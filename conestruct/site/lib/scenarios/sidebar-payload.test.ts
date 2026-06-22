// #85 sidebar restructure is presentation-only: the scenario object the
// form builds — and JSON.stringify({ scenario }) sends to every render
// endpoint — must be identical for equivalent inputs, with no field
// renamed or dropped. The only state-touching change is single-source
// `divided` (roadType now derives it on shoulder). These pin that the
// derivation reproduces the value a consistent pre-change form set, that
// urban_arterial keeps its explicit toggle, and that the field sets the
// payload carries are unchanged for both shoulder and flagger.

import { describe, expect, it } from "vitest";
import type { RoadType, ShoulderScenario } from "./types";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "./index";
import { dividedForShoulderRoadType } from "./overrides";

// The restructured shoulder road-type setter: roadType + derived divided
// in one update (mirrors ShoulderForm.onRoadTypeChange).
function setShoulderRoadType(
  s: ShoulderScenario,
  rt: RoadType,
): ShoulderScenario {
  return {
    ...s,
    roadType: rt,
    divided: dividedForShoulderRoadType(rt, s.divided),
  };
}

const SHOULDER_KEYS = [
  "kind",
  "meta",
  "roadType",
  "speed",
  "lanes",
  "laneWidth",
  "divided",
  "workType",
  "duration",
  "workLen",
  "night",
].sort();

const FLAGGER_KEYS = [
  "kind",
  "meta",
  "roadType",
  "speed",
  "laneWidth",
  "workType",
  "duration",
  "workLen",
  "night",
  "pilotCar",
  "afad",
  "pedestrianAccess",
].sort();

describe("#85 payload equivalence — shoulder divided single-source", () => {
  it("derives the same divided a consistent pre-change form set", () => {
    // Pre-change, roadType and divided were independent controls; a
    // correctly-filled form paired them as below. The derivation must
    // produce the identical scenario object (same payload).
    const cases: Array<{ rt: RoadType; divided: boolean }> = [
      { rt: "rural_undivided", divided: false },
      { rt: "rural_divided", divided: true },
      { rt: "freeway", divided: true },
    ];
    for (const { rt, divided } of cases) {
      expect(setShoulderRoadType(DEFAULT_SHOULDER, rt)).toEqual({
        ...DEFAULT_SHOULDER,
        roadType: rt,
        divided,
      });
    }
  });

  it("urban_arterial keeps the explicit toggle (either value)", () => {
    expect(
      setShoulderRoadType({ ...DEFAULT_SHOULDER, divided: false }, "urban_arterial")
        .divided,
    ).toBe(false);
    expect(
      setShoulderRoadType({ ...DEFAULT_SHOULDER, divided: true }, "urban_arterial")
        .divided,
    ).toBe(true);
  });

  it("default shoulder roundtrips unchanged (rural_divided stays divided)", () => {
    expect(
      setShoulderRoadType(DEFAULT_SHOULDER, DEFAULT_SHOULDER.roadType),
    ).toEqual(DEFAULT_SHOULDER);
  });

  it("no shoulder field is renamed or dropped", () => {
    const built = setShoulderRoadType(DEFAULT_SHOULDER, "rural_divided");
    expect(Object.keys(built).sort()).toEqual(SHOULDER_KEYS);
  });
});

describe("#85 payload equivalence — flagger pass-through", () => {
  it("flagger carries no divided field (consolidation is shoulder-only)", () => {
    expect("divided" in DEFAULT_FLAGGER).toBe(false);
  });

  it("flagger field set is unchanged by the reorg", () => {
    // The reorg only moves flagger's groups; its setters are untouched
    // pass-throughs, so a representative build preserves every field.
    const built = { ...DEFAULT_FLAGGER, speed: 45, workLen: 600, night: true };
    expect(Object.keys(built).sort()).toEqual(FLAGGER_KEYS);
    expect(built).toEqual({
      ...DEFAULT_FLAGGER,
      speed: 45,
      workLen: 600,
      night: true,
    });
  });
});
