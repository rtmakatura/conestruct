import { DEFAULT_FLAGGER } from "./flagger";
import { DEFAULT_SHOULDER } from "./shoulder";
import type { RoadType, Scenario, ScenarioMeta } from "./types";

// Old plans saved before the discriminated-union refactor have a flat
// `LegacyScenarioParams` shape: { closure: "shoulder" | "lane" | "full_road"
// | "mobile", roadType, speed, lanes, divided, night, ... }. This shim
// detects that shape on load and translates it into the new Scenario
// union so the workbench can render it.

interface LegacyScenarioParams {
  roadType: RoadType;
  speed: number;
  lanes: number;
  laneWidth: number;
  closure: "shoulder" | "lane" | "full_road" | "mobile";
  workLen: number;
  divided: boolean;
  night: boolean;
  address: string;
  lat: number;
  lng: number;
  project: string;
}

export function isLegacyParams(value: unknown): value is LegacyScenarioParams {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  // The new shape has `kind`; the old shape doesn't. `closure` is the
  // load-bearing legacy field.
  if (typeof v.kind === "string") return false;
  return typeof v.closure === "string";
}

export function isScenario(value: unknown): value is Scenario {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.kind === "shoulder" ||
    v.kind === "flagger_lane_closure" ||
    v.kind === "lane_closure_divided" ||
    v.kind === "work_beyond_shoulder" ||
    v.kind === "mobile_op_2lane" ||
    v.kind === "mobile_op_multilane"
  );
}

function metaFromLegacy(p: LegacyScenarioParams): ScenarioMeta {
  return {
    project: p.project ?? "",
    address: p.address ?? "",
    lat: p.lat ?? 0,
    lng: p.lng ?? 0,
  };
}

export function migrateLegacy(p: LegacyScenarioParams): Scenario {
  // Map legacy `closure` to a best-fit new scenario. "shoulder" is a
  // direct match. Everything else (lane / full_road / mobile) gets
  // re-homed to flagger lane closure as the closest-fit v1 scenario,
  // since the new model no longer carries those cases verbatim.
  if (p.closure === "shoulder") {
    return {
      ...DEFAULT_SHOULDER,
      meta: metaFromLegacy(p),
      roadType: p.roadType,
      speed: p.speed,
      lanes: p.lanes,
      laneWidth: p.laneWidth,
      divided: p.divided,
      workLen: p.workLen,
      night: p.night,
    };
  }

  // Coerce roadType to one allowed by flagger TA-10 (2-lane 2-way).
  const flaggerRoadType =
    p.roadType === "urban_arterial" ? "urban_arterial" : "rural_undivided";

  return {
    ...DEFAULT_FLAGGER,
    meta: metaFromLegacy(p),
    roadType: flaggerRoadType,
    speed: p.speed,
    laneWidth: p.laneWidth,
    workLen: p.workLen,
    night: p.night,
  };
}

export function toScenario(value: unknown): Scenario {
  if (isScenario(value)) return value;
  if (isLegacyParams(value)) return migrateLegacy(value);
  return DEFAULT_SHOULDER;
}
