import { describe, expect, it } from "vitest";

import {
  BUFFER_TABLE,
  bufferFor,
  deviceSpacing,
  mergingTaperLength,
  nightDrumCount,
} from "@/lib/scenarios/shared";

// These tests pin the *current* behavior of lib/scenarios/shared.ts so a
// regression here turns into a red CI signal instead of silent drift in
// downstream scenarios.  The expected values are observations of what the
// code returns today, not derivations from MUTCD — if the spec and the
// code disagree, that conversation happens through a deliberate edit
// (which will fail these tests and force a review), not through the
// implementation quietly changing.

describe("bufferFor", () => {
  it("returns exact table values for in-table speeds", () => {
    expect(bufferFor(20)).toBe(115);
    expect(bufferFor(25)).toBe(155);
    expect(bufferFor(45)).toBe(360);
    expect(bufferFor(55)).toBe(495);
    expect(bufferFor(65)).toBe(645);
    expect(bufferFor(75)).toBe(820);
  });

  it("rounds off-table speeds to the nearest 5-mph bucket", () => {
    // 63 mph rounds up to 65 → 645 ft.
    expect(bufferFor(63)).toBe(645);
    // 62 mph rounds down to 60 → 570 ft.
    expect(bufferFor(62)).toBe(570);
    // 42 mph rounds down to 40 → 305 ft.
    expect(bufferFor(42)).toBe(305);
    // 22 mph rounds down to 20 → 115 ft (the row that was missing from
    // the TS table before).
    expect(bufferFor(22)).toBe(115);
  });

  it("throws on out-of-range speeds instead of fabricating a buffer", () => {
    // 80 mph rounds to 80, which is not in MUTCD Table 6B-2.  Python
    // raises ValueError with the same wording; TS now throws.  Previous
    // behavior silently returned 645 (a non-MUTCD value masquerading as
    // a safety-critical distance).
    expect(() => bufferFor(80)).toThrow(
      "Speed 80 mph is not in MUTCD Table 6B-2",
    );
    // 10 mph rounds to 10 — below the 20 mph table floor.
    expect(() => bufferFor(10)).toThrow(
      "Speed 10 mph is not in MUTCD Table 6B-2",
    );
  });

  it("exposes the full TS buffer table for downstream callers", () => {
    expect(BUFFER_TABLE).toEqual({
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
    });
  });

  // Cross-check captured to prevent silent TS/Python drift on the buffer
  // table.  Expected values are Python src/rules/spacing.py::buffer_space
  // outputs across the shared speed range.  Asserted only on exact
  // multiples of 5 in [20, 75] — TS's nearest-5 rounding for non-multiples
  // is an intentional, documented divergence from Python (Python raises
  // on non-multiples) and is excluded here.
  it("matches Python buffer_space on every Table 6B-2 multiple", () => {
    expect(bufferFor(20)).toBe(115);
    expect(bufferFor(25)).toBe(155);
    expect(bufferFor(30)).toBe(200);
    expect(bufferFor(35)).toBe(250);
    expect(bufferFor(40)).toBe(305);
    expect(bufferFor(45)).toBe(360);
    expect(bufferFor(50)).toBe(425);
    expect(bufferFor(55)).toBe(495);
    expect(bufferFor(60)).toBe(570);
    expect(bufferFor(65)).toBe(645);
    expect(bufferFor(70)).toBe(730);
    expect(bufferFor(75)).toBe(820);
  });
});

describe("mergingTaperLength", () => {
  it("uses L = W * S for speeds at or above 40 mph", () => {
    expect(mergingTaperLength(12, 40)).toBe(480);
    expect(mergingTaperLength(12, 45)).toBe(540);
    expect(mergingTaperLength(12, 55)).toBe(660);
    expect(mergingTaperLength(12, 65)).toBe(780);
    expect(mergingTaperLength(11, 65)).toBe(715);
  });

  it("uses L = W * S^2 / 60 for speeds below 40 mph", () => {
    expect(mergingTaperLength(12, 30)).toBe(180);
    expect(mergingTaperLength(12, 35)).toBe(245);
  });

  it("returns integer feet (Math.round of the formula)", () => {
    // 12 * 44 = 528 (high-speed since 44 >= 40).
    expect(mergingTaperLength(12, 44)).toBe(528);
    // 12 * 43 = 516 (high-speed since 43 >= 40).
    expect(mergingTaperLength(12, 43)).toBe(516);
  });

  it("switches formulas at the 40 mph boundary (MUTCD §6C.08)", () => {
    // 39 mph (below threshold): 12 * 39^2 / 60 = 304.2 → 304.
    expect(mergingTaperLength(12, 39)).toBe(304);
    // 40 mph (at threshold, high-speed formula kicks in): 12 * 40 = 480.
    expect(mergingTaperLength(12, 40)).toBe(480);
    // 41 mph (above threshold): 12 * 41 = 492.
    expect(mergingTaperLength(12, 41)).toBe(492);
  });

  // Cross-check captured to prevent silent TS/Python drift on the taper
  // formula.  Expected values are Python src/rules/spacing.py::taper_length
  // outputs at W=12, rounded with Math.round semantics to match TS.
  // Computed and verified 2026-05-26.  Only 38 mph is off-integer
  // (288.8 → 289); the other speeds land on clean integers at W=12.
  it("matches Python taper_length across the speed range", () => {
    expect(mergingTaperLength(12, 35)).toBe(245); // 12 * 35^2 / 60 = 245.0
    expect(mergingTaperLength(12, 38)).toBe(289); // 12 * 38^2 / 60 = 288.8 → 289
    expect(mergingTaperLength(12, 40)).toBe(480); // 12 * 40 = 480 (high-speed)
    expect(mergingTaperLength(12, 45)).toBe(540); // 12 * 45 = 540
    expect(mergingTaperLength(12, 55)).toBe(660); // 12 * 55 = 660
    expect(mergingTaperLength(12, 65)).toBe(780); // 12 * 65 = 780
    expect(mergingTaperLength(12, 75)).toBe(900); // 12 * 75 = 900
  });
});

describe("deviceSpacing", () => {
  it("returns the posted speed as feet (in-taper convention)", () => {
    expect(deviceSpacing(25)).toBe(25);
    expect(deviceSpacing(45)).toBe(45);
    expect(deviceSpacing(65)).toBe(65);
  });
});

describe("nightDrumCount", () => {
  it("returns zero in daytime regardless of cone count", () => {
    expect(nightDrumCount(0, false)).toBe(0);
    expect(nightDrumCount(20, false)).toBe(0);
    expect(nightDrumCount(1000, false)).toBe(0);
  });

  it("converts ~25 percent of cones into drums at night (ceiling)", () => {
    expect(nightDrumCount(20, true)).toBe(5);
    // 13 * 0.25 = 3.25 → ceil → 4.
    expect(nightDrumCount(13, true)).toBe(4);
    // 1 cone still yields 1 drum (ceil of 0.25).
    expect(nightDrumCount(1, true)).toBe(1);
    expect(nightDrumCount(0, true)).toBe(0);
  });
});
