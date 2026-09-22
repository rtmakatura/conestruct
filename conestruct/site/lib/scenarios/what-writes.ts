// #289 Phase 2 — the three WHAT-grid writes that are more than a set.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// (a) "every path that wrote meta through the strip editors, withPin, or
// the corrections helpers becomes a band re-open, and a mounted test
// proves 'only APPLY writes' by exercising each" · #281 Part 1 §8.22.
//
// WHY THESE THREE ARE NOT INLINE IN THE COMPONENT.  Each carries
// bookkeeping that exists because a measured defect made it necessary —
// the #136 single-lane refusal's recovery, #177's disputed-override
// record, #112's silent manual supersede, #85's divided single-sourcing,
// the work-zone speed clamp.  When the same logic lived inside three
// per-kind form components it was three copies, and the grid replacing
// them would have been a fourth.  It is one function per write, here,
// with the comment that says why each clause is there.
//
// Everything below is carried VERBATIM from the form it came from, with
// the file and line it was at on e60c91c.  Nothing is re-reasoned.
//
// Rule 3: none of this computes a compliance value.  It writes scenario
// fields and clears relays; the backend re-validates every render call.

import {
  appendDetectionOverride,
  lanesArithmeticMismatch,
} from "./auto-apply";
import { applyRoadTypeOverride, dividedForShoulderRoadType } from "./overrides";
import type { DetectionOverride, RoadType, Scenario } from "./types";

/** The lane relays and the override log, as the kinds that carry them
 *  declare them.  Naming exactly the fields these writers touch keeps a
 *  kind that grows one later a compile error rather than a silent
 *  no-op. */
type LaneRelayFields = {
  detectedLanesTotal?: number;
  detectedLanesForward?: number;
  detectedLanesBackward?: number;
  detectedLanesBothWays?: number;
  detectionOverrides?: DetectionOverride[];
};

/**
 * Posted speed.
 *
 * Carried from `ShoulderForm.tsx:103-117`: clamp the work-zone speed if it
 * would meet or exceed the new posted.  Equal-to-posted means "no
 * reduction" — drop to undefined.  Only the shoulder kind carries the
 * field, so the `in` guard makes this a no-op elsewhere rather than a
 * per-kind branch.
 */
export function setSpeed(scenario: Scenario, mph: number): Scenario {
  if (
    "workZoneSpeed" in scenario &&
    scenario.workZoneSpeed !== undefined &&
    scenario.workZoneSpeed >= mph
  ) {
    return { ...scenario, speed: mph, workZoneSpeed: undefined } as Scenario;
  }
  return { ...scenario, speed: mph } as Scenario;
}

/**
 * Road type.
 *
 * Two things at once, and both were already written down:
 *
 *  · the per-kind NARROWING, from `applyRoadTypeOverride` (overrides.ts:69)
 *    — a kind that cannot represent the chosen type keeps its own, which
 *    is the picker's path and now the grid's, so the two cannot disagree;
 *  · the shoulder's DIVIDED single-sourcing, from `ShoulderForm.tsx:54-63`
 *    (#85): "roadType drives `divided` so the two can't disagree. Set both
 *    in one update; urban_arterial keeps the explicit toggle, preserving
 *    its current value here.  When divided-ness flips, lanes resets to the
 *    road-class default (2 per direction divided, 1 undivided — the
 *    classic 2-lane road); the picker's auto-apply sets lanes in the same
 *    patch as roadType, so a detected value is never clobbered by this
 *    reset."
 */
export function setRoadType(scenario: Scenario, rt: RoadType): Scenario {
  const narrowed = applyRoadTypeOverride(scenario, rt);
  if (narrowed.kind !== "shoulder") return narrowed;
  const nextDivided = dividedForShoulderRoadType(
    narrowed.roadType,
    narrowed.divided,
  );
  return {
    ...narrowed,
    divided: nextDivided,
    ...(nextDivided !== narrowed.divided ? { lanes: nextDivided ? 2 : 1 } : {}),
  };
}

/**
 * Lanes per direction.
 *
 * Carried from `ShoulderForm.tsx:136-172`.  Editing the count is the
 * operator correcting detection, so the relayed signals clear — which
 * lifts the #136 single-lane block and the #120 caution.
 *
 * Disputed-only override record (#177): the erased relays were driving
 * the #136 refusal (total === 1), the #120 caution, or the #173
 * signal-proximity refusal (both arithmetic mismatch — the edit is the
 * recovery affordance for that gate; the signal-distance fact itself
 * stays, and alone it never blocks).  An ordinary edit over consistent
 * relays is the manual-supersede convention (#112) and stays silent.
 *
 * `near_intersection` wrote this as a plain `set("lanes", v)`
 * (NearIntersectionForm.tsx:270) and therefore never cleared its relays.
 * That difference is DELIBERATE and preserved: the near-intersection lane
 * relays live on the approach legs, not on the mainline, and clearing a
 * mainline relay the kind does not carry would be bookkeeping about
 * nothing.  `via` still names the shoulder edit because that is the
 * marker's recorded vocabulary and renaming it would break the audit's
 * reprint.
 */
export function setLanes(scenario: Scenario, n: number): Scenario {
  const s = scenario as Scenario & LaneRelayFields;
  if (scenario.kind !== "shoulder") {
    return { ...s, lanes: n } as Scenario;
  }
  const disputed =
    s.detectedLanesTotal === 1 ||
    lanesArithmeticMismatch(
      s.detectedLanesTotal,
      s.detectedLanesForward,
      s.detectedLanesBackward,
      s.detectedLanesBothWays,
    );
  return {
    ...s,
    lanes: n,
    // Editing the count takes ownership of it: clear the #136
    // single-lane relay and the #120 per-direction relays together,
    // lifting the block and the caution.
    detectedLanesTotal: undefined,
    detectedLanesForward: undefined,
    detectedLanesBackward: undefined,
    detectedLanesBothWays: undefined,
    detectionOverrides: disputed
      ? appendDetectionOverride(s.detectionOverrides, {
          via: "shoulder_lane_edit",
          detectedLanesTotal: s.detectedLanesTotal,
          detectedLanesForward: s.detectedLanesForward,
          detectedLanesBackward: s.detectedLanesBackward,
          detectedLanesBothWays: s.detectedLanesBothWays,
          asserted: `${n} lane${n === 1 ? "" : "s"} per direction`,
        })
      : s.detectionOverrides,
  } as Scenario;
}
