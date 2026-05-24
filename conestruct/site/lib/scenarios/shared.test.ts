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
  });

  it("falls back to 645 when the rounded speed is not in the table", () => {
    // 80 mph rounds to 80, which is not a table key → fallback.
    expect(bufferFor(80)).toBe(645);
    // 22 mph rounds to 20, which is not in the TS table → fallback.
    // (The Python BUFFER_SPACE table has a 20-mph row at 115 ft; the TS
    // table starts at 25 mph.  See cross-check report.)
    expect(bufferFor(22)).toBe(645);
  });

  it("exposes the full TS buffer table for downstream callers", () => {
    expect(BUFFER_TABLE).toEqual({
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
});

describe("mergingTaperLength", () => {
  it("uses L = W * S for speeds at or above 45 mph", () => {
    expect(mergingTaperLength(12, 45)).toBe(540);
    expect(mergingTaperLength(12, 55)).toBe(660);
    expect(mergingTaperLength(12, 65)).toBe(780);
    expect(mergingTaperLength(11, 65)).toBe(715);
  });

  it("uses L = W * S^2 / 60 for speeds below 45 mph", () => {
    expect(mergingTaperLength(12, 30)).toBe(180);
    expect(mergingTaperLength(12, 35)).toBe(245);
    // 12 * 1600 / 60 = 320.  TS treats 40 mph as low-speed (threshold
    // is `>= 45`, not `>= 40`).  This differs from the Python backend,
    // where TAPER_LENGTH_FORMULA_THRESHOLD_MPH = 40 and the same input
    // returns 480.  See cross-check report.
    expect(mergingTaperLength(12, 40)).toBe(320);
  });

  it("returns integer feet (Math.round of the formula)", () => {
    // 12 * 44^2 / 60 = 387.2 → 387.
    expect(mergingTaperLength(12, 44)).toBe(387);
    // 12 * 43^2 / 60 = 369.8 → 370.
    expect(mergingTaperLength(12, 43)).toBe(370);
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
