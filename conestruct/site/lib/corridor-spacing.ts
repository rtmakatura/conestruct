// Client-side mirror of the MUTCD/CDOT spacing math used to size a
// corridor for the static-map preview.  The authoritative implementation
// is ``src/rules/spacing.py`` + ``src/rules/tables.py``; this is the
// minimal subset needed to draw an accurate preview without a backend
// round-trip.  Any drift between the two should be reconciled by
// re-running the Python tests, since field validation lives on that side.

import type { ScenarioKind } from "./scenarios";
import type { CorridorSpec } from "./corridor-map";

// Buffer space in feet, MUTCD Table 6B-2.
const BUFFER_BY_SPEED: Record<number, number> = {
  20: 115,
  25: 155,
  30: 200,
  35: 250,
  40: 305,
  45: 360,
  50: 425,
  55: 495,
  60: 570,
  65: 645,
  70: 730,
  75: 820,
};

// Advance-warning distances A+B+C in feet, MUTCD Table 6B-1.  Returned
// as a single sum since the corridor preview only needs the upstream
// extent.
const ADVANCE_WARNING_TOTAL: Record<string, number> = {
  urban_low: 100 + 100 + 100,
  urban_high: 350 + 350 + 350,
  rural: 500 + 500 + 500,
  expressway: 1000 + 1500 + 2640,
  freeway: 1000 + 1500 + 2640,
};

// Mirrors TAPER_LENGTH_FORMULA_THRESHOLD_MPH in src/rules/tables.py
// (MUTCD §6B.08: below 45 mph L = W×S²/60, at or above L = W×S).
const TAPER_FORMULA_THRESHOLD_MPH = 45;

// One-lane two-way traffic taper for flagger-controlled alternating
// flow — mirrors one_lane_two_way_taper_length() in
// src/rules/spacing.py (MUTCD §6B.08 ¶14: 50–100 ft band, Conestruct
// uses the 100 ft maximum; NOT the merging taper L — CDOT Case 17:
// "THIS TAPER MUST BE SHORT ENOUGH TO NOT BE MISTAKEN FOR A
// TRANSITION").  NOTE: the Python source is currently a CONSTANT; if
// it ever becomes parametric (e.g., a CDOT-permissive band pick),
// this mirror must be updated in lockstep — the value here is an
// assumption about spacing.py, not just a citation.
const ONE_LANE_TWO_WAY_TAPER_FT = 100;

export type ClosureKind = "shoulder" | "lane" | "shifting" | "one_lane_two_way";

export type AdvanceRoadCategory = keyof typeof ADVANCE_WARNING_TOTAL;

// Mirrors _map_road_type() in src/api/schemas.py — the backend's
// road_type → Table 6B-1 category mapping, including the speed-dependent
// urban_arterial split (urban_high above 40 mph, urban_low at or below).
// Unknown/absent road types return null so advanceWarningFt falls back
// to its speed-based heuristic.
export function roadCategoryForRoadType(
  roadType: string | null | undefined,
  speedMph: number,
): AdvanceRoadCategory | null {
  if (roadType === "rural_undivided" || roadType === "rural_divided") {
    return "rural";
  }
  if (roadType === "urban_arterial") {
    return speedMph > 40 ? "urban_high" : "urban_low";
  }
  if (roadType === "freeway") return "freeway";
  return null;
}

function fullTaperLengthFt(speedMph: number, offsetFt: number): number {
  if (speedMph < TAPER_FORMULA_THRESHOLD_MPH) {
    return (offsetFt * speedMph * speedMph) / 60;
  }
  return offsetFt * speedMph;
}

function taperLengthFt(
  closure: ClosureKind,
  speedMph: number,
  laneWidthFt: number,
  shoulderWidthFt: number,
): number {
  switch (closure) {
    case "shoulder":
      return fullTaperLengthFt(speedMph, shoulderWidthFt) / 3;
    case "shifting":
      return fullTaperLengthFt(speedMph, laneWidthFt) / 2;
    case "one_lane_two_way":
      return ONE_LANE_TWO_WAY_TAPER_FT;
    case "lane":
    default:
      return fullTaperLengthFt(speedMph, laneWidthFt);
  }
}

