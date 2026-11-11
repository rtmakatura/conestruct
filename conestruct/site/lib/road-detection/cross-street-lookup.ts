// #440 X4 — the cross-street lookup, one producer for its two callers: the
// picker's cross-street click (LocationPickerModal `placeCrossPin`) and the
// WHERE band's tap on its aerial.  It is the picker's own sequence, moved
// here verbatim: POST /api/road-bearing at the point → the #213
// `scan_status` guard → `deriveCrossStreet`.
//
// Authority: validation-artifacts/committed/ux-group4-cross-street/
// rulings.md, ruling 3 ("one producer: reuse its handler and wire field;
// no second path") and X4.

import type { IntersectionRecord } from "../scenarios/types";
import { deriveCrossStreet, type CrossStreetCandidate } from "./cross-street";
import { GEOMETRY_MAX_NODES } from "./stitch";
import type { RoadCandidate, RoadDetectResponse } from "./types";

/** A candidate's raw OSM bearing, normalised to 0–359.  (#290: never a
 *  typed direction any more — the cross-street parallel filter reads it.) */
export function normaliseBearing(n: number): number {
  const r = ((Math.round(n) % 360) + 360) % 360;
  return r;
}

/** The lookup's answer: a named candidate, no cross street at the point
 *  (the picker's "none"), or a lookup that did not answer (its "error"). */
export type CrossStreetLookup =
  | { kind: "detected"; candidate: CrossStreetCandidate }
  | { kind: "none" }
  | { kind: "error" };

export async function lookupCrossStreet(
  point: { lat: number; lng: number },
  mainline: Pick<RoadCandidate, "way_id" | "name" | "bearing"> | null,
  signal?: AbortSignal,
): Promise<CrossStreetLookup> {
  try {
    const r = await fetch("/api/road-bearing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lat: point.lat, lng: point.lng }),
      ...(signal ? { signal } : {}),
    });
    if (!r.ok) return { kind: "error" };
    const j = (await r.json()) as RoadDetectResponse;
    if (j.scan_status === "unavailable") {
      // #213: same guard as the mainline path — an unavailable scan
      // is the error state, never a derived "no cross street" (and
      // never deriveCrossStreet's isUrban-driven rural default).
      return { kind: "error" };
    }
    // #290: raw facts only — the cross street's name, legs, signal,
    // speed and lanes.  Where it sits relative to the work is the
    // backend's to measure from the marked pin (ruling 7).
    const derived = deriveCrossStreet({
      detection: j,
      mainlineWayId: mainline?.way_id ?? null,
      mainlineName: mainline?.name ?? null,
      mainlineBearingDeg: mainline ? normaliseBearing(mainline.bearing) : null,
    });
    return derived ? { kind: "detected", candidate: derived } : { kind: "none" };
  } catch {
    return { kind: "error" };
  }
}

/** `meta.intersection` for a freshly looked-up crossing (#234, #316): the
 *  point, the cross street's name, class and posted speed — the record the
 *  picker's Save has always written.  #493: plus the cross street's line
 *  when the lookup kept one, so the NEEDS YOU map reads no second time;
 *  a record with no line is byte-identical to before.  A line longer than
 *  GEOMETRY_MAX_NODES (an own-way line the stitch didn't trim) is left out,
 *  not cut here: the map then looks the street up (Rule 3; the backend
 *  drops one too, so a plan is never refused for it). */
export function intersectionRecord(
  point: { lat: number; lng: number },
  cs: CrossStreetCandidate | null,
): IntersectionRecord {
  const geometry = cs?.geometry;
  return {
    lat: point.lat,
    lng: point.lng,
    name: cs?.name ?? null,
    highwayClass: cs?.highwayClass ?? null,
    postedSpeedMph: cs?.speedMph ?? null,
    ...(geometry && geometry.length >= 2 && geometry.length <= GEOMETRY_MAX_NODES
      ? { geometry }
      : {}),
  };
}
