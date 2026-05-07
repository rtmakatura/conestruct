// Apply a Mapbox-derived RoadClassification to the current Scenario,
// respecting per-scenario-kind narrowing of the RoadType union. If the
// detected road type isn't in the scenario kind's allowed set we skip
// roadType but still apply lane width — operator can either override or
// switch scenario kinds.

import type { RoadClassification } from "../road-classify";
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
}

export function applyClassification(
  scenario: Scenario,
  c: RoadClassification,
): { scenario: Scenario; delta: AutoApplyDelta } {
  // Defaults: every scenario kind has roadType + laneWidth fields, and only
  // ShoulderScenario surfaces a separate `divided` boolean — the other
  // kinds infer divided from their narrowed roadType union.
  const delta: AutoApplyDelta = {
    roadTypeApplied: false,
    roadTypeApplicable: true,
    dividedApplied: false,
    dividedApplicable: false,
    laneWidthApplied: true,
    laneWidthApplicable: true,
  };

  switch (scenario.kind) {
    case "shoulder": {
      return {
        scenario: {
          ...scenario,
          roadType: c.roadType,
          divided: c.divided,
          laneWidth: c.laneWidthFt,
        },
        delta: {
          roadTypeApplied: true,
          roadTypeApplicable: true,
          dividedApplied: true,
          dividedApplicable: true,
          laneWidthApplied: true,
          laneWidthApplicable: true,
        },
      };
    }
    case "flagger_lane_closure": {
      const next = { ...scenario, laneWidth: c.laneWidthFt };
      if (FLAGGER_TYPES.has(c.roadType as FlaggerRoadType)) {
        next.roadType = c.roadType as FlaggerRoadType;
        delta.roadTypeApplied = true;
      }
      return { scenario: next, delta };
    }
    case "lane_closure_divided": {
      const next = { ...scenario, laneWidth: c.laneWidthFt };
      if (LANE_CLOSURE_TYPES.has(c.roadType as LaneClosureRoadType)) {
        next.roadType = c.roadType as LaneClosureRoadType;
        delta.roadTypeApplied = true;
      }
      return { scenario: next, delta };
    }
    case "work_beyond_shoulder": {
      const next = { ...scenario, laneWidth: c.laneWidthFt };
      if (WORK_BEYOND_TYPES.has(c.roadType as RoadType)) {
        next.roadType = c.roadType as WorkBeyondShoulderRoadType;
        delta.roadTypeApplied = true;
      }
      return { scenario: next, delta };
    }
    case "mobile_op_2lane": {
      const next = { ...scenario, laneWidth: c.laneWidthFt };
      if (MOBILE_2LANE_TYPES.has(c.roadType as MobileRoadType2Lane)) {
        next.roadType = c.roadType as MobileRoadType2Lane;
        delta.roadTypeApplied = true;
      }
      return { scenario: next, delta };
    }
    case "mobile_op_multilane": {
      const next = { ...scenario, laneWidth: c.laneWidthFt };
      if (MOBILE_MULTILANE_TYPES.has(c.roadType as MobileRoadTypeMultilane)) {
        next.roadType = c.roadType as MobileRoadTypeMultilane;
        delta.roadTypeApplied = true;
      }
      return { scenario: next, delta };
    }
  }
}
