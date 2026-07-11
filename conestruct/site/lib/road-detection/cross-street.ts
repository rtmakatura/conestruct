// Cross-street candidate derivation for the near_intersection kind
// (#117, Option C increment 4).  Pure module: the LocationPickerModal's
// "mark the intersection" second pin runs the same /api/road-bearing
// detection at the intersection point, then this file turns that
// response into ONE proposed cross-street prefill for the approach
// form.  Detection proposes, the user disposes — every derived value
// lands in an editable field, and the lane count additionally carries
// a needs-confirmation flag (OSM lane counts near intersections are
// routinely inflated by turn pockets).

import { M_PER_FT, haversineM, initialBearingDeg } from "../geodesy";
import { snapSpeedToDomain } from "../scenarios/auto-apply";
import type { NearIntersectionApproach } from "../scenarios/types";
import { clampLanesToDomain } from "../scenarios/validation";
import { lanesPerDirectionFromTags, parseMaxspeedToMph } from "./classify";
import type { RoadCandidate, RoadDetectResponse } from "./types";

// A signal node this close to the cross street's snapped point means
// the intersection is signal-controlled.  Same magnitude as the
// route's SNAP_MAX_DISTANCE_M — a signal across a wide intersection
// still counts; one at the next block over doesn't.
const SIGNAL_NEARBY_M = 30;

// A candidate whose bearing is within this many degrees of the
// mainline's (mod 180 — either direction of travel) is the mainline
// itself, or a frontage road running parallel to it; never propose it
// as the cross street.
const PARALLEL_TOLERANCE_DEG = 25;

export interface CrossStreetCandidate {
  /** Display name of the proposed cross street, when OSM has one. */
  name: string | null;
  /**
   * Derived crossing point on the mainline station axis (0 =
   * downstream end of the work zone, increasing upstream), rounded to
   * whole feet.  Shown in an editable field — a sloppy second pin is
   * off by tens of feet, and the user corrects it there.
   */
  alongStationFt: number;
  /** One direction of travel (oneway cross street) or two. */
  legCount: 1 | 2;
  /** True when a traffic-signal node sits within SIGNAL_NEARBY_M. */
  signalized: boolean;
  /** Parsed + snapped posted speed, or null when OSM has no tag. */
  speedMph: number | null;
  /** Lanes per direction from OSM tags, clamped 1–4; null = no tag. */
  lanesPerDirection: number | null;
  /**
   * Always true in practice for this kind (approach lane counts are
   * never silently committed) — but when OSM shows explicit turn-lane
   * markers the form upgrades its copy to say WHY the count is
   * suspect.
   */
  lanesSuspect: boolean;
  lanesSuspectReason: string | null;
  roadType: "rural_undivided" | "urban_arterial";
  /** Approach bearing (the OSM way's direction at the crossing). */
  bearingDeg: number;
}

export interface DeriveCrossStreetInput {
  /** Detection response from /api/road-bearing at the SECOND pin. */
  detection: RoadDetectResponse;
  /** The picked mainline's identity, to exclude it from candidates. */
  mainlineWayId: string | null;
  mainlineName: string | null;
  mainlineBearingDeg: number;
  /** Work-zone anchor pin (the corridor anchor). */
  anchorLat: number;
  anchorLng: number;
  /** The intersection pin. */
  crossLat: number;
  crossLng: number;
  /**
   * Length of the downstream taper in the corridor spec — the anchor
   * pin sits at the corridor's downstream tip, one downstream-taper
   * length below station 0 (lib/corridor-polyline.ts convention:
   * anchor(0) → downstream taper → work zone → …).
   */
  downstreamTaperFt: number;
}

/** Smallest angular difference between two bearings, ignoring
 * direction of travel (mod 180). */
export function bearingDeltaMod180(a: number, b: number): number {
  const d = Math.abs(((a - b) % 180) + 180) % 180;
  return Math.min(d, 180 - d);
}

/**
 * Signed distance (ft) from the anchor pin to the cross pin, measured
 * along the mainline bearing (positive = upstream, the direction
 * stations grow), then shifted into the work-zone station frame.
 */
export function alongStationFromPins(
  anchorLat: number,
  anchorLng: number,
  crossLat: number,
  crossLng: number,
  mainlineBearingDeg: number,
  downstreamTaperFt: number,
): number {
  const distM = haversineM(anchorLat, anchorLng, crossLat, crossLng);
  const brg = initialBearingDeg(anchorLat, anchorLng, crossLat, crossLng);
  const theta = ((brg - mainlineBearingDeg) * Math.PI) / 180;
  const alongFt = (distM / M_PER_FT) * Math.cos(theta);
  return Math.round(alongFt - downstreamTaperFt);
}

