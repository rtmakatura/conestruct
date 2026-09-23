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
import { isFieldStaged } from "./site-corrections";
import type {
  DetectionOverride,
  RoadType,
  Scenario,
  StagedCorrection,
} from "./types";

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

/**
 * The work dates — ONE write for one control.
 *
 * #289 hand-check, 2026-09-23: "Work dates is one control in the WHAT
 * grid — the Single day / Date range / Not set buttons write the same
 * field as the date input; keep one, drop the duplicate."
 *
 * They did.  The grid's cell wrote `work_date` (stamping `date_mode:
 * "single"` as it went) and the second group's cell wrote `work_date`
 * again behind three chips that wrote `date_mode` — two controls and a
 * mode selector for one answer, which is exactly the two-writers defect
 * this arc keeps removing.
 *
 * The dates are now the control and the MODE IS DERIVED from them, which
 * is also the honest reading of #199: a schedule nobody entered is "Not
 * set" because there is no date, not because a chip says so.  No date →
 * `tbd`; a start and an end → `range`; a start alone → `single`.  The
 * times are a separate question and keep their own cells.
 */
export function setWorkDates(
  scenario: Scenario,
  dates: { start?: string; end?: string },
): Scenario {
  const prior = scenario.schedule ?? null;
  const start = "start" in dates ? dates.start || undefined : prior?.work_date;
  const end = "end" in dates ? dates.end || undefined : prior?.work_date_end;
  // An end with no start is not a range anybody can act on, and the
  // backend reads the pair — so the end only counts while a start
  // stands.  Rule 10: what is not set is not sent.
  const keptEnd = start ? end : undefined;
  const date_mode = !start ? "tbd" : keptEnd ? "range" : "single";
  return {
    ...scenario,
    schedule: {
      ...(prior ?? {}),
      date_mode,
      work_date: start,
      work_date_end: keptEnd,
    },
  } as Scenario;
}

/**
 * #289 Phase 2, S7 — APPLY's field half.
 *
 * Ruling e: "APPLY folds staged fields and corrections into one write."
 * The corrections half is `applyStaged` (site-corrections.ts), which
 * folds meta; this folds the SCENARIO, through the same writers the
 * grid's cells use — so a staged speed still drags the work-zone
 * reduction with it, a staged road type still single-sources `divided`
 * (#85), and a staged lane count still clears the relays and records the
 * #177 override.  A staged edit that wrote the field directly would be a
 * fourth copy of that bookkeeping, which is the defect this module was
 * built to end.
 */
export function applyStagedFields(
  scenario: Scenario,
  staged: readonly StagedCorrection[],
): Scenario {
  let next = scenario;
  for (const s of staged) {
    if (!isFieldStaged(s)) continue;
    switch (s.field) {
      case "speed":
        next = setSpeed(next, Number(s.to));
        break;
      case "lanes":
        next = setLanes(next, Number(s.to));
        break;
      case "roadType":
        next = setRoadType(next, s.to as RoadType);
        break;
      case "laneWidth":
        next = { ...next, laneWidth: Number(s.to) } as Scenario;
        break;
      case "jurisdiction_key":
        next = {
          ...next,
          jurisdiction_key: (s.to as string) || null,
        } as Scenario;
        break;
    }
  }
  return next;
}

/**
 * Ruling 191's sentence: "the staged sentence enumerating what is staged
 * ('1 field · 2 corrections') so one Apply is known to carry both."
 *
 * Counted from the one list, so the sentence cannot disagree with what
 * APPLY will write.  A half that is empty is not named — "0 corrections"
 * would be a clause about nothing (rule 10).
 */
export function stagedEnumeration(staged: readonly StagedCorrection[]): string {
  const fields = staged.filter(isFieldStaged).length;
  const corrections = staged.length - fields;
  const parts: string[] = [];
  if (fields > 0) parts.push(`${fields} field${fields === 1 ? "" : "s"}`);
  if (corrections > 0) {
    parts.push(`${corrections} correction${corrections === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}
