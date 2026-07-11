// Client-side input validation for scenario forms (UX audit finding
// UX-21).  Mirrors the backend gates so the UI can refuse to generate
// a plan the render API would reject — instantly, without a round
// trip.  The backend stays authoritative: ``workLen`` has Pydantic
// ``gt=0`` / ``le=WORK_LEN_MAX_FT`` bounds (schemas.py) and ``validate_corridor_geometry``
// raises HTTP 400 on WORK_ZONE_SHORTER_THAN_TAPER, so drift in this
// mirror fails safe.  Mapbox-free by design — unit-tested via vitest
// like lib/scenarios/overrides.ts.

import { minWorkZoneFt } from "../corridor-spacing";
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

/** Clamp an OSM-detected or user-override lane count into the schema
 * domain (1..MAX_LANES_PER_DIRECTION). */
export function clampLanesToDomain(lanes: number): number {
  const whole = Math.round(lanes);
  return Math.min(MAX_LANES_PER_DIRECTION, Math.max(1, whole));
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
        ? " With one lane each way, traffic can't merge around the closure — that's a flagger job, not this plan type."
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
    return {
      ok: false,
      message:
        `${scenario.lanes} lanes × ${scenario.laneWidth} ft + ${shoulderFt} ft shoulder ` +
        `is wider than the plan sheet can draw (${MAX_DRAWABLE_HALF_ROAD_FT} ft per ` +
        `direction). Use a lane width of ${maxWidth} ft or less, or fewer lanes.`,
    };
  }
  return { ok: true, message: null };
}

export interface WorkZoneValidation {
  ok: boolean;
  /** Smallest whole-foot work-zone length the backend accepts. */
  minFt: number;
  /** Inline error message; null when ok. */
  message: string | null;
}

// Shoulder width per kind — mirrors the ``shoulder_width_ft`` values
// scenario_to_call hard-codes at the schemas bridge (schemas.py): the
// shoulder kind reads 10 ft divided / 8 ft undivided; the others carry
// fixed widths.  Only the shoulder kinds feed the taper math (L/3 uses
// the shoulder width); the rest are carried for completeness.
function shoulderWidthFtFor(scenario: Scenario): number {
  switch (scenario.kind) {
    case "shoulder":
      return scenario.divided ? 10 : 8;
    case "work_beyond_shoulder":
      return scenario.roadType === "rural_divided" ||
        scenario.roadType === "freeway"
        ? 10
        : 8;
    case "lane_closure_divided":
    case "mobile_op_multilane":
      return 10;
    case "flagger_lane_closure":
    case "mobile_op_2lane":
      return 8;
    case "near_intersection":
      // Undivided mainline — same 8 ft the backend's drawable-width
      // check assumes (schemas.py _check_drawable_road_width).
      return 8;
  }
}

// Human label for the taper that sets the minimum — driver-facing copy
// for the inline error.  The flagger label diverges from the backend's
// generic "merging taper (L)" string deliberately: flagger plans use
// the one-lane two-way taper (§6B.08 ¶14), and quoting a merging taper
// would contradict the schematic.
function taperLabelFor(scenario: Scenario): string {
  if (scenario.kind === "flagger_lane_closure") {
    return "one-lane two-way taper";
  }
  if (
    scenario.kind === "shoulder" ||
    scenario.kind === "work_beyond_shoulder"
  ) {
    return "shoulder taper (L/3)";
  }
  return "merging taper (L)";
}

export function validateWorkZone(scenario: Scenario): WorkZoneValidation {
  const minExact = minWorkZoneFt(
    scenario.kind,
    scenario.speed,
    scenario.laneWidth,
    shoulderWidthFtFor(scenario),
  );
  const minFt = Math.ceil(minExact);
  const wz = scenario.workLen;

  if (!Number.isFinite(wz) || wz <= 0) {
    return {
      ok: false,
      minFt,
      message:
        `Work zone length is required — at least ${minFt} ft ` +
        `(the ${taperLabelFor(scenario)} at ${scenario.speed} mph, ` +
        `MUTCD § 6C.08).`,
    };
  }
  if (wz < minExact) {
    return {
      ok: false,
      minFt,
      message:
        `Work zone must be at least ${minFt} ft — the required ` +
        `${taperLabelFor(scenario)} at ${scenario.speed} mph ` +
        `(MUTCD § 6C.08). Lengthen the work zone or reduce the speed.`,
    };
  }
  if (wz > MAX_WORK_LEN_FT) {
    return {
      ok: false,
      minFt,
      message:
        `Work zone can't exceed ${MAX_WORK_LEN_FT.toLocaleString("en-US")} ft ` +
        `(about 3.8 miles) on a single plan. Split a longer project into ` +
        `multiple plans.`,
    };
  }
  return { ok: true, minFt, message: null };
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
        "Describe 1 or 2 cross-street directions — one for a T-intersection, " +
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

  // One cross street: both legs share the crossing point.  The form
  // holds a single field so disagreement is normally unrepresentable,
  // but the payload is validated, not the widgets (rule 10 posture).
  const along = legs[0].alongStationFt;
  if (legs.some((leg) => leg.alongStationFt !== along)) {
    return {
      ok: false,
      message:
        "Both cross-street directions must use the same distance to the " +
        "intersection — two different distances would describe two separate " +
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
        "The cross street can't be inside the work zone — Conestruct supports " +
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
        `intersection itself isn't supported — shorten the work zone or ` +
        `increase the distance to the intersection.`,
    };
  }
  return { ok: true, message: null };
}
