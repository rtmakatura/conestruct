// Server-only Mapbox geocoding. Reads MAPBOX_TOKEN from env so the token
// is never exposed to the browser. Mirrors the Streamlit ``_geocode_address``
// helper (v5 places API, limit=1).
//
// #347: a cross-street pair ("Colfax & Williams, Denver") takes its own
// path.  Mapbox v5 finds intersections only from the bare street pair:
// a trailing ", Denver" turns it into a search for a street named Denver
// (Schuyler, NE ranked first).  So the city is resolved on its own, the
// pair is searched inside that city's box, and only a result Mapbox flags
// ``properties.accuracy: "intersection"`` is accepted (v5 types it
// "address" like any street address).  No flagged hit ⇒ the area itself
// comes back as a coarse match: never a far-off street address presented
// as the corner (Rule 10).  With no city typed and no jurisdiction
// selected, the area is all of our TIGER places together, and no flagged
// hit inside it answers 422: "Add a city to search cross streets."
// #352: a selected jurisdiction with no TIGER place searches its
// authority's extent (cdot: Colorado, held to the same 422 rule).
// #376 (R1, reverses #347 ruling 2): a typed city resolves only inside
// Colorado.  One that names a place elsewhere answers 422 "outside
// colorado"; a partial match inside Colorado answers 404 "check spelling".
// Every corner must lie inside Colorado, whatever the area.

import {
  areaForKey,
  areaForName,
  bboxCenter,
  COLORADO_BBOX,
  COMBINED_BBOX,
  type BBox,
} from "@/lib/jurisdiction-areas";

export type GeocodeResult =
  | { ok: true; lat: number; lng: number; placeType: string | null }
  | { ok: false; status: number; reason: string };

export interface GeocodeOptions {
  /** The form's selected jurisdiction; scopes a cross-street pair typed
   *  with no city.  A key with no TIGER place uses its authority's
   *  extent (#352); one with none (e470) is ignored. */
  jurisdictionKey?: string | null;
}

interface MapboxContext {
  id?: string;
  text?: string;
  short_code?: string;
}

interface MapboxFeature {
  id?: string;
  text?: string;
  center?: [number, number];
  place_type?: string[];
  bbox?: BBox;
  /** The house number, when the hit carries one. */
  address?: string;
  context?: MapboxContext[];
  properties?: { accuracy?: string; short_code?: string };
  /** 1 when every word of the query matched. */
  relevance?: number;
}

type Fetched =
  | { ok: true; features: MapboxFeature[] }
  | { ok: false; status: number; reason: string };

// "&", "@", "and", "at" between two street names.
const CROSS_SPLIT = /\s*(?:&|@|\band\b|\bat\b)\s*/i;
const COLORADO = /^(co|colorado)(\s+\d{5}(-\d{4})?)?$/i;

export interface CrossStreetQuery {
  streets: string;
  city: string | null;
}

/** The street pair and the typed city, or null when `q` is not a
 *  cross-street pair.  Exported for the tests. */
export function parseCrossStreets(q: string): CrossStreetQuery | null {
  const [head, ...tail] = q.split(",").map((s) => s.trim());
  const parts = head.split(CROSS_SPLIT);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const rest = tail.filter(Boolean);
  return { streets: head, city: rest.length ? rest.join(", ") : null };
}

