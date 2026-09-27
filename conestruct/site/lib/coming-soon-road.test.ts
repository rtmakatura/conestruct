// coming-soon-gate R13 / R14 — the milepost road's arithmetic.

import { describe, expect, it } from "vitest";
import { ZONE_COLOR, ZONE_LABEL } from "./corridor-zones";
import {
  EASE,
  ROAD_MIN_WIDTH,
  STRETCHES,
  X,
  easeToward,
  roadFront,
  roadLayout,
  stretchAt,
} from "./coming-soon-road";

// A page like the 1440 one: the road's column starts 1100 px down, is
// 3000 px tall, and the page is 4400 px tall in a 900 px window.
const PAGE = { vh: 900, docH: 4400, roadTop: 1100, h: 3000 };

describe("the stretches are the product's zones, in traffic order (R9, R13)", () => {
  it("words are ZONE_LABEL lower-cased and colours are ZONE_COLOR", () => {
    expect(STRETCHES.map((s) => s.word)).toEqual([
      "advance warning",
      "taper",
      "buffer",
      "work zone",
      "downstream",
    ]);
    expect(STRETCHES.map((s) => s.word)).toEqual(
      (["advance_warning", "transition", "buffer", "work_zone", "downstream"] as const).map((z) =>
        ZONE_LABEL[z].toLowerCase(),
      ),
    );
    expect(STRETCHES.map((s) => s.colour)).toEqual([
      ZONE_COLOR.advance_warning,
      ZONE_COLOR.transition,
      ZONE_COLOR.buffer,
      ZONE_COLOR.work_zone,
      ZONE_COLOR.downstream,
    ]);
    expect(STRETCHES.map((s) => s.post)).toEqual(["01", "02", "03", "04", "CO"]);
  });

  it("the road and marker threshold is 980 px (R13, R14)", () => {
    expect(ROAD_MIN_WIDTH).toBe(980);
  });
});

describe("the highlight's front (R13)", () => {
  it("is 0 until the road's top is 60 % down the window", () => {
    expect(roadFront({ ...PAGE, scrollY: 0 })).toBe(0);
    expect(roadFront({ ...PAGE, scrollY: 1100 - 540 })).toBe(0);
  });

  it("reaches the end of the road exactly at the bottom of the page", () => {
    expect(roadFront({ ...PAGE, scrollY: PAGE.docH - PAGE.vh })).toBe(PAGE.h);
    expect(roadFront({ ...PAGE, scrollY: PAGE.docH - PAGE.vh - 1 })).toBeLessThan(PAGE.h);
  });

  it("moves with the scroll, never backwards", () => {
    let last = -1;
    for (let y = 0; y <= PAGE.docH - PAGE.vh; y += 50) {
      const f = roadFront({ ...PAGE, scrollY: y });
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
  });

  it("eases: each frame closes a fraction of the gap (no stepping) and lands exactly", () => {
    let cur = 0;
    const seen: number[] = [];
    for (let k = 0; k < 200 && cur !== 3000; k++) {
      cur = easeToward(cur, 3000);
      seen.push(cur);
    }
    expect(seen[0]).toBeCloseTo(3000 * EASE);
    expect(seen.at(-1)).toBe(3000);
    for (let k = 1; k < seen.length; k++) {
      expect(seen[k]).toBeGreaterThan(seen[k - 1]);
      // No jump bigger than the first frame's.
      expect(seen[k] - seen[k - 1]).toBeLessThanOrEqual(3000 * EASE + 1e-9);
    }
  });
});

describe("the stretch the highlight has reached (R14's marker)", () => {
  const starts = [114, 694, 1234, 1754, 2694, 2980];
  it("is -1 before 01, then each stretch in turn", () => {
    expect(stretchAt(0, starts)).toBe(-1);
    expect(stretchAt(113.9, starts)).toBe(-1);
    expect(stretchAt(114, starts)).toBe(0);
    expect(stretchAt(694, starts)).toBe(1);
    expect(stretchAt(1500, starts)).toBe(2);
    expect(stretchAt(1754, starts)).toBe(3);
    expect(stretchAt(2694, starts)).toBe(4);
    expect(stretchAt(3000, starts)).toBe(4);
  });
});

describe("the road is the product's lane closure (A2-Q5)", () => {
  const l = roadLayout([120, 700, 1240, 1760, 2700], 3000);
  const [, tap, buf, work, down] = l.starts;

  it("mileposts sit 6 px above each section; downstream ends 20 px short of the road", () => {
    expect(l.starts).toEqual([114, 694, 1234, 1754, 2694, 2980]);
  });

  it("three advance signs, all in the advance-warning stretch", () => {
    expect(l.signs).toHaveLength(3);
    for (const y of l.signs) {
      expect(y).toBeGreaterThan(l.starts[0]);
      expect(y).toBeLessThan(tap);
    }
  });

  it("the buffer is empty", () => {
    expect(l.devices.filter(([, y]) => y > buf && y < work)).toEqual([]);
  });

  it("the taper runs from the edge to the lane line", () => {
    const taper = l.devices.filter(([, y]) => y >= tap && y < buf);
    expect(taper).toHaveLength(7);
    expect(taper[0][0]).toBeLessThan(taper[6][0]);
    expect(taper[0][0]).toBeGreaterThanOrEqual(X.edgeL);
    expect(taper[6][0]).toBeLessThanOrEqual(X.lane);
  });

  it("devices line the lane through the work", () => {
    const along = l.devices.filter(([x, y]) => x === X.lane && y >= work && y <= down);
    expect(along.length).toBeGreaterThanOrEqual(5);
    expect(l.work[0]).toBeGreaterThan(work);
    expect(l.work[1]).toBeLessThan(down);
  });
});
