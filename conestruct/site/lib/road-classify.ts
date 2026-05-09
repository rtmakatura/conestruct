// Server-side road classification using Mapbox Tilequery on streets-v8.
// Reads MAPBOX_TOKEN from env so the token never reaches the browser.
//
// Two queries: a tight one against the `road` layer to find the closest
// segment, and a wider one against `place_label` to detect whether we're
// inside or adjacent to a populated place (urban vs rural). Returns a
// RoadClassification with a confidence flag so the UI can warn the operator
// when the detection is borderline.

import type { RoadType } from "./scenarios";

export type Confidence = "high" | "medium" | "low";

// Per-field detection metadata.  Surfaces, alongside the value itself,
// where the value came from and how trustworthy that source is, so the
// UI can ask the operator to confirm a low-confidence pick before it
// flows into the plan.
export interface DetectedField<T> {
  value: T;
  confidence: Confidence;
  // Human-readable label of the source (e.g., ``"OSM maxspeed tag"``,
  // ``"highway-class fallback"``).  Shown verbatim in the verification
  // UI.
  source: string;
  // Raw evidence backing the value (e.g., ``"maxspeed=55 mph"``).
  // Optional because some inferred values have no underlying tag — the
  // raw class label is still in ``raw.class``.
  rawData?: string;
}

export interface RoadClassification {
  roadType: RoadType;
  divided: boolean;
  laneWidthFt: number;
  // Both come from OpenStreetMap tags on the closest way (Overpass).
  // OSM coverage is uneven, so each is optional — undefined means
  // "the tag wasn't on the way" or "Overpass was unreachable", and the
  // operator is expected to fill manually.
  lanesPerDirection?: number;
  speedLimitMph?: number;
  confidence: Confidence;
  source: "mapbox-tilequery";
  raw: {
    class: string;
    oneway: boolean;
    structure: string | null; // "bridge" | "tunnel" | null
    roadName: string | null;
    roadRef: string | null; // route number (e.g. "US 85")
    place: string | null; // OSM place class — city/town/etc.
    placeName: string | null;
    osmLanesTag: string | null; // raw OSM `lanes` value, for the source panel
    osmMaxspeedTag: string | null; // raw OSM `maxspeed` value
  };
  // Per-field confidence, source, and raw-evidence — populated for
  // every field even when the top-level value falls back to a default
  // (so the UI always has something to show in its verification rows).
  // Kept as a sibling of the flat fields so existing readers continue
  // to work; a follow-up can collapse the duplication once all
  // consumers migrate.
  fields: {
    speed: DetectedField<number | null>;
    lanes: DetectedField<number | null>;
    roadType: DetectedField<RoadType>;
    divided: DetectedField<boolean>;
  };
}

export type ClassifyResult =
  | { ok: true; result: RoadClassification }
  | { ok: false; status: number; reason: string };

interface MapboxFeature {
  properties?: Record<string, unknown>;
  tilequery?: { distance?: number; layer?: string };
}

interface TilequeryResponse {
  features?: MapboxFeature[];
}

const STREETS_TILESET = "mapbox.mapbox-streets-v8";

// Public Overpass mirrors, tried in order on 5xx / connection error.
// The official endpoint regularly returns 504 under load; community
// mirrors are more reliable for occasional one-off queries like ours.
const OVERPASS_MIRRORS: readonly string[] = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
// Per-mirror timeout in ms.  Tight bound because we run inside a Vercel
// serverless function; the Mapbox classify already burned some of our
// budget before we get here.
const OVERPASS_TIMEOUT_MS = 6000;
const OVERPASS_USER_AGENT =
  "conestruct-traffic-control-tool/0.2 (+https://conestruct.com)";

// Treat these OSM `place=*` classes as "urban" for road-type assignment.
const URBAN_PLACE_CLASSES = new Set([
  "city",
  "town",
  "suburb",
  "neighbourhood",
]);

