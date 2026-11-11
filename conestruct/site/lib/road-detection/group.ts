/**
 * #507 ruling 2: one list entry per street.  The road list's server
 * producer (`app/api/road-bearing/route.ts`) calls this; the picker only
 * renders what it gets (R145-1, validation-artifacts/committed/missions/
 * ux-group8-map-window/rulings.md).
 *
 * The grouping rule (R145-2): two candidates are one street's two
 * carriageways when they have the same name (or the same ref when
 * unnamed), the same OSM class, both are tagged one-way, and their
 * travel directions are at least `OPPOSITE_MIN_DEG` apart (the #308 twin
 * rule's threshold).  Both sit within the 30 m snap of the pin, so each
 * is inside the other's 100 m twin radius: the backend's R83 verdict for
 * either is "divided".  The nearer one leads and carries the other as
 * `twin`; the list keeps the lead's place.  Anything else is untouched:
 * a true one-way street (no opposite same-name way), a divided road with
 * one carriageway in reach, and every two-way road.
 */
import { OPPOSITE_MIN_DEG } from "./twin";
import type { RoadCandidate } from "./types";

const ONE_WAY_TAGS = new Set(["yes", "-1"]);

/** Travel bearing: vertex order, reversed for `oneway=-1`. */
function travel(c: RoadCandidate): number {
  return c.tags.oneway === "-1" ? (c.bearing + 180) % 360 : c.bearing;
}

function apart(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

function sameStreet(a: RoadCandidate, b: RoadCandidate): boolean {
  const named = a.name !== null ? a.name === b.name : b.name === null && a.ref !== null && a.ref === b.ref;
  return (
    named &&
    a.highway_class === b.highway_class &&
    ONE_WAY_TAGS.has(a.tags.oneway ?? "") &&
    ONE_WAY_TAGS.has(b.tags.oneway ?? "") &&
    apart(travel(a), travel(b)) >= OPPOSITE_MIN_DEG
  );
}

/** Groups opposite carriageways; `candidates` must be sorted nearest first. */
export function groupCarriageways(candidates: RoadCandidate[]): RoadCandidate[] {
  const out: RoadCandidate[] = [];
  const taken = new Set<number>();
  candidates.forEach((c, i) => {
    if (taken.has(i)) return;
    const j = candidates.findIndex((o, k) => k > i && !taken.has(k) && sameStreet(c, o));
    if (j < 0) {
      out.push(c);
      return;
    }
    taken.add(j);
    out.push({ ...c, twin: candidates[j] });
  });
  return out;
}
