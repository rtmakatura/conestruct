// Unified road detection: given a (lat, lng) anchor, query Overpass for
// motorized highway ways AND nearby place nodes in a single round trip,
// project the anchor onto each candidate way, deduplicate same-road
// segments by (name||ref, highway_class, bearing-octant), and return
// per-candidate OSM tags plus pin-level urban/place context so the
// client can synthesize a full RoadClassification at candidate-pick
// time without a second API call.
//
// This route replaced the previous bearing-only behaviour AND the
// /api/road-classify Mapbox-tilequery path on 2026-05-29.  Treating
// road detection as one pipeline (one Overpass query, one response,
// one operator-pick choice) was the structural fix for the
// candidate-list inaccuracy and the related state-inconsistency bug
// where the property panel and bearing field could disagree.

import { NextRequest } from "next/server";
import { dedupCandidates } from "@/lib/road-detection/dedup";
import type {
  RoadCandidate,
  RoadDetectResponse,
} from "@/lib/road-detection/types";
import { rateLimitOr429 } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 256;
// Overpass search radius for ways.  Wider than SNAP_MAX_DISTANCE_M so
// the per-way projection step has options to consider.
const SEARCH_RADIUS_M = 50;
// Hard snap tolerance.  30 m (~100 ft) is tight enough that a pin on
// one carriageway of a divided highway won't include the opposite
// carriageway, while still wide enough to forgive normal click
// imprecision on undivided roads.
const SNAP_MAX_DISTANCE_M = 30;
// Place-node search radius.  Used to decide isUrban for road-type
// classification — matches the Mapbox-tilequery `place_label` radius
// that the previous /api/road-classify used (3000 m).
const PLACE_RADIUS_M = 3000;

// Treat these OSM `place=*` classes as "urban" for road-type assignment.
const URBAN_PLACE_CLASSES: ReadonlySet<string> = new Set([
  "city",
  "town",
  "suburb",
  "neighbourhood",
]);

const OVERPASS_MIRRORS: readonly string[] = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 6000;
const OVERPASS_USER_AGENT =
  "conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)";

interface OverpassNode {
  lat: number;
  lon: number;
}

interface OverpassWay {
  type: "way";
  id: number;
  geometry?: OverpassNode[];
  tags?: Record<string, string>;
}

