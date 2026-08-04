// Scenario module entrypoint.
//
// PR 3 deleted the per-scenario compute*() files (shoulder.ts, flagger.ts,
// lane-closure-divided.ts, work-beyond-shoulder.ts, mobile-2lane.ts,
// mobile-multilane.ts) and their shared formula helpers (shared.ts).  The
// rules engine on the Modal-hosted backend is now the single source for
// MUTCD/CDOT calculations; this module retains only:
//
//   - Type re-exports (the discriminated union and its members)
//   - Per-scenario DEFAULT_* constants (form prefill + new-plan baselines)
//   - Work-type labels (form dropdowns)
//   - SCENARIO_KINDS + ENABLED_SCENARIO_KINDS gate
//   - Narrowing helpers + carryMeta for form swaps
//   - expectedFlaggerCount (Quote panel prefill)
//   - Legacy saved-plan migration (isScenario, toScenario, migrateLegacy)
//
// AuditTrail.tsx's render paths are fully backend-sourced as of
// engine-removal PR C (the flagger SSD ``bufferFor`` table — the last
// TS-side heuristic — is deleted; the row reads
// ``sections.flagger.sight_distance_ft``, cite §6D.06 → Table 6B-2).
import { snapSpeedToDomain } from "./auto-apply";
import type {
  DetectionOverride,
  FlaggerLaneClosureScenario,
  FlaggerWorkType,
  LaneClosureDividedScenario,
  LaneClosureWorkType,
  MobileOp2LaneScenario,
  MobileOpMultilaneScenario,
  MobileWorkType,
  NearIntersectionScenario,
  NearIntersectionWorkType,
  RoadType,
  Scenario,
  ScenarioKind,
  ScenarioMeta,
  ShoulderScenario,
  ShoulderWorkType,
  WorkBeyondShoulderScenario,
  WorkBeyondShoulderWorkType,
} from "./types";

