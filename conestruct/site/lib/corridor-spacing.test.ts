// PR 4: the corridor preview is the client-side mirror of
// src/rules/spacing.py — these tests pin the flagger one-lane two-way
// taper (100 ft, mirroring one_lane_two_way_taper_length()) and the
// live-fixture total, plus a shoulder regression so the mirror cannot
// silently fall back to the merging-taper L for flagger again.

import { describe, expect, it } from "vitest";
import {
  buildCorridorSpec,
  corridorTotalLengthFt,
  minWorkZoneFt,
} from "./corridor-spacing";
import { snapSpeedToDomain } from "./scenarios";

const ANCHOR = { anchorLat: 38.7, anchorLng: -104.6, bearingDeg: 0 };

describe("buildCorridorSpec", () => {
  it("flagger uses the one-lane two-way taper (100 ft) and totals 2,460 ft on the live fixture", () => {
    // DEFAULT_FLAGGER live fixture: 45 mph, laneWidth 12, wz 400, rural.
    const spec = buildCorridorSpec({
      ...ANCHOR,
      speedMph: 45,
      workZoneFt: 400,
      scenarioKind: "flagger_lane_closure",
      laneWidthFt: 12,
      roadCategory: "rural",
    });
    expect(spec.taperFt).toBe(100); // NOT 540 = 12 × 45 (the pre-fix merging L)
    expect(spec.advanceWarningFt).toBe(1500);
    expect(spec.bufferFt).toBe(360);
    expect(spec.workZoneFt).toBe(400);
    expect(spec.downstreamTaperFt).toBe(100);
    expect(corridorTotalLengthFt(spec)).toBe(2460);
  });

  it("flagger taper is speed-independent (fixed band value)", () => {
    for (const speedMph of [25, 35, 55]) {
      const spec = buildCorridorSpec({
        ...ANCHOR,
        speedMph,
        workZoneFt: 400,
        scenarioKind: "flagger_lane_closure",
      });
      expect(spec.taperFt).toBe(100);
    }
  });

  it("shoulder keeps the L/3 shoulder taper (regression)", () => {
    const spec = buildCorridorSpec({
      ...ANCHOR,
      speedMph: 55,
      workZoneFt: 1000,
      scenarioKind: "shoulder",
      shoulderWidthFt: 10,
      roadCategory: "freeway",
    });
    // L/3 = (10 × 55) / 3 ≈ 183.33 — unchanged by the flagger fix.
    expect(spec.taperFt).toBeCloseTo(183.33, 1);
  });

  it("divided lane closure keeps the merging taper L (regression)", () => {
    const spec = buildCorridorSpec({
      ...ANCHOR,
      speedMph: 55,
      workZoneFt: 800,
      scenarioKind: "lane_closure_divided",
      laneWidthFt: 12,
    });
    expect(spec.taperFt).toBe(660); // L = 12 × 55
  });
});

// UX-01: the LocationPicker preview must clamp speed to the scenario
// kind's schema domain (snapSpeedToDomain) *before* feeding it to
// buildCorridorSpec — the same clamp the form applies on Save. This pins
// the SH-94 reproduction: an OSM-detected 65 mph on a flagger scenario
// (TA-10 domain [20, 55]) lands at 55, so the preview must show the 55
// numbers the form will keep, not the 65 numbers it will silently drop.
describe("buildCorridorSpec — UX-01 picker preview is post-clamp", () => {
  // DEFAULT_FLAGGER live fixture, rural, wz 400 — matches the modal's
  // SH-94 flagger handoff (effectiveRoadType rural_undivided → "rural").
  const flaggerPreview = (rawSpeedMph: number) =>
    buildCorridorSpec({
      ...ANCHOR,
      speedMph: snapSpeedToDomain("flagger_lane_closure", rawSpeedMph),
      workZoneFt: 400,
      scenarioKind: "flagger_lane_closure",
      laneWidthFt: 12,
      roadCategory: "rural",
    });

  it("clamps an OSM 65 mph to 55 → Buffer 495 / Total 2,595 (the value Save applies)", () => {
    const spec = flaggerPreview(65);
    expect(spec.bufferFt).toBe(495); // BUFFER_BY_SPEED[55], NOT 645
    expect(corridorTotalLengthFt(spec)).toBe(2595); // NOT the pre-clamp 2,745
  });

  it("pre-clamp 65 mph would have shown Buffer 645 / Total 2,745 (the bug this prevents)", () => {
    // Same inputs WITHOUT the clamp — documents the divergence the fix
    // closes: 645 − 495 = 150 ft of buffer, 2,745 − 2,595 = 150 ft total.
    const unclamped = buildCorridorSpec({
      ...ANCHOR,
      speedMph: 65,
      workZoneFt: 400,
      scenarioKind: "flagger_lane_closure",
      laneWidthFt: 12,
      roadCategory: "rural",
    });
    expect(unclamped.bufferFt).toBe(645);
    expect(corridorTotalLengthFt(unclamped)).toBe(2745);
  });

  it("an in-domain speed is unchanged (45 mph stays 45 → Buffer 360)", () => {
    const spec = flaggerPreview(45);
    expect(spec.bufferFt).toBe(360);
    expect(corridorTotalLengthFt(spec)).toBe(2460);
  });
});

// PR 7 (UX-21): minWorkZoneFt mirrors validate_corridor_geometry's
// WORK_ZONE_SHORTER_THAN_TAPER floor — the work zone must be at least
// as long as its kind's required taper.
describe("minWorkZoneFt", () => {
  it("flagger minimum is the fixed 100 ft one-lane two-way taper", () => {
    for (const speedMph of [25, 45, 65]) {
      expect(minWorkZoneFt("flagger_lane_closure", speedMph, 12, 8)).toBe(100);
    }
  });

  it("shoulder minimum is the L/3 shoulder taper at both widths", () => {
    // Divided (10 ft shoulder): (10 × 55) / 3 ≈ 183.33.
    expect(minWorkZoneFt("shoulder", 55, 12, 10)).toBeCloseTo(183.33, 1);
    // Undivided (8 ft shoulder): (8 × 55) / 3 ≈ 146.67.
    expect(minWorkZoneFt("shoulder", 55, 12, 8)).toBeCloseTo(146.67, 1);
  });

  it("shoulder minimum uses the W·S²/60 branch below 40 mph", () => {
    // (8 × 25² / 60) / 3 ≈ 27.78.
    expect(minWorkZoneFt("shoulder", 25, 12, 8)).toBeCloseTo(27.78, 1);
  });

  it("divided lane closure minimum is the merging taper L", () => {
    expect(minWorkZoneFt("lane_closure_divided", 55, 12, 10)).toBe(660);
  });
});
