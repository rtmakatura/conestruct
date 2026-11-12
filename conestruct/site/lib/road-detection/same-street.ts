/**
 * #525 (Ryan, 2026-11-11, docs/prompts/cc-prompt-ux-group7b-guesses-hours.md
 * item 2): "the backend groups every way with the same name that connects
 * or runs along the same line into one entry, at the distance of its
 * nearest way (Rule 3).  When the pin is at an intersection with that
 * street, the line under it adds 'at <cross street>'."
 *
 * The road list's server producer (`app/api/road-bearing/route.ts`) calls
 * both functions here; the picker renders what it gets (group 8's R145-1).
 * Rulings: validation-artifacts/committed/missions/ux-group7b-guesses-hours/
 * issue-525/rulings.md (R145-1..9).
 *
 * `dedupCandidates` keys pieces by bearing octant, so a street drawn in
 * pieces with opposite vertex order (Pennsylvania Street at Colfax: way
 * 812978772 runs north to south, the rest south to north) listed twice.
 * `mergeSameStreet` folds such pieces into the nearest one.  Two opposite
 * one-way carriageways never fold here: `groupCarriageways` pairs them
 * after this step (#507), so a divided road keeps its one grouped entry.
 */
import { PARALLEL_TOLERANCE_DEG } from "./cross-street";
import { STITCH_HEADING_TOL_DEG } from "./stitch";
import type { RoadCandidate } from "./types";

// CHOSEN (non-safety; it only decides which rows the list shows), R145-6:
// how far the other piece may sit off the lead piece's line and still run
// "along the same line".  Above the digitising offset measured between
// Pennsylvania's pieces at #525's pin, under half the narrowest
// carriageway gap measured there (East Colfax, 6.6 m), so a divided road
// tagged two-way on both halves still lists two rows.
export const SAME_LINE_OFFSET_M = 3;

// R145-8: a crossing counts when the two streets share a node this close
// to the pin.  Reused: the route's snap limit and the backend's
// CROSS_STREET_RADIUS_M (src/rules/site_detection.py).
export const CROSSING_RADIUS_M = 30;

const ONE_WAY_TAGS = new Set(["yes", "-1"]);
const TWO_WAY_TAGS = new Set(["", "no"]);
// R145-11 (gate round 1 finding 5): OSM implies one-way on these classes, so
// an untagged one never reads as two-way here.  A mirror of the backend's
// IMPLIED_ONE_WAY_CLASSES (src/rules/corridor.py, `travel_reading`), which
// stays authoritative for the words; #514 is the open issue for untagged
// motorways.  Known limit: a roundabout (`junction=roundabout`, also
// implied one-way) isn't caught, because the route doesn't relay `junction`.
const IMPLIED_ONE_WAY_CLASSES = new Set(["motorway", "motorway_link"]);

/** The street's name, or its ref when unnamed; null when it has neither. */
function streetKey(c: RoadCandidate): string | null {
  if (c.name !== null) return `name:${c.name}`;
  return c.ref !== null ? `ref:${c.ref}` : null;
}

/** R145-2 (group 8): same name (or ref when unnamed) and same OSM class. */
function sameStreet(a: RoadCandidate, b: RoadCandidate): boolean {
  const key = streetKey(a);
  return key !== null && key === streetKey(b) && a.highway_class === b.highway_class;
}

function readsTwoWay(c: RoadCandidate): boolean {
  const o = c.tags.oneway ?? "";
  if (o === "" && IMPLIED_ONE_WAY_CLASSES.has(c.highway_class)) return false;
  return TWO_WAY_TAGS.has(o);
}