export type {
  DetectionOverride,
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
  NearIntersectionApproach,
  NearIntersectionResult,
  NearIntersectionRoadType,
  NearIntersectionScenario,
  NearIntersectionWorkType,
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

export { applyClassification, snapSpeedToDomain } from "./auto-apply";
export type { AutoApplyDelta } from "./auto-apply";

// ---------------------------------------------------------------------------
// Per-scenario defaults — initial form values when the user opens a fresh
// workbench or switches scenario kind.  Inlined from the deleted per-scenario
// .ts files (previously DEFAULT_SHOULDER lived in shoulder.ts, etc.).
//
// Reachability follows ENABLED_SCENARIO_KINDS (shoulder and
// flagger_lane_closure live today; near_intersection flips with #117).
// Gated kinds' defaults are kept as the canonical starting points for
// when those scenarios enable; per #26, each default is verified
// against its own backend bounds as a pre-enablement check (the
// near_intersection check lives in
// tests/test_near_intersection_endpoints.py::test_default_scenario_clears_every_backend_rejection).
// ---------------------------------------------------------------------------

export const DEFAULT_SHOULDER: ShoulderScenario = {
  kind: "shoulder",
  meta: {
    project: "",
    address: "",
    lat: 0,
    lng: 0,
  },
  roadType: "rural_divided",
  speed: 65,
  lanes: 2,
  laneWidth: 12,
  divided: true,
  workType: "utility_locate",
  duration: "short",
  // workLen: minimum 1000 ft to clear the backend's
  // WORK_ZONE_SHORTER_THAN_TAPER hard rule (shoulder taper at 65 mph with
  // 10-ft shoulder = 217 ft) and the WORK_ZONE_SHORT_VS_BUFFER soft rule
  // (buffer/2 at 65 mph = 322 ft).  Default scenarios must render cleanly
  // through /render/audit on first paint — no validation banner.
  workLen: 1000,
  night: false,
};

export const DEFAULT_FLAGGER: FlaggerLaneClosureScenario = {
  kind: "flagger_lane_closure",
  meta: {
    project: "",
    address: "",
    lat: 0,
    lng: 0,
  },
  roadType: "rural_undivided",
  speed: 45,
  laneWidth: 12,
  workType: "utility_cut",
  duration: "long",
  workLen: 400,
  night: false,
  pilotCar: false,
  afad: false,
  pedestrianAccess: false,
};

export const DEFAULT_LANE_CLOSURE: LaneClosureDividedScenario = {
  kind: "lane_closure_divided",
  meta: {
    project: "",
    address: "",
    lat: 0,
    lng: 0,
  },
  roadType: "freeway",
  speed: 65,
  laneWidth: 12,
  workType: "pavement_repair",
  duration: "long",
  workLen: 800,
  night: false,
  truckMountedAttenuator: true,
};

export const DEFAULT_WORK_BEYOND_SHOULDER: WorkBeyondShoulderScenario = {
  kind: "work_beyond_shoulder",
  meta: { project: "", address: "", lat: 0, lng: 0 },
  roadType: "rural_undivided",
  speed: 45,
  laneWidth: 12,
  workType: "utility",
  duration: "short",
  workLen: 200,
  night: false,
};

export const DEFAULT_MOBILE_OP_2LANE: MobileOp2LaneScenario = {
  kind: "mobile_op_2lane",
  meta: { project: "", address: "", lat: 0, lng: 0 },
  roadType: "rural_undivided",
  speed: 45,
  laneWidth: 12,
  workType: "striping",
  workLen: 200,
  night: false,
  arrowBoardOnShadow: true,
};

export const DEFAULT_MOBILE_OP_MULTILANE: MobileOpMultilaneScenario = {
  kind: "mobile_op_multilane",
  meta: { project: "", address: "", lat: 0, lng: 0 },
  roadType: "freeway",
  speed: 65,
  laneWidth: 12,
  workType: "striping",
  workLen: 300,
  night: false,
  secondTMA: false,
};

// GATED (near_intersection, #117): the picker never offers this kind
// while it is absent from ENABLED_SCENARIO_KINDS; the default exists so
// tests and the eventual enablement have a canonical starting point.
// Values clear every backend rejection: speed within 25-55, 2 lanes per
// direction (the layout requires >= 2), and a near-side cross street
// whose curb-to-curb box stays outside the work zone.
export const DEFAULT_NEAR_INTERSECTION: NearIntersectionScenario = {
  kind: "near_intersection",
  meta: { project: "", address: "", lat: 0, lng: 0 },
  roadType: "urban_arterial",
  speed: 35,
  lanes: 2,
  laneWidth: 12,
  divided: false,
  workType: "utility_cut",
  duration: "short",
  workLen: 500,
  night: false,
  approaches: [
    {
      id: "cross_a",
      speed: 30,
      roadType: "urban_arterial",
      lanesPerDirection: 1,
      laneWidth: 12,
      signalized: false,
      alongStationFt: -200,
    },
  ],
};

export const DEFAULT_SCENARIO: Scenario = DEFAULT_SHOULDER;

// ---------------------------------------------------------------------------
// Scenario kinds and enablement gate
// ---------------------------------------------------------------------------

export const SCENARIO_KINDS: Array<{ v: ScenarioKind; l: string; sub: string }> = [
  // Kind-level family label (Refs #100): the picker renders before any
  // plan exists, so it can't read the backend's road-type-aware
  // summary.ta (TA-3 generally, TA-5 on a freeway).  Static family
  // label only — never a road-type conditional here (rule #3).
  { v: "shoulder", l: "Shoulder work", sub: "TA-3/TA-5 · S-630-1" },
  {
    v: "flagger_lane_closure",
    l: "Flagger lane closure",
    // S-630-1 (PR 3 correction): the validated flagger fixtures come
    // from S-630-1 Sheet 9 Case 17 / Sheet 25 Case 42.
    sub: "TA-10 · S-630-1",
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
  {
    v: "near_intersection",
    l: "Lane closure near intersection",
    sub: "Cases 18/19 · S-630-1",
  },
];

// Gate which scenario kinds the UI offers and the API accepts. Kinds
// enable as their generators pass validation against the CDOT S-630
// typical sheets — extending the array re-enables the rest without
// touching any other code. flagger_lane_closure enabled in PR 3
// (TA-10 + S-630-1 Cases 17/42; harness at tests/s630/
// test_ta10_flagger.py). Must match render_api.py ENABLED_SCENARIOS.
export const ENABLED_SCENARIO_KINDS = [
  "shoulder",
  "flagger_lane_closure",
] as const satisfies readonly ScenarioKind[];

export function isScenarioKindEnabled(kind: ScenarioKind): boolean {
  return (ENABLED_SCENARIO_KINDS as readonly ScenarioKind[]).includes(kind);
}

// ---------------------------------------------------------------------------
// Work-type labels — form dropdown options.
// ---------------------------------------------------------------------------

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

export const NEAR_INTERSECTION_WORK_TYPES: Array<{
  v: NearIntersectionWorkType;
  l: string;
}> = [
  { v: "utility_cut", l: "Utility cut" },
  { v: "water_main", l: "Water main" },
  { v: "patching", l: "Pavement patching" },
  { v: "signal_work", l: "Traffic signal work" },
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

// ---------------------------------------------------------------------------
// Form-layer helpers
// ---------------------------------------------------------------------------

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
    case "near_intersection":
      return DEFAULT_NEAR_INTERSECTION;
  }
}

export function carryMeta(prev: Scenario, next: Scenario): Scenario {
  return { ...next, meta: prev.meta } as Scenario;
}

// #181: the kind-switch carry.  carryMeta alone made a kind switch an
// unmarked erase site — every kind-agnostic input AND the detection
// relays vanished, which turned the shipped #86/#136/#158 gates into
// order-dependent gates (detect-then-switch produced a payload the
// backend had nothing to refuse on).
//
// Scope is shared-fields-only (ruling 2026-07-30): the fields below are
// kind-agnostic user/state inputs no detection owns.  Kind-specific
// fields (pilotCar, lanes, duration where absent) start from the target
// kind's defaults, and the relay fields are deliberately NOT copied
// here — each kind carries its own relay shape (flagger alone has
// `oneway`), so the sidebar re-derives them by re-running
// applyClassification from the confirmed detection after this carry.
// Speed snaps to the target kind's server schema domain (the B-04
// clamp class — never hand the user a 422 for an app-moved value).
export function carryAcrossKinds(prev: Scenario, next: Scenario): Scenario {
  const carried = {
    ...next,
    meta: prev.meta,
    speed: snapSpeedToDomain(next.kind, prev.speed),
    workLen: prev.workLen,
    night: prev.night,
    jurisdiction_key: prev.jurisdiction_key,
    street_class: prev.street_class,
    schedule: prev.schedule,
  } as Scenario;
  // Override provenance (#177) rides along only where the target kind
  // declares the field — attaching it to a kind whose schema (and TS
  // shape) lacks it would put an undeclared key on the wire.
  const prevOverrides = (
    prev as { detectionOverrides?: DetectionOverride[] }
  ).detectionOverrides;
  if (
    prevOverrides !== undefined &&
    (carried.kind === "shoulder" ||
      carried.kind === "flagger_lane_closure" ||
      carried.kind === "near_intersection")
  ) {
    return { ...carried, detectionOverrides: prevOverrides } as Scenario;
  }
  return carried;
}

// #189-3 (Refs #197 — the clear-on-invalidate variant, lib/answer-stamp.ts):
// a picker save with no resolved road invalidates the applied detection.
// The relay facts ride the wire, so a stale answer here is REMOVED, not
// decorated — absence renders as absence (Rule 10), and the backend
// gates receive the same honest nothing a fresh no-detection pin sends.
// Reviewed FORM values (speed, lanes, roadType…) are not detection
// facts and are untouched; the #177 override markers go with the
// detection they disputed.
export function clearDetectionRelays(s: Scenario): Scenario {
  const rest = { ...s } as Scenario & Record<string, unknown>;
  delete rest.detectedLanesTotal;
  delete rest.detectedLanesForward;
  delete rest.detectedLanesBackward;
  delete rest.detectedLanesBothWays;
  delete rest.oneway;
  delete rest.detectionOverrides;
  return rest as Scenario;
}

// #186 — the one location-presence predicate.  ``lat: 0, lng: 0`` is the
// documented unset sentinel (every DEFAULT_* starts there; neither the TS
// type nor the backend ScenarioMeta admits null, and the backend already
// reads ``meta.lat or None``).  Literal 0/0 is never a legitimate site in
// scope — it is the Gulf of Guinea — so absence and 0/0 are the same
// state.  BOTH coordinates must be nonzero: a lat without a lng (reachable
// through the manual-entry fallback) is not a usable location.  The strip
// and the Generate gate read only this helper; other, older sentinel
// spellings (GeneratorSidebar hasPin, QuotePanel, SiteConditionsField)
// consolidate onto it when next touched.
export function hasLocation(meta: ScenarioMeta): boolean {
  return meta.lat !== 0 && meta.lng !== 0;
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

export function asNearIntersection(
  s: Scenario,
): NearIntersectionScenario | null {
  return s.kind === "near_intersection" ? s : null;
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

// ---------------------------------------------------------------------------
// Legacy saved-plan migration
//
// Old plans saved before the discriminated-union refactor have a flat
// ``LegacyScenarioParams`` shape.  This shim detects that shape on load
// and translates it into the new Scenario union so the workbench can
// render it.  Inlined from the deleted ``legacy.ts`` after PR 3.
// ---------------------------------------------------------------------------

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
  // The new shape has `kind`; the old shape doesn't.  `closure` is the
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
    v.kind === "mobile_op_multilane" ||
    v.kind === "near_intersection"
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
  // Map legacy `closure` to a best-fit new scenario.  "shoulder" is a
  // direct match.  Everything else (lane / full_road / mobile) gets
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
