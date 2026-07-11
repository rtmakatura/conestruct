import { describe, expect, it } from "vitest";

import { bearingOctant, dedupCandidates } from "@/lib/road-detection/dedup";
import type { RoadCandidate } from "@/lib/road-detection/types";

// Tests pin the *current* behavior of the dedup so a regression turns
// into a red CI signal instead of silently merging carriageways the
// picker exists to distinguish.

function mkCandidate(over: Partial<RoadCandidate>): RoadCandidate {
  return {
    way_id: "1",
    highway_class: "primary",
    name: null,
    ref: null,
    bearing: 0,
    snap_distance_m: 0,
    snapped_lat: 0,
    snapped_lng: 0,
    tags: {
      oneway: null,
      maxspeed: null,
      lanes: null,
      lanes_forward: null,
      lanes_backward: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
    ...over,
  };
}

describe("bearingOctant", () => {
  it("bins each octant on the canonical 45° boundaries", () => {
    expect(bearingOctant(0)).toBe("N");
    expect(bearingOctant(45)).toBe("NE");
    expect(bearingOctant(90)).toBe("E");
    expect(bearingOctant(135)).toBe("SE");
    expect(bearingOctant(180)).toBe("S");
    expect(bearingOctant(225)).toBe("SW");
    expect(bearingOctant(270)).toBe("W");
    expect(bearingOctant(315)).toBe("NW");
  });

  it("normalises out-of-range bearings", () => {
    expect(bearingOctant(360)).toBe("N");
    expect(bearingOctant(-5)).toBe("N");
    expect(bearingOctant(720)).toBe("N");
  });
});

describe("dedupCandidates", () => {
  it("keeps opposite-direction same-name carriageways distinct (divided highway)", () => {
    // I-25 Mead case: NB and SB carriageways both tagged ref='I 25'.
    // 0° and 180° → octants N and S → different keys → kept distinct.
    const result = dedupCandidates([
      mkCandidate({ way_id: "nb", ref: "I 25", bearing: 0, snap_distance_m: 5 }),
      mkCandidate({ way_id: "sb", ref: "I 25", bearing: 180, snap_distance_m: 10 }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.way_id).sort()).toEqual(["nb", "sb"]);
  });

  it("merges same-road segment duplicates regardless of inconsistent oneway tagging", () => {
    // Welton St case: two OSM segments of the same physical road, same
    // name + class + octant, but oneway tag is missing on one segment.
    // Should collapse to one candidate (the closer one).
    const result = dedupCandidates([
      mkCandidate({
        way_id: "explicit",
        name: "Welton Street",
        highway_class: "tertiary",
        bearing: 44.61,
        snap_distance_m: 25,
        tags: { oneway: "yes", maxspeed: null, lanes: null, lanes_forward: null, lanes_backward: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null },
      }),
      mkCandidate({
        way_id: "missing-oneway",
        name: "Welton Street",
        highway_class: "tertiary",
        bearing: 43.72,
        snap_distance_m: 12,
        tags: { oneway: null, maxspeed: null, lanes: null, lanes_forward: null, lanes_backward: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null },
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].way_id).toBe("missing-oneway");
  });

  it("keeps different-name one-way couplet streets distinct", () => {
    // Downtown Denver: Stout St (NE) and Champa St (SW) are a couplet
    // pair with different names — trivially distinct by name key.
    const result = dedupCandidates([
      mkCandidate({ way_id: "stout", name: "Stout Street", bearing: 45, snap_distance_m: 5 }),
      mkCandidate({ way_id: "champa", name: "Champa Street", bearing: 225, snap_distance_m: 8 }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("keeps same-name roads of different highway_class distinct (frontage vs main)", () => {
    // Frontage road (service or unclassified) parallel to a main road,
    // both happening to be tagged with the same name.  Different
    // highway_class → different keys → kept distinct.
    const result = dedupCandidates([
      mkCandidate({
        way_id: "main",
        name: "Frontage Rd",
        highway_class: "primary",
        bearing: 0,
        snap_distance_m: 5,
      }),
      mkCandidate({
        way_id: "frontage",
        name: "Frontage Rd",
        highway_class: "unclassified",
        bearing: 0,
        snap_distance_m: 25,
      }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("falls back to ref when name is null", () => {
    // OSM ways with only a `ref` tag (route number) should cluster
    // together when they share the ref + class + octant.
    const result = dedupCandidates([
      mkCandidate({ way_id: "a", name: null, ref: "US 85", highway_class: "trunk", bearing: 0, snap_distance_m: 5 }),
      mkCandidate({ way_id: "b", name: null, ref: "US 85", highway_class: "trunk", bearing: 0, snap_distance_m: 15 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].way_id).toBe("a");
  });

  it("keeps the nearest way when collapsing a cluster", () => {
    const result = dedupCandidates([
      mkCandidate({ way_id: "far", name: "Main St", bearing: 0, snap_distance_m: 28 }),
      mkCandidate({ way_id: "near", name: "Main St", bearing: 1, snap_distance_m: 4 }),
      mkCandidate({ way_id: "mid", name: "Main St", bearing: 2, snap_distance_m: 15 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].way_id).toBe("near");
  });

  it("clusters unnamed segments of the same class+octant together", () => {
    // Two unnamed `residential` segments at the same octant — likely
    // the same unnamed alley split into multiple OSM ways.  Should
    // merge.  (If they're really different unnamed roads, the operator
    // sees one option labelled "Unnamed residential" and can verify.)
    const result = dedupCandidates([
      mkCandidate({ way_id: "a", name: null, ref: null, highway_class: "residential", bearing: 0, snap_distance_m: 5 }),
      mkCandidate({ way_id: "b", name: null, ref: null, highway_class: "residential", bearing: 0, snap_distance_m: 15 }),
    ]);
    expect(result).toHaveLength(1);
  });
});
