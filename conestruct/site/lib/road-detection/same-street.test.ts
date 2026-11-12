// #525: one entry per street (Ryan, 2026-11-11, cc-prompt-ux-group7b item 2)
// and the street each entry meets at the pin.  Rulings R145-2..8 in
// validation-artifacts/committed/missions/ux-group7b-guesses-hours/issue-525/.
import { describe, expect, it } from "vitest";

import { groupCarriageways } from "./group";
import { attachCrossStreets, mergeSameStreet } from "./same-street";
import type { RoadCandidate } from "./types";

const PIN = { lat: 39.74, lng: -104.98 };
const M_LAT = 1 / 111_320;
const M_LNG = 1 / (111_320 * Math.cos((PIN.lat * Math.PI) / 180));

/** A point `northM` north and `eastM` east of the pin. */
function at(northM: number, eastM: number): [number, number] {
  return [PIN.lat + northM * M_LAT, PIN.lng + eastM * M_LNG];
}

function way(
  id: string,
  name: string | null,
  geometry: Array<[number, number]>,
  over: { oneway?: string | null; bearing?: number; dist?: number; snap?: [number, number] } = {},
): RoadCandidate {
  const snap = over.snap ?? geometry[0];
  return {
    way_id: id,
    highway_class: "residential",
    name,
    ref: null,
    bearing: over.bearing ?? 0,
    snap_distance_m: over.dist ?? 0,
    snapped_lat: snap[0],
    snapped_lng: snap[1],
    tags: {
      oneway: over.oneway ?? null,
      maxspeed: null,
      lanes: null,
      lanes_forward: null,
      lanes_backward: null,
      lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
    geometry,
  };
}

const ids = (cs: RoadCandidate[]) => cs.map((c) => c.way_id);

describe("mergeSameStreet: connects (R145-5)", () => {
  it("folds a reversed piece reached through a chain of same-name pieces into the nearest", () => {
    // Pennsylvania's shape: a (S→N, through the pin), b (S→N, north of a),
    // c (N→S, ending on b's north end).  Dedup kept a and c only.
    const a = way("a", "Penn St", [at(-5, 1), at(20, 1)], { dist: 1, snap: at(0, 1) });
    const b = way("b", "Penn St", [at(20, 1), at(40, 1)], { dist: 20, snap: at(20, 1) });
    const c = way("c", "Penn St", [at(200, 1), at(40, 1)], { bearing: 180, dist: 40, snap: at(40, 1) });
    expect(ids(mergeSameStreet([a, b, c], [a, c]))).toEqual(["a"]);
  });

  it("keeps the lead's way, geometry and distance", () => {
    const a = way("a", "Penn St", [at(-5, 1), at(20, 1)], { dist: 1, snap: at(0, 1) });
    const c = way("c", "Penn St", [at(200, 1), at(20, 1)], { bearing: 180, dist: 20, snap: at(20, 1) });
    const [lead] = mergeSameStreet([a, c], [a, c]);
    expect(lead).toBe(a);
    expect(lead.snap_distance_m).toBe(1);
  });

  it("merges a one-way street's pieces whose travel agrees (oneway=-1 drawn backwards)", () => {
    const a = way("a", "Lincoln St", [at(20, 0), at(-20, 0)], { oneway: "yes", bearing: 180, dist: 0, snap: at(0, 0) });
    const b = way("b", "Lincoln St", [at(-20, 0), at(-60, 0)].reverse() as Array<[number, number]>, {
      oneway: "-1",
      bearing: 0,
      dist: 20,
      snap: at(-20, 0),
    });
    expect(ids(mergeSameStreet([a, b], [a, b]))).toEqual(["a"]);
  });
});

describe("mergeSameStreet: runs along the same line (R145-6)", () => {
  it("folds a piece that doesn't connect but sits on the lead's line", () => {
    const a = way("a", "Penn St", [at(-5, 0), at(15, 0)], { dist: 0, snap: at(0, 0) });
    const c = way("c", "Penn St", [at(80, 1), at(25, 1)], { bearing: 180, dist: 25, snap: at(25, 1) });
    expect(ids(mergeSameStreet([a, c], [a, c]))).toEqual(["a"]);
  });

  it("keeps a parallel same-name way more than 3 m off the line (a divided road tagged two-way)", () => {
    const a = way("a", "Speer Blvd", [at(-30, 0), at(30, 0)], { dist: 0, snap: at(0, 0) });
    const c = way("c", "Speer Blvd", [at(30, 7), at(-30, 7)], { bearing: 180, dist: 7, snap: at(0, 7) });
    expect(ids(mergeSameStreet([a, c], [a, c]))).toEqual(["a", "c"]);
  });

  it("keeps a same-name way at an angle that doesn't connect", () => {
    const a = way("a", "Penn St", [at(-5, 0), at(15, 0)], { dist: 0, snap: at(0, 0) });
    const c = way("c", "Penn St", [at(10, 10), at(10, 50)], { bearing: 90, dist: 14, snap: at(10, 10) });
    expect(ids(mergeSameStreet([a, c], [a, c]))).toEqual(["a", "c"]);
  });
});

describe("mergeSameStreet: what never folds", () => {
  it("R145-3: two opposite one-way carriageways stay apart, even connected (#507 groups them)", () => {
    const e = way("e", "Colfax Ave", [at(0, -30), at(0, 30)], { oneway: "yes", bearing: 90, dist: 0, snap: at(0, 0) });
    const w = way("w", "Colfax Ave", [at(0, 30), at(0, -30)], { oneway: "yes", bearing: 270, dist: 0.5, snap: at(0, 0) });
    expect(ids(mergeSameStreet([e, w], [e, w]))).toEqual(["e", "w"]);
  });

  it("R145-4: a street that turns one-way at the corner keeps two rows", () => {
    const a = way("a", "Penn St", [at(-20, 0), at(0, 0)], { dist: 0, snap: at(0, 0) });
    const b = way("b", "Penn St", [at(0, 0), at(30, 0)], { oneway: "yes", dist: 0.1, snap: at(0, 0) });
    expect(ids(mergeSameStreet([a, b], [a, b]))).toEqual(["a", "b"]);
  });

  it("R145-4: a reversible way never folds", () => {
    const a = way("a", "Express", [at(-20, 0), at(0, 0)], { oneway: "reversible", dist: 0, snap: at(0, 0) });
    const b = way("b", "Express", [at(0, 0), at(30, 0)], { oneway: "reversible", dist: 0.1, snap: at(0, 0) });
    expect(ids(mergeSameStreet([a, b], [a, b]))).toEqual(["a", "b"]);
  });

  it("different names never fold, and unnamed ways never fold", () => {
    const a = way("a", "Penn St", [at(-5, 0), at(15, 0)], { dist: 0, snap: at(0, 0) });
    const b = way("b", "Pearl St", [at(15, 0), at(40, 0)], { dist: 15, snap: at(15, 0) });
    const u1 = way("u1", null, [at(-5, 5), at(15, 5)], { dist: 5, snap: at(0, 5) });
    const u2 = way("u2", null, [at(15, 5), at(40, 5)], { dist: 16, snap: at(15, 5) });
    expect(ids(mergeSameStreet([a, b, u1, u2], [a, u1, b, u2]))).toEqual(["a", "u1", "b", "u2"]);
  });
});

describe("mergeSameStreet: the class test (R145-2, gate round 1 finding 1)", () => {
  it("a same-name one-way link nearer the pin never folds its mainline, which still pairs with its twin", () => {
    const link = way("l", "Colfax Ave", [at(-15, -20), at(0, 0)], { oneway: "yes", bearing: 53, dist: 0.2, snap: at(0, 0) });
    link.highway_class = "primary_link";
    const east = way("e", "Colfax Ave", [at(0, -30), at(0, 0), at(0, 30)], { oneway: "yes", bearing: 90, dist: 0.5, snap: at(0, 0) });
    east.highway_class = "primary";
    const west = way("w", "Colfax Ave", [at(7, 30), at(7, -30)], { oneway: "yes", bearing: 270, dist: 7, snap: at(7, 0) });
    west.highway_class = "primary";
    const merged = mergeSameStreet([link, east, west], [link, east, west]);
    expect(ids(merged)).toEqual(["l", "e", "w"]);
    const grouped = groupCarriageways(merged);
    expect(ids(grouped)).toEqual(["l", "e"]);
    expect(grouped[1].twin?.way_id).toBe("w");
  });

  it("an untagged motorway never folds as two-way (implied one-way, #514)", () => {
    const a = way("a", "I-25", [at(-30, 0), at(0, 0)], { dist: 0, snap: at(0, 0) });
    const b = way("b", "I-25", [at(30, 0), at(0, 0)], { bearing: 180, dist: 0.1, snap: at(0, 0) });
    a.highway_class = "motorway";
    b.highway_class = "motorway";
    expect(ids(mergeSameStreet([a, b], [a, b]))).toEqual(["a", "b"]);
  });

  it("a motorway tagged oneway=no still folds its reversed piece", () => {
    const a = way("a", "Ramp Rd", [at(-30, 0), at(0, 0)], { oneway: "no", dist: 0, snap: at(0, 0) });
    const b = way("b", "Ramp Rd", [at(30, 0), at(0, 0)], { oneway: "no", bearing: 180, dist: 0.1, snap: at(0, 0) });
    a.highway_class = "motorway";
    b.highway_class = "motorway";
    expect(ids(mergeSameStreet([a, b], [a, b]))).toEqual(["a"]);
  });
});

describe("attachCrossStreets (R145-8)", () => {
  const penn = () => way("p", "Penn St", [at(-30, 0), at(0, 0), at(30, 0)], { dist: 0, snap: at(0, 0) });
  const colfax = () => way("c", "Colfax Ave", [at(0, -30), at(0, 0), at(0, 30)], { bearing: 90, dist: 0.5, snap: at(0, 0) });

  it("names the street sharing a node near the pin, on both entries", () => {
    const p = penn();
    const c = colfax();
    attachCrossStreets([p, c], [p, c], PIN.lat, PIN.lng);
    expect(p.cross_street).toBe("Colfax Ave");
    expect(c.cross_street).toBe("Penn St");
  });

  it("names nothing when the ways cross without a shared node (a bridge)", () => {
    const p = penn();
    const c = way("c", "Colfax Ave", [at(1, -30), at(1, 30)], { bearing: 90, dist: 1, snap: at(1, 0) });
    attachCrossStreets([p, c], [p, c], PIN.lat, PIN.lng);
    expect(p.cross_street).toBeUndefined();
    expect(c.cross_street).toBeUndefined();
  });

  it("names nothing when the shared node is more than 30 m from the pin", () => {
    const p = way("p", "Penn St", [at(-10, 0), at(45, 0)], { dist: 0, snap: at(0, 0) });
    const c = way("c", "Colfax Ave", [at(45, -30), at(45, 0), at(45, 30)], { bearing: 90, dist: 28, snap: at(45, 0) });
    attachCrossStreets([p, c], [p, c], PIN.lat, PIN.lng);
    expect(p.cross_street).toBeUndefined();
  });

  it("never names a parallel street (a fork or a frontage road) or an unnamed one", () => {
    const p = penn();
    const fork = way("f", "Penn Frontage", [at(0, 0), at(30, 3)], { bearing: 6, dist: 0.2, snap: at(0, 0) });
    const unnamed = way("u", null, [at(0, -30), at(0, 0)], { bearing: 90, dist: 0.3, snap: at(0, 0) });
    attachCrossStreets([p, fork, unnamed], [p, fork, unnamed], PIN.lat, PIN.lng);
    expect(p.cross_street).toBeUndefined();
  });

  it("names the nearest of two crossing streets", () => {
    const p = penn();
    const near = colfax();
    const far = way("x", "Elm Ave", [at(20, -30), at(20, 0), at(20, 30)], { bearing: 90, dist: 20, snap: at(20, 0) });
    attachCrossStreets([p, near, far], [p, near, far], PIN.lat, PIN.lng);
    expect(p.cross_street).toBe("Colfax Ave");
  });
});
