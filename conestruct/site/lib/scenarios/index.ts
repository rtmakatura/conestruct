import { computeFlagger, DEFAULT_FLAGGER, flaggerWorkLabel } from "./flagger";
import {
  computeLaneClosure,
  DEFAULT_LANE_CLOSURE,
  laneClosureWorkLabel,
} from "./lane-closure-divided";
import {
  computeMobileOp2Lane,
  DEFAULT_MOBILE_OP_2LANE,
  mobileWorkLabel,
} from "./mobile-2lane";
import {
  computeMobileOpMultilane,
  DEFAULT_MOBILE_OP_MULTILANE,
} from "./mobile-multilane";
import { computeShoulder, DEFAULT_SHOULDER, shoulderWorkLabel } from "./shoulder";
import {
  computeWorkBeyondShoulder,
  DEFAULT_WORK_BEYOND_SHOULDER,
  workBeyondShoulderWorkLabel,
} from "./work-beyond-shoulder";
import type {
  FlaggerLaneClosureScenario,
  FlaggerWorkType,
  LaneClosureDividedScenario,
  LaneClosureWorkType,
  MobileOp2LaneScenario,
  MobileOpMultilaneScenario,
  MobileWorkType,
  Scenario,
  ScenarioKind,
  ScenarioResult,
  ShoulderScenario,
  ShoulderWorkType,
  WorkBeyondShoulderScenario,
  WorkBeyondShoulderWorkType,
} from "./types";

export type {
  DeviceListEntry,
  Duration,
  FlaggerLaneClosureScenario,
  FlaggerResult,
  FlaggerRoadType,
  FlaggerWorkType,
  LaneClosureDividedScenario,
  LaneClosureResult,
  LaneClosureRoadType,
  LaneClosureWorkType,
  MobileOp2LaneResult,
  MobileOp2LaneScenario,
  MobileOpMultilaneResult,
  MobileOpMultilaneScenario,
  MobileRoadType2Lane,
  MobileRoadTypeMultilane,
  MobileWorkType,
  RoadType,
  Scenario,
  ScenarioKind,
  ScenarioMeta,
  ScenarioResult,
  SiteConditionFlag,
  SiteConditions,
  ShoulderResult,
  ShoulderScenario,
  ShoulderWorkType,
  WorkBeyondShoulderResult,
  WorkBeyondShoulderRoadType,
  WorkBeyondShoulderScenario,
  WorkBeyondShoulderWorkType,
} from "./types";

export {
  computeFlagger,
  computeLaneClosure,
  computeMobileOp2Lane,
  computeMobileOpMultilane,
  computeShoulder,
  computeWorkBeyondShoulder,
  DEFAULT_FLAGGER,
  DEFAULT_LANE_CLOSURE,
  DEFAULT_MOBILE_OP_2LANE,
  DEFAULT_MOBILE_OP_MULTILANE,
  DEFAULT_SHOULDER,
  DEFAULT_WORK_BEYOND_SHOULDER,
  flaggerWorkLabel,
  laneClosureWorkLabel,
  mobileWorkLabel,
  shoulderWorkLabel,
  workBeyondShoulderWorkLabel,
};
export { isLegacyParams, isScenario, migrateLegacy, toScenario } from "./legacy";
export { applyClassification } from "./auto-apply";
export type { AutoApplyDelta } from "./auto-apply";

export function compute(s: Scenario): ScenarioResult {
  switch (s.kind) {
    case "shoulder":
      return computeShoulder(s);
    case "flagger_lane_closure":
      return computeFlagger(s);
    case "lane_closure_divided":
      return computeLaneClosure(s);
    case "work_beyond_shoulder":
      return computeWorkBeyondShoulder(s);
    case "mobile_op_2lane":
      return computeMobileOp2Lane(s);
    case "mobile_op_multilane":
      return computeMobileOpMultilane(s);
  }
}

export const DEFAULT_SCENARIO: Scenario = DEFAULT_SHOULDER;

export const SCENARIO_KINDS: Array<{ v: ScenarioKind; l: string; sub: string }> = [
  { v: "shoulder", l: "Shoulder work", sub: "TA-2 · S-630-1" },
  {
    v: "flagger_lane_closure",
    l: "Flagger lane closure",
    sub: "TA-10 · S-630-2",
  },
  {
    v: "lane_closure_divided",
    l: "Lane closure (divided)",
    sub: "TA-19 · S-630-3",
  },
  {
    v: "work_beyond_shoulder",
    l: "Work beyond shoulder",
    sub: "TA-1 · S-630-1",
  },
  {
    v: "mobile_op_2lane",
    l: "Mobile op (2-lane)",
    sub: "TA-35 · S-630-1",
  },
  {
    v: "mobile_op_multilane",
    l: "Mobile op (multi-lane)",
    sub: "TA-26 · S-630-3",
  },
];

