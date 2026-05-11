// Road-bearing detection: given a (lat, lng) anchor, query Overpass for the
// nearest motorized highway way, find the geometry segment closest to the
// anchor, and return the bearing of that segment along with the snapped
// nearest point on the road.
//
// TS port of ``detect_road_bearing`` in ``src/rules/site_detection.py`` —
// same Overpass query (``out geom tags``), same haversine + bearing math —
// extended to also project the anchor onto the matching segment so the
// frontend can snap a draggable pin to the road centerline.

import { NextRequest } from "next/server";

const MAX_BODY_BYTES = 256;
const RATE_LIMIT_PER_MIN = 30;
const SEARCH_RADIUS_M = 30;
const SNAP_MAX_DISTANCE_M = 100;

const OVERPASS_MIRRORS: readonly string[] = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 6000;
const OVERPASS_USER_AGENT =
  "conestruct-traffic-control-tool/0.2 (+https://conestruct.com)";

const buckets = new Map<string, { count: number; reset: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const cur = buckets.get(ip);
  if (!cur || cur.reset < now) {
    buckets.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (cur.count >= RATE_LIMIT_PER_MIN) return false;
  cur.count++;
  return true;
}

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

interface OverpassResponse {
  elements?: Array<OverpassWay | { type: string }>;
}

function buildQuery(lat: number, lng: number, radiusM: number): string {
  // Mirror ``_build_road_at_query``: pull motorized highway ways with
  // geometry so we can compute bearings from the actual segment nodes.
  return `[out:json][timeout:10];(way(around:${radiusM.toFixed(0)},${lat},${lng})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];);out geom tags;`;
}

async function overpassQuery(
  lat: number,
  lng: number,
  signal: AbortSignal | undefined,
): Promise<OverpassResponse | null> {
  const data = buildQuery(lat, lng, SEARCH_RADIUS_M);
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

// Project (lat, lng) onto the segment a→b using a local equirectangular
// approximation. At ~30 m scales the distortion is well below the snap
// tolerance, and we sidestep needing geodesy for a small projection.
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

interface BearingResult {
  bearing: number | null;
  way_id: string | null;
  highway_class: string | null;
  snapped_lat: number | null;
  snapped_lng: number | null;
}

function emptyResult(): BearingResult {
  return {
    bearing: null,
    way_id: null,
    highway_class: null,
    snapped_lat: null,
    snapped_lng: null,
  };
}

function detect(
  payload: OverpassResponse | null,
  lat: number,
  lng: number,
): BearingResult {
  const ways: OverpassWay[] =
    payload?.elements?.filter(
      (el): el is OverpassWay =>
        el.type === "way" &&
        Array.isArray((el as OverpassWay).geometry) &&
        ((el as OverpassWay).geometry?.length ?? 0) >= 2,
    ) ?? [];
  if (ways.length === 0) return emptyResult();

  let bestWay: OverpassWay | null = null;
  let bestA: OverpassNode | null = null;
  let bestB: OverpassNode | null = null;
  let bestProj: { lat: number; lng: number; distM: number } | null = null;
  let bestDistance = Infinity;

  for (const way of ways) {
    const geom = way.geometry ?? [];
    for (let i = 0; i < geom.length - 1; i++) {
      const a = geom[i];
      const b = geom[i + 1];
      const proj = projectOnSegment(lat, lng, a.lat, a.lon, b.lat, b.lon);
      if (proj.distM < bestDistance) {
        bestDistance = proj.distM;
        bestWay = way;
        bestA = a;
        bestB = b;
        bestProj = proj;
      }
    }
  }

  if (!bestWay || !bestA || !bestB || !bestProj) return emptyResult();
  if (bestDistance > SNAP_MAX_DISTANCE_M) return emptyResult();

  const bearing = bearingDeg(bestA.lat, bestA.lon, bestB.lat, bestB.lon);
  return {
    bearing: Math.round(bearing * 100) / 100,
    way_id: String(bestWay.id),
    highway_class: bestWay.tags?.highway ?? null,
    snapped_lat: bestProj.lat,
    snapped_lng: bestProj.lng,
  };
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!rateLimit(ip)) {
    return new Response("Too many requests", { status: 429 });
  }

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

  return Response.json(detect(payload, lat, lng));
}