function pickCrossCandidate(
  detection: RoadDetectResponse,
  mainlineWayId: string | null,
  mainlineName: string | null,
  mainlineBearingDeg: number,
): RoadCandidate | null {
  const eligible = detection.candidates.filter((c) => {
    if (mainlineWayId !== null && c.way_id === mainlineWayId) return false;
    if (
      mainlineName !== null &&
      c.name !== null &&
      c.name.toLowerCase() === mainlineName.toLowerCase()
    ) {
      return false;
    }
    return (
      bearingDeltaMod180(c.bearing, mainlineBearingDeg) > PARALLEL_TOLERANCE_DEG
    );
  });
  if (eligible.length === 0) return null;
  return eligible.reduce((best, c) =>
    c.snap_distance_m < best.snap_distance_m ? c : best,
  );
}

/**
 * Turn-lane suspicion: OSM counts turn pockets in `lanes` near
 * intersections.  Explicit `turn:lanes*` tags, or a total that isn't
 * the symmetric forward+backward sum, are the strong markers; either
 * upgrades the needs-confirmation copy from "verify this" to "OSM
 * counts turn pockets here".
 */
export function lanesSuspicion(tags: RoadCandidate["tags"]): {
  suspect: boolean;
  reason: string | null;
} {
  if (tags.turn_lanes || tags.turn_lanes_forward || tags.turn_lanes_backward) {
    return {
      suspect: true,
      reason:
        "The map data shows marked turn lanes here — its lane count " +
        "usually includes turn pockets, so the through-lane count is " +
        "often lower.",
    };
  }
  const total = Number(tags.lanes);
  const fwd = Number(tags.lanes_forward);
  const bwd = Number(tags.lanes_backward);
  if (
    Number.isFinite(total) &&
    Number.isFinite(fwd) &&
    Number.isFinite(bwd) &&
    total !== fwd + bwd
  ) {
    return {
      suspect: true,
      reason:
        "The map data's total lane count doesn't match its per-direction " +
        "counts — a marker for turn pockets or a center turn lane.",
    };
  }
  return { suspect: false, reason: null };
}

/**
 * Derive the single proposed cross street from a second-pin detection,
 * or null when nothing near the pin qualifies (the form then falls
 * back to manual entry — detection is a convenience, not a
 * dependency).
 */
/**
 * Turn a proposed cross street into the scenario's approaches array.
 * Ids are generated here ("cross_a"/"cross_b") — never user-typed —
 * so the backend's pattern/uniqueness/reserved-id 422s stay
 * unrepresentable.  A missing speed or lane tag falls back to the
 * form's conservative defaults (30 mph, 1 lane); both remain fully
 * editable, and the lane count is additionally held for explicit
 * confirmation by the form when it was detection-filled.
 */
export function approachesFromCrossStreet(
  cs: CrossStreetCandidate,
): NearIntersectionApproach[] {
  const base = {
    speed: cs.speedMph ?? 30,
    roadType: cs.roadType,
    lanesPerDirection: cs.lanesPerDirection ?? 1,
    laneWidth: 12,
    signalized: cs.signalized,
    alongStationFt: cs.alongStationFt,
  };
  const legA: NearIntersectionApproach = {
    id: "cross_a",
    ...base,
    bearingDeg: cs.bearingDeg,
  };
  if (cs.legCount === 1) return [legA];
  return [
    legA,
    {
      id: "cross_b",
      ...base,
      bearingDeg: (cs.bearingDeg + 180) % 360,
    },
  ];
}

export function deriveCrossStreet(
  input: DeriveCrossStreetInput,
): CrossStreetCandidate | null {
  const cand = pickCrossCandidate(
    input.detection,
    input.mainlineWayId,
    input.mainlineName,
    input.mainlineBearingDeg,
  );
  if (!cand) return null;

  const rawSpeed = parseMaxspeedToMph(cand.tags.maxspeed);
  const speedMph =
    rawSpeed === null ? null : snapSpeedToDomain("near_intersection", rawSpeed);
  const rawLanes = lanesPerDirectionFromTags(cand.tags);
  const lanesPerDirection =
    rawLanes === undefined ? null : clampLanesToDomain(rawLanes);
  const { suspect, reason } = lanesSuspicion(cand.tags);
  const oneway = cand.tags.oneway === "yes" || cand.tags.oneway === "-1";

  return {
    name: cand.name ?? cand.ref,
    alongStationFt: alongStationFromPins(
      input.anchorLat,
      input.anchorLng,
      input.crossLat,
      input.crossLng,
      input.mainlineBearingDeg,
      input.downstreamTaperFt,
    ),
    legCount: oneway ? 1 : 2,
    signalized:
      cand.signal_distance_m !== null &&
      cand.signal_distance_m <= SIGNAL_NEARBY_M,
    speedMph,
    lanesPerDirection,
    lanesSuspect: suspect,
    lanesSuspectReason: reason,
    roadType: input.detection.isUrban ? "urban_arterial" : "rural_undivided",
    bearingDeg: cand.bearing,
  };
}
