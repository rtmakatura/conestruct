// #140 — station frame over an optional road centerline.
//
// Mirrors the backend tests in tests/test_corridor_centerline.py: a
// synthetic quarter-circle with a closed-form truth, the no-geometry
// zero-churn bar (identical to the pre-#140 dead-reckon), tangent
// continuation, and vertex-order independence.

import { describe, expect, it } from "vitest";
import { buildStationFrame, zonePointsAlongFrame } from "./centerline";
import { destinationPoint, haversineM, M_PER_FT, FT_PER_M } from "./geodesy";

const ARC_CENTER: [number, number] = [39.75, -105.0];
const ARC_RADIUS_FT = 1000;

function arcPoint(thetaDeg: number): [number, number] {
  return destinationPoint(ARC_CENTER[0], ARC_CENTER[1], thetaDeg, ARC_RADIUS_FT * M_PER_FT);
}

function arcCenterline(stepDeg = 1): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= 90 / stepDeg; i++) out.push(arcPoint(i * stepDeg));
  return out;
}

// Anchor at theta=0; walking clockwise the start tangent is 90°.
const ANCHOR = arcPoint(0);

function trueArcStation(stationFt: number): [number, number] {
  return arcPoint((stationFt / ARC_RADIUS_FT) * (180 / Math.PI));
}

function distFt(a: [number, number], b: [number, number]): number {
  return haversineM(a[0], a[1], b[0], b[1]) * FT_PER_M;
}

describe("buildStationFrame with a curved centerline", () => {
  const frame = buildStationFrame(ANCHOR[0], ANCHOR[1], 90, arcCenterline());

  it.each([0, 300, 600, 900, 1200])("station %d lands on the arc", (stationFt) => {
    expect(distFt(frame.pointAtStationFt(stationFt), trueArcStation(stationFt))).toBeLessThan(2);
  });

  it("is vertex-order independent (direction from bearing, not order)", () => {
    const reversed = buildStationFrame(
      ANCHOR[0],
      ANCHOR[1],
      90,
      [...arcCenterline()].reverse(),
    );
    for (const s of [0, 600, 1200]) {
      expect(distFt(frame.pointAtStationFt(s), reversed.pointAtStationFt(s))).toBeLessThan(0.5);
    }
  });

  it("reports coverage as the remaining arc", () => {
    // Full quarter circle upstream of the anchor: 2π·1000/4 ≈ 1,571 ft.
    expect(frame.coverageFt).toBeCloseTo((Math.PI * ARC_RADIUS_FT) / 2, -1);
  });

  it("the straight frame is measurably wrong here (assertions non-vacuous)", () => {
    const straight = buildStationFrame(ANCHOR[0], ANCHOR[1], 90, null);
    expect(distFt(straight.pointAtStationFt(1200), trueArcStation(1200))).toBeGreaterThan(400);
  });
});

describe("buildStationFrame without a centerline (zero-churn bar)", () => {
  it("is exactly the pre-#140 dead-reckon", () => {
    const frame = buildStationFrame(ANCHOR[0], ANCHOR[1], 90, null);
    for (const s of [0, 250, 1200, -50]) {
      expect(frame.pointAtStationFt(s)).toEqual(
        destinationPoint(ANCHOR[0], ANCHOR[1], 90, s * M_PER_FT),
      );
    }
    expect(frame.coverageFt).toBeNull();
    expect(frame.vertexStationsFt).toBeNull();
  });

  it("treats a degenerate one-point polyline as no geometry", () => {
    const frame = buildStationFrame(ANCHOR[0], ANCHOR[1], 90, [ANCHOR]);
    expect(frame.coverageFt).toBeNull();
  });
});

describe("tangent continuation", () => {
  it("continues on the end segment's heading past the geometry", () => {
    const end = destinationPoint(ANCHOR[0], ANCHOR[1], 0, 500 * M_PER_FT);
    const frame = buildStationFrame(ANCHOR[0], ANCHOR[1], 0, [ANCHOR, end]);
    const expected = destinationPoint(ANCHOR[0], ANCHOR[1], 0, 800 * M_PER_FT);
    expect(distFt(frame.pointAtStationFt(800), expected)).toBeLessThan(0.5);
    expect(frame.coverageFt).toBeCloseTo(500, 0);
  });
});

describe("zonePointsAlongFrame", () => {
  it("without geometry: samples+1 points identical to the old per-zone loop", () => {
    const frame = buildStationFrame(ANCHOR[0], ANCHOR[1], 90, null);
    const pts = zonePointsAlongFrame(frame, 100, 500, 4);
    expect(pts).toHaveLength(5);
    for (let i = 0; i <= 4; i++) {
      const station = 100 + ((500 - 100) * i) / 4;
      expect(pts[i]).toEqual(destinationPoint(ANCHOR[0], ANCHOR[1], 90, station * M_PER_FT));
    }
  });

  it("with geometry: exact boundary points plus on-road interior vertices", () => {
    const centerline = arcCenterline();
    const frame = buildStationFrame(ANCHOR[0], ANCHOR[1], 90, centerline);
    const pts = zonePointsAlongFrame(frame, 100, 900, 4);
    expect(pts.length).toBeGreaterThan(5);
    expect(pts[0]).toEqual(frame.pointAtStationFt(100));
    expect(pts[pts.length - 1]).toEqual(frame.pointAtStationFt(900));
    for (const pt of pts) {
      // Every point sits on the arc: its distance from the arc center
      // equals the radius (within node-quantization tolerance).
      const rFt = haversineM(ARC_CENTER[0], ARC_CENTER[1], pt[0], pt[1]) * FT_PER_M;
      expect(Math.abs(rFt - ARC_RADIUS_FT)).toBeLessThan(2);
    }
  });
});