function bufferSpaceFt(speedMph: number): number {
  // Snap to the nearest 5-mph bucket if the user typed an off-grid value.
  const snap = Math.round(speedMph / 5) * 5;
  return BUFFER_BY_SPEED[snap] ?? 360;
}

function advanceWarningFt(speedMph: number, road: AdvanceRoadCategory | null): number {
  if (road && ADVANCE_WARNING_TOTAL[road] !== undefined) {
    return ADVANCE_WARNING_TOTAL[road];
  }
  if (speedMph <= 35) return ADVANCE_WARNING_TOTAL.urban_low;
  if (speedMph < 45) return ADVANCE_WARNING_TOTAL.urban_high;
  return ADVANCE_WARNING_TOTAL.rural;
}

const SCENARIO_TO_CLOSURE: Record<ScenarioKind, ClosureKind> = {
  shoulder: "shoulder",
  // PR 4: flagger uses the one-lane two-way taper — mapping it to
  // "lane" fed the merging-taper L into the corridor preview (540 ft
  // at 12 × 45) while the schematic/audit correctly showed 100 ft.
  flagger_lane_closure: "one_lane_two_way",
  lane_closure_divided: "lane",
  work_beyond_shoulder: "shoulder",
  mobile_op_2lane: "lane",
  mobile_op_multilane: "lane",
};

export interface BuildCorridorInput {
  anchorLat: number;
  anchorLng: number;
  bearingDeg: number;
  speedMph: number;
  workZoneFt: number;
  scenarioKind: ScenarioKind;
  // Optional overrides; defaults track CDOT typicals.
  laneWidthFt?: number;
  shoulderWidthFt?: number;
  numLanesClosed?: number;
  roadCategory?: AdvanceRoadCategory | null;
}

export function buildCorridorSpec(input: BuildCorridorInput): CorridorSpec {
  const {
    anchorLat,
    anchorLng,
    bearingDeg,
    speedMph,
    workZoneFt,
    scenarioKind,
    laneWidthFt = 12,
    shoulderWidthFt = 10,
    numLanesClosed = 1,
    roadCategory = null,
  } = input;

  const closure = SCENARIO_TO_CLOSURE[scenarioKind];
  const taperFt = taperLengthFt(closure, speedMph, laneWidthFt, shoulderWidthFt);
  const bufferFt = bufferSpaceFt(speedMph);
  const advanceFt = advanceWarningFt(speedMph, roadCategory);
  // Use the upper bound of the 50–100 ft-per-lane MUTCD range so the
  // preview corridor is conservative.
  const downstreamFt = numLanesClosed * 100;

  return {
    anchorLat,
    anchorLng,
    bearingDeg,
    advanceWarningFt: advanceFt,
    taperFt,
    bufferFt,
    workZoneFt,
    downstreamTaperFt: downstreamFt,
  };
}

// Minimum work-zone length for a scenario kind, in feet — the required
// taper length for that kind's closure mapping.  Client-side mirror of
// ``validate_corridor_geometry``'s WORK_ZONE_SHORTER_THAN_TAPER rule
// (src/rules/validators.py:1350): a work zone shorter than its taper is
// geometrically impossible to lay out, and the render API blocks it
// with HTTP 400.  This mirror exists purely for instant inline feedback
// (UX-21) — the backend stays authoritative, so drift here fails safe
// (the 400 still blocks; the user just loses the inline hint).  Any
// drift between the two should be reconciled by re-running the Python
// tests, same convention as the rest of this module.
//
// NOTE: the mobile kinds map to closure "lane" here AND in
// scenario_to_call (schemas.py), so this mirror faithfully reproduces
// the backend's taper floor on them — including the known
// trailing-distance/taper-floor collision on the gated mobile kinds
// (parked with the gated-kinds triage; unreachable while gated).
export function minWorkZoneFt(
  kind: ScenarioKind,
  speedMph: number,
  laneWidthFt: number,
  shoulderWidthFt: number,
): number {
  return taperLengthFt(
    SCENARIO_TO_CLOSURE[kind],
    speedMph,
    laneWidthFt,
    shoulderWidthFt,
  );
}

export function corridorTotalLengthFt(spec: CorridorSpec): number {
  return (
    spec.advanceWarningFt +
    spec.taperFt +
    spec.bufferFt +
    spec.workZoneFt +
    spec.downstreamTaperFt
  );
}
