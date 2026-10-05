/**
 * #308 — the twin evidence: the distance from a one-way candidate's snapped
 * point to the nearest way with the SAME name (or ref), tagged one-way,
 * whose travel runs the opposite direction.  The backend decides from it
 * (src/rules/carriageway.py); this is the raw fact the picker relays.
 */
import { describe, expect, it } from "vitest";
import { nearestOppositeTwinM } from "./twin";

// A metre at 39.73° N: 1 / 111,320 deg of latitude; 1 / 85,640 of longitude.
const LAT = 39.7337;
const LNG = -104.98753;
const dLng = (m: number) => m / (111_320 * Math.cos((LAT * Math.PI) / 180));
const dLat = (m: number) => m / 111_320;

// The candidate: North Broadway southbound, travel 180°.
const broadway = {
  way_id: "131232822",
  name: "North Broadway",
  ref: null,
  bearing: 180,
  snapped_lat: LAT,
  snapped_lng: LNG,
  tags: { oneway: "yes" as string | null },
};

/** A straight way `eastM` metres east of the candidate, running north
 *  (vertex order south → north) unless `southbound`. */
function way(
  id: number,
  eastM: number,
  tags: Record<string, string>,
  southbound = false,
) {
  const a = { lat: LAT - dLat(200), lon: LNG + dLng(eastM) };
  const b = { lat: LAT + dLat(200), lon: LNG + dLng(eastM) };
  return { id, tags, geometry: southbound ? [b, a] : [a, b] };
}

describe("nearestOppositeTwinM", () => {
  it("measures a same-name way running the opposite direction", () => {
    const pool = [way(1, 21.7, { name: "North Broadway", oneway: "yes" })];
    expect(nearestOppositeTwinM(broadway, pool)).toBeCloseTo(21.7, 0);
  });

  it("ignores a same-name way running the same direction", () => {
    const pool = [way(1, 30, { name: "North Broadway", oneway: "yes" }, true)];
    expect(nearestOppositeTwinM(broadway, pool)).toBeNull();
  });

  it("ignores a different name: a paired one-way street is not a twin", () => {
    const pool = [way(1, 137, { name: "North Lincoln Street", oneway: "yes" })];
    expect(nearestOppositeTwinM(broadway, pool)).toBeNull();
  });

  it("ignores a same-name way that is two-way", () => {
    const pool = [way(1, 15, { name: "North Broadway" })];
    expect(nearestOppositeTwinM(broadway, pool)).toBeNull();
  });

  it("ignores the candidate's own way", () => {
    const pool = [way(131232822, 15, { name: "North Broadway", oneway: "yes" })];
    expect(nearestOppositeTwinM(broadway, pool)).toBeNull();
  });

  it("reads oneway=-1 as travel against the vertex order", () => {
    // Drawn southbound, but -1 means traffic runs north: opposite to ours.
    const pool = [way(1, 14, { name: "North Broadway", oneway: "-1" }, true)];
    expect(nearestOppositeTwinM(broadway, pool)).toBeCloseTo(14, 0);
  });

  it("reads the candidate's own oneway=-1 the same way", () => {
    const reversed = { ...broadway, bearing: 0, tags: { oneway: "-1" } };
    const pool = [way(1, 18, { name: "North Broadway", oneway: "yes" })];
    expect(nearestOppositeTwinM(reversed, pool)).toBeCloseTo(18, 0);
  });

  it("returns the nearest of several twins", () => {
    const pool = [
      way(1, 55.4, { name: "North Broadway", oneway: "yes" }),
      way(2, 12.2, { name: "North Broadway", oneway: "yes" }),
    ];
    expect(nearestOppositeTwinM(broadway, pool)).toBeCloseTo(12.2, 0);
  });

  it("matches on ref when the candidate has no name", () => {
    const unnamed = { ...broadway, name: null, ref: "CO 88" };
    const pool = [way(1, 13, { ref: "CO 88", oneway: "yes" })];
    expect(nearestOppositeTwinM(unnamed, pool)).toBeCloseTo(13, 0);
  });

  it("skips points a mirror couldn't resolve", () => {
    const w = way(1, 20, { name: "North Broadway", oneway: "yes" });
    const pool = [{ ...w, geometry: [w.geometry[0], null, w.geometry[1]] }];
    expect(nearestOppositeTwinM(broadway, pool)).toBeNull();
  });
});