function angleBetween(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

function axisGap(a: number, b: number): number {
  const d = angleBetween(a, b);
  return Math.min(d, 180 - d);
}

/** Travel bearing: vertex order, reversed for `oneway=-1`. */
function travel(c: RoadCandidate): number {
  return c.tags.oneway === "-1" ? (c.bearing + 180) % 360 : c.bearing;
}

/** R145-3/R145-4: the two pieces' travel reads the same, so one entry's
 *  words hold for both.  Two opposite carriageways never qualify. */
function sameTravel(a: RoadCandidate, b: RoadCandidate): boolean {
  const oa = a.tags.oneway ?? "";
  const ob = b.tags.oneway ?? "";
  if (readsTwoWay(a) && readsTwoWay(b)) return true;
  if (ONE_WAY_TAGS.has(oa) && ONE_WAY_TAGS.has(ob)) {
    return angleBetween(travel(a), travel(b)) <= STITCH_HEADING_TOL_DEG;
  }
  return false;
}

function vertexKey(p: [number, number]): string {
  return `${p[0]},${p[1]}`;
}

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371008.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Metres from `b`'s snapped point to the line through `a`'s snapped point
 *  at `a`'s bearing (local equirectangular frame). */
function offsetFromLine(a: RoadCandidate, b: RoadCandidate): number {
  const mLat = 111_320;
  const mLng = 111_320 * Math.cos(toRad(a.snapped_lat));
  const dx = (b.snapped_lng - a.snapped_lng) * mLng;
  const dy = (b.snapped_lat - a.snapped_lat) * mLat;
  const ux = Math.sin(toRad(a.bearing));
  const uy = Math.cos(toRad(a.bearing));
  return Math.abs(dx * uy - dy * ux);
}

/** R145-6: the axes within the parallel tolerance, and `b` on `a`'s line. */
function alongSameLine(a: RoadCandidate, b: RoadCandidate): boolean {
  return axisGap(a.bearing, b.bearing) <= PARALLEL_TOLERANCE_DEG && offsetFromLine(a, b) <= SAME_LINE_OFFSET_M;
}

/**
 * Folds every entry of `kept` (sorted nearest first) into an earlier entry
 * of the same street when the two connect or run along the same line and
 * their travel reads the same (R145-2..7).  "Connect" counts through any
 * chain of `raw` same-street pieces sharing a node (R145-5).  The earlier
 * entry is unchanged, so the entry keeps its nearest way's distance.
 */
export function mergeSameStreet(raw: RoadCandidate[], kept: RoadCandidate[]): RoadCandidate[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let r = id;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r) as string;
    return r;
  };
  const byVertex = new Map<string, RoadCandidate[]>();
  for (const c of raw) {
    parent.set(c.way_id, c.way_id);
    if (streetKey(c) === null) continue;
    for (const p of c.geometry ?? []) {
      const k = vertexKey(p);
      const at = byVertex.get(k) ?? [];
      for (const o of at) {
        if (sameStreet(o, c) && sameTravel(o, c)) parent.set(find(c.way_id), find(o.way_id));
      }
      at.push(c);
      byVertex.set(k, at);
    }
  }
  const out: RoadCandidate[] = [];
  for (const c of kept) {
    const lead = out.find(
      (l) => sameStreet(l, c) && sameTravel(l, c) && (find(l.way_id) === find(c.way_id) || alongSameLine(l, c)),
    );
    if (!lead) out.push(c);
  }
  return out;
}

/**
 * R145-8: each entry's cross street, the nearest other listed street that
 * shares a node with it within `CROSSING_RADIUS_M` of the pin and is not
 * within the parallel tolerance of it.  Named streets only (Rule 10).
 * Sets `cross_street` only where one is found; reads `raw`'s own-way
 * geometry, so it runs before the centerline is stitched.
 */
export function attachCrossStreets(
  raw: RoadCandidate[],
  entries: RoadCandidate[],
  pinLat: number,
  pinLng: number,
): void {
  const near = new Map<string, Set<string>>();
  for (const c of raw) {
    const key = streetKey(c);
    if (key === null) continue;
    const set = near.get(key) ?? new Set<string>();
    for (const p of c.geometry ?? []) {
      if (haversineM(pinLat, pinLng, p[0], p[1]) <= CROSSING_RADIUS_M) set.add(vertexKey(p));
    }
    near.set(key, set);
  }
  for (const e of entries) {
    const own = near.get(streetKey(e) ?? "");
    if (!own || own.size === 0) continue;
    const cross = entries.find((o) => {
      const key = streetKey(o);
      if (key === null || key === streetKey(e)) return false;
      if (axisGap(o.bearing, e.bearing) <= PARALLEL_TOLERANCE_DEG) return false;
      for (const v of near.get(key) ?? []) if (own.has(v)) return true;
      return false;
    });
    if (cross) e.cross_street = cross.name ?? cross.ref;
  }
}
