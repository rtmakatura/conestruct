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

/** Mirror of the backend's drawable-half-road cross-check (shoulder
 * kind only — it's the only kind with a ``lanes`` field). */
export function validateLanes(scenario: Scenario): LanesValidation {
  if (scenario.kind !== "shoulder") {
    return { ok: true, message: null };
  }
  if (
    !Number.isInteger(scenario.lanes) ||
    scenario.lanes < 1 ||
    scenario.lanes > MAX_LANES_PER_DIRECTION
  ) {
    return {
      ok: false,
      message: `Lanes per direction must be between 1 and ${MAX_LANES_PER_DIRECTION}.`,
    };
  }
  const shoulderFt = scenario.divided ? 10 : 8;
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