async function tilequery(
  layers: string,
  lat: number,
  lng: number,
  radius: number,
  signal: AbortSignal | undefined,
  token: string,
): Promise<TilequeryResponse | null> {
  const url =
    `https://api.mapbox.com/v4/${STREETS_TILESET}/tilequery/` +
    `${lng},${lat}.json?radius=${radius}&limit=10&dedupe=true` +
    `&layers=${encodeURIComponent(layers)}&access_token=${encodeURIComponent(token)}`;
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    return (await r.json()) as TilequeryResponse;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return null;
  }
}

function pickClosestRoad(resp: TilequeryResponse | null): MapboxFeature | null {
  if (!resp?.features?.length) return null;
  // The tilequery response is already ordered by distance ascending, but a
  // few low-relevance footways/paths can sit closer than the actual road —
  // skip them in favor of a real driveable class.
  const driveable = new Set([
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "street",
    "street_limited",
    "service",
  ]);
  for (const f of resp.features) {
    const cls = String(f.properties?.class ?? "");
    if (driveable.has(cls)) return f;
  }
  return resp.features[0] ?? null;
}

function pickClosestPlace(resp: TilequeryResponse | null): MapboxFeature | null {
  if (!resp?.features?.length) return null;
  const knownPlaces = new Set([
    "city",
    "town",
    "village",
    "hamlet",
    "suburb",
    "neighbourhood",
  ]);
  for (const f of resp.features) {
    const cls = String(f.properties?.class ?? "");
    if (knownPlaces.has(cls)) return f;
  }
  return null;
}

function pickClosestRoadLabel(
  resp: TilequeryResponse | null,
  withinM: number,
): MapboxFeature | null {
  if (!resp?.features?.length) return null;
  let best: MapboxFeature | null = null;
  let bestDist = Infinity;
  for (const f of resp.features) {
    if (f.tilequery?.layer !== "road_label") continue;
    const d = f.tilequery?.distance ?? Infinity;
    if (d < bestDist && d <= withinM) {
      best = f;
      bestDist = d;
    }
  }
  return best;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

interface OsmWayTags {
  lanes?: string;
  "lanes:forward"?: string;
  "lanes:backward"?: string;
  oneway?: string;
  maxspeed?: string;
  highway?: string;
}

interface OverpassResponse {
  elements?: Array<{
    type?: string;
    tags?: OsmWayTags;
  }>;
}

const DRIVEABLE_HIGHWAY_TAGS = new Set([
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link",
  "unclassified",
  "residential",
]);

function buildOverpassQuery(lat: number, lng: number): string {
  // Tight 25 m radius — we want the way the user is on, not a
  // neighbouring road.  Restrict to driveable highway tags so we
  // don't accidentally pick up a footway/cycleway running parallel.
  return `[out:json][timeout:5];way(around:25,${lat},${lng})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)(_link)?$"];out tags;`;
}

async function overpassQuery(
  lat: number,
  lng: number,
  signal: AbortSignal | undefined,
): Promise<OverpassResponse | null> {
  const data = buildOverpassQuery(lat, lng);
  for (const url of OVERPASS_MIRRORS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
    // Compose the caller's signal with our own timeout, so an upstream
    // abort still tears the request down.
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": OVERPASS_USER_AGENT,
        },
        body: `data=${encodeURIComponent(data)}`,
        signal: controller.signal,
      });
      if (r.status >= 400 && r.status < 500) {
        // Query-side error — the next mirror won't help.
        return null;
      }
      if (!r.ok) {
        continue; // 5xx — try the next mirror.
      }
      return (await r.json()) as OverpassResponse;
    } catch (err) {
      if ((err as Error).name === "AbortError" && signal?.aborted) {
        // Caller cancelled — propagate.
        throw err;
      }
      // Timeout or network error — try the next mirror.
      continue;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  return null;
}

