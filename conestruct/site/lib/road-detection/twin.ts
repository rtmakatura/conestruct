/**
 * #308 — the twin evidence for a one-way candidate: metres from its snapped
 * point to the nearest way with the SAME name (or ref, when it has no
 * name), tagged one-way, whose travel runs the opposite direction.
 *
 * A divided road's other carriageway is exactly that; a paired one-way
 * street (Broadway / Lincoln) has a different name a block away.  This is
 * a raw measured fact, relayed to the backend, which owns the verdict
 * (src/rules/carriageway.py, ruling R83; the relay-fact pattern).  The pool
 * is the same-name ways the route already fetched to stitch the centerline
 * (`extendCandidateGeometry`), so measuring costs no extra request.
 */
import { validRuns, type GeoPoint } from "./usable-ways";

/** Travel bearings this far apart or more run opposite ways. */
const OPPOSITE_MIN_DEG = 150;
const ONE_WAY_TAGS = new Set(["yes", "-1"]);

export interface TwinCandidate {
  way_id: string;
  name: string | null;
  ref: string | null;
  /** Bearing of the snap segment, in the way's vertex order. */
  bearing: number;
  snapped_lat: number;
  snapped_lng: number;
  tags: { oneway: string | null };
}

export interface TwinPoolWay {
  id: number | string;
  tags?: Record<string, string | undefined>;
  geometry?: unknown[];
}

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Travel bearing: vertex order, reversed for `oneway=-1`. */
function travel(bearing: number, oneway: string | null | undefined): number {
  return oneway === "-1" ? (bearing + 180) % 360 : bearing;
}

function angleBetween(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return d;
}

/** Distance (m) from p to segment a→b and the segment's bearing, on a local
 *  equirectangular frame (well inside the tolerance at these scales). */
function segment(
  pLat: number,
  pLng: number,
  a: GeoPoint,
  b: GeoPoint,
): { distM: number; bearing: number } {
  const mLat = 111_320;
  const mLng = 111_320 * Math.cos(toRad(pLat));
  const ax = (a.lon - pLng) * mLng;
  const ay = (a.lat - pLat) * mLat;
  const bx = (b.lon - pLng) * mLng;
  const by = (b.lat - pLat) * mLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return { distM: Math.hypot(cx, cy), bearing };
}

export function nearestOppositeTwinM(
  candidate: TwinCandidate,
  pool: TwinPoolWay[],
): number | null {
  const own = travel(candidate.bearing, candidate.tags.oneway);
  let best: number | null = null;
  for (const w of pool) {
    if (String(w.id) === candidate.way_id) continue;
    const tags = w.tags ?? {};
    const sameRoad = candidate.name
      ? tags.name === candidate.name
      : !tags.name && candidate.ref !== null && tags.ref === candidate.ref;
    if (!sameRoad || !ONE_WAY_TAGS.has(tags.oneway ?? "")) continue;
    // Nearest segment of this way to the snapped point, over real points only.
    let nearest: { distM: number; bearing: number } | null = null;
    for (const run of validRuns(w.geometry)) {
      for (let i = 0; i < run.length - 1; i++) {
        const s = segment(candidate.snapped_lat, candidate.snapped_lng, run[i], run[i + 1]);
        if (nearest === null || s.distM < nearest.distM) nearest = s;
      }
    }
    if (nearest === null) continue;
    if (angleBetween(own, travel(nearest.bearing, tags.oneway)) < OPPOSITE_MIN_DEG) continue;
    if (best === null || nearest.distM < best) best = nearest.distM;
  }
  return best === null ? null : Math.round(best * 100) / 100;
}
