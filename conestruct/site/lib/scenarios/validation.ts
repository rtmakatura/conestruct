// Client-side input validation for scenario forms (UX audit finding
// UX-21).  Mirrors the backend SCHEMA bounds only (Pydantic ``gt=0`` /
// ``le=WORK_LEN_MAX_FT`` on ``workLen``, the lanes bounds) so the UI can
// refuse a payload the render API would 422 — instantly, without a round
// trip.  MUTCD geometry rules are NOT mirrored here: they are MUTCD math,
// owned by the backend (validate_corridor_geometry; the taper floor that
// used to be one is gone since #382), and reach the UI as the audit
// fetch's HTTP 400 (engine-removal PR D — rule 3, no parallel frontend
// computation).  Mapbox-free by design — unit-tested via vitest like
// lib/scenarios/overrides.ts.

import type { Scenario } from "./types";

// Mirrors WORK_LEN_MAX_FT in src/api/schemas.py — the Pydantic
// ``le=`` ceiling on every scenario kind's ``workLen`` (itself matching
// the DetectSiteRequest.work_zone_ft cap).  Backend stays authoritative:
// drift here fails safe (the 422 still blocks; the user just loses the
// inline hint).
export const MAX_WORK_LEN_FT = 20000;

// Mirrors the lanes bounds in src/api/schemas.py (multi-lane
// wire-through): ``lanes`` is capped at 4 per direction, and the
// combination lanes x laneWidth + shoulder may not exceed
// MAX_DRAWABLE_HALF_ROAD_FT — the widest half-road the plan sheet can
// draw at its fixed vertical scale (verified against real renders).
// Backend stays authoritative; drift here fails safe as a 422.
export const MAX_LANES_PER_DIRECTION = 4;
export const MAX_DRAWABLE_HALF_ROAD_FT = 52;

// #335: display-only mirror of FREEWAY_MIN_LANE_WIDTH_FT in
// src/rules/validators.py (CDOT S-630-1 Sheet 7 Case 11 "11' MIN.").  It
// decides only which recovery the drawable refusal names; the backend
// owns the rule (Rule 3).
const FREEWAY_MIN_LANE_WIDTH_FT = 11;

/** The shoulder width the drawable check adds to the lanes, as both
 *  validators derive it: 10 ft behind a divided SHOULDER plan, 8 ft
 *  otherwise (`src/api/schemas.py:410`); near_intersection is
 *  mainline-only and always 8 (`src/api/schemas.py:722-726`: "under
 *  Option C the cross street is never drawn … so the drawable bound does
 *  not apply to approaches"). */
export function shoulderWidthFt(kind: Scenario["kind"], divided: boolean): number {
  return kind === "shoulder" && divided ? 10 : 8;
}

/**
 * The widest lane the sheet can draw at this lane count — the inverse of
 * the drawable-half-road check, at the 0.5-ft step the width control
 * offers.
 *
 * TRACED, not chosen (Rule 12).  `MAX_DRAWABLE_HALF_ROAD_FT` is 52 ft:
 * "the widest half-road (work-direction lanes + shoulder) the plan sheet
 * can draw at its fixed 3.5 pt/ft vertical scale.  Verified empirically:
 * at 52 ft (e.g. 3 lanes x 14 ft + 10 ft shoulder) the sheet renders
 * cleanly; beyond it the road collides with the title block and
 * dimension callouts" (src/api/schemas.py:50-57).  The backend publishes
 * the same arithmetic in its own refusal — "Use a lane width of
 * {max_width:.1f} ft or less" — so this is a mirror of a stated bound,
 * not a second rule (Rule 3).
 *
 * At the 4-lane ceiling that works out to 11 ft undivided and 10.5 ft
 * divided, both of which the 9–14 ft control offers.
 */
export function laneWidthCeilingFt(
  kind: Scenario["kind"],
  lanes: number,
  divided: boolean,
): number {
  const shoulder = shoulderWidthFt(kind, divided);
  return Math.floor(((MAX_DRAWABLE_HALF_ROAD_FT - shoulder) / lanes) * 2) / 2;
}

