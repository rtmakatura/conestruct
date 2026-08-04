// Apply an OSM-tag-derived RoadClassification to the current Scenario,
// respecting per-scenario-kind narrowing of the RoadType union. If the
// detected road type isn't in the scenario kind's allowed set we skip
// roadType but still apply lane width — operator can either override or
// switch scenario kinds.
//
// Scope policy: this module only applies fields with a defensible OSM-
// derived ground truth (roadType, divided, laneWidth, speed, lanes).
// ``workZoneSpeed`` on ShoulderScenario is intentionally NOT auto-applied
// — it's an operator decision based on work conditions, not a detectable
// road property. Q6 of V1-Wide Item 1 review (2026-06-06).

import type { RoadClassification } from "../road-detection/types";
import { clampLanesToDomain } from "./validation";
import type {
  DetectionOverride,
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

// OSM `oneway` tag values that make a road ineligible for a flagger plan
// (issue #158): the road carries traffic in one direction only, so TA-10 has
// no opposing direction to alternate with.  Mirrors `_ONEWAY_BLOCKING` in
// src/api/render_api.py (the `_ensure_direction_eligible` gate) — the backend
// is the authoritative gate; this drives only the recovery affordance's
// visibility.
// `no`/undefined is two-way and never blocks.
export const ONEWAY_BLOCKING: ReadonlySet<string> = new Set([
  "yes",
  "-1",
  "reversible",
]);

// Flagger multi-lane eligibility ceiling (issue #86): TA-10 applies where one
// through lane runs in each direction, so a detected total of 4+ is refused
// unconditionally and a total of 3 is eligible only as a consistently
// decomposed center-turn-lane road (1 forward + 1 backward + 1 both_ways).
// Mirrors `flagger_lane_ineligible_high` in src/api/schemas.py (consumed by
// the `_ensure_lane_eligible` gate) — the backend is the authoritative gate;
// this drives only the recovery affordance's visibility.
// An absent total never blocks.
export function flaggerLaneIneligibleHigh(
  total: number | undefined,
  forward: number | undefined,
  backward: number | undefined,
  bothWays: number | undefined,
): boolean {
  if (total === undefined) return false;
  if (total >= 4) return true;
  if (total === 3) return !(forward === 1 && backward === 1 && bothWays === 1);
  return false;
}

// Lane-count consistency predicate (issue #120): the OSM lane tags
// dispute themselves when total, forward, and backward all exist and
// total != forward + backward + both_ways.  Mirrors
// `lanes_arithmetic_mismatch` in src/api/schemas.py (the backend audit
// caution / near-intersection gate) — the backend is authoritative; this
// mirror only decides whether an erased relay set was DISPUTED at erase
// time, which gates recording a DetectionOverride marker (issue #177).
// Sparse tags never count as disputed.
export function lanesArithmeticMismatch(
  total: number | undefined,
  forward: number | undefined,
  backward: number | undefined,
  bothWays: number | undefined,
): boolean {
  if (total === undefined || forward === undefined || backward === undefined) {
    return false;
  }
  return total !== forward + backward + (bothWays ?? 0);
}

// One refusal, one voice (issue #180): associate a backend gate 400 with
// the confirm affordance that remedies it — WITHOUT string-matching the
// message text.  The banner shortens to ``pointer`` when this returns a
// match; the affordance row's own note stays the primary voice.
//
// Correctness rests on two facts, both quoted in the #180 plan:
//   1. The row predicates below are exact mirrors of the backend gates
//      (flaggerLaneIneligibleHigh ↔ flagger_lane_ineligible_high;
//      ONEWAY_BLOCKING ↔ _ONEWAY_BLOCKING; total === 1 ↔ the single-lane
//      gate, exact because FlaggerLaneClosureScenario has no ``divided``).
//   2. The evaluation ORDER below replicates the backend gate order in
//      render_api._placements_for (#86 high → #136 single-lane → #158
//      one-way, all before geometry validation), so the first true
//      predicate names the gate that actually fired.
//
// Drift is fail-safe: a future gate shipped WITHOUT a mirror row matches
// nothing here, so the banner renders that gate's full 400 once (the
// no-affordance shape) — never a wrong pointer.  If a gate ever ships
// without its mirror row and needs a pointer anyway, that is the moment
// machine-readable codes on the backend 400 earn their test churn
// (option (i) in the #180 plan) — do not extend this matcher with
// message-text sniffing.
//
export interface RefusalAffordance {
  code:
    | "flagger_multilane"
    | "flagger_single_lane"
    | "flagger_oneway"
    | "ni_lane_confidence";
  pointer: string;
}

export function matchRefusalAffordance(
  scenario: Scenario,
): RefusalAffordance | null {
  // near_intersection (#117 enablement, #120's gate): exact mirror of
  // render_api._ensure_lane_confidence — the backend refuses when ANY
  // approach's relayed lane tags dispute themselves.  The remedy is the
  // form's "Lane count is right" confirm (NearIntersectionForm), which
  // clears the relays on every leg.  This row replaces the transient
  // sidebar hold as the refusal's mirror: the hold is one-time UI state
  // and does not return after an untick — the relays and this predicate
  // do (#179).
  if (scenario.kind === "near_intersection") {
    const disputed = scenario.approaches.some((a) =>
      lanesArithmeticMismatch(
        a.detectedLanesTotal,
        a.detectedLanesForward,
        a.detectedLanesBackward,
        a.detectedLanesBothWays,
      ),
    );
    return disputed
      ? {
          code: "ni_lane_confidence",
          pointer:
            "The map's lane counts for the cross street contradict each other — confirm “Lane count is right” in the Cross street section to proceed.",
        }
      : null;
  }
  if (scenario.kind !== "flagger_lane_closure") return null;
  if (
    flaggerLaneIneligibleHigh(
      scenario.detectedLanesTotal,
      scenario.detectedLanesForward,
      scenario.detectedLanesBackward,
      scenario.detectedLanesBothWays,
    )
  ) {
    return {
      code: "flagger_multilane",
      pointer:
        "Detection saw a multi-lane road — confirm the lane count in the Road section to proceed.",
    };
  }
  if (scenario.detectedLanesTotal === 1) {
    return {
      code: "flagger_single_lane",
      pointer:
        "Detection saw a single-lane road — confirm the lane count in the Road section to proceed.",
    };
  }
  if (scenario.oneway !== undefined && ONEWAY_BLOCKING.has(scenario.oneway)) {
    return {
      code: "flagger_oneway",
      pointer:
        "Detection saw a one-way street — confirm two-way traffic in the Road section to proceed.",
    };
  }
  return null;
}

// Append a DetectionOverride marker (issue #177), keeping the newest 8 —
// the backend schema caps the list (max_length=8), and on a session deep
// enough to hit the cap the oldest markers describe relays that have
// since been re-detected and re-erased.
export function appendDetectionOverride(
  existing: DetectionOverride[] | undefined,
  marker: DetectionOverride,
): DetectionOverride[] {
  return [...(existing ?? []), marker].slice(-8);
}

// The tick's inverse (issue #179): remove the LAST marker of the given
// via and hand it back so the caller can restore the recorded relay
// fields.  Marker-reversal IS exact snapshot restore here: every
// confirm's erase set (detection relays) is disjoint from every
// user-editable field — flagger has no lane or oneway inputs, and the
// near-intersection approach relays are not editable — so restoring the
// marker's fields reconstructs the exact pre-tick payload (byte-identical
// after JSON serialization; asserted in tests) while intervening manual
// edits survive untouched.  An emptied list returns undefined so the
// wire key drops entirely: a payload after tick-then-untick is
// indistinguishable from one that was never confirmed.
export function undoDetectionOverride(
  existing: DetectionOverride[] | undefined,
  via: DetectionOverride["via"],
): {
  overrides: DetectionOverride[] | undefined;
  marker: DetectionOverride | null;
} {
  const list = existing ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].via !== via) continue;
    const rest = [...list.slice(0, i), ...list.slice(i + 1)];
    return { overrides: rest.length > 0 ? rest : undefined, marker: list[i] };
  }
  return { overrides: existing, marker: null };
}

