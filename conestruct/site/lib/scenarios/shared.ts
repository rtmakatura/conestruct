// MUTCD Table 6C-2 — Stopping Sight Distance / Buffer space (ft)
// Doubles as flagger station sight distance per MUTCD Table 6E-1.
export const BUFFER_TABLE: Record<number, number> = {
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

export function bufferFor(speed: number): number {
  return BUFFER_TABLE[Math.round(speed / 5) * 5] ?? 645;
}

// MUTCD § 6C.08 Equation 6C-1 — merging taper length L (ft)
// Speed >=45 mph: L = W * S
// Speed <45 mph:  L = W * S^2 / 60
export function mergingTaperLength(laneWidth: number, speed: number): number {
  return speed >= 45
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
