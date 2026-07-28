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