async function mapbox(
  query: string,
  params: string,
  token: string,
  signal?: AbortSignal,
): Promise<Fetched> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query,
  )}.json?access_token=${encodeURIComponent(token)}${params}`;
  let upstream: Response;
  try {
    upstream = await fetch(url, { signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { ok: false, status: 499, reason: "aborted" };
    }
    return { ok: false, status: 502, reason: "mapbox unreachable" };
  }
  if (!upstream.ok) {
    return { ok: false, status: 502, reason: `mapbox ${upstream.status}` };
  }
  const payload = (await upstream.json()) as { features?: MapboxFeature[] };
  return { ok: true, features: payload.features ?? [] };
}

interface SearchBox {
  bbox: BBox | null;
  center: [number, number];
  /** Too wide to recenter on: all TIGER places together (no city typed,
   *  no jurisdiction) or a whole state (#352, cdot).  The corner must lie
   *  inside `bbox`; a miss answers 422. */
  strict?: true;
}

/** The box and center to search a street pair in. */
async function searchArea(
  cross: CrossStreetQuery,
  opts: GeocodeOptions,
  token: string,
  signal?: AbortSignal,
): Promise<
  | { ok: true; area: SearchBox }
  | { ok: false; status: number; reason: string }
> {
  if (cross.city === null) {
    const a = areaForKey(opts.jurisdictionKey);
    if (a) {
      const area: SearchBox = { bbox: a.bbox, center: bboxCenter(a.bbox) };
      return { ok: true, area: a.statewide ? { ...area, strict: true } : area };
    }
    return {
      ok: true,
      area: { bbox: COMBINED_BBOX, center: bboxCenter(COMBINED_BBOX), strict: true },
    };
  }
  // A typed city that is one of our TIGER places, with no state or with
  // Colorado, uses that polygon's box: Mapbox alone ranks Lakewood and
  // Englewood, New Jersey first.
  const [name, ...state] = cross.city.split(",").map((s) => s.trim());
  const known = areaForName(name);
  if (known && (state.length === 0 || COLORADO.test(state.join(" ")))) {
    return { ok: true, area: { bbox: known.bbox, center: bboxCenter(known.bbox) } };
  }
  // #376: Mapbox reads "Lafayette, CO" as California; the state is
  // spelled out, and the lookup is held to Colorado.
  const city = state.length && COLORADO.test(state.join(" ")) ? `${name}, Colorado` : cross.city;
  const params = "&types=place,locality&limit=1";
  const r = await mapbox(city, `${params}&bbox=${COLORADO_BBOX.join(",")}`, token, signal);
  if (!r.ok) return r;
  const place = located(r.features[0]);
  if (place && place.relevance === 1 && inside(place.center, COLORADO_BBOX)) {
    // A place with no extent still scopes by nearness to its center.
    return { ok: true, area: { bbox: place.bbox ?? null, center: place.center } };
  }
  // Not a full match in Colorado: Mapbox's best answer anywhere tells a
  // place elsewhere ("Aurora, IL") from a misspelling.
  const any = await mapbox(city, params, token, signal);
  if (!any.ok) return any;
  const best = located(any.features[0]);
  if (best && !inside(best.center, COLORADO_BBOX) && (best.relevance === 1 || !place)) {
    return { ok: false, status: 422, reason: "outside colorado" };
  }
  if (place) return { ok: false, status: 404, reason: "check spelling" };
  return { ok: false, status: 404, reason: "no match" };
}

function located(
  f: MapboxFeature | undefined,
): (MapboxFeature & { center: [number, number] }) | null {
  return f?.center?.length === 2 ? (f as MapboxFeature & { center: [number, number] }) : null;
}

function inside([lng, lat]: [number, number], b: BBox): boolean {
  return b[0] <= lng && lng <= b[2] && b[1] <= lat && lat <= b[3];
}

async function geocodeCrossStreets(
  cross: CrossStreetQuery,
  opts: GeocodeOptions,
  token: string,
  signal?: AbortSignal,
): Promise<GeocodeResult> {
  const scoped = await searchArea(cross, opts, token, signal);
  if (!scoped.ok) return scoped;
  const area = scoped.area;
  const scope = `${area.bbox ? `&bbox=${area.bbox.join(",")}` : ""}&proximity=${area.center.join(",")}`;
  const r = await mapbox(cross.streets, `&types=address&limit=5${scope}`, token, signal);
  if (!r.ok) return r;
  const hit = r.features.find(
    (f) =>
      f.properties?.accuracy === "intersection" &&
      f.center?.length === 2 &&
      // #376: never a corner outside Colorado, whatever the area.
      inside(f.center, COLORADO_BBOX) &&
      // A strict area must hold the corner, not just rank it.
      (!area.strict || (area.bbox !== null && inside(f.center, area.bbox))),
  );
  if (hit?.center) {
    const [lng, lat] = hit.center;
    return { ok: true, lat, lng, placeType: "intersection" };
  }
  if (area.strict) {
    return { ok: false, status: 422, reason: "add a city" };
  }
  // The corner was not found inside the area: hand back the area as a
  // coarse match, so the picker recenters and asks for a pin.
  const [lng, lat] = area.center;
  return { ok: true, lat, lng, placeType: "place" };
}

export async function geocodeAddress(
  address: string,
  signal?: AbortSignal,
  opts: GeocodeOptions = {},
): Promise<GeocodeResult> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return { ok: false, status: 503, reason: "MAPBOX_TOKEN not configured" };
  }

  const trimmed = address.trim();
  if (!trimmed) {
    return { ok: false, status: 400, reason: "empty address" };
  }

  const cross = parseCrossStreets(trimmed);
  if (cross) return geocodeCrossStreets(cross, opts, token, signal);

  const plain = await geocodePlain(trimmed, token, signal);
  if (!plain.ok) return plain;
  const [lng, lat] = plain.feature.center;
  // Mapbox's precision class for the match ("address", "place",
  // "locality", …).  Surfaced so the client can tell a street-level hit
  // from a whole-town centroid — road detection at a town centroid
  // produces a confidently wrong road (lib/geocode-precision.ts).
  const placeType = plain.feature.place_type?.[0] ?? null;
  return { ok: true, lat, lng, placeType };
}

// #384 (R1 Ryan): a plain address resolves only inside Colorado.  The
// boxed answer stands when every word matched, or when it lies in a city
// the operator typed and carries the house number they typed.  422
// "outside colorado" only when the text names another state or nothing
// in Colorado came back; any other partial match answers 404 "check
// address".
async function geocodePlain(
  text: string,
  token: string,
  signal?: AbortSignal,
): Promise<
  | { ok: true; feature: MapboxFeature & { center: [number, number] } }
  | { ok: false; status: number; reason: string }
> {
  // Mapbox reads a trailing "CO" as any state; spelled out, it stays.
  const segs = text.split(",").map((s) => s.trim());
  const last = segs[segs.length - 1];
  const endsColorado = segs.length > 1 && COLORADO.test(last);
  if (endsColorado) segs[segs.length - 1] = last.replace(/^(co|colorado)/i, "Colorado");
  const query = segs.join(", ");
  const r = await mapbox(query, `&limit=1&bbox=${COLORADO_BBOX.join(",")}`, token, signal);
  if (!r.ok) return r;
  const boxed = located(r.features[0]);
  // Inside the box Mapbox fully matches "Lafayette, LA" to a Leadville
  // street, so a full match stands at once only with no other place last.
  const full = boxed?.relevance === 1;
  if (full && (segs.length === 1 || endsColorado)) return { ok: true, feature: boxed };
  // Mapbox's best answer anywhere tells another state named from a
  // match here.
  const any = await mapbox(query, "&limit=1", token, signal);
  if (!any.ok) return any;
  const best = located(any.features[0]);
  const elsewhere = best && !inside(best.center, COLORADO_BBOX) ? best : null;
  if (elsewhere && (!boxed || namesState(segs, elsewhere))) {
    return { ok: false, status: 422, reason: "outside colorado" };
  }
  if (!boxed) return { ok: false, status: 404, reason: "no match" };
  if (full) return { ok: true, feature: boxed };
  if (inTypedCity(text, boxed) && (!/^\d/.test(text) || boxed.address)) {
    return { ok: true, feature: boxed };
  }
  return { ok: false, status: 404, reason: "check address" };
}

function contextOf(f: MapboxFeature, kind: string): { text?: string; short_code?: string } | null {
  if (f.id?.startsWith(`${kind}.`)) return { text: f.text, short_code: f.properties?.short_code };
  return f.context?.find((c) => c.id?.startsWith(`${kind}.`)) ?? null;
}

/** The last comma part, zip dropped, is the answer's state by name or
 *  postal code ("New York, NY", "Lafayette, LA"). */
function namesState(segs: string[], f: MapboxFeature): boolean {
  if (segs.length < 2) return false;
  const region = contextOf(f, "region");
  const typed = segs[segs.length - 1].replace(/\s+\d{5}(-\d{4})?$/, "").toLowerCase();
  return (
    !!region &&
    (typed === region.text?.toLowerCase() ||
      typed === region.short_code?.replace(/^us-/i, "").toLowerCase())
  );
}

function inTypedCity(text: string, f: MapboxFeature): boolean {
  const city = contextOf(f, "place")?.text;
  if (!city) return false;
  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}
