export type RoadType =
  | "rural_undivided"
  | "rural_divided"
  | "urban_arterial"
  | "freeway";

export type Duration = "short" | "long";

export type ShoulderWorkType =
  | "utility_locate"
  | "survey"
  | "signal_cabinet"
  | "guardrail"
  | "other";

export type FlaggerWorkType =
  | "utility_cut"
  | "water_main"
  | "chip_seal"
  | "patching"
  | "other";

export type LaneClosureWorkType =
  | "pavement_repair"
  | "striping"
  | "drainage"
  | "bridge_deck"
  | "guardrail"
  | "other";

export type LaneClosureRoadType = "rural_divided" | "freeway";

export type WorkBeyondShoulderRoadType =
  | "rural_undivided"
  | "rural_divided"
  | "urban_arterial"
  | "freeway";

export type WorkBeyondShoulderWorkType =
  | "utility"
  | "environmental"
  | "landscaping"
  | "survey"
  | "fence_repair"
  | "other";

export type MobileRoadType2Lane = "rural_undivided" | "urban_arterial";
export type MobileRoadTypeMultilane = "rural_divided" | "freeway";

export type MobileWorkType =
  | "striping"
  | "sweeping"
  | "mowing"
  | "patching_pothole"
  | "crack_seal"
  | "sign_maintenance"
  | "asphalt_repair"
  | "other";

export type SiteConditionFlag =
  | "limited_sight_distance"
  | "adjacent_intersection"
  | "adjacent_interchange"
  | "driveways_present"
  | "pedestrian_facility"
  | "bicycle_facility"
  | "school_zone";

export type SiteConditions = Partial<Record<SiteConditionFlag, boolean>>;

export interface ScenarioMeta {
  project: string;
  address: string;
  lat: number;
  lng: number;
  /**
   * Engineering-style location text shown on the title block (e.g.
   * "I-25 NB, MP 144.5–146, Colorado Springs"). Distinct from
   * ``address`` which is geocodable; ``locationDescription`` is human
   * prose for the LOCATION row of the schematic title block.
   */
  locationDescription?: string;
  /**
   * Road compass bearing (0 = N, 90 = E). Rotates the north arrow on
   * the rendered schematic to match the site. Leave undefined for the
   * default "↑ = North" orientation with a verify-bearing caveat.
   */
  bearingDeg?: number;
  siteConditions?: SiteConditions;
}

export interface ShoulderScenario {
  kind: "shoulder";
  meta: ScenarioMeta;

  roadType: RoadType;
  speed: number;
  lanes: number;
  laneWidth: number;
  divided: boolean;

  workType: ShoulderWorkType;
  duration: Duration;
  workLen: number;
  night: boolean;
}

export type FlaggerRoadType = "rural_undivided" | "urban_arterial";

export interface FlaggerLaneClosureScenario {
  kind: "flagger_lane_closure";
  meta: ScenarioMeta;

  roadType: FlaggerRoadType;
  speed: number;
  laneWidth: number;

  workType: FlaggerWorkType;
  duration: Duration;
  workLen: number;
  night: boolean;

  pilotCar: boolean;
  afad: boolean;
  pedestrianAccess: boolean;
}

export interface LaneClosureDividedScenario {
  kind: "lane_closure_divided";
  meta: ScenarioMeta;

  roadType: LaneClosureRoadType;
  speed: number;
  laneWidth: number;

  workType: LaneClosureWorkType;
  duration: Duration;
  workLen: number;
  night: boolean;

  truckMountedAttenuator: boolean;
}

export interface WorkBeyondShoulderScenario {
  kind: "work_beyond_shoulder";
  meta: ScenarioMeta;

  roadType: WorkBeyondShoulderRoadType;
  speed: number;
  laneWidth: number;

  workType: WorkBeyondShoulderWorkType;
  duration: Duration;
  workLen: number;
  night: boolean;
}

export interface MobileOp2LaneScenario {
  kind: "mobile_op_2lane";
  meta: ScenarioMeta;

  roadType: MobileRoadType2Lane;
  speed: number;
  laneWidth: number;

  workType: MobileWorkType;
  workLen: number; // trailing distance to shadow vehicle (ft)
  night: boolean;

  arrowBoardOnShadow: boolean;
}

export interface MobileOpMultilaneScenario {
  kind: "mobile_op_multilane";
  meta: ScenarioMeta;

  roadType: MobileRoadTypeMultilane;
  speed: number;
  laneWidth: number;

  workType: MobileWorkType;
  workLen: number; // trailing distance to shadow vehicle (ft)
  night: boolean;

  secondTMA: boolean;
}

export type Scenario =
  | ShoulderScenario
  | FlaggerLaneClosureScenario
  | LaneClosureDividedScenario
  | WorkBeyondShoulderScenario
  | MobileOp2LaneScenario
  | MobileOpMultilaneScenario;
export type ScenarioKind = Scenario["kind"];

export interface DeviceListEntry {
  device: string;
  code: string;
  fn: string;
  qty: number;
}

interface ResultBase {
  ta: string;
  cdotSheet: string;
  caseId: string;

  L: number;
  B: number;
  spacing: number;

  taperCones: number;
  tangentCones: number;
  cones: number;
  drums: number;
  signs: number;
  arrowBoards: number;

  totalDevices: number;
  uniqueTypes: number;
  steps: number;

  devices: DeviceListEntry[];
}

export interface ShoulderResult extends ResultBase {
  kind: "shoulder";
}

export interface FlaggerResult extends ResultBase {
  kind: "flagger_lane_closure";
  flaggerStations: number;
  pilotCarVehicles: number;
  afadDevices: number;
  sightDistance: number;
}

export interface LaneClosureResult extends ResultBase {
  kind: "lane_closure_divided";
  tmaCount: number;
}

export interface WorkBeyondShoulderResult extends ResultBase {
  kind: "work_beyond_shoulder";
}

export interface MobileOp2LaneResult extends ResultBase {
  kind: "mobile_op_2lane";
  shadowVehicles: number;
  tmaCount: number;
}

export interface MobileOpMultilaneResult extends ResultBase {
  kind: "mobile_op_multilane";
  shadowVehicles: number;
  tmaCount: number;
}

export type ScenarioResult =
  | ShoulderResult
  | FlaggerResult
  | LaneClosureResult
  | WorkBeyondShoulderResult
  | MobileOp2LaneResult
  | MobileOpMultilaneResult;