/** Clamp an OSM-detected or user-override lane count into the schema
 * domain (1..MAX_LANES_PER_DIRECTION). */
export function clampLanesToDomain(lanes: number): number {
  const whole = Math.round(lanes);
  return Math.min(MAX_LANES_PER_DIRECTION, Math.max(1, whole));
}

/** #310: the road's lane count as the `roadLanesPerDirection` relay — the
 *  count unclamped (the backend says when the plan draws fewer), or
 *  nothing when it isn't a whole count of at least 1.  An OSM tag can
 *  parse to 0; sending it would 422 the whole render (the wire's `ge=1`),
 *  the failure `clampLanesToDomain` exists to prevent. */
export function roadLanesRelay(lanes: number | undefined): number | undefined {
  return lanes !== undefined && Number.isInteger(lanes) && lanes >= 1 ? lanes : undefined;
}

export interface LanesValidation {
  ok: boolean;
  /** Inline error message; null when ok. */
  message: string | null;
}

/** Mirror of the backend's drawable-half-road cross-check (the shoulder
 * and near_intersection kinds — the two with a ``lanes`` field). */
export function validateLanes(scenario: Scenario): LanesValidation {
  if (scenario.kind !== "shoulder" && scenario.kind !== "near_intersection") {
    return { ok: true, message: null };
  }
  // The near-intersection layout merges the closed lane's traffic into
  // an adjacent same-direction lane, so it needs at least 2 lanes per
  // direction (src/generation/layout.py raises below 2 — a floor the
  // schema alone can't see).
  const minLanes = scenario.kind === "near_intersection" ? 2 : 1;
  if (
    !Number.isInteger(scenario.lanes) ||
    scenario.lanes < minLanes ||
    scenario.lanes > MAX_LANES_PER_DIRECTION
  ) {
    const flaggerHint =
      scenario.kind === "near_intersection" && scenario.lanes < 2
        ? " With one lane each way, traffic can't merge around the closure. That's a flagger job, not this plan type."
        : "";
    return {
      ok: false,
      message:
        `Lanes per direction must be between ${minLanes} and ` +
        `${MAX_LANES_PER_DIRECTION}.${flaggerHint}`,
    };
  }
  const shoulderFt = scenario.kind === "shoulder" && scenario.divided ? 10 : 8;
  const halfRoad = scenario.lanes * scenario.laneWidth + shoulderFt;
  if (halfRoad > MAX_DRAWABLE_HALF_ROAD_FT) {
    // Widest lane the slider offers (0.5-ft steps) that still fits.
    const maxWidth =
      Math.floor(((MAX_DRAWABLE_HALF_ROAD_FT - shoulderFt) / scenario.lanes) * 2) / 2;
    const exceeds =
      `${scenario.lanes} lanes × ${scenario.laneWidth} ft + ${shoulderFt} ft shoulder ` +
      `is wider than the plan sheet can draw (${MAX_DRAWABLE_HALF_ROAD_FT} ft per ` +
      `direction).`;
    // #335: mirrors the backend's freeway branch — a narrower lane trips
    // the 11 ft freeway minimum, so the only recovery is fewer lanes.
    if (
      scenario.kind === "shoulder" &&
      scenario.roadType === "freeway" &&
      maxWidth < FREEWAY_MIN_LANE_WIDTH_FT
    ) {
      const fitLanes = Math.floor(
        (MAX_DRAWABLE_HALF_ROAD_FT - shoulderFt) / FREEWAY_MIN_LANE_WIDTH_FT,
      );
      return {
        ok: false,
        message:
          `${exceeds} Freeway lanes must be at least ${FREEWAY_MIN_LANE_WIDTH_FT} ft, ` +
          `so the sheet draws at most ${fitLanes} lanes per direction. ` +
          `Set lanes to ${fitLanes}.`,
      };
    }
    return {
      ok: false,
      message: `${exceeds} Use a lane width of ${maxWidth} ft or less, or fewer lanes.`,
    };
  }
  return { ok: true, message: null };
}

