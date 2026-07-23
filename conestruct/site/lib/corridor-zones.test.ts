// #131 guards.  The corridor zones must be told apart by a NON-colour
// channel on every surface, so a colour-vision-deficient reader or a
// grayscale/faxed print can still see where each zone (and the work area a
// crew stands in) begins and ends.  These pin that the channel exists, is
// distinct per zone, distinguishes neighbours, and is single-sourced.

import { describe, expect, it } from "vitest";

import {
  CORRIDOR_ZONES,
  ZONE_CHANNEL,
  ZONE_COLOR,
  ZONE_LABEL,
} from "./corridor-zones";
import { corridorMapUrl, type CorridorSpec } from "./corridor-map";

describe("ZONE_CHANNEL non-colour distinguishability (issue #131)", () => {
  it("gives every zone a distinct dash signature", () => {
    const sigs = CORRIDOR_ZONES.map((z) => JSON.stringify(ZONE_CHANNEL[z].dash));
    expect(new Set(sigs).size).toBe(CORRIDOR_ZONES.length);
  });

  it("gives every zone a distinct stroke-width rank", () => {
    const ranks = CORRIDOR_ZONES.map((z) => ZONE_CHANNEL[z].widthRank);
    expect(new Set(ranks).size).toBe(CORRIDOR_ZONES.length);
  });

  it("never lets two ADJACENT zones share a dash or a width", () => {
    for (let i = 1; i < CORRIDOR_ZONES.length; i++) {
      const a = ZONE_CHANNEL[CORRIDOR_ZONES[i - 1]];
      const b = ZONE_CHANNEL[CORRIDOR_ZONES[i]];
      expect(JSON.stringify(a.dash)).not.toBe(JSON.stringify(b.dash));
      expect(a.widthRank).not.toBe(b.widthRank);
    }
  });

  it("ramps width monotonically along the corridor (downstream → advance)", () => {
    const ranks = CORRIDOR_ZONES.map((z) => ZONE_CHANNEL[z].widthRank);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThan(ranks[i - 1]);
    }
  });
});

describe("corridor legend completeness (issue #131)", () => {
  it("gives every zone a non-empty text label and a valid colour", () => {
    for (const z of CORRIDOR_ZONES) {
      expect(ZONE_LABEL[z]?.length ?? 0).toBeGreaterThan(0);
      expect(ZONE_COLOR[z]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

const SPEC: CorridorSpec = {
  anchorLat: 39.7,
  anchorLng: -104.98,
  bearingDeg: 90,
  advanceWarningFt: 500,
  taperFt: 200,
  bufferFt: 300,
  workZoneFt: 400,
  downstreamTaperFt: 100,
};

describe("static preview: single-sourced colour + width-tier (issue #131)", () => {
  const url = corridorMapUrl(SPEC, "test-token");

  it("draws every zone with the shared ZONE_COLOR (no divergent duplicate table)", () => {
    for (const z of CORRIDOR_ZONES) {
      const hex = ZONE_COLOR[z].slice(1).toLowerCase();
      expect(url).toContain(`+${hex}(`);
    }
  });

  it("width-tiers the path overlays so zones differ by thickness, not colour alone", () => {
    const widths = [...url.matchAll(/path-(\d+)\+/g)].map((m) => Number(m[1]));
    expect(widths.length).toBe(CORRIDOR_ZONES.length);
    expect(new Set(widths).size).toBeGreaterThan(1);
  });
});