interface OverpassPlace {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

type OverpassElement =
  | OverpassWay
  | OverpassPlace
  | { type: string; [k: string]: unknown };

interface OverpassResponse {
  elements?: OverpassElement[];
}

function buildQuery(lat: number, lng: number): string {
  // Single round-trip union: motorized ways within SEARCH_RADIUS_M +
  // urban place nodes within PLACE_RADIUS_M.  `out geom tags;` returns
  // way geometry for snap projection and full tag sets for downstream
  // classification.
  return (
    `[out:json][timeout:10];` +
    `(way(around:${SEARCH_RADIUS_M.toFixed(0)},${lat},${lng})` +
    `["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];` +
    `node(around:${PLACE_RADIUS_M.toFixed(0)},${lat},${lng})` +
    `["place"~"^(city|town|suburb|neighbourhood|village|hamlet)$"];` +
    // Signal nodes near the pin: the `signalized` default for
    // cross-street approaches (near_intersection #117).  Same radius
    // as the way search so a pin on the intersection sees its signals.
    `node(around:${SEARCH_RADIUS_M.toFixed(0)},${lat},${lng})` +
    `["highway"="traffic_signals"];` +
    `);out geom tags;`
  );
}

async function overpassQuery(
  lat: number,
  lng: number,
  signal: AbortSignal | undefined,
): Promise<OverpassResponse | null> {
  const data = buildQuery(lat, lng);
  for (const url of OVERPASS_MIRRORS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
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
      if (r.status >= 400 && r.status < 500) return null;
      if (!r.ok) continue;
      return (await r.json()) as OverpassResponse;
    } catch (err) {
      if ((err as Error).name === "AbortError" && signal?.aborted) throw err;
      continue;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  return null;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371008.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLambda = toRad(lng2 - lng1);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Local equirectangular projection of (pLat, pLng) onto segment a→b.
// At ~30 m scales the distortion is well below the snap tolerance, so
// we sidestep geodesy for a small projection.
function projectOnSegment(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): { lat: number; lng: number; distM: number } {
  const lat0 = toRad((aLat + bLat) / 2);
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(lat0);
  const ax = aLng * mPerDegLng;
  const ay = aLat * mPerDegLat;
  const bx = bLng * mPerDegLng;
  const by = bLat * mPerDegLat;
  const px = pLng * mPerDegLng;
  const py = pLat * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  const sx = ax + t * dx;
  const sy = ay + t * dy;
  const sLng = sx / mPerDegLng;
  const sLat = sy / mPerDegLat;
  const distM = haversineM(pLat, pLng, sLat, sLng);
  return { lat: sLat, lng: sLng, distM };
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// Pick the closest urban place node from the Overpass response.  The
// presence of any urban-class place within PLACE_RADIUS_M means
// `isUrban=true` for classification purposes; we additionally surface
// the closest place's name for display.
function pickClosestPlace(
  elements: OverpassElement[],
  lat: number,
  lng: number,
): OverpassPlace | null {
  let best: OverpassPlace | null = null;
  let bestDist = Infinity;
  for (const el of elements) {
    if (el.type !== "node") continue;
    const node = el as OverpassPlace;
    const placeClass = node.tags?.place;
    if (!placeClass) continue;
    if (typeof node.lat !== "number" || typeof node.lon !== "number") continue;
    const d = haversineM(lat, lng, node.lat, node.lon);
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best;
}

function emptyResponse(isUrban: boolean, placeName: string | null): RoadDetectResponse {
  return { candidates: [], primary_index: null, isUrban, placeName };
}

function buildResponse(
  payload: OverpassResponse | null,
  lat: number,
  lng: number,
): RoadDetectResponse {
  const elements = payload?.elements ?? [];

  // Resolve pin-level place context once for the whole response.
  // isUrban is the gate that flips trunk/primary/secondary/tertiary
  // toward urban_arterial vs rural_* in classifyFromOsmTags.
  const place = pickClosestPlace(elements, lat, lng);
  const isUrban = place !== null && URBAN_PLACE_CLASSES.has(place.tags?.place ?? "");
  const placeName = place ? strOrNull(place.tags?.name) : null;

  // Signal nodes (highway=traffic_signals) from the same round trip.
  // Kept as bare coordinates; each candidate records its distance to
  // the nearest one below.
  const signalNodes: Array<{ lat: number; lon: number }> = [];
  for (const el of elements) {
    if (el.type !== "node") continue;
    const node = el as OverpassPlace;
    if (node.tags?.highway !== "traffic_signals") continue;
    if (typeof node.lat !== "number" || typeof node.lon !== "number") continue;
    signalNodes.push({ lat: node.lat, lon: node.lon });
  }

  const ways: OverpassWay[] = elements.filter(
    (el): el is OverpassWay =>
      el.type === "way" &&
      Array.isArray((el as OverpassWay).geometry) &&
      ((el as OverpassWay).geometry?.length ?? 0) >= 2,
  );
  if (ways.length === 0) return emptyResponse(isUrban, placeName);

  const candidates: RoadCandidate[] = [];
  for (const way of ways) {
    const geom = way.geometry ?? [];
    let bestA: OverpassNode | null = null;
    let bestB: OverpassNode | null = null;
    let bestProj: { lat: number; lng: number; distM: number } | null = null;
    let bestDistance = Infinity;
    for (let i = 0; i < geom.length - 1; i++) {
      const a = geom[i];
      const b = geom[i + 1];
      const proj = projectOnSegment(lat, lng, a.lat, a.lon, b.lat, b.lon);
      if (proj.distM < bestDistance) {
        bestDistance = proj.distM;
        bestA = a;
        bestB = b;
        bestProj = proj;
      }
    }
    if (!bestA || !bestB || !bestProj) continue;
    if (bestDistance > SNAP_MAX_DISTANCE_M) continue;

    const tags = way.tags ?? {};
    const brg = bearingDeg(bestA.lat, bestA.lon, bestB.lat, bestB.lon);
    let signalDistM: number | null = null;
    for (const s of signalNodes) {
      const d = haversineM(bestProj.lat, bestProj.lng, s.lat, s.lon);
      if (signalDistM === null || d < signalDistM) signalDistM = d;
    }
    candidates.push({
      way_id: String(way.id),
      highway_class: tags.highway ?? "unclassified",
      name: strOrNull(tags.name),
      ref: strOrNull(tags.ref),
      bearing: Math.round(brg * 100) / 100,
      snap_distance_m: Math.round(bestDistance * 100) / 100,
      snapped_lat: bestProj.lat,
      snapped_lng: bestProj.lng,
      tags: {
        oneway: strOrNull(tags.oneway),
        maxspeed: strOrNull(tags.maxspeed),
        lanes: strOrNull(tags.lanes),
        lanes_forward: strOrNull(tags["lanes:forward"]),
        lanes_backward: strOrNull(tags["lanes:backward"]),
        turn_lanes: strOrNull(tags["turn:lanes"]),
        turn_lanes_forward: strOrNull(tags["turn:lanes:forward"]),
        turn_lanes_backward: strOrNull(tags["turn:lanes:backward"]),
      },
      signal_distance_m:
        signalDistM === null ? null : Math.round(signalDistM * 100) / 100,
    });
  }

  if (candidates.length === 0) return emptyResponse(isUrban, placeName);

  // Dedup clusters same-road segment duplicates (the dominant noise
  // source in raw Overpass output), then sort what remains by snap
  // distance so primary_index points at the geometrically nearest
  // *logical road*.
  const deduped = dedupCandidates(candidates).sort(
    (a, b) => a.snap_distance_m - b.snap_distance_m,
  );

  return {
    candidates: deduped,
    primary_index: 0,
    isUrban,
    placeName,
  };
}

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "road-bearing", 30);
  if (over) return over;

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { lat, lng } = (body as { lat?: unknown; lng?: unknown }) ?? {};
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return new Response("Invalid coords", { status: 400 });
  }

  let payload: OverpassResponse | null = null;
  try {
    payload = await overpassQuery(lat, lng, req.signal);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return new Response("Aborted", { status: 499 });
    }
    payload = null;
  }

  return Response.json(buildResponse(payload, lat, lng));
}
