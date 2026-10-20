// #310 — the road's lane count per direction rides the wire as
// `roadLanesPerDirection` (a raw relay; `lanes` stays what the plan draws,
// at most 4).  The backend says so on page 1, in the audit and in the crew
// narrative when the road has more.  Set by detection and by the picker's
// override; cleared when a form lane edit disputes the detection (#345:
// an undisputed edit keeps it), and when a picker save leaves no road.

import { describe, expect, it } from "vitest";

import type { RoadClassification } from "../road-detection/types";
import { applyClassification } from "./auto-apply";
import { clearDetectionRelays, DEFAULT_SHOULDER } from "./index";
import { applyOverridesToScenario } from "./overrides";
import type { Scenario, ShoulderScenario } from "./types";
import { setLanes } from "./what-writes";

function classification(lanesPerDirection: number | undefined): RoadClassification {
  return {
    roadType: "urban_arterial",
    divided: true,
    laneWidthFt: 11,
    lanesPerDirection,
    confidence: "high",
    source: "osm-tags",
    raw: {
      class: "primary",
      oneway: true,
      roadName: "North Broadway",
      roadRef: null,
      placeName: null,
      osmLanesTag: lanesPerDirection !== undefined ? String(lanesPerDirection) : null,
      osmMaxspeedTag: null,
    },
    fields: {
      speed: { value: null, confidence: "low", source: "n/a", method: "inferred" },
      lanes: {
        value: lanesPerDirection ?? null,
        confidence: "high",
        source: "OSM lanes tag",
        method: "measured",
      },
      roadType: { value: "urban_arterial", confidence: "high", source: "n/a", method: "measured" },
      divided: { value: true, confidence: "high", source: "n/a", method: "measured" },
    },
  } as RoadClassification;
}

const shoulder = (s: Scenario) => s as ShoulderScenario;

describe("#310 roadLanesPerDirection relay", () => {
  it("detection: a 5-lane road plans 4 and relays 5", () => {
    const { scenario } = applyClassification(DEFAULT_SHOULDER, classification(5));
    expect(shoulder(scenario).lanes).toBe(4);
    expect(shoulder(scenario).roadLanesPerDirection).toBe(5);
  });

  it("detection within the ceiling relays the same count", () => {
    const { scenario } = applyClassification(DEFAULT_SHOULDER, classification(3));
    expect(shoulder(scenario).lanes).toBe(3);
    expect(shoulder(scenario).roadLanesPerDirection).toBe(3);
  });

  it("a detection with no lane count clears a previous road's", () => {
    const prior = { ...DEFAULT_SHOULDER, roadLanesPerDirection: 5 } as Scenario;
    const { scenario } = applyClassification(prior, classification(undefined));
    expect(shoulder(scenario).roadLanesPerDirection).toBeUndefined();
  });

  it("the picker override is the operator's statement of the road", () => {
    const next = applyOverridesToScenario(DEFAULT_SHOULDER, { lanesPerDirection: 6 });
    expect(shoulder(next).lanes).toBe(4);
    expect(shoulder(next).roadLanesPerDirection).toBe(6);
  });

  it("#345: an undisputed form lane edit keeps the road's count", () => {
    // #335's recovery on a 4-lane freeway: 4 → 3 must still say the road has 4.
    const prior = { ...DEFAULT_SHOULDER, lanes: 4, roadLanesPerDirection: 4 } as Scenario;
    const three = setLanes(prior, 3);
    expect(shoulder(three).lanes).toBe(3);
    expect(shoulder(three).roadLanesPerDirection).toBe(4);
    // Back up and down again: the count survives (the backend is silent at 4 of 4).
    expect(shoulder(setLanes(setLanes(three, 4), 3)).roadLanesPerDirection).toBe(4);
    // And it rides the request body.
    expect(JSON.parse(JSON.stringify(three)).roadLanesPerDirection).toBe(4);
  });

  it("#345: an edit that disputes the detection clears it", () => {
    // #136: a detected total of 1 is disputed by any form edit.
    const single = {
      ...DEFAULT_SHOULDER,
      lanes: 1,
      detectedLanesTotal: 1,
      roadLanesPerDirection: 1,
    } as Scenario;
    expect(shoulder(setLanes(single, 2)).roadLanesPerDirection).toBeUndefined();
    // #120: forward + backward disagreeing with the total.
    const mismatch = {
      ...DEFAULT_SHOULDER,
      lanes: 4,
      detectedLanesTotal: 8,
      detectedLanesForward: 2,
      detectedLanesBackward: 2,
      roadLanesPerDirection: 4,
    } as Scenario;
    expect(shoulder(setLanes(mismatch, 2)).roadLanesPerDirection).toBeUndefined();
  });

  it("an outsized count relays as-is (the wire has no upper bound); a 0 is dropped", () => {
    // OSM can say anything: `lanes=25` is still the map's claim, and the
    // backend reads it; a count that parses to 0 would 422 the render.
    const big = applyClassification(DEFAULT_SHOULDER, classification(25)).scenario;
    expect(shoulder(big).lanes).toBe(4);
    expect(shoulder(big).roadLanesPerDirection).toBe(25);
    const zero = applyClassification(DEFAULT_SHOULDER, classification(0)).scenario;
    expect(shoulder(zero).roadLanesPerDirection).toBeUndefined();
    const zeroOverride = applyOverridesToScenario(DEFAULT_SHOULDER, { lanesPerDirection: 0 });
    expect(shoulder(zeroOverride).roadLanesPerDirection).toBeUndefined();
  });

  it("a picker save with no road removes it from the wire", () => {
    const prior = { ...DEFAULT_SHOULDER, roadLanesPerDirection: 5 } as Scenario;
    const cleared = clearDetectionRelays(prior) as unknown as Record<string, unknown>;
    expect("roadLanesPerDirection" in cleared).toBe(false);
  });
});
