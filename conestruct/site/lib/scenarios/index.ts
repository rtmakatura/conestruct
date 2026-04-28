import { computeFlagger, DEFAULT_FLAGGER, flaggerWorkLabel } from "./flagger";
import { computeShoulder, DEFAULT_SHOULDER, shoulderWorkLabel } from "./shoulder";
import type {
  FlaggerLaneClosureScenario,
  FlaggerWorkType,
  Scenario,
  ScenarioKind,
  ScenarioResult,
  ShoulderScenario,
  ShoulderWorkType,
} from "./types";

export type {
  DeviceListEntry,
  Duration,
  FlaggerLaneClosureScenario,
  FlaggerResult,
  FlaggerRoadType,
  FlaggerWorkType,
  RoadType,
  Scenario,
  ScenarioKind,
  ScenarioMeta,
  ScenarioResult,
  ShoulderResult,
  ShoulderScenario,
  ShoulderWorkType,
} from "./types";

export {
  computeFlagger,
  computeShoulder,
  DEFAULT_FLAGGER,
  DEFAULT_SHOULDER,
  flaggerWorkLabel,
  shoulderWorkLabel,
};
export { isLegacyParams, isScenario, migrateLegacy, toScenario } from "./legacy";

export function compute(s: Scenario): ScenarioResult {
  switch (s.kind) {
    case "shoulder":
      return computeShoulder(s);
    case "flagger_lane_closure":
      return computeFlagger(s);
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
];

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

// Helpers for the form layer to swap between scenarios while preserving
// shared meta/roadway fields where they apply.
export function defaultFor(kind: ScenarioKind): Scenario {
  return kind === "shoulder" ? DEFAULT_SHOULDER : DEFAULT_FLAGGER;
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
