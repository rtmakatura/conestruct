// #210 — the stitcher, unit-tested against a recorded Overpass pool
// (tests/fixtures/centerline/bayaud_colorado_pool.json, the Lookout
// fixture pattern: provenance header + raw data, no network).
//
// Commit-A scope (extraction fidelity): the moved stitchChain/trimChain
// must reproduce, vertex for vertex, the chain production served at the
// E Bayaud pin pre-fix — including its defects (the couplet hairpin and
// the 20 ft eastward coverage).  This pins the pure move; the fix
// commit replaces these expectations with the corrected chain and keeps
// the pre-fix geometry as the red baseline.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stitchChain, trimChain, type StitchWay } from "./stitch";

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

describe("stitchChain + trimChain (extracted, pre-fix behavior)", () => {
  it("reproduces the production-served E Bayaud chain vertex-for-vertex", () => {
    const own = fx.elements.find((w) => w.id === fx.own_way_id);
    expect(own).toBeDefined();
    const chain = stitchChain(own as StitchWay, fx.elements);
    const trimmed = trimChain(chain, fx.snapped[0], fx.snapped[1]);
    expect(trimmed).toEqual(fx.pre_fix_served_geometry);
  });
});
