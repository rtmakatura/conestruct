// #440 X4 — the cross-street apply, one producer for the picker's Save
// (GeneratorSidebar `onPickerSave`) and the WHERE band's tap.  Moved out of
// `onPickerSave` verbatim: the approaches from the candidate, the approach
// speed no longer the operator's (#316), the recorded overrides dropped
// (#177), the lane-count hold (#174 option d), all behind the fresh-content
// guard (#112's clobber class: an unchanged candidate is not new
// information and must not overwrite approach fields edited since).
//
// Pure: the caller owns the guard's memory and the hold's state.

import { approachesFromCrossStreet, type CrossStreetCandidate } from "../road-detection/cross-street";
import { withoutOperatorSet } from "./guesses";
import type { Scenario } from "./types";

export interface ApproachHold {
  pending: boolean;
  reason: string | null;
}

export interface CrossStreetApplied {
  scenario: Scenario;
  /** The guard's new memory (the candidate's JSON without its line,
   *  #493), or the old one when
   *  nothing was applied. */
  appliedJson: string | null;
  /** The lane-count hold to set, or null when nothing was applied. */
  hold: ApproachHold | null;
}

export function applyCrossStreetCandidate(
  next: Scenario,
  crossStreet: CrossStreetCandidate | null,
  lastAppliedJson: string | null,
): CrossStreetApplied {
  if (next.kind !== "near_intersection" || !crossStreet) {
    return { scenario: next, appliedJson: lastAppliedJson, hold: null };
  }
  // #493: the guard leaves the line out.  It can differ between taps of the
  // same street (trimmed around the snapped point, or the whole own way
  // when the stitch fails), and a line-only difference is not new
  // information for the approaches.  The record's line is written by
  // `intersectionRecord`, not here, so a re-tap still refreshes it.
  const { geometry: _line, ...guarded } = crossStreet;
  const crossJson = JSON.stringify(guarded);
  if (crossJson === lastAppliedJson) {
    return { scenario: next, appliedJson: lastAppliedJson, hold: null };
  }
  // #316: the fresh detection's approaches replace the operator's
  // speed as they always did, so the speed is no longer theirs.
  let out = withoutOperatorSet(next, "approachSpeed") as typeof next;
  out = {
    ...out,
    approaches: approachesFromCrossStreet(crossStreet),
    // Fresh cross-street detection supersedes any recorded
    // override (#177) — the old dispute was about approach relays
    // this patch just replaced.
    detectionOverrides: undefined,
  };
  return {
    scenario: out,
    appliedJson: crossJson,
    hold: {
      // #174 ruling (option d, 2026-08-03): confirm-on-default.  A
      // substituted count renders identically to a detected one, so
      // the no-tag case holds for confirmation too — the hold's
      // reason says the 1 was assumed, making the acknowledgment
      // (and the minLanes floor, when it bites) explicable.
      pending: true,
      reason:
        crossStreet.lanesPerDirection !== null
          ? crossStreet.lanesSuspectReason
          : "The map data carries no lane tag for the cross street. " +
            "The lane count was assumed at 1 per direction, not detected. " +
            "Confirm it or set the real count.",
    },
  };
}
