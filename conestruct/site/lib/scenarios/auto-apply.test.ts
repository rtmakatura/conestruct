// Tests for the OSM-speed snap-and-clamp in auto-apply (audit fix B-04).
//
// OSM `maxspeed` values land off the server schema's 5-mph grid (km/h
// conversions like 100 km/h → 62 mph) or beyond the Table 6C-2 ceiling
// (80-mph rural tags). applyClassification must only ever patch speeds
// the Pydantic schema accepts — multiples of 5, clamped to the
// scenario kind's range — so auto-apply can never cause a 422 the user
// didn't type.

import { describe, expect, it } from "vitest";

import type { RoadClassification } from "../road-detection/types";
import type { Scenario, ShoulderScenario } from "./types";
import { applyClassification, snapSpeedToDomain } from "./auto-apply";

function classification(
  speedLimitMph: number | undefined,
): RoadClassification {
  return {
    roadType: "freeway",
    divided: true,
    laneWidthFt: 12,
    speedLimitMph,
    confidence: "high",
    source: "osm-tags",
    raw: {
      class: "motorway",
      oneway: true,
      roadName: null,
      roadRef: "I-25",
      placeName: null,
      osmLanesTag: null,
      osmMaxspeedTag: speedLimitMph !== undefined ? String(speedLimitMph) : null,
    },
    fields: {
      speed: {
        value: speedLimitMph ?? null,
        confidence: "high",
        source: "OSM maxspeed tag",
        method: "measured",
      },
      lanes: { value: null, confidence: "low", source: "n/a", method: "inferred" },
      roadType: { value: "freeway", confidence: "high", source: "n/a", method: "measured" },
      divided: { value: true, confidence: "high", source: "n/a", method: "measured" },
    },
  };
}

const SHOULDER: ShoulderScenario = {
  kind: "shoulder",
  meta: { project: "", address: "", lat: 0, lng: 0 },
  roadType: "rural_divided",
  speed: 55,
  lanes: 2,
  laneWidth: 12,
  divided: true,
  workType: "utility_locate",
  duration: "short",
  workLen: 800,
  night: false,
};

describe("snapSpeedToDomain", () => {
  it("snaps km/h-converted speeds to the 5-mph grid", () => {
    // 100 km/h → parseMaxspeedToMph rounds to 62 → snaps to 60.
    expect(snapSpeedToDomain("shoulder", 62)).toBe(60);
    expect(snapSpeedToDomain("shoulder", 63)).toBe(65);
  });

  it("clamps to the scenario kind's schema ceiling", () => {
    expect(snapSpeedToDomain("shoulder", 80)).toBe(75);
    expect(snapSpeedToDomain("flagger_lane_closure", 65)).toBe(55);
    expect(snapSpeedToDomain("mobile_op_2lane", 70)).toBe(55);
  });

  it("clamps to the scenario kind's schema floor", () => {
    expect(snapSpeedToDomain("shoulder", 10)).toBe(20);
    expect(snapSpeedToDomain("lane_closure_divided", 25)).toBe(35);
    expect(snapSpeedToDomain("mobile_op_multilane", 30)).toBe(45);
  });

  it("passes through values already on the grid and in range", () => {
    expect(snapSpeedToDomain("shoulder", 55)).toBe(55);
    expect(snapSpeedToDomain("shoulder", 20)).toBe(20);
    expect(snapSpeedToDomain("shoulder", 75)).toBe(75);
  });
});

describe("applyClassification speed patching", () => {
  it("patches a snapped, schema-valid speed (62 → 60)", () => {
    const { scenario, delta } = applyClassification(SHOULDER, classification(62));
    expect((scenario as ShoulderScenario).speed).toBe(60);
    expect(delta.speedApplied).toBe(true);
  });

  it("clamps an 80-mph OSM tag to the 75 schema ceiling", () => {
    const { scenario } = applyClassification(SHOULDER, classification(80));
    expect((scenario as ShoulderScenario).speed).toBe(75);
  });

  it("clamps per-kind: 65-mph road on a flagger scenario → 55", () => {
    const flagger: Scenario = {
      kind: "flagger_lane_closure",
      meta: { project: "", address: "", lat: 0, lng: 0 },
      roadType: "rural_undivided",
      speed: 45,
      laneWidth: 11,
      workType: "utility_cut",
      duration: "short",
      workLen: 500,
      night: false,
      pilotCar: false,
      afad: false,
      pedestrianAccess: false,
    };
    const { scenario } = applyClassification(flagger, classification(65));
    expect(scenario.speed).toBe(55);
  });

  it("leaves speed untouched when OSM carried no maxspeed", () => {
    const { scenario, delta } = applyClassification(
      SHOULDER,
      classification(undefined),
    );
    expect((scenario as ShoulderScenario).speed).toBe(55);
    expect(delta.speedApplied).toBe(false);
  });
});

describe("applyClassification lanes clamping", () => {
  // Same B-04 class as the speed snap: OSM can tag more lanes per
  // direction than the schema's 1..4 domain — the auto-applied value
  // must never hand the user a 422 they didn't type.
  function withLanes(lanesPerDirection: number): RoadClassification {
    return { ...classification(undefined), lanesPerDirection };
  }

  it("applies an in-domain detected lane count as-is", () => {
    const { scenario, delta } = applyClassification(SHOULDER, withLanes(3));
    expect((scenario as ShoulderScenario).lanes).toBe(3);
    expect(delta.lanesApplied).toBe(true);
  });

  it("clamps a 6-lane-per-direction detection to the schema cap (4)", () => {
    const { scenario } = applyClassification(SHOULDER, withLanes(6));
    expect((scenario as ShoulderScenario).lanes).toBe(4);
  });

  it("leaves lanes untouched when OSM carried no lanes tag", () => {
    const { scenario, delta } = applyClassification(
      SHOULDER,
      classification(undefined),
    );
    expect((scenario as ShoulderScenario).lanes).toBe(2);
    expect(delta.lanesApplied).toBe(false);
  });
});