// Gate which scenario kinds the UI offers and the API accepts. v1 ships
// with shoulder only while we verify the other generators against
// CDOT S-630 typical sheets — extending the array re-enables the rest
// without touching any other code.
export const ENABLED_SCENARIO_KINDS = ["shoulder"] as const satisfies readonly ScenarioKind[];

export function isScenarioKindEnabled(kind: ScenarioKind): boolean {
  return (ENABLED_SCENARIO_KINDS as readonly ScenarioKind[]).includes(kind);
}

export const SHOULDER_WORK_TYPES: Array<{ v: ShoulderWorkType; l: string }> = [
  { v: "utility_locate", l: "Utility locate" },
  { v: "survey", l: "Survey crew" },
  { v: "signal_cabinet", l: "Signal cabinet" },
  { v: "guardrail", l: "Guardrail repair" },
  { v: "other", l: "Other" },
];

export const FLAGGER_WORK_TYPES: Array<{ v: FlaggerWorkType; l: string }> = [
  { v: "utility_cut", l: "Utility cut" },
  { v: "water_main", l: "Water main" },
  { v: "chip_seal", l: "Chip seal" },
  { v: "patching", l: "Pavement patching" },
  { v: "other", l: "Other" },
];

export const LANE_CLOSURE_WORK_TYPES: Array<{
  v: LaneClosureWorkType;
  l: string;
}> = [
  { v: "pavement_repair", l: "Pavement repair" },
  { v: "striping", l: "Pavement striping" },
  { v: "drainage", l: "Drainage / culvert" },
  { v: "bridge_deck", l: "Bridge deck repair" },
  { v: "guardrail", l: "Guardrail repair" },
  { v: "other", l: "Other" },
];

export const WORK_BEYOND_SHOULDER_WORK_TYPES: Array<{
  v: WorkBeyondShoulderWorkType;
  l: string;
}> = [
  { v: "utility", l: "Utility (off-road)" },
  { v: "environmental", l: "Environmental sampling" },
  { v: "landscaping", l: "Landscaping / mowing" },
  { v: "survey", l: "Survey crew" },
  { v: "fence_repair", l: "Fence repair" },
  { v: "other", l: "Other" },
];

export const MOBILE_WORK_TYPES: Array<{ v: MobileWorkType; l: string }> = [
  { v: "striping", l: "Pavement striping" },
  { v: "sweeping", l: "Street sweeping" },
  { v: "mowing", l: "Roadside mowing" },
  { v: "patching_pothole", l: "Pothole patching" },
  { v: "crack_seal", l: "Crack sealing" },
  { v: "sign_maintenance", l: "Sign maintenance" },
  { v: "asphalt_repair", l: "Asphalt repair" },
  { v: "other", l: "Other" },
];

// Helpers for the form layer to swap between scenarios while preserving
// shared meta/roadway fields where they apply.
export function defaultFor(kind: ScenarioKind): Scenario {
  switch (kind) {
    case "shoulder":
      return DEFAULT_SHOULDER;
    case "flagger_lane_closure":
      return DEFAULT_FLAGGER;
    case "lane_closure_divided":
      return DEFAULT_LANE_CLOSURE;
    case "work_beyond_shoulder":
      return DEFAULT_WORK_BEYOND_SHOULDER;
    case "mobile_op_2lane":
      return DEFAULT_MOBILE_OP_2LANE;
    case "mobile_op_multilane":
      return DEFAULT_MOBILE_OP_MULTILANE;
  }
}

export function carryMeta(prev: Scenario, next: Scenario): Scenario {
  return { ...next, meta: prev.meta } as Scenario;
}

// Narrow helpers — useful in form components so each sub-form receives
// a guaranteed-shape scenario rather than the union.
export function asShoulder(s: Scenario): ShoulderScenario | null {
  return s.kind === "shoulder" ? s : null;
}

export function asFlagger(s: Scenario): FlaggerLaneClosureScenario | null {
  return s.kind === "flagger_lane_closure" ? s : null;
}

export function asLaneClosure(
  s: Scenario,
): LaneClosureDividedScenario | null {
  return s.kind === "lane_closure_divided" ? s : null;
}

export function asWorkBeyondShoulder(
  s: Scenario,
): WorkBeyondShoulderScenario | null {
  return s.kind === "work_beyond_shoulder" ? s : null;
}

export function asMobileOp2Lane(s: Scenario): MobileOp2LaneScenario | null {
  return s.kind === "mobile_op_2lane" ? s : null;
}

export function asMobileOpMultilane(
  s: Scenario,
): MobileOpMultilaneScenario | null {
  return s.kind === "mobile_op_multilane" ? s : null;
}

// Canonical flagger headcount the layout itself dictates.  Only the
// flagger lane-closure scenario stations flaggers (two for manual
// flagging, zero when AFAD replaces them); every other scenario kind
// is unflaggered.  Pre-fills the Quote panel so a contractor doesn't
// have to retype a number the layout already knows.
export function expectedFlaggerCount(s: Scenario): number {
  if (s.kind !== "flagger_lane_closure") return 0;
  return s.afad ? 0 : 2;
}
