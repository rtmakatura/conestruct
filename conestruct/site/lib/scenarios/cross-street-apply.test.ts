// #440 X4 — the cross-street apply moved out of GeneratorSidebar's
// onPickerSave into one function the band's tap also calls.  The picker
// Save's result must be byte-identical to before: `legacy` below is the
// base commit's inline branch (GeneratorSidebar.tsx at 9f1314e, lines
// 351-381), copied verbatim with its two refs made parameters, and every
// case compares JSON strings (key order included).

import { describe, expect, it } from "vitest";

import { DEFAULT_NEAR_INTERSECTION, DEFAULT_SHOULDER } from "./index";
import type { Scenario } from "./types";
import { withoutOperatorSet } from "./guesses";
import { approachesFromCrossStreet, type CrossStreetCandidate } from "../road-detection/cross-street";
import { applyCrossStreetCandidate } from "./cross-street-apply";

function legacy(next: Scenario, crossStreet: CrossStreetCandidate | null, last: string | null) {
  let hold: { pending: boolean; reason: string | null } | null = null;
  let ref = last;
  if (next.kind === "near_intersection" && crossStreet) {
    const crossJson = JSON.stringify(crossStreet);
    if (crossJson !== ref) {
      next = withoutOperatorSet(next, "approachSpeed") as typeof next;
      next = {
        ...next,
        approaches: approachesFromCrossStreet(crossStreet),
        detectionOverrides: undefined,
      };
      ref = crossJson;
      hold = {
        pending: true,
        reason:
          crossStreet.lanesPerDirection !== null
            ? crossStreet.lanesSuspectReason
            : "The map data carries no lane tag for the cross street. " +
              "The lane count was assumed at 1 per direction, not detected. " +
              "Confirm it or set the real count.",
      };
    }
  }
  return { scenario: next, appliedJson: ref, hold };
}

const CS: CrossStreetCandidate = {
  name: "Race Street",
  highwayClass: "residential",
  legCount: 2,
  signalized: false,
  speedMph: 25,
  lanesPerDirection: 1,
  lanesSuspect: true,
  lanesSuspectReason: "Check the lane count.",
  roadType: "urban_arterial",
  bearingDeg: 0,
  detectedLanesTotal: 2,
  detectedLanesForward: null,
  detectedLanesBackward: null,
  detectedLanesBothWays: null,
};

const NI = {
  ...DEFAULT_NEAR_INTERSECTION,
  meta: {
    ...DEFAULT_NEAR_INTERSECTION.meta,
    lat: 39.74,
    lng: -104.966,
    operatorSet: ["speed", "approachSpeed"],
    intersection: { lat: 39.7401, lng: -104.9659, name: "Race Street" },
  },
  detectionOverrides: { someField: "disputed" },
} as unknown as Scenario;

const CASES: [string, Scenario, CrossStreetCandidate | null, string | null][] = [
  ["a fresh candidate", NI, CS, null],
  ["the same candidate again (the guard)", NI, CS, JSON.stringify(CS)],
  ["a one-way candidate with no lane tag", NI, { ...CS, legCount: 1, lanesPerDirection: null }, null],
  ["no candidate (a cleared pin)", NI, null, null],
  ["another kind", { ...DEFAULT_SHOULDER } as Scenario, CS, null],
];

describe("the picker Save's cross-street apply is byte-identical after the move (X4)", () => {
  it.each(CASES)("%s", (_name, scenario, cs, last) => {
    const was = legacy(scenario, cs, last);
    const now = applyCrossStreetCandidate(scenario, cs, last);
    expect(JSON.stringify(now.scenario)).toBe(JSON.stringify(was.scenario));
    expect(now.appliedJson).toBe(was.appliedJson);
    expect(now.hold).toEqual(was.hold);
  });

  it("the fresh case writes what the Save always wrote", () => {
    const now = applyCrossStreetCandidate(NI, CS, null);
    expect(now.scenario.kind === "near_intersection" && now.scenario.approaches).toEqual(
      approachesFromCrossStreet(CS),
    );
    expect(now.scenario.meta.operatorSet).toEqual(["speed"]);
    expect(now.hold).toEqual({ pending: true, reason: "Check the lane count." });
  });
});
