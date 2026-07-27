import { describe, expect, it } from "vitest";

import {
  alongStationFromPins,
  approachesFromCrossStreet,
  bearingDeltaMod180,
  deriveCrossStreet,
  lanesSuspicion,
  type CrossStreetCandidate,
} from "@/lib/road-detection/cross-street";
import { destinationPoint } from "@/lib/geodesy";
import type {
  RoadCandidate,
  RoadDetectResponse,
} from "@/lib/road-detection/types";

const M_PER_FT = 0.3048;

function mkCandidate(over: Partial<RoadCandidate>): RoadCandidate {
  return {
    way_id: "1",
    highway_class: "secondary",
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
      lanes_backward: null, lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
    ...over,
  };
}

function mkDetection(
  candidates: RoadCandidate[],
  isUrban = true,
): RoadDetectResponse {
  return { candidates, primary_index: 0, isUrban, placeName: null };
}

const ANCHOR = { lat: 39.9936, lng: -105.0897 };

describe("bearingDeltaMod180", () => {
  it("ignores direction of travel", () => {
    expect(bearingDeltaMod180(0, 180)).toBe(0);
    expect(bearingDeltaMod180(90, 270)).toBe(0);
  });
  it("measures the perpendicular case as 90", () => {
    expect(bearingDeltaMod180(0, 90)).toBe(90);
    expect(bearingDeltaMod180(45, 315)).toBe(90);
  });
});

describe("alongStationFromPins", () => {
  it("projects a pin straight up the mainline into the station frame", () => {
    // Cross pin exactly 1,000 ft north of the anchor, mainline bearing
    // north: raw along-distance 1,000 ft, minus the 100-ft downstream
    // taper the anchor sits below station 0.
    const [clat, clng] = destinationPoint(
      ANCHOR.lat,
      ANCHOR.lng,
      0,
      1000 * M_PER_FT,
    );
    const along = alongStationFromPins(
      ANCHOR.lat,
      ANCHOR.lng,
      clat,
      clng,
      0,
      100,
    );
    expect(Math.abs(along - 900)).toBeLessThanOrEqual(1);
  });

  it("signs the projection negative behind the anchor (downstream side)", () => {
    const [clat, clng] = destinationPoint(
      ANCHOR.lat,
      ANCHOR.lng,
      180,
      300 * M_PER_FT,
    );
    const along = alongStationFromPins(
      ANCHOR.lat,
      ANCHOR.lng,
      clat,
      clng,
      0,
      100,
    );
    expect(Math.abs(along - -400)).toBeLessThanOrEqual(1);
  });
});

describe("lanesSuspicion", () => {
  it("flags explicit turn-lane tags", () => {
    const { suspect, reason } = lanesSuspicion({
      ...mkCandidate({}).tags,
      turn_lanes: "left|through|through",
    });
    expect(suspect).toBe(true);
    expect(reason).toMatch(/turn/i);
  });
  it("flags an asymmetric total vs per-direction split", () => {
    const { suspect } = lanesSuspicion({
      ...mkCandidate({}).tags,
      lanes: "5",
      lanes_forward: "2",
      lanes_backward: "2", lanes_both_ways: null,
    });
    expect(suspect).toBe(true);
  });
  it("stays quiet on clean symmetric tagging", () => {
    const { suspect, reason } = lanesSuspicion({
      ...mkCandidate({}).tags,
      lanes: "4",
      lanes_forward: "2",
      lanes_backward: "2", lanes_both_ways: null,
    });
    expect(suspect).toBe(false);
    expect(reason).toBeNull();
  });
});

