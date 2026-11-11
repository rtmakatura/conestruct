// #507 R145-3: the twin side swaps the confirmed carriageway, and the wire
// relays the twin only under work_start (centerline-relay.ts).
import { describe, expect, it } from "vitest";
import { swapToTwin } from "./carriageway-swap";
import { withRelayedCenterline } from "./centerline-relay";
import { confirmedRoadLabel } from "./band-facts";
import { classifyFromCandidate } from "@/lib/road-detection/classify";
import type { RoadCandidate } from "@/lib/road-detection/types";
import type { Scenario, ScenarioMeta } from "./types";

function cand(o: Partial<RoadCandidate>): RoadCandidate {
  return {
    way_id: "1",
    highway_class: "primary",
    name: "East Colfax Avenue",
    ref: null,
    bearing: 90,
    snap_distance_m: 9,
    snapped_lat: 39.74,
    snapped_lng: -104.966,
    tags: {
      oneway: "yes",
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
    geometry: [
      [39.74, -104.967],
      [39.74, -104.965],
    ],
    ...o,
  };
}

const west = cand({ way_id: "2", bearing: 270, snap_distance_m: 21, tags: { ...cand({}).tags, lanes: "2" } });
const east = cand({ twin: west });

function meta(): ScenarioMeta {
  return {
    lat: 39.74,
    lng: -104.966,
    pinModel: "work_start",
    confirmedRoad: {
      candidate: east,
      classification: classifyFromCandidate(east, true, "Denver"),
      method: "operator_pick",
      isUrban: true,
      placeName: "Denver",
      pinLat: 39.74,
      pinLng: -104.966,
    },
  } as unknown as ScenarioMeta;
}

describe("swapToTwin", () => {
  it("confirms the twin, carries the old lead as its twin, and reclassifies from the twin", () => {
    const out = swapToTwin(meta(), { side: "right", travel: "with_geometry" })!;
    expect(out.work).toEqual({ side: "right", travel: "with_geometry" });
    expect(out.confirmedRoad!.candidate.way_id).toBe("2");
    expect(out.confirmedRoad!.candidate.twin?.way_id).toBe("1");
    expect(out.confirmedRoad!.candidate.twin?.twin).toBeUndefined();
    expect(out.confirmedRoad!.classification).toEqual(classifyFromCandidate(west, true, "Denver"));
  });

  it("is null for a road with no twin", () => {
    const m = meta();
    m.confirmedRoad!.candidate = cand({});
    expect(swapToTwin(m, { side: "right", travel: "with_geometry" })).toBeNull();
  });
});

describe("withRelayedCenterline: the twin rides the wire", () => {
  it("relays twinRoad under work_start only", () => {
    const s = { meta: meta() } as unknown as Scenario;
    expect(withRelayedCenterline(s).meta.twinRoad).toEqual({
      centerline: west.geometry,
      osmBearingDeg: 270,
      oneway: "yes",
    });
    const end = { meta: { ...meta(), pinModel: "corridor_end" } } as unknown as Scenario;
    expect(withRelayedCenterline(end).meta.twinRoad).toBeUndefined();
  });
});

describe("#507 Rule 10: a grouped street names no direction until its side is picked", () => {
  it("names the street alone, then the carriageway once a side is set", () => {
    const s = { meta: meta() } as unknown as Scenario;
    expect(confirmedRoadLabel(s)).toBe("East Colfax Avenue");
    const sided = { meta: { ...meta(), work: { side: "right", travel: "with_geometry" } } } as unknown as Scenario;
    expect(confirmedRoadLabel(sided)).toBe("East Colfax Avenue Eastbound");
  });
});
