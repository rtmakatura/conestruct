// #507 ruling 2 (R145-2): one road-list entry per street.  `groupCarriageways`
// folds a divided street's two one-way carriageways into one entry (the
// nearer leads, the other rides as `twin`) and leaves everything else as
// it came: a true one-way, two-way roads, different streets or classes,
// and two ways that run the same direction.

import { describe, expect, it } from "vitest";
import { groupCarriageways } from "./group";
import type { RoadCandidate } from "./types";

function road(overrides: Partial<RoadCandidate> & { oneway?: string | null }): RoadCandidate {
  const { oneway = null, ...rest } = overrides;
  return {
    way_id: "1",
    highway_class: "primary",
    name: "E Colfax Ave",
    ref: null,
    bearing: 90,
    snap_distance_m: 5,
    snapped_lat: 39.7401,
    snapped_lng: -104.97,
    tags: {
      oneway,
      maxspeed: "30 mph",
      lanes: "3",
      lanes_forward: null,
      lanes_backward: null,
      lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
    ...rest,
  };
}

describe("groupCarriageways (#507 ruling 2, R145-2)", () => {
  it("E Colfax: same name, both oneway=yes, bearings 90 and 270 -> one entry, the nearer leads with the other as twin", () => {
    const eb = road({ way_id: "eb", bearing: 90, oneway: "yes", snap_distance_m: 6 });
    const wb = road({ way_id: "wb", bearing: 270, oneway: "yes", snap_distance_m: 14 });
    const out = groupCarriageways([eb, wb]);
    expect(out).toHaveLength(1);
    expect(out[0].way_id).toBe("eb");
    expect(out[0].twin?.way_id).toBe("wb");
    // The twin carries no twin of its own, and the input is not mutated.
    expect(out[0].twin?.twin).toBeUndefined();
    expect(eb.twin).toBeUndefined();
  });

  it("the nearer carriageway leads whichever way it runs (input sorted nearest first)", () => {
    const wb = road({ way_id: "wb", bearing: 270, oneway: "yes", snap_distance_m: 3 });
    const eb = road({ way_id: "eb", bearing: 90, oneway: "yes", snap_distance_m: 11 });
    const out = groupCarriageways([wb, eb]);
    expect(out.map((c) => c.way_id)).toEqual(["wb"]);
    expect(out[0].twin?.way_id).toBe("eb");
  });

  it("oneway=-1 reverses the travel direction: same vertex bearing, one of them -1 -> opposite, grouped", () => {
    const a = road({ way_id: "a", bearing: 90, oneway: "yes", snap_distance_m: 4 });
    const b = road({ way_id: "b", bearing: 90, oneway: "-1", snap_distance_m: 9 });
    const out = groupCarriageways([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].twin?.way_id).toBe("b");
  });

  it("oneway=-1 on an opposite vertex bearing travels the SAME way -> not grouped", () => {
    const a = road({ way_id: "a", bearing: 90, oneway: "yes", snap_distance_m: 4 });
    const b = road({ way_id: "b", bearing: 270, oneway: "-1", snap_distance_m: 9 });
    const out = groupCarriageways([a, b]);
    expect(out.map((c) => c.way_id)).toEqual(["a", "b"]);
    expect(out.every((c) => c.twin === undefined)).toBe(true);
  });

  it("different names are not grouped", () => {
    const a = road({ way_id: "a", name: "E Colfax Ave", bearing: 90, oneway: "yes" });
    const b = road({ way_id: "b", name: "E 14th Ave", bearing: 270, oneway: "yes", snap_distance_m: 9 });
    const out = groupCarriageways([a, b]);
    expect(out.map((c) => c.way_id)).toEqual(["a", "b"]);
    expect(out.every((c) => c.twin === undefined)).toBe(true);
  });

  it("a true one-way alone is untouched", () => {
    const a = road({ way_id: "a", bearing: 0, oneway: "yes" });
    const out = groupCarriageways([a]);
    expect(out).toEqual([a]);
    expect(out[0].twin).toBeUndefined();
  });

  it("two-way roads are untouched, even with the same name and opposite bearings", () => {
    const a = road({ way_id: "a", bearing: 90, oneway: null });
    const b = road({ way_id: "b", bearing: 270, oneway: null, snap_distance_m: 9 });
    const c = road({ way_id: "c", name: "Main St", bearing: 0, oneway: "no", snap_distance_m: 20 });
    const out = groupCarriageways([a, b, c]);
    expect(out).toEqual([a, b, c]);
  });

  it("a one-way and a two-way of the same name are not grouped", () => {
    const a = road({ way_id: "a", bearing: 90, oneway: "yes" });
    const b = road({ way_id: "b", bearing: 270, oneway: null, snap_distance_m: 9 });
    expect(groupCarriageways([a, b]).map((c) => c.way_id)).toEqual(["a", "b"]);
  });

  it("same name, both one-way, same direction -> not grouped", () => {
    const a = road({ way_id: "a", bearing: 90, oneway: "yes" });
    const b = road({ way_id: "b", bearing: 95, oneway: "yes", snap_distance_m: 9 });
    const out = groupCarriageways([a, b]);
    expect(out.map((c) => c.way_id)).toEqual(["a", "b"]);
    expect(out.every((c) => c.twin === undefined)).toBe(true);
  });

  it("same name, opposite one-ways, different highway_class -> not grouped", () => {
    const a = road({ way_id: "a", highway_class: "primary", bearing: 90, oneway: "yes" });
    const b = road({ way_id: "b", highway_class: "secondary", bearing: 270, oneway: "yes", snap_distance_m: 9 });
    expect(groupCarriageways([a, b]).map((c) => c.way_id)).toEqual(["a", "b"]);
  });

  it("unnamed with the same ref -> grouped; unnamed with no ref, or a different ref -> not", () => {
    const a = road({ way_id: "a", name: null, ref: "US 40", bearing: 90, oneway: "yes" });
    const b = road({ way_id: "b", name: null, ref: "US 40", bearing: 270, oneway: "yes", snap_distance_m: 9 });
    const grouped = groupCarriageways([a, b]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].twin?.way_id).toBe("b");

    const c = road({ way_id: "c", name: null, ref: null, bearing: 90, oneway: "yes" });
    const d = road({ way_id: "d", name: null, ref: null, bearing: 270, oneway: "yes", snap_distance_m: 9 });
    expect(groupCarriageways([c, d]).map((x) => x.way_id)).toEqual(["c", "d"]);

    const e = road({ way_id: "e", name: null, ref: "US 40", bearing: 90, oneway: "yes" });
    const f = road({ way_id: "f", name: null, ref: "US 287", bearing: 270, oneway: "yes", snap_distance_m: 9 });
    expect(groupCarriageways([e, f]).map((x) => x.way_id)).toEqual(["e", "f"]);
  });

  it("keeps the lead's place among other roads, and pairs each carriageway once", () => {
    const eb = road({ way_id: "eb", bearing: 90, oneway: "yes", snap_distance_m: 4 });
    const main = road({ way_id: "main", name: "N Main St", bearing: 0, oneway: null, snap_distance_m: 8 });
    const wb = road({ way_id: "wb", bearing: 270, oneway: "yes", snap_distance_m: 15 });
    const wb2 = road({ way_id: "wb2", bearing: 268, oneway: "yes", snap_distance_m: 25 });
    const out = groupCarriageways([eb, main, wb, wb2]);
    expect(out.map((c) => c.way_id)).toEqual(["eb", "main", "wb2"]);
    expect(out[0].twin?.way_id).toBe("wb");
    expect(out[2].twin).toBeUndefined();
  });
});
