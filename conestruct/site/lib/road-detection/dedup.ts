import type { RoadCandidate } from "./types";

// 8-way compass bin centred on each cardinal/intercardinal direction
// (45° each).  Used as the direction component of the dedup key —
// 180°-opposed carriageways always fall in opposite octants because
// 180° rotation is well past the 45° bin width, so divided same-name
// roads stay distinct without needing the OSM `oneway` tag (which is
// inconsistently applied in real data — see scripts/test_dedup_couplet.mjs).
export function bearingOctant(deg: number): string {
  const n = ((deg % 360) + 360) % 360;
  if (n < 22.5 || n >= 337.5) return "N";
  if (n < 67.5) return "NE";
  if (n < 112.5) return "E";
  if (n < 157.5) return "SE";
  if (n < 202.5) return "S";
  if (n < 247.5) return "SW";
  if (n < 292.5) return "W";
  return "NW";
}

// Cluster candidates by (name||ref, highway_class, bearing-octant) and
// keep the geometrically nearest way per cluster.  `oneway` is
// intentionally NOT in the key: real OSM data has consecutive same-road
// segments where some have `oneway=yes` and adjacent ones have the tag
// missing (e.g., Welton St in downtown Denver).  Including `oneway`
// would split them into two picker entries for what is one road.  The
// bearing octant already captures direction unambiguously.
export function dedupCandidates(candidates: RoadCandidate[]): RoadCandidate[] {
  const sorted = [...candidates].sort(
    (a, b) => a.snap_distance_m - b.snap_distance_m,
  );
  const seen = new Map<string, RoadCandidate>();
  for (const c of sorted) {
    const nameKey = c.name ?? c.ref ?? "__unnamed__";
    const key = `${nameKey}|${c.highway_class}|${bearingOctant(c.bearing)}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()];
}