/** #428: is the work-zone length box empty?  An emptied box writes 0 and
 *  drops the operator's `workLen` record (clearWorkLen); a typed 0 is the
 *  operator's (setWorkLen keeps the record).  The record check is
 *  isOperatorSet's (guesses.ts), inlined because guesses.ts imports this
 *  module through auto-apply.ts. */
export function workLenIsEmpty(s: Scenario): boolean {
  return s.workLen === 0 && !(s.meta.operatorSet?.includes("workLen") ?? false);
}

export interface WorkZoneValidation {
  ok: boolean;
  /** Inline error message; null when ok. */
  message: string | null;
}

// Schema-bound checks only (Pydantic gt=0 / le=WORK_LEN_MAX_FT).  The
// MUTCD taper floor that used to live here left in engine-removal PR D,
// and the backend dropped its own in #382.  Geometry rules are the
// backend's: validate_corridor_geometry raises HTTP 400 (e.g.
// LANE_WIDTH_BELOW_FREEWAY_MIN) on the audit fetch that already fires
// per change, and GeneratorShell surfaces that message as the strip's
// INVALID INPUT + the Generate gate.  No client-side floor may return —
// a value computed here is one the audit trail can disagree with.
export function validateWorkZone(scenario: Scenario): WorkZoneValidation {
  const wz = scenario.workLen;

  // #428: an empty box (workLenIsEmpty) and NaN read "required"; a typed 0
  // is a number, below.
  if (!Number.isFinite(wz) || workLenIsEmpty(scenario)) {
    return {
      ok: false,
      message: "Work zone length is required.",
    };
  }
  // #403 / #428: a negative or typed 0 length is a number, not a missing
  // one.  Mirror of the backend's `workLen: float = Field(gt=0.0, ...)`
  // (src/api/schemas.py), which is authoritative; the message names that
  // bound (Rule 10).
  if (wz <= 0) {
    return {
      ok: false,
      message: "Work zone length must be more than 0 ft.",
    };
  }
  if (wz > MAX_WORK_LEN_FT) {
    return {
      ok: false,
      message:
        `Work zone can't exceed ${MAX_WORK_LEN_FT.toLocaleString("en-US")} ft ` +
        `(about 3.8 miles) on a single plan. Split a longer project into ` +
        `multiple plans.`,
    };
  }
  return { ok: true, message: null };
}

/** #429 (Ryan, 2026-10-29: "#429 yes (plain "yours", over-cap too)."): is
 *  the work-zone length the operator's number, refused by the form?  A
 *  negative, a typed 0 or a length over MAX_WORK_LEN_FT: a number
 *  validateWorkZone rejects, as against an empty box (workLenIsEmpty) or
 *  NaN, which it calls "required".  Derived from the validator, so the
 *  bounds stay in one place.  The WHERE band's marker reads it (plain
 *  "yours", no ✓). */
export function workLenIsRefused(s: Scenario): boolean {
  return Number.isFinite(s.workLen) && !workLenIsEmpty(s) && !validateWorkZone(s).ok;
}

// ---------------------------------------------------------------------------
// near_intersection approaches — mirrors both validation layers on the
// backend: the schema 422s (src/api/schemas.py IntersectionApproach /
// NearIntersectionScenario) AND the placement generator's ValueErrors
// (src/generation/layout.py near_intersection_stations), which today
// surface as 500s because the render path doesn't catch them.  Catching
// those three server-side is on the enablement checklist; until then
// this mirror is the only guard.
// ---------------------------------------------------------------------------

// Approach + mainline speed bounds for the kind (schemas.py: ge=25,
// le=55, multiple_of=5 — floor 25 per the increment-1 ruling).
export const NEAR_INTERSECTION_SPEED_MIN = 25;
export const NEAR_INTERSECTION_SPEED_MAX = 55;

export interface ApproachesValidation {
  ok: boolean;
  /** First inline error, in form order; null when ok. */
  message: string | null;
}

