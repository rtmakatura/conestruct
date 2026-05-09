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
  urban_low: 350 + 350 + 350,
  urban_high: 350 + 350 + 350,
  rural: 500 + 500 + 500,
  expressway: 1000 + 1500 + 2640,
  freeway: 1000 + 1500 + 2640,
};

const TAPER_FORMULA_THRESHOLD_MPH = 40;

export type ClosureKind = "shoulder" | "lane" | "shifting";

export type AdvanceRoadCategory = keyof typeof ADVANCE_WARNING_TOTAL;

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
  flagger_lane_closure: "lane",
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

export function corridorTotalLengthFt(spec: CorridorSpec): number {
  return (
    spec.advanceWarningFt +
    spec.taperFt +
    spec.bufferFt +
    spec.workZoneFt +
    spec.downstreamTaperFt
  );
}
