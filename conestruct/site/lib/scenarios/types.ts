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

export interface ScenarioMeta {
  project: string;
  address: string;
  lat: number;
  lng: number;
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

  flaggerCount: 1 | 2;
  pilotCar: boolean;
  afad: boolean;
  pedestrianAccess: boolean;
}

export type Scenario = ShoulderScenario | FlaggerLaneClosureScenario;
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

export type ScenarioResult = ShoulderResult | FlaggerResult;
