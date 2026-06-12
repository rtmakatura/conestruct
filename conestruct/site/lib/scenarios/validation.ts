// Client-side input validation for scenario forms (UX audit finding
// UX-21).  Mirrors the backend gates so the UI can refuse to generate
// a plan the render API would reject — instantly, without a round
// trip.  The backend stays authoritative: ``workLen`` has a Pydantic
// ``gt=0`` floor (schemas.py) and ``validate_corridor_geometry``
// raises HTTP 400 on WORK_ZONE_SHORTER_THAN_TAPER, so drift in this
// mirror fails safe.  Mapbox-free by design — unit-tested via vitest
// like lib/scenarios/overrides.ts.

import { minWorkZoneFt } from "../corridor-spacing";
import type { Scenario } from "./types";

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
  return { ok: true, minFt, message: null };
}
