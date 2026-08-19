// #210 — the stitcher, unit-tested against a recorded Overpass pool
// (tests/fixtures/centerline/bayaud_colorado_pool.json, the Lookout
// fixture pattern: provenance header + raw data, no network).
//
// The fixture's pre_fix_served_geometry is production's pre-fix output
// at the E Bayaud pin (2026-08-19, sha 118b3e5): a 26-vertex chain that
// hairpins through the 1480386062-67 couplet and ends 20 ft east of the
// pin.  These tests were red against that algorithm (the extraction
// commit) — the red run is recorded in the arc's evidence directory.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  STITCH_GAP_MAX_M,
  STITCH_REVERSAL_DEG,
  stitchChainDetailed,
  trimChain,
  truncateAtReversal,
  type StitchNode,
  type StitchWay,
} from "./stitch";

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/centerline/bayaud_colorado_pool.json",
);

interface Fixture {
  pin: [number, number];
  own_way_id: number;
  snapped: [number, number];
  pre_fix_served_geometry: Array<[number, number]>;
  elements: StitchWay[];
}

const fx = JSON.parse(readFileSync(FIXTURE, "utf-8")) as Fixture;

function headings(chain: StitchNode[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    const phi1 = (a.lat * Math.PI) / 180;
    const phi2 = (b.lat * Math.PI) / 180;
    const dl = ((b.lon - a.lon) * Math.PI) / 180;
    const y = Math.sin(dl) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dl);
    out.push(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
  }
  return out;
}

function maxAdjacentReversal(chain: StitchNode[]): number {
  const hs = headings(chain);
  let worst = 0;
  for (let i = 0; i < hs.length - 1; i++) {
    const d = Math.abs(((hs[i] - hs[i + 1] + 540) % 360) - 180);
    worst = Math.max(worst, d);
  }
  return worst;
}

function mkWay(
  id: number,
  pts: Array<[number, number]>,
  tags?: Record<string, string>,
): StitchWay {
  return { id, geometry: pts.map(([lat, lon]) => ({ lat, lon })), tags };
}

describe("stitchChainDetailed on the recorded E Bayaud pool", () => {
  const own = fx.elements.find((w) => w.id === fx.own_way_id) as StitchWay;
  const result = stitchChainDetailed(own, fx.elements);

  it("bridges the divided S Colorado Blvd crossing (one bounded gap, eastward coverage)", () => {
    // Exactly one synthetic connector, the measured ~29 m crossing gap.
    expect(result.bridges).toHaveLength(1);
    const [wayId, gapM] = result.bridges[0];
    expect(wayId).toBe(1175151991);
    expect(gapM).toBeGreaterThan(20);
    expect(gapM).toBeLessThan(STITCH_GAP_MAX_M);
    // The chain now continues well east of the crossing (pre-fix it
    // ended 20 ft east of the pin at lon -104.9406).
    const maxLon = Math.max(...result.chain.map((n) => n.lon));
    expect(maxLon).toBeGreaterThan(-104.93);
  });

  it("never doubles back — one couplet half only, the direction-agreeing one", () => {
    expect(maxAdjacentReversal(result.chain)).toBeLessThan(STITCH_REVERSAL_DEG);
    // The 1480386062-67 couplet: the chain may ride ONE half, never
    // both (the old walk consumed both and hairpinned).  Distinctive
    // interior vertices: south/eastbound half (way 1480386062) vs
    // north/westbound half (way 1480386063).
    const hasSouth = result.chain.some(
      (n) => n.lat.toFixed(7) === "39.7146127" && n.lon.toFixed(7) === "-104.9439947",
    );
    const hasNorth = result.chain.some(
      (n) => n.lat.toFixed(7) === "39.7146812" && n.lon.toFixed(7) === "-104.9435795",
    );
    expect(hasSouth !== hasNorth).toBe(true);
    // The chain's tail-ward thread runs eastbound (the own way's vertex
    // order), so the agreeing half is the eastbound-travel one — the
    // south half, way 1480386062 (the oneway tie-break, ruled).
    expect(hasSouth).toBe(true);
    expect(result.usedWayIds).not.toContain(1480386063);
  });

  it("differs from the recorded pre-fix served chain (the deliberate behavior change)", () => {
    const trimmed = trimChain(
      truncateAtReversal(result.chain, fx.snapped[0], fx.snapped[1]),
      fx.snapped[0],
      fx.snapped[1],
    );
    expect(trimmed).not.toEqual(fx.pre_fix_served_geometry);
    expect(trimmed.length).toBeGreaterThan(fx.pre_fix_served_geometry.length);
  });
});

