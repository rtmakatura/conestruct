/**
 * #305 — which Overpass ways the picker's road lookup may read, and how.
 *
 * The TypeScript twin of #304 (a) and (d) in `src/rules/site_detection.py`.
 * A mirror can list a node it can't resolve as `null` inside a way's
 * geometry (seen: overpass.openstreetmap.fr, way 42125193, a street in
 * Pavlodar, Kazakhstan, returned for an `around:` query in Denver).
 *
 * (a) A point without numeric `lat`/`lon` is not a point, so a segment
 *     touching one is not a segment.  Geometry is read as the runs of
 *     consecutive real points; nothing ever bridges a gap.
 * (d) A way whose extent doesn't meet its query's `around:` circle is not an
 *     answer to that query, and is dropped.  The extent is the way's
 *     `bounds` (Overpass sends them with `out geom`), else the box of its
 *     real points.  Exact: no margin.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

interface Bounds {
  minlat: number;
  minlon: number;
  maxlat: number;
  maxlon: number;
}

export interface WayLike {
  geometry?: unknown[];
  bounds?: Partial<Bounds>;
}

const M_PER_DEG_LAT = 111_320;

/** A geometry point with numeric `lat` and `lon`. */
export function hasCoords(p: unknown): p is GeoPoint {
  if (p === null || typeof p !== "object") return false;
  const { lat, lon } = p as Record<string, unknown>;
  return typeof lat === "number" && typeof lon === "number";
}

/** The runs of consecutive real points, each at least two long. */
export function validRuns(geometry: unknown[] | undefined): GeoPoint[][] {
  const runs: GeoPoint[][] = [];
  let run: GeoPoint[] = [];
  for (const p of geometry ?? []) {
    if (hasCoords(p)) {
      run.push(p);
    } else {
      if (run.length >= 2) runs.push(run);
      run = [];
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

/** The way's extent meets the box of the `around:radiusM` circle at (lat, lng). */
export function wayMeetsCircle(way: WayLike, lat: number, lng: number, radiusM: number): boolean {
  const b = way.bounds;
  let s: number, w: number, n: number, e: number;
  if (
    b &&
    typeof b.minlat === "number" &&
    typeof b.minlon === "number" &&
    typeof b.maxlat === "number" &&
    typeof b.maxlon === "number"
  ) {
    [s, w, n, e] = [b.minlat, b.minlon, b.maxlat, b.maxlon];
  } else {
    const pts = (way.geometry ?? []).filter(hasCoords);
    if (pts.length === 0) return false;
    s = Math.min(...pts.map((p) => p.lat));
    n = Math.max(...pts.map((p) => p.lat));
    w = Math.min(...pts.map((p) => p.lon));
    e = Math.max(...pts.map((p) => p.lon));
  }
  const dLat = radiusM / M_PER_DEG_LAT;
  const dLng = radiusM / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return !(n < lat - dLat || s > lat + dLat || e < lng - dLng || w > lng + dLng);
}

/**
 * The ways an `around:radiusM` query at (lat, lng) may use: those that meet
 * the circle and keep at least one run of two real points.  The counts say
 * what was set aside (for tests; nothing reaches the wire).
 */
export function usableWays<W extends WayLike>(
  ways: W[],
  lat: number,
  lng: number,
  radiusM: number,
): { ways: W[]; dropped: number; pointsSkipped: number } {
  const kept: W[] = [];
  let pointsSkipped = 0;
  for (const way of ways) {
    if (!wayMeetsCircle(way, lat, lng, radiusM)) continue;
    pointsSkipped += (way.geometry ?? []).filter((p) => !hasCoords(p)).length;
    if (validRuns(way.geometry).length > 0) kept.push(way);
  }
  return { ways: kept, dropped: ways.length - kept.length, pointsSkipped };
}
