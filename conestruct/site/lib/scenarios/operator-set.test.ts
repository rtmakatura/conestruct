// R110 Q4 / Q7 / Q8 — the fields the operator wrote.
//
// Authority: validation-artifacts/committed/setup-what-redesign/rulings.md.
// Q4: "Never overwrite a value the operator set, road type included."
// Q7: lane width carries "its own source"; Q8: Hours and Speed reduction
// read "✓ default" until changed, then "✓ yours".  One record serves all
// four: `meta.operatorSet`, written by the operator's writers only.

import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO, carryAcrossKinds, defaultFor, type Scenario } from "./index";
import { applyClassification } from "./auto-apply";
import { applyOverridesToScenario } from "./overrides";
import {
  applyStagedFields,
  setLaneWidth,
  setNight,
  setRoadType,
  setWorkZoneSpeed,
} from "./what-writes";
import { isOperatorSet } from "./guesses";
import { classifyFromOsmTags } from "../road-detection/classify";
import type { RoadClassification } from "../road-detection/types";
import type { StagedCorrection } from "./types";

function cls(highwayClass: string): RoadClassification {
  return classifyFromOsmTags(
    {
      highwayClass,
      name: "Mainstreet",
      ref: null,
      tags: {
        oneway: null,
        maxspeed: "30 mph",
        lanes: "2",
        lanes_forward: null,
        lanes_backward: null,
        lanes_both_ways: null,
      },
    },
    false,
    null,
  );
}

const shoulder = DEFAULT_SCENARIO as Scenario & { roadType: string; laneWidth: number };

describe("road type the operator set survives a fresh detection (Q4)", () => {
  it("detection writes road type when the operator has not set it", () => {
    const c = cls("residential");
    const out = applyClassification(shoulder, c).scenario as typeof shoulder;
    expect(out.roadType).toBe(c.roadType);
  });

  it("detection keeps the operator's road type", () => {
    const mine = setRoadType(shoulder, "freeway") as typeof shoulder;
    expect(isOperatorSet(mine, "roadType")).toBe(true);
    const c = cls("residential");
    expect(c.roadType).not.toBe("freeway");
    const { scenario, delta } = applyClassification(mine, c);
    expect((scenario as typeof shoulder).roadType).toBe("freeway");
    // #85: the divided pairing follows the type that stands.
    expect((scenario as { divided: boolean }).divided).toBe(true);
    expect(delta.roadTypeApplied).toBe(false);
  });

  it("a picker override and a staged S7 road type are the operator's", () => {
    const viaPicker = applyOverridesToScenario(shoulder, { roadType: "rural_divided" });
    expect(isOperatorSet(viaPicker, "roadType")).toBe(true);
    const staged: StagedCorrection[] = [
      { field: "roadType", label: "Road type", from: "urban_arterial", to: "freeway" },
    ];
    expect(isOperatorSet(applyStagedFields(shoulder, staged), "roadType")).toBe(true);
  });

  it("a kind switch carries the operator's road type when the kind can hold it", () => {
    const mine = setRoadType(shoulder, "urban_arterial");
    const flagger = carryAcrossKinds(mine, defaultFor("flagger_lane_closure")) as typeof shoulder;
    expect(flagger.roadType).toBe("urban_arterial");
    expect(isOperatorSet(flagger, "roadType")).toBe(true);
  });

  it("…and drops the record when it cannot, so detection fills it", () => {
    const mine = setRoadType(shoulder, "freeway");
    const flagger = carryAcrossKinds(mine, defaultFor("flagger_lane_closure"));
    expect(isOperatorSet(flagger, "roadType")).toBe(false);
  });
});

describe("lane width, hours and speed reduction record the operator's write", () => {
  it("each writer marks its field", () => {
    expect(isOperatorSet(setLaneWidth(shoulder, 11), "laneWidth")).toBe(true);
    expect(isOperatorSet(setNight(shoulder, true), "night")).toBe(true);
    expect(isOperatorSet(setWorkZoneSpeed(shoulder, 20), "workZoneSpeed")).toBe(true);
  });

  it("setting a value back to the default is still the operator's (Q8: until changed)", () => {
    const back = setNight(setNight(shoulder, true), false);
    expect(back.night).toBe(false);
    expect(isOperatorSet(back, "night")).toBe(true);
  });

  it("a fresh detection that re-fits the lane width hands it back to the default", () => {
    const mine = setLaneWidth(shoulder, 11);
    const out = applyClassification(mine, cls("residential")).scenario;
    expect(isOperatorSet(out, "laneWidth")).toBe(false);
  });

  it("a kind switch drops the records of fields the new kind starts fresh", () => {
    const mine = setWorkZoneSpeed(setLaneWidth(setNight(shoulder, true), 11), 20);
    const next = carryAcrossKinds(mine, defaultFor("flagger_lane_closure"));
    expect(isOperatorSet(next, "night")).toBe(true);
    expect(isOperatorSet(next, "laneWidth")).toBe(false);
    expect(isOperatorSet(next, "workZoneSpeed")).toBe(false);
  });
});