// The last recorded marker for a via (issue #179) — drives the
// confirmed-row render: a matching marker means the row's confirm is in
// effect, so the row stays mounted, checked, describing what it
// overrode.  Relay-present and marker-present are mutually exclusive per
// via by construction (only a tick erases relays while appending its
// marker; re-detection, a settled-null save, and a kind switch with a
// confirmed road all reset the list in the same patch that rewrites
// relays), so armed and confirmed states cannot collide.
export function lastDetectionOverride(
  existing: DetectionOverride[] | undefined,
  via: DetectionOverride["via"],
): DetectionOverride | null {
  const list = existing ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].via === via) return list[i];
  }
  return null;
}

// Display clause for a confirmed row (issue #179), built ONLY from the
// marker's present fields — the marker records just the relays that
// existed at erase time (#177), so the clause never states a value
// detection didn't report.  Mirrors ``_override_detected_clause`` in
// src/api/audit.py (display-only mirror: the audit's
// detection_overridden item stays backend-composed; this string decides
// nothing but the row's description text).
export function overrideDetectedClause(m: DetectionOverride): string {
  const parts: string[] = [];
  if (m.detectedLanesTotal !== undefined) {
    const lanesWord = m.detectedLanesTotal === 1 ? "lane" : "lanes";
    const directional = (
      [
        [m.detectedLanesForward, "forward"],
        [m.detectedLanesBackward, "backward"],
        [m.detectedLanesBothWays, "both-ways"],
      ] as const
    )
      .filter(([v]) => v !== undefined)
      .map(([v, label]) => `${v} ${label}`);
    let clause = `${m.detectedLanesTotal} total ${lanesWord}`;
    if (directional.length > 0) clause += ` (${directional.join(", ")})`;
    parts.push(clause);
  }
  if (m.detectedOneway !== undefined) {
    parts.push(`a one-way road (oneway=${m.detectedOneway})`);
  }
  return parts.join("; ");
}
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

