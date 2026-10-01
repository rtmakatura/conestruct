import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { hasCoords, usableWays, validRuns, wayMeetsCircle } from "./usable-ways";

const FIXTURES = resolve(__dirname, "../../../../tests/fixtures/site_scan");
const PIN = { lat: 39.7342642691076, lng: -105.02504468168067 };

type Way = { id: number; geometry?: unknown[]; bounds?: Record<string, number> };
const roadWays = (file: string): Way[] =>
  (JSON.parse(readFileSync(resolve(FIXTURES, file), "utf-8")).elements as Way[]).filter(
    (e) => Array.isArray(e.geometry),
  );

describe("#305 hasCoords / validRuns (a)", () => {
  it("reads only numeric lat and lon as a point", () => {
    expect(hasCoords({ lat: 39.7, lon: -105 })).toBe(true);
    for (const p of [null, undefined, "x", { lat: 39.7 }, { lat: null, lon: -105 }, { lat: "39.7", lon: "-105" }]) {
      expect(hasCoords(p)).toBe(false);
    }
  });

  it("splits at a pointless point and never bridges the gap", () => {
    const a = { lat: 1, lon: 1 };
    const b = { lat: 2, lon: 2 };
    const c = { lat: 3, lon: 3 };
    const d = { lat: 4, lon: 4 };
    expect(validRuns([a, b, null, c, d])).toEqual([[a, b], [c, d]]);
    expect(validRuns([a, null, b, null, c])).toEqual([]);
    expect(validRuns([a, b, c])).toEqual([[a, b, c]]);
    expect(validRuns(undefined)).toEqual([]);
  });
});

describe("#305 wayMeetsCircle / usableWays (d)", () => {
  it("drops the Pavlodar way from the real fallback capture, and nothing else", () => {
    const fallback = roadWays("federal_fallback_null_points.json");
    const primary = roadWays("federal_primary.json");
    const f = usableWays(fallback, PIN.lat, PIN.lng, 50);
    const p = usableWays(primary, PIN.lat, PIN.lng, 50);
    expect(f.dropped).toBe(1);
    expect(fallback.find((w) => !f.ways.includes(w))?.id).toBe(42125193);
    expect(p.dropped).toBe(0);
    expect(f.ways.map((w) => w.id)).toEqual(p.ways.map((w) => w.id));
  });

  it("uses the real points' box when a way carries no bounds", () => {
    const near = { geometry: [{ lat: PIN.lat, lon: PIN.lng }, null, { lat: PIN.lat + 0.001, lon: PIN.lng }] };
    const far = { geometry: [{ lat: 52.29, lon: 76.94 }, { lat: 52.291, lon: 76.95 }] };
    expect(wayMeetsCircle(near, PIN.lat, PIN.lng, 50)).toBe(true);
    expect(wayMeetsCircle(far, PIN.lat, PIN.lng, 50)).toBe(false);
    expect(wayMeetsCircle({ geometry: [null, null] }, PIN.lat, PIN.lng, 50)).toBe(false);
  });

  it("counts skipped points on the ways it keeps; a way with no run of two is set aside", () => {
    const p = (dLat: number) => ({ lat: PIN.lat + dLat, lon: PIN.lng });
    const gappy = { geometry: [p(0), p(0.0001), null, p(0.0002)] };
    const hopeless = { geometry: [p(0), null, p(0.0001)] };
    const r = usableWays([gappy, hopeless], PIN.lat, PIN.lng, 50);
    expect(r.ways).toEqual([gappy]);
    expect(r.dropped).toBe(1);
    expect(r.pointsSkipped).toBe(2);
  });
});
