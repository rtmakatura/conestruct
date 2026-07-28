// Shared types for the unified road-detection pipeline.  This module is
// the single source of truth for the data shapes that flow from
// /api/road-bearing through to the LocationPickerModal's property panel
// and on to applyClassification.  Both server (route handler) and client
// (modal) import from here so the contract is symmetric.

import type { RoadType } from "../scenarios";
import type { RoadFieldOverrides } from "../scenarios/overrides";

export type Confidence = "high" | "medium" | "low";

// Per-field detection metadata, alongside the value itself, so the UI
// can show *where* the value came from and how trustworthy that source
// is.  Keeps the verification UI honest: an OSM-tag-backed value gets
// "high" + the literal tag string, a class-fallback gets "low" + the
// fallback label.
export interface DetectedField<T> {
  value: T;
  confidence: Confidence;
  source: string;
  /**
   * How the value was obtained, independent of the confidence pips:
   * ``measured`` = read from a real OSM tag for this exact attribute (a
   * posted maxspeed, a lanes count, an unambiguous class → type
   * mapping); ``inferred`` = derived or fell back from the road class
   * because OSM did not record the attribute.  Drives the short
   * provenance label and its color — amber (the warning role) marks
   * inferred values only, so a measured value never borrows the warning
   * tone (#152 follow-up).  Set at classify time where the
   * tag-vs-fallback fact is known; never re-derived downstream.
   */
  method: "measured" | "inferred";
  rawData?: string;
}

// One road candidate returned by /api/road-bearing after dedup.  Each
// candidate is one *deduplicated cluster* of OSM ways (same logical
// road), represented by the geometrically nearest way in the cluster.
// All OSM tags needed to derive road properties (speed, lanes,
// roadType, divided) ride along so the client can synthesize a
// RoadClassification at candidate-pick time without a second round trip.
export interface RoadCandidate {
  way_id: string;
  highway_class: string;
  name: string | null;
  ref: string | null;
  bearing: number;
  snap_distance_m: number;
  snapped_lat: number;
  snapped_lng: number;
  tags: {
    oneway: string | null;
    maxspeed: string | null;
    lanes: string | null;
    lanes_forward: string | null;
    lanes_backward: string | null;
    // Center turn lane / two-way-left-turn-lane count (issue #120): a
    // correctly tagged TWLTL road has lanes = forward + backward +
    // both_ways, so the lane-count consistency check must include this
    // term or it flags most center-turn-lane arterials as defective.
    lanes_both_ways: string | null;
    // Turn-lane markers (near_intersection #117): presence signals
    // that OSM's `lanes` count likely includes turn pockets, so a
    // prefilled lane count needs user confirmation.
    turn_lanes: string | null;
    turn_lanes_forward: string | null;
    turn_lanes_backward: string | null;
  };
  /**
   * Distance from this candidate's snapped point to the nearest
   * highway=traffic_signals node in the same query, or null when none
   * is within the search radius.  Drives the `signalized` default for
   * cross-street approaches (near_intersection #117).
   */
  signal_distance_m: number | null;
}

// Full response from /api/road-bearing.  `isUrban` and `placeName`
// describe the *pin location*, not any individual candidate — they
// come from a single Overpass place-node lookup that runs in the same
// round trip as the way query.
export interface RoadDetectResponse {
  candidates: RoadCandidate[];
  primary_index: number | null;
  isUrban: boolean;
  placeName: string | null;
}

// Final classification shape consumed by the LocationPickerModal's
// property panel and applyClassification in lib/scenarios/auto-apply.ts.
// Synthesized from the picked candidate's tags + the response-level
// isUrban flag via classifyFromOsmTags.
/**
 * The road choice the operator committed at Save & Close, persisted on
 * ``scenario.meta.confirmedRoad`` so it survives picker close/reopen
 * and page reload (it rides the saved plan's ``data`` verbatim).  This
 * is the root-cause fix for the lost-confirmations bug: the choice used
 * to live only in picker-local state and evaporated at Save.
 *
 * The contract it carries: a confirmed choice is permanent until the
 * pin moves.  Reopening the picker with an unmoved pin restores this
 * state as-is and fires ZERO detect calls; ``pinLat``/``pinLng`` are
 * the staleness key — a pin that no longer matches invalidates the
 * record and re-detection runs as usual.
 */
export interface ConfirmedRoad {
  /** The picked candidate — road identity (way id, name, ref) plus the
   *  OSM tags needed to re-render the selection without a network call. */
  candidate: RoadCandidate;
  /** Classification synthesized from the candidate at confirm time. */
  classification: RoadClassification;
  /** How the road was determined: auto-adopted sole candidate, or an
   *  explicit operator pick among multiple. */
  method: "auto_single" | "operator_pick";
  /** Operator edits on top of the classification at confirm time —
   *  restored so the reopened picker shows exactly what was applied. */
  overrides: RoadFieldOverrides;
  /** Pin-level place context from the detection response, needed if the
   *  operator re-picks from the restored state. */
  isUrban: boolean;
  placeName: string | null;
  /** The pin this road was confirmed at — the staleness key. */
  pinLat: number;
  pinLng: number;
}

export interface RoadClassification {
  roadType: RoadType;
  divided: boolean;
  laneWidthFt: number;
  lanesPerDirection?: number;
  /** Raw OSM `lanes` total (issue #136), relayed to the backend
   *  single-lane eligibility gate.  Undefined when OSM had no `lanes`
   *  tag.  See ShoulderScenario.detectedLanesTotal. */
  detectedLanesTotal?: number;
  /** Raw OSM `oneway` tag value (issue #158), relayed to the backend
   *  flagger directionality gate.  Undefined when OSM carried no `oneway`
   *  tag.  See FlaggerLaneClosureScenario.oneway. */
  detectedOneway?: string;
  /** Parsed OSM `lanes:forward` / `lanes:backward` / `lanes:both_ways`
   *  counts (issue #120), relayed unchanged to the backend lane-count
   *  consistency check alongside `detectedLanesTotal`.  Pure facts —
   *  they drive no geometry or label here.  Each is undefined when OSM
   *  carried no such tag, so a sparsely-tagged way never trips the
   *  check (the check needs total, forward, AND backward to fire). */
  detectedLanesForward?: number;
  detectedLanesBackward?: number;
  detectedLanesBothWays?: number;
  speedLimitMph?: number;
  confidence: Confidence;
  source: "osm-tags";
  raw: {
    class: string;
    /** Folded boolean (`oneway=yes` or `-1`); the raw tag string is
     *  `osmOnewayTag`. */
    oneway: boolean;
    roadName: string | null;
    roadRef: string | null;
    placeName: string | null;
    /** The OSM `lanes` tag only — never a `lanes:forward` stand-in
     *  (issue #178); the directional tags have their own members. */
    osmLanesTag: string | null;
    osmMaxspeedTag: string | null;
    /** Raw directional lane tags and the raw `oneway` string (issue
     *  #178) — the evidence behind the #120/#158 relays, printed in the
     *  replication snapshot so the relays are cross-referenceable.
     *  Optional (not `| null` only) so pre-existing fixtures compile;
     *  classifyFromOsmTags always populates them. */
    osmLanesForwardTag?: string | null;
    osmLanesBackwardTag?: string | null;
    osmLanesBothWaysTag?: string | null;
    osmOnewayTag?: string | null;
  };
  fields: {
    speed: DetectedField<number | null>;
    lanes: DetectedField<number | null>;
    roadType: DetectedField<RoadType>;
    divided: DetectedField<boolean>;
  };
}