describe("deriveCrossStreet", () => {
  const mainline = mkCandidate({
    way_id: "m1",
    name: "Main Street",
    bearing: 0,
  });
  const oak = mkCandidate({
    way_id: "c1",
    name: "Oak Street",
    bearing: 90,
    snap_distance_m: 4,
    tags: {
      ...mkCandidate({}).tags,
      maxspeed: "30 mph",
      lanes: "2",
    },
    signal_distance_m: 12,
  });
  const baseInput = {
    mainlineWayId: "m1",
    mainlineName: "Main Street",
    mainlineBearingDeg: 0,
    anchorLat: ANCHOR.lat,
    anchorLng: ANCHOR.lng,
    crossLat: ANCHOR.lat,
    crossLng: ANCHOR.lng,
    downstreamTaperFt: 100,
  };

  it("excludes the mainline and picks the perpendicular road", () => {
    const cs = deriveCrossStreet({
      ...baseInput,
      detection: mkDetection([mainline, oak]),
    });
    expect(cs?.name).toBe("Oak Street");
  });

  it("excludes a parallel frontage road even with a different id", () => {
    const frontage = mkCandidate({
      way_id: "f1",
      name: "Main Street Frontage",
      bearing: 8, // within the parallel tolerance of the mainline's 0
      snap_distance_m: 2,
    });
    const cs = deriveCrossStreet({
      ...baseInput,
      detection: mkDetection([mainline, frontage]),
    });
    expect(cs).toBeNull();
  });

  it("returns null when nothing qualifies (manual entry fallback)", () => {
    const cs = deriveCrossStreet({
      ...baseInput,
      detection: mkDetection([mainline]),
    });
    expect(cs).toBeNull();
  });

  it("derives signalized, speed, lanes-per-direction, and two legs", () => {
    const cs = deriveCrossStreet({
      ...baseInput,
      detection: mkDetection([mainline, oak]),
    });
    expect(cs?.signalized).toBe(true); // 12 m <= the 30 m threshold
    expect(cs?.speedMph).toBe(30);
    expect(cs?.lanesPerDirection).toBe(1); // lanes=2 total, two-way
    expect(cs?.legCount).toBe(2);
    expect(cs?.roadType).toBe("urban_arterial"); // isUrban=true
  });

  it("a one-way cross street proposes a single leg", () => {
    const onewayOak = mkCandidate({
      ...oak,
      tags: { ...oak.tags, oneway: "yes" },
    });
    const cs = deriveCrossStreet({
      ...baseInput,
      detection: mkDetection([mainline, onewayOak]),
    });
    expect(cs?.legCount).toBe(1);
  });

  it("snaps an off-grid speed into the kind's 25-55 domain", () => {
    const fast = mkCandidate({
      ...oak,
      tags: { ...oak.tags, maxspeed: "70 mph" },
    });
    const cs = deriveCrossStreet({
      ...baseInput,
      detection: mkDetection([mainline, fast]),
    });
    expect(cs?.speedMph).toBe(55);
  });
});

describe("approachesFromCrossStreet", () => {
  const cs: CrossStreetCandidate = {
    name: "Oak Street",
    alongStationFt: -250,
    legCount: 2,
    signalized: true,
    speedMph: 30,
    lanesPerDirection: 2,
    lanesSuspect: true,
    lanesSuspectReason: "turn lanes",
    roadType: "urban_arterial",
    bearingDeg: 90,
    detectedLanesTotal: 4,
    detectedLanesForward: 2,
    detectedLanesBackward: 2,
    detectedLanesBothWays: null,
  };

  it("relays the lane tags onto every leg (issue #120) — both legs are the same way", () => {
    const legs = approachesFromCrossStreet(cs);
    for (const leg of legs) {
      expect(leg.detectedLanesTotal).toBe(4);
      expect(leg.detectedLanesForward).toBe(2);
      expect(leg.detectedLanesBackward).toBe(2);
      // Absent tag rides as undefined (omitted on the wire), not null.
      expect(leg.detectedLanesBothWays).toBeUndefined();
    }
  });

  it("generates both legs with form-owned ids and mirrored bearings", () => {
    const legs = approachesFromCrossStreet(cs);
    expect(legs.map((l) => l.id)).toEqual(["cross_a", "cross_b"]);
    expect(legs[0].bearingDeg).toBe(90);
    expect(legs[1].bearingDeg).toBe(270);
    // One cross street: the shared fields agree by construction.
    expect(legs[0].alongStationFt).toBe(-250);
    expect(legs[1].alongStationFt).toBe(-250);
    expect(legs.every((l) => l.signalized)).toBe(true);
    expect(legs.every((l) => l.speed === 30)).toBe(true);
    expect(legs.every((l) => l.lanesPerDirection === 2)).toBe(true);
  });

  it("a one-leg candidate yields a single approach", () => {
    const legs = approachesFromCrossStreet({ ...cs, legCount: 1 });
    expect(legs).toHaveLength(1);
    expect(legs[0].id).toBe("cross_a");
  });

  it("missing tags fall back to editable defaults", () => {
    const legs = approachesFromCrossStreet({
      ...cs,
      speedMph: null,
      lanesPerDirection: null,
    });
    expect(legs[0].speed).toBe(30);
    expect(legs[0].lanesPerDirection).toBe(1);
  });
});