// Server schema speed domain per scenario kind — mirrors the Pydantic
// bounds in src/api/schemas.py (multiples of 5 inside the MUTCD Table
// 6C-2 range the rules engine can resolve). OSM `maxspeed` can carry
// values off the grid: km/h conversions land on arbitrary integers
// (100 km/h → 62 mph) and rural US tags reach 80 mph. Snapping +
// clamping here means auto-apply only ever produces speeds the server
// schema accepts, instead of handing the user a validation error for a
// value the app filled in itself (audit fix B-04).
const SPEED_RANGE: Record<Scenario["kind"], readonly [number, number]> = {
  shoulder: [20, 75],
  flagger_lane_closure: [20, 55],
  lane_closure_divided: [35, 75],
  work_beyond_shoulder: [20, 75],
  mobile_op_2lane: [25, 55],
  mobile_op_multilane: [45, 75],
  near_intersection: [25, 55],
};

export function snapSpeedToDomain(
  kind: Scenario["kind"],
  mph: number,
): number {
  const [min, max] = SPEED_RANGE[kind];
  const snapped = Math.round(mph / 5) * 5;
  return Math.min(max, Math.max(min, snapped));
}

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
      ? { speed: snapSpeedToDomain(scenario.kind, c.speedLimitMph) }
      : {};

  switch (scenario.kind) {
    case "shoulder": {
      const lanesApplicable = true;
      const lanesApplied = c.lanesPerDirection !== undefined;
      // Clamp to the schema domain (1..4): OSM can tag more lanes per
      // direction than the backend accepts or the sheet can draw.
      const lanesPatch =
        lanesApplied && c.lanesPerDirection !== undefined
          ? { lanes: clampLanesToDomain(c.lanesPerDirection) }
          : {};
      return {
        scenario: {
          ...scenario,
          roadType: c.roadType,
          divided: c.divided,
          laneWidth: c.laneWidthFt,
          // Relay the raw OSM total for the backend single-lane gate
          // (issue #136).  Pure fact; drives no geometry here.
          detectedLanesTotal: c.detectedLanesTotal,
          // Relay the per-direction lane tags for the backend lane-count
          // consistency caution (issue #120).  Pure facts; the audit
          // flags total != forward + backward + both_ways.
          detectedLanesForward: c.detectedLanesForward,
          detectedLanesBackward: c.detectedLanesBackward,
          detectedLanesBothWays: c.detectedLanesBothWays,
          // Fresh detection supersedes any recorded override (#177):
          // the old dispute was about relays this patch just replaced.
          detectionOverrides: undefined,
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
      // Relay the raw OSM total for the backend single-lane gate (#136);
      // flagger has no `lanes` field, so this is its only lane-count relay.
      // Relay the raw OSM `oneway` tag for the directionality gate (#158) —
      // detection folds `oneway` into `divided`/`roadType`, so the raw tag
      // is carried separately for the flagger one-way refusal.
      const next = {
        ...scenario,
        laneWidth: c.laneWidthFt,
        detectedLanesTotal: c.detectedLanesTotal,
        oneway: c.detectedOneway,
        // Per-direction lane relays (issue #120) — same consistency
        // caution as shoulder; flagger has no lane field, so the audit
        // item is the only consumer.
        detectedLanesForward: c.detectedLanesForward,
        detectedLanesBackward: c.detectedLanesBackward,
        detectedLanesBothWays: c.detectedLanesBothWays,
        // Fresh detection supersedes any recorded override (#177):
        // the old dispute was about relays this patch just replaced.
        detectionOverrides: undefined,
        ...speedPatch,
      };
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
    case "near_intersection": {
      // Mainline only — approaches are proposed via the picker's
      // cross-street candidate, never silently written here.  Mainline
      // lanes are deliberately NOT auto-applied: the kind needs >= 2
      // lanes per direction and OSM lane counts are turn-lane-inflated
      // near intersections (the parked mainline-confidence issue stays
      // parked; the user sets the count).
      const next = { ...scenario, laneWidth: c.laneWidthFt, ...speedPatch };
      const delta = baseDelta(speedApplied, speedApplicable);
      if (FLAGGER_TYPES.has(c.roadType as FlaggerRoadType)) {
        next.roadType = c.roadType as FlaggerRoadType;
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
