// Apply an OSM-tag-derived RoadClassification to the current Scenario,
// respecting per-scenario-kind narrowing of the RoadType union. If the
// detected road type isn't in the scenario kind's allowed set we skip
// roadType but still apply lane width — operator can either override or
// switch scenario kinds.

import type { RoadClassification } from "../road-detection/types";
import type {
  Scenario,
  RoadType,
  FlaggerRoadType,
  LaneClosureRoadType,
  WorkBeyondShoulderRoadType,
  MobileRoadType2Lane,
  MobileRoadTypeMultilane,
} from "./types";

const FLAGGER_TYPES = new Set<FlaggerRoadType>([
  "rural_undivided",
  "urban_arterial",
]);
const LANE_CLOSURE_TYPES = new Set<LaneClosureRoadType>([
  "rural_divided",
  "freeway",
]);
const WORK_BEYOND_TYPES = new Set<WorkBeyondShoulderRoadType>([
  "rural_undivided",
  "rural_divided",
  "urban_arterial",
  "freeway",
]);
const MOBILE_2LANE_TYPES = new Set<MobileRoadType2Lane>([
  "rural_undivided",
  "urban_arterial",
]);
const MOBILE_MULTILANE_TYPES = new Set<MobileRoadTypeMultilane>([
  "rural_divided",
  "freeway",
]);

export interface AutoApplyDelta {
  roadTypeApplied: boolean;
  roadTypeApplicable: boolean;
  dividedApplied: boolean;
  dividedApplicable: boolean;
  laneWidthApplied: boolean;
  laneWidthApplicable: boolean;
  // Speed and lanes come from OpenStreetMap tags (when available).
  // `*Applicable` is false when the scenario kind doesn't have the
  // field (only ShoulderScenario carries `lanes` today); `*Applied`
  // is false when the OSM way didn't carry the tag.
  speedApplied: boolean;
  speedApplicable: boolean;
  lanesApplied: boolean;
  lanesApplicable: boolean;
}

export function applyClassification(
  scenario: Scenario,
  c: RoadClassification,
): { scenario: Scenario; delta: AutoApplyDelta } {
  // Speed is a field on every scenario kind, so the OSM `maxspeed` lookup
  // is always applicable.  Lanes is only on ShoulderScenario for now —
  // the other kinds hard-code lane counts in their compute() functions
  // and need a follow-up refactor before they can accept an auto-applied
  // value.  `*Applicable` reflects shape; `*Applied` reflects whether
  // OSM actually carried the tag.
  const speedApplicable = true;
  const speedApplied = c.speedLimitMph !== undefined;
  const speedPatch =
    speedApplied && c.speedLimitMph !== undefined
      ? { speed: c.speedLimitMph }
      : {};

  switch (scenario.kind) {
    case "shoulder": {
      const lanesApplicable = true;
      const lanesApplied = c.lanesPerDirection !== undefined;
      const lanesPatch =
        lanesApplied && c.lanesPerDirection !== undefined
          ? { lanes: c.lanesPerDirection }
          : {};
      return {
        scenario: {
          ...scenario,
          roadType: c.roadType,
          divided: c.divided,
          laneWidth: c.laneWidthFt,
          ...speedPatch,
          ...lanesPatch,
        },
        delta: {
          roadTypeApplied: true,
          roadTypeApplicable: true,
          dividedApplied: true,
          dividedApplicable: true,
          laneWidthApplied: true,
          laneWidthApplicable: true,
          speedApplied,
          speedApplicable,
          lanesApplied,
          lanesApplicable,
        },
      };
    }
    case "flagger_lane_closure": {
      const next = { ...scenario, laneWidth: c.laneWidthFt, ...speedPatch };
      const delta = baseDelta(speedApplied, speedApplicable);
      if (FLAGGER_TYPES.has(c.roadType as FlaggerRoadType)) {
        next.roadType = c.roadType as FlaggerRoadType;
        delta.roadTypeApplied = true;
      }
      return { scenario: next, delta };
    }
    case "lane_closure_divided": {
      const next = { ...scenario, laneWidth: c.laneWidthFt, ...speedPatch };
      const delta = baseDelta(speedApplied, speedApplicable);
      if (LANE_CLOSURE_TYPES.has(c.roadType as LaneClosureRoadType)) {
        next.roadType = c.roadType as LaneClosureRoadType;
        delta.roadTypeApplied = true;
      }
      return { scenario: next, delta };
    }
    case "work_beyond_shoulder": {
      const next = { ...scenario, laneWidth: c.laneWidthFt, ...speedPatch };
      const delta = baseDelta(speedApplied, speedApplicable);
      if (WORK_BEYOND_TYPES.has(c.roadType as RoadType)) {
        next.roadType = c.roadType as WorkBeyondShoulderRoadType;
        delta.roadTypeApplied = true;
      }
      return { scenario: next, delta };
    }
    case "mobile_op_2lane": {
      const next = { ...scenario, laneWidth: c.laneWidthFt, ...speedPatch };
      const delta = baseDelta(speedApplied, speedApplicable);
      if (MOBILE_2LANE_TYPES.has(c.roadType as MobileRoadType2Lane)) {
        next.roadType = c.roadType as MobileRoadType2Lane;
        delta.roadTypeApplied = true;
      }
      return { scenario: next, delta };
    }
    case "mobile_op_multilane": {
      const next = { ...scenario, laneWidth: c.laneWidthFt, ...speedPatch };
      const delta = baseDelta(speedApplied, speedApplicable);
      if (MOBILE_MULTILANE_TYPES.has(c.roadType as MobileRoadTypeMultilane)) {
        next.roadType = c.roadType as MobileRoadTypeMultilane;
        delta.roadTypeApplied = true;
      }
      return { scenario: next, delta };
    }
  }
}

// Default delta for the non-shoulder branches.  Lanes is "not applicable"
// because the scenario kind has no `lanes` field — the lane-closure /
// flagger / mobile generators currently hard-code their counts.
function baseDelta(
  speedApplied: boolean,
  speedApplicable: boolean,
): AutoApplyDelta {
  return {
    roadTypeApplied: false,
    roadTypeApplicable: true,
    dividedApplied: false,
    dividedApplicable: false,
    laneWidthApplied: true,
    laneWidthApplicable: true,
    speedApplied,
    speedApplicable,
    lanesApplied: false,
    lanesApplicable: false,
  };
}
