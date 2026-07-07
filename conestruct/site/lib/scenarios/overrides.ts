// Manual road-property overrides from the LocationPicker, applied on
// top of a freshly-applied OSM classification.  Extracted from
// GeneratorSidebar (PR 4) so the speed-clamp behavior is unit-testable
// without dragging the component/Mapbox dependency tree into vitest.
//
// Mirrors the per-scenario-kind narrowing rules in
// ``applyClassification``: a roadType override only sticks when it's
// in the kind's allowed set; ``lanes``/``divided`` only persist on
// shoulder (the only kind that carries them today); speed snaps +
// clamps to the kind's server schema domain via ``snapSpeedToDomain``
// — the raw write let an accepted OSM 65 mph land on a flagger
// scenario whose schema caps at 55, handing the user a validation
// error for a value the app filled in itself (the exact B-04 class
// the clamp exists to prevent).

import { snapSpeedToDomain } from "./auto-apply";
import { clampLanesToDomain } from "./validation";
import type {
  FlaggerRoadType,
  LaneClosureRoadType,
  MobileRoadType2Lane,
  MobileRoadTypeMultilane,
  RoadType,
  Scenario,
  WorkBeyondShoulderRoadType,
} from "./types";

export interface RoadFieldOverrides {
  speedMph?: number;
  lanesPerDirection?: number;
  roadType?: RoadType;
  divided?: boolean;
}

const FLAGGER_TYPES: ReadonlySet<FlaggerRoadType> = new Set<FlaggerRoadType>([
  "rural_undivided",
  "urban_arterial",
]);
const LANE_CLOSURE_TYPES: ReadonlySet<LaneClosureRoadType> =
  new Set<LaneClosureRoadType>(["rural_divided", "freeway"]);
const WORK_BEYOND_TYPES: ReadonlySet<WorkBeyondShoulderRoadType> =
  new Set<WorkBeyondShoulderRoadType>([
    "rural_undivided",
    "rural_divided",
    "urban_arterial",
    "freeway",
  ]);
const MOBILE_2LANE_TYPES: ReadonlySet<MobileRoadType2Lane> =
  new Set<MobileRoadType2Lane>(["rural_undivided", "urban_arterial"]);
const MOBILE_MULTILANE_TYPES: ReadonlySet<MobileRoadTypeMultilane> =
  new Set<MobileRoadTypeMultilane>(["rural_divided", "freeway"]);

// Single-source `divided` for shoulder scenarios: roadType drives it, so
// the road-type select and the divided state can't disagree (#85
// consolidation). rural_divided / freeway are inherently divided;
// rural_undivided is not; urban_arterial can be either, so it keeps the
// operator's current toggle. Mirrors the backend's is_divided derivation
// for work_beyond_shoulder (schemas.py:391) and keeps the exact `divided`
// boolean the render API receives.
export function dividedForShoulderRoadType(
  roadType: RoadType,
  current: boolean,
): boolean {
  if (roadType === "rural_divided" || roadType === "freeway") return true;
  if (roadType === "rural_undivided") return false;
  return current; // urban_arterial — explicit toggle
}

export function applyRoadTypeOverride(scenario: Scenario, rt: RoadType): Scenario {
  switch (scenario.kind) {
    case "shoulder":
      // ShoulderScenario carries the full RoadType union, so anything sticks.
      return { ...scenario, roadType: rt };
    case "flagger_lane_closure":
      return FLAGGER_TYPES.has(rt as FlaggerRoadType)
        ? { ...scenario, roadType: rt as FlaggerRoadType }
        : scenario;
    case "lane_closure_divided":
      return LANE_CLOSURE_TYPES.has(rt as LaneClosureRoadType)
        ? { ...scenario, roadType: rt as LaneClosureRoadType }
        : scenario;
    case "work_beyond_shoulder":
      return WORK_BEYOND_TYPES.has(rt as WorkBeyondShoulderRoadType)
        ? { ...scenario, roadType: rt as WorkBeyondShoulderRoadType }
        : scenario;
    case "mobile_op_2lane":
      return MOBILE_2LANE_TYPES.has(rt as MobileRoadType2Lane)
        ? { ...scenario, roadType: rt as MobileRoadType2Lane }
        : scenario;
    case "mobile_op_multilane":
      return MOBILE_MULTILANE_TYPES.has(rt as MobileRoadTypeMultilane)
        ? { ...scenario, roadType: rt as MobileRoadTypeMultilane }
        : scenario;
  }
}

export function applyOverridesToScenario(
  scenario: Scenario,
  overrides: RoadFieldOverrides,
): Scenario {
  let next: Scenario = scenario;
  if (overrides.speedMph !== undefined) {
    // PR 4 (Q4): snap + clamp to the kind's server schema domain, same
    // as the applyClassification path.
    next = {
      ...next,
      speed: snapSpeedToDomain(next.kind, overrides.speedMph),
    } as Scenario;
  }
  if (overrides.roadType !== undefined) {
    next = applyRoadTypeOverride(next, overrides.roadType);
  }
  if (overrides.divided !== undefined && next.kind === "shoulder") {
    next = { ...next, divided: overrides.divided };
  }
  if (overrides.lanesPerDirection !== undefined && next.kind === "shoulder") {
    // Clamp to the schema domain (1..4), same B-04 class as the speed
    // snap above — never hand the user a 422 for an app-filled value.
    next = { ...next, lanes: clampLanesToDomain(overrides.lanesPerDirection) };
  }
  return next;
}
