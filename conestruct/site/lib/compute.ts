export type RoadType =
  | "rural_undivided"
  | "rural_divided"
  | "urban_arterial"
  | "freeway";

export type ClosureType = "shoulder" | "lane" | "full_road" | "mobile";

export interface ScenarioParams {
  roadType: RoadType;
  speed: number;
  lanes: number;
  laneWidth: number;
  closure: ClosureType;
  workLen: number;
  divided: boolean;
  night: boolean;
  address: string;
  lat: number;
  lng: number;
  project: string;
}

export interface ScenarioResults {
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
  caseId: string;
  steps: number;
}

export const ROAD_TYPES: Array<{ v: RoadType; l: string }> = [
  { v: "rural_undivided", l: "Rural — undivided" },
  { v: "rural_divided", l: "Rural — divided hwy" },
  { v: "urban_arterial", l: "Urban arterial" },
  { v: "freeway", l: "Freeway / interstate" },
];

export const CLOSURE_TYPES: Array<{ v: ClosureType; l: string }> = [
  { v: "shoulder", l: "Shoulder" },
  { v: "lane", l: "Lane" },
  { v: "full_road", l: "Full road" },
  { v: "mobile", l: "Mobile" },
];

const BUFFER_TABLE: Record<number, number> = {
  25: 155,
  30: 200,
  35: 250,
  40: 305,
  45: 360,
  50: 425,
  55: 495,
  60: 570,
  65: 645,
  70: 730,
  75: 820,
};

export function caseMatch(p: ScenarioParams): string {
  if (p.closure === "shoulder") return p.divided ? "Case 1A" : "Case 1B";
  if (p.closure === "lane") return p.divided ? "Case 2A" : "Case 2B";
  if (p.closure === "full_road") return "Case 3A";
  return "Case M-1";
}

export function compute(params: ScenarioParams): ScenarioResults {
  const W = params.laneWidth;
  const S = params.speed;
  const L = S >= 45 ? Math.round(W * S) : Math.round((W * S * S) / 60);
  const B = BUFFER_TABLE[Math.round(S / 5) * 5] ?? 645;
  const spacing = S;

  const taperCones = Math.max(4, Math.ceil(L / spacing));
  const tangentCones = Math.ceil(params.workLen / spacing);
  const cones = taperCones + tangentCones;
  const drums = params.night ? Math.ceil(cones * 0.25) : 0;
  const signs = S >= 45 ? 3 : 2;
  const arrowBoards =
    params.closure === "lane" || params.closure === "full_road" ? 1 : 0;
  const totalDevices = cones + drums + signs + arrowBoards;
  const uniqueTypes =
    1 + (drums ? 1 : 0) + (signs ? 1 : 0) + (arrowBoards ? 1 : 0);

  const steps = cones > 30 ? 14 : 11;

  return {
    L,
    B,
    spacing,
    taperCones,
    tangentCones,
    cones,
    drums,
    signs,
    arrowBoards,
    totalDevices,
    uniqueTypes,
    caseId: caseMatch(params),
    steps,
  };
}

export const DEFAULT_PARAMS: ScenarioParams = {
  roadType: "rural_divided",
  speed: 65,
  lanes: 2,
  laneWidth: 12,
  closure: "lane",
  workLen: 800,
  divided: true,
  night: false,
  address: "",
  lat: 0,
  lng: 0,
  project: "",
};