function parseMaxspeedToMph(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  // Sentinel values OSM uses for "no speed limit" or "varies"; we can't
  // turn these into a number, so leave them out.
  if (trimmed === "none" || trimmed === "signals" || trimmed === "variable") {
    return null;
  }
  const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*(mph|kmh|km\/h|kph)?$/);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = m[2];
  // OSM convention: bare number is km/h *globally*, but in the US the
  // overwhelming majority of `maxspeed` tags are filed as "55 mph" or
  // bare numbers meant as mph (a known mis-convention).  We assume mph
  // when no unit is given because our tool is US-only; we'll still
  // honor an explicit km/h suffix for the rare correctly-tagged way.
  if (unit === "kmh" || unit === "km/h" || unit === "kph") {
    return Math.round(value * 0.621371);
  }
  return Math.round(value);
}

function pickClosestDriveableTags(
  resp: OverpassResponse | null,
): OsmWayTags | null {
  if (!resp?.elements?.length) return null;
  for (const el of resp.elements) {
    if (el.type !== "way") continue;
    const tags = el.tags ?? {};
    if (!tags.highway || !DRIVEABLE_HIGHWAY_TAGS.has(tags.highway)) continue;
    return tags;
  }
  return null;
}

function lanesPerDirectionFromTags(tags: OsmWayTags): number | undefined {
  // OSM convention: `lanes` is the total number of traffic lanes on the
  // way.  Each carriageway of a divided highway is its own one-way way
  // tagged `oneway=yes`, so `lanes` already equals lanes-per-direction
  // there.  An undivided two-way road shares lanes both ways, so we
  // halve unless `lanes:forward` is set explicitly.
  const fwd = parseLaneNumber(tags["lanes:forward"]);
  if (fwd !== null) return fwd;
  const total = parseLaneNumber(tags.lanes);
  if (total === null) return undefined;
  const isOneway = tags.oneway === "yes" || tags.oneway === "-1";
  if (isOneway) return total;
  // Two-way road: split.  Floor handles the rare 3-lane (one direction
  // has a centre turn lane) case more conservatively than ceil would.
  return Math.max(1, Math.floor(total / 2));
}

function parseLaneNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

async function enrichWithOsmTags(
  lat: number,
  lng: number,
  signal: AbortSignal | undefined,
): Promise<{
  lanesPerDirection?: number;
  speedLimitMph?: number;
  osmLanesTag: string | null;
  osmMaxspeedTag: string | null;
}> {
  let resp: OverpassResponse | null = null;
  try {
    resp = await overpassQuery(lat, lng, signal);
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    resp = null;
  }
  const tags = pickClosestDriveableTags(resp);
  if (!tags) {
    return { osmLanesTag: null, osmMaxspeedTag: null };
  }
  return {
    lanesPerDirection: lanesPerDirectionFromTags(tags),
    speedLimitMph: parseMaxspeedToMph(tags.maxspeed) ?? undefined,
    osmLanesTag: tags.lanes ?? tags["lanes:forward"] ?? null,
    osmMaxspeedTag: tags.maxspeed ?? null,
  };
}

// Highway-class → fallback posted speed (mph).  Used only when OSM
// has no ``maxspeed`` tag; the result is always reported as low
// confidence so the operator sees the warning and verifies.
const SPEED_BY_CLASS: Record<string, number> = {
  motorway: 65,
  motorway_link: 45,
  trunk: 55,
  trunk_link: 45,
  primary: 45,
  primary_link: 35,
  secondary: 40,
  secondary_link: 30,
  tertiary: 35,
  tertiary_link: 30,
  street: 30,
  street_limited: 25,
  service: 15,
  residential: 25,
};

// Highway-class → fallback lanes-per-direction.  Same rationale.
const LANES_BY_CLASS: Record<string, number> = {
  motorway: 2,
  motorway_link: 1,
  trunk: 2,
  trunk_link: 1,
  primary: 2,
  primary_link: 1,
  secondary: 1,
  secondary_link: 1,
  tertiary: 1,
  tertiary_link: 1,
  street: 1,
  street_limited: 1,
  service: 1,
  residential: 1,
};

