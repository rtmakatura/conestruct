// Shared types for the unified road-detection pipeline.  This module is
// the single source of truth for the data shapes that flow from
// /api/road-bearing through to the LocationPickerModal's property panel
// and on to applyClassification.  Both server (route handler) and client
// (modal) import from here so the contract is symmetric.

import type { RoadType } from "../scenarios";

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
export interface RoadClassification {
  roadType: RoadType;
  divided: boolean;
  laneWidthFt: number;
  lanesPerDirection?: number;
  speedLimitMph?: number;
  confidence: Confidence;
  source: "osm-tags";
  raw: {
    class: string;
    oneway: boolean;
    roadName: string | null;
    roadRef: string | null;
    placeName: string | null;
    osmLanesTag: string | null;
    osmMaxspeedTag: string | null;
  };
  fields: {
    speed: DetectedField<number | null>;
    lanes: DetectedField<number | null>;
    roadType: DetectedField<RoadType>;
    divided: DetectedField<boolean>;
  };
}
