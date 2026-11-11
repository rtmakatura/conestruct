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

// #493: the candidate now carries the cross street's line, and the line can
// differ between taps of the same street (trimmed around the snapped point,
// or the whole own way when the stitch fails).  A line-only difference is
// not new information: the #112 guard must still keep what the operator
// edited since the first tap.
describe("a re-tap of the same street with a different line is not new (#493, #112)", () => {
  const LINE_A: Array<[number, number]> = [[39.7401, -104.9659], [39.7411, -104.9659]];
  const LINE_B: Array<[number, number]> = [[39.7391, -104.9659], [39.7401, -104.9659], [39.7431, -104.9659]];

  function firstTapThenEdit() {
    const first = applyCrossStreetCandidate(NI, { ...CS, geometry: LINE_A }, null);
    const s = first.scenario;
    if (s.kind !== "near_intersection") throw new Error("kind");
    // The operator edits an approach and a dispute is recorded after the tap.
    const edited = {
      ...s,
      approaches: s.approaches.map((a, i) => (i === 0 ? { ...a, lanesPerDirection: 3 } : a)),
      detectionOverrides: { someField: "disputed again" },
    } as unknown as Scenario;
    return { edited, memory: first.appliedJson };
  }

  it("keeps the edited approaches, the overrides and the hold off", () => {
    const { edited, memory } = firstTapThenEdit();
    const again = applyCrossStreetCandidate(edited, { ...CS, geometry: LINE_B }, memory);
    expect(again.scenario).toBe(edited);
    expect(again.hold).toBeNull();
    expect(again.appliedJson).toBe(memory);
    expect(memory).not.toContain("geometry");
    const s = again.scenario as Extract<Scenario, { kind: "near_intersection" }>;
    expect((s.approaches[0] as { lanesPerDirection: number }).lanesPerDirection).toBe(3);
    expect(s.detectionOverrides).toEqual({ someField: "disputed again" });
  });

  it("a line dropped on the re-tap (stitch failed, no line kept) is not new either", () => {
    const { edited, memory } = firstTapThenEdit();
    const again = applyCrossStreetCandidate(edited, { ...CS, geometry: null }, memory);
    expect(again.scenario).toBe(edited);
    expect(again.hold).toBeNull();
  });

  it("a different street with the same line still replaces", () => {
    const { edited, memory } = firstTapThenEdit();
    const other = { ...CS, name: "Franklin Street", speedMph: 30, geometry: LINE_A };
    const again = applyCrossStreetCandidate(edited, other, memory);
    expect(again.scenario).not.toBe(edited);
    expect(again.scenario.kind === "near_intersection" && again.scenario.approaches).toEqual(
      approachesFromCrossStreet(other),
    );
    expect(again.scenario.kind === "near_intersection" && again.scenario.detectionOverrides).toBeUndefined();
    expect(again.hold).toEqual({ pending: true, reason: "Check the lane count." });
    expect(again.appliedJson).not.toBe(memory);
  });
});