function classify(
  road: MapboxFeature,
  place: MapboxFeature | null,
  roadLabel: MapboxFeature | null,
): RoadClassification {
  const cls = String(road.properties?.class ?? "");
  const oneway = road.properties?.oneway === 1 || road.properties?.oneway === true;
  const structure = strOrNull(road.properties?.structure);
  const placeClass = place ? String(place.properties?.class ?? "") : null;
  const placeName = place ? strOrNull(place.properties?.name) : null;
  const roadName = roadLabel ? strOrNull(roadLabel.properties?.name) : null;
  const roadRef = roadLabel ? strOrNull(roadLabel.properties?.ref) : null;
  const isUrban = placeClass !== null && URBAN_PLACE_CLASSES.has(placeClass);

  let roadType: RoadType;
  let divided: boolean;
  let confidence: Confidence;

  if (cls === "motorway" || cls === "motorway_link") {
    roadType = "freeway";
    divided = true;
    confidence = "high";
  } else if (cls === "trunk" || cls === "trunk_link") {
    // Trunks (US/state primary routes) are typically multi-lane divided.
    roadType = isUrban ? "urban_arterial" : "rural_divided";
    divided = true;
    confidence = "medium";
  } else if (cls === "primary" || cls === "primary_link") {
    if (oneway) {
      // One-way primary in either direction implies a couplet → divided.
      roadType = isUrban ? "urban_arterial" : "rural_divided";
      divided = true;
      confidence = "medium";
    } else {
      roadType = isUrban ? "urban_arterial" : "rural_undivided";
      divided = false;
      confidence = "medium";
    }
  } else if (cls === "secondary" || cls === "secondary_link") {
    roadType = isUrban ? "urban_arterial" : "rural_undivided";
    divided = false;
    confidence = "medium";
  } else if (
    cls === "tertiary" ||
    cls === "tertiary_link" ||
    cls === "street" ||
    cls === "street_limited"
  ) {
    roadType = isUrban ? "urban_arterial" : "rural_undivided";
    divided = false;
    confidence = "low";
  } else {
    // service, residential, path, etc. — uncommon TC sites; fall back low.
    roadType = isUrban ? "urban_arterial" : "rural_undivided";
    divided = false;
    confidence = "low";
  }

  // Default per-field metadata.  These describe what the *classifier*
  // alone derived from Mapbox tile data, before any OSM enrichment.
  // ``classifyRoadAtPoint`` upgrades the speed and lanes entries when
  // an OSM ``maxspeed`` / ``lanes`` tag is found.
  const speedFallback = SPEED_BY_CLASS[cls] ?? null;
  const lanesFallback = LANES_BY_CLASS[cls] ?? null;

  // Road-type / divided confidence reuses the same rule as the
  // top-level confidence: motorway is unambiguous, trunk/primary is
  // medium, anything below is low.
  const fieldRoadTypeConf: Confidence =
    cls === "motorway" || cls === "motorway_link"
      ? "high"
      : cls === "trunk" || cls === "trunk_link" || cls.startsWith("primary")
        ? "medium"
        : "low";
  const fieldDividedConf: Confidence =
    cls === "motorway" || cls === "motorway_link"
      ? "high"
      : cls === "trunk" || cls === "trunk_link" || (cls.startsWith("primary") && oneway)
        ? "medium"
        : "low";

  return {
    roadType,
    divided,
    laneWidthFt: 12,
    confidence,
    source: "mapbox-tilequery",
    raw: {
      class: cls,
      oneway,
      structure,
      roadName,
      roadRef,
      place: placeClass,
      placeName,
      osmLanesTag: null,
      osmMaxspeedTag: null,
    },
    fields: {
      speed: {
        value: speedFallback,
        confidence: "low",
        source: speedFallback !== null
          ? `highway-class fallback ("${cls}")`
          : "no fallback for this class",
        rawData: speedFallback !== null ? `class=${cls}` : undefined,
      },
      lanes: {
        value: lanesFallback,
        confidence: "low",
        source: lanesFallback !== null
          ? `highway-class fallback ("${cls}")`
          : "no fallback for this class",
        rawData: lanesFallback !== null ? `class=${cls}` : undefined,
      },
      roadType: {
        value: roadType,
        confidence: fieldRoadTypeConf,
        source:
          fieldRoadTypeConf === "high"
            ? `Mapbox class=${cls} (motorway → freeway)`
            : `Mapbox class=${cls} + place=${placeClass ?? "unknown"} (inferred)`,
        rawData: `class=${cls}, place=${placeClass ?? "—"}, oneway=${oneway}`,
      },
      divided: {
        value: divided,
        confidence: fieldDividedConf,
        source:
          fieldDividedConf === "high"
            ? `Mapbox class=${cls} (always divided)`
            : oneway
              ? `Mapbox oneway=yes (couplet → divided)`
              : `inferred from class=${cls}`,
        rawData: `class=${cls}, oneway=${oneway}`,
      },
    },
  };
}