describe("truncateAtReversal", () => {
  it("cuts the recorded pre-fix hairpin on the side away from the snapped point", () => {
    const nodes: StitchNode[] = fx.pre_fix_served_geometry.map(([lat, lon]) => ({ lat, lon }));
    expect(maxAdjacentReversal(nodes)).toBeGreaterThanOrEqual(STITCH_REVERSAL_DEG);
    const cut = truncateAtReversal(nodes, fx.snapped[0], fx.snapped[1]);
    expect(cut.length).toBeLessThan(nodes.length);
    expect(maxAdjacentReversal(cut)).toBeLessThan(STITCH_REVERSAL_DEG);
    // The snapped point's side survives: its nearest vertex stays.
    const near = cut.some(
      (n) => Math.abs(n.lat - fx.snapped[0]) < 1e-4 && Math.abs(n.lon - fx.snapped[1]) < 1e-4,
    );
    expect(near).toBe(true);
  });

  it("leaves a clean chain untouched", () => {
    const clean: StitchNode[] = [
      { lat: 39.7, lon: -105.0 },
      { lat: 39.7, lon: -104.999 },
      { lat: 39.7001, lon: -104.998 },
      { lat: 39.7003, lon: -104.997 },
    ];
    expect(truncateAtReversal(clean, 39.7, -105.0)).toEqual(clean);
  });
});

describe("stitchChainDetailed on synthetic pools", () => {
  // ~0.001° lon ≈ 85 m at this latitude.
  it("clean exact-endpoint pools concatenate fully with no bridges (clean-pin equivalence)", () => {
    const a = mkWay(1, [[39.7, -105.002], [39.7, -105.001]]);
    const own = mkWay(2, [[39.7, -105.001], [39.7, -105.0]]);
    const b = mkWay(3, [[39.7, -105.0], [39.7, -104.999]]);
    const r = stitchChainDetailed(own, [a, own, b]);
    expect(r.usedWayIds).toEqual([1, 2, 3]);
    expect(r.bridges).toEqual([]);
    expect(r.chain).toHaveLength(4);
  });

  it("refuses a gap beyond STITCH_GAP_MAX_M (the measured 197 m E Cedar class)", () => {
    const own = mkWay(1, [[39.7, -105.001], [39.7, -105.0]]);
    // ~103 m east of the chain end — collinear, but out of bounds.
    const far = mkWay(2, [[39.7, -104.9988], [39.7, -104.9978]]);
    const r = stitchChainDetailed(own, [own, far]);
    expect(r.usedWayIds).toEqual([1]);
    expect(r.bridges).toEqual([]);
  });

  it("refuses a perpendicular same-name branch even at an exact shared endpoint (ruled)", () => {
    const own = mkWay(1, [[39.7, -105.001], [39.7, -105.0]]);
    const perp = mkWay(2, [[39.7, -105.0], [39.701, -105.0]]);
    const r = stitchChainDetailed(own, [own, perp]);
    expect(r.usedWayIds).toEqual([1]);
  });

  it("takes one thread through a oneway couplet loop, preferring the agreeing half", () => {
    // Own two-way stub, then a couplet: two parallel oneway halves that
    // share both end nodes (the loop the old stitcher walked all the
    // way around).
    const own = mkWay(1, [[39.7, -105.001], [39.7, -105.0]]);
    const north = mkWay(
      2,
      [[39.7, -105.0], [39.70005, -104.9995], [39.7, -104.999]],
      { oneway: "yes" },
    );
    const south = mkWay(
      3,
      [[39.7, -104.999], [39.69995, -104.9995], [39.7, -105.0]],
      { oneway: "yes" },
    );
    const cont = mkWay(4, [[39.7, -104.999], [39.7, -104.998]]);
    const r = stitchChainDetailed(own, [own, north, south, cont]);
    // The tail-ward thread runs west→east; the agreeing half is
    // `north` (vertex order west→east).  The return half must be
    // refused, the continuation joined.
    expect(r.usedWayIds).toContain(2);
    expect(r.usedWayIds).not.toContain(3);
    expect(r.usedWayIds).toContain(4);
    expect(maxAdjacentReversal(r.chain)).toBeLessThan(STITCH_REVERSAL_DEG);
  });
});