export function validateApproaches(scenario: Scenario): ApproachesValidation {
  if (scenario.kind !== "near_intersection") {
    return { ok: true, message: null };
  }
  const legs = scenario.approaches;
  if (legs.length < 1 || legs.length > 2) {
    return {
      ok: false,
      message:
        "Describe 1 or 2 cross-street directions: one for a T-intersection, " +
        "two when the cross street continues on both sides.",
    };
  }
  for (const leg of legs) {
    if (
      leg.speed < NEAR_INTERSECTION_SPEED_MIN ||
      leg.speed > NEAR_INTERSECTION_SPEED_MAX ||
      leg.speed % 5 !== 0
    ) {
      return {
        ok: false,
        message:
          `Cross-street speed must be between ${NEAR_INTERSECTION_SPEED_MIN} and ` +
          `${NEAR_INTERSECTION_SPEED_MAX} mph, in 5-mph steps.`,
      };
    }
    if (
      !Number.isInteger(leg.lanesPerDirection) ||
      leg.lanesPerDirection < 1 ||
      leg.lanesPerDirection > MAX_LANES_PER_DIRECTION
    ) {
      return {
        ok: false,
        message:
          `Cross-street lanes per direction must be between 1 and ` +
          `${MAX_LANES_PER_DIRECTION}.`,
      };
    }
    if (leg.laneWidth < 9 || leg.laneWidth > 14) {
      return {
        ok: false,
        message: "Cross-street lane width must be between 9 and 14 ft.",
      };
    }
  }

  // #290: under the work-start model the backend places the cross street
  // from the marked intersection (ruling 7) and refuses one inside the
  // work zone itself — the station checks below are the corridor_end
  // model's, run on a frontend-computed station that no longer exists.
  // What the frontend can check is that there is a marked intersection.
  if (scenario.meta.pinModel === "work_start") {
    // Only once there is a pin: before one there is nothing to mark the
    // cross street against, and the location's own reason is the truth.
    const located = scenario.meta.lat !== 0 && scenario.meta.lng !== 0;
    if (located && !scenario.meta.intersection) {
      return {
        ok: false,
        message: "Mark the cross street on the map. The plan places it from there.",
      };
    }
    return { ok: true, message: null };
  }

  // One cross street: both legs share the crossing point.  The form
  // holds a single field so disagreement is normally unrepresentable,
  // but the payload is validated, not the widgets (rule 10 posture).
  const along = legs[0].alongStationFt ?? Number.NaN;
  if (legs.some((leg) => leg.alongStationFt !== along)) {
    return {
      ok: false,
      message:
        "Both cross-street directions must use the same distance to the " +
        "intersection. Two different distances would describe two separate " +
        "cross streets, which needs two plans.",
    };
  }
  if (!Number.isFinite(along) || Math.abs(along) > MAX_WORK_LEN_FT) {
    return {
      ok: false,
      message:
        `The intersection must be within ` +
        `${MAX_WORK_LEN_FT.toLocaleString("en-US")} ft of the work zone.`,
    };
  }
  const wz = scenario.workLen;
  if (along >= 0 && along <= wz) {
    return {
      ok: false,
      message:
        "The cross street can't be inside the work zone. Conestruct supports " +
        "work near an intersection, not in it. Move the work zone or the " +
        "intersection distance so they don't overlap.",
    };
  }
  // Curb-to-curb box, same derivation as the layout: half-width = the
  // widest leg's lanes x lane width (symmetric two-way cross street).
  const halfCrossFt = Math.max(
    ...legs.map((leg) => leg.lanesPerDirection * leg.laneWidth),
  );
  const overlapsNear = along < 0 && along + halfCrossFt > 0;
  const overlapsFar = along > wz && along - halfCrossFt < wz;
  if (overlapsNear || overlapsFar) {
    return {
      ok: false,
      message:
        `The cross street's pavement (about ${Math.round(halfCrossFt)} ft each ` +
        `way from its centerline) reaches into the work zone. Work inside the ` +
        `intersection itself isn't supported. Shorten the work zone or ` +
        `increase the distance to the intersection.`,
    };
  }
  return { ok: true, message: null };
}