export async function classifyRoadAtPoint(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ClassifyResult> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return { ok: false, status: 503, reason: "MAPBOX_TOKEN not configured" };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, status: 400, reason: "invalid coords" };
  }

  // Run all three lookups in parallel — Mapbox road + place + Overpass
  // OSM tags are independent.  Worst-case latency caps at the slowest
  // single call (Overpass at OVERPASS_TIMEOUT_MS).  Best-effort: if the
  // OSM query fails, the lanes/speed fields just stay undefined.
  const [roadResp, placeResp, osm] = await Promise.all([
    tilequery("road,road_label", lat, lng, 30, signal, token),
    tilequery("place_label", lat, lng, 3000, signal, token),
    enrichWithOsmTags(lat, lng, signal),
  ]);

  const road = pickClosestRoad(roadResp);
  if (!road) {
    return { ok: false, status: 404, reason: "no road found near point" };
  }
  const place = pickClosestPlace(placeResp);
  const roadLabel = pickClosestRoadLabel(roadResp, 25);
  const result = classify(road, place, roadLabel);

  if (osm.lanesPerDirection !== undefined) {
    result.lanesPerDirection = osm.lanesPerDirection;
  }
  if (osm.speedLimitMph !== undefined) {
    result.speedLimitMph = osm.speedLimitMph;
  }
  result.raw.osmLanesTag = osm.osmLanesTag;
  result.raw.osmMaxspeedTag = osm.osmMaxspeedTag;

  // Upgrade per-field metadata with OSM evidence when present.
  if (osm.osmMaxspeedTag !== null && osm.speedLimitMph !== undefined) {
    result.fields.speed = {
      value: osm.speedLimitMph,
      confidence: "high",
      source: "OSM maxspeed tag",
      rawData: `maxspeed=${osm.osmMaxspeedTag}`,
    };
  } else if (osm.osmMaxspeedTag !== null) {
    // Tag present but un-parseable (signals/none/variable).  Treat as
    // medium — we have evidence the road is signed, just not a number.
    result.fields.speed = {
      ...result.fields.speed,
      confidence: "medium",
      source: "OSM maxspeed tag (un-parseable)",
      rawData: `maxspeed=${osm.osmMaxspeedTag}`,
    };
  }

  if (osm.osmLanesTag !== null && osm.lanesPerDirection !== undefined) {
    // High confidence only when the directional split is explicit;
    // otherwise medium (we halved a generic ``lanes`` tag).
    const splitExplicit = osm.osmLanesTag.includes(":") ||
      osm.osmLanesTag !== String(osm.lanesPerDirection * 2);
    result.fields.lanes = {
      value: osm.lanesPerDirection,
      confidence: splitExplicit ? "high" : "medium",
      source: splitExplicit
        ? "OSM lanes:forward tag"
        : "OSM lanes tag (no directional split)",
      rawData: `lanes=${osm.osmLanesTag}`,
    };
  }

  return { ok: true, result };
}
