// #211 — buildCorridorPolyline surfaces coverage and splits zones at the
// boundary, so drawing surfaces can render beyond-geometry footage
// distinctly instead of a tangent ray posing as the road.

import { describe, expect, it } from "vitest";
import { buildCorridorPolyline } from "./corridor-polyline";
import { destinationPoint, M_PER_FT } from "./geodesy";

const ANCHOR: [number, number] = [39.7, -105.0];

// Straight-east centerline reaching coverageFt from the anchor.
function eastCenterline(coverageFt: number): Array<[number, number]> {
  return [0, coverageFt / 2, coverageFt].map((ft) =>
    destinationPoint(ANCHOR[0], ANCHOR[1], 90, ft * M_PER_FT),
  );
}

// Zones: downstream [0,100], work [100,500], buffer [500,600],
// transition [600,700], advance [700,1200].
function spec(centerline: Array<[number, number]> | null) {
  return {
    anchorLat: ANCHOR[0],
    anchorLng: ANCHOR[1],
    bearingDeg: 90,
    advanceWarningFt: 500,
    taperFt: 100,
    bufferFt: 100,
    workZoneFt: 400,
    downstreamTaperFt: 100,
    centerline,
  };
}

describe("buildCorridorPolyline coverage (#211)", () => {
  it("manual mode (no centerline): coverage null, nothing extended, one labeled feature per zone", () => {
    const p = buildCorridorPolyline(spec(null));
    expect(p.coverageFt).toBeNull();
    expect(p.featureCollection.features).toHaveLength(5);
    for (const f of p.featureCollection.features) {
      expect(f.properties.extended).toBe(false);
      expect(f.properties.labeled).toBe(true);
    }
  });

  it("full coverage: nothing extended", () => {
    const p = buildCorridorPolyline(spec(eastCenterline(1500)));
    expect(p.coverageFt).not.toBeNull();
    expect(p.coverageFt as number).toBeGreaterThan(1200);
    expect(p.featureCollection.features.every((f) => !f.properties.extended)).toBe(true);
  });

  it("mid-zone coverage splits that zone at the boundary; later zones are wholly extended", () => {
    const p = buildCorridorPolyline(spec(eastCenterline(250)));
    expect(p.coverageFt as number).toBeCloseTo(250, 0);
    const byZone = (zone: string) =>
      p.featureCollection.features.filter((f) => f.properties.zone === zone);
    // downstream [0,100] wholly covered; work [100,500] split; the rest
    // wholly extended.
    expect(byZone("downstream").map((f) => f.properties.extended)).toEqual([false]);
    expect(byZone("work_zone").map((f) => f.properties.extended)).toEqual([false, true]);
    for (const zone of ["buffer", "transition", "advance_warning"]) {
      expect(byZone(zone).map((f) => f.properties.extended)).toEqual([true]);
    }
    // The split halves share the boundary vertex — no gap in the drawing.
    const [covered, extended] = byZone("work_zone");
    const a = covered.geometry.coordinates[covered.geometry.coordinates.length - 1];
    const b = extended.geometry.coordinates[0];
    expect(a).toEqual(b);
    // Exactly one labeled feature per zone (the longer work-zone half).
    for (const zone of ["downstream", "work_zone", "buffer", "transition", "advance_warning"]) {
      expect(byZone(zone).filter((f) => f.properties.labeled)).toHaveLength(1);
    }
    expect(extended.properties.labeled).toBe(true); // [250,500] > [100,250]
  });

  it("segments keep zone-level stations and lengths regardless of the split", () => {
    const p = buildCorridorPolyline(spec(eastCenterline(250)));
    expect(p.segments.map((s) => [s.zone, s.lengthFt])).toEqual([
      ["downstream", 100],
      ["work_zone", 400],
      ["buffer", 100],
      ["transition", 100],
      ["advance_warning", 500],
    ]);
    expect(p.totalLengthFt).toBe(1200);
  });
});
