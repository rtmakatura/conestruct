// MUTCD Table 6C-2 — Stopping Sight Distance / Buffer space (ft)
// Doubles as flagger station sight distance per MUTCD Table 6E-1.
// Keyed in 5-mph increments from 20 to 75 mph, matching the Python
// BUFFER_SPACE table in src/rules/tables.py.
export const BUFFER_TABLE: Record<number, number> = {
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

// Known, accepted divergence from Python src/rules/spacing.py::buffer_space:
// TS rounds in-range non-multiples to the nearest 5 (e.g. 42 → 40 → 305),
// while Python requires an exact multiple of 5 and raises on anything else.
// Both ends agree on exact multiples in [20, 75]; the TS rounding is
// intentional UX-side forgiveness, not a bug.  Out-of-range speeds throw
// with the same wording as Python so silent fabrication of a
// safety-critical distance cannot happen on either side.
export function bufferFor(speed: number): number {
  const snapped = Math.round(speed / 5) * 5;
  const buffer = BUFFER_TABLE[snapped];
  if (buffer === undefined) {
    throw new Error(
      `Speed ${speed} mph is not in MUTCD Table 6B-2; valid values are 20, 25, 30, ..., 75.`,
    );
  }
  return buffer;
}

// MUTCD § 6C.08 Equation 6C-1 — merging taper length L (ft)
// Speed >=40 mph: L = W * S
// Speed <40 mph:  L = W * S^2 / 60
export function mergingTaperLength(laneWidth: number, speed: number): number {
  return speed >= 40
    ? Math.round(laneWidth * speed)
    : Math.round((laneWidth * speed * speed) / 60);
}

// MUTCD § 6F.65 — channelizing device spacing in tapers/tangents
// Approximately equal to speed in feet on-center.
export function deviceSpacing(speed: number): number {
  return speed;
}

// Drums for night ops — retroreflective channelizers replace ~25% of cones
// (Conestruct heuristic; CDOT S-630 calls for Type IX sheeting at night.)
export function nightDrumCount(cones: number, night: boolean): number {
  return night ? Math.ceil(cones * 0.25) : 0;
}
