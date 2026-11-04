// #440 X4 — the picker's cross-street lookup, moved into one function the
// band's tap also calls.  Pinned at the request (what is sent) and at the
// answer for every branch the picker had: a named street, none, an HTTP
// error, the #213 unavailable scan, and a network failure.

import { afterEach, describe, expect, it, vi } from "vitest";

import { deriveCrossStreet } from "./cross-street";
import { intersectionRecord, lookupCrossStreet, normaliseBearing } from "./cross-street-lookup";
import type { RoadCandidate, RoadDetectOk } from "./types";

function candidate(over: Partial<RoadCandidate>): RoadCandidate {
  return {
    way_id: "W1",
    highway_class: "primary",
    name: "East Colfax Avenue",
    ref: null,
    bearing: 90,
    snap_distance_m: 3,
    snapped_lat: 39.74,
    snapped_lng: -104.966,
    tags: {
      oneway: null,
      maxspeed: "30 mph",
      lanes: "4",
      lanes_forward: null,
      lanes_backward: null,
      lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
    ...over,
  };
}

const MAIN = candidate({});
const RACE = candidate({ way_id: "R1", name: "Race Street", bearing: 0, highway_class: "residential" });
const DETECTION: RoadDetectOk = {
  scan_status: "ok",
  candidates: [MAIN, RACE],
  primary_index: 0,
  isUrban: true,
  placeName: null,
};
const POINT = { lat: 39.7401, lng: -104.9659 };

function answer(body: unknown, ok = true) {
  const f = vi.fn(async () => ({ ok, status: ok ? 200 : 502, json: async () => body }) as unknown as Response);
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lookupCrossStreet — the picker's lookup, one producer", () => {
  it("asks /api/road-bearing at the point, exactly as the picker did, and names the street", async () => {
    const f = answer(DETECTION);
    const got = await lookupCrossStreet(POINT, MAIN);
    expect(f).toHaveBeenCalledWith("/api/road-bearing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(POINT),
    });
    expect(got).toEqual({
      kind: "detected",
      candidate: deriveCrossStreet({
        detection: DETECTION,
        mainlineWayId: "W1",
        mainlineName: "East Colfax Avenue",
        mainlineBearingDeg: 90,
      }),
    });
  });

  it("no other street there is none", async () => {
    answer({ ...DETECTION, candidates: [MAIN] });
    expect(await lookupCrossStreet(POINT, MAIN)).toEqual({ kind: "none" });
  });

  it("an HTTP error, an unavailable scan (#213) and a network failure are each the error state", async () => {
    answer({}, false);
    expect(await lookupCrossStreet(POINT, MAIN)).toEqual({ kind: "error" });
    answer({ scan_status: "unavailable" });
    expect(await lookupCrossStreet(POINT, MAIN)).toEqual({ kind: "error" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await lookupCrossStreet(POINT, MAIN)).toEqual({ kind: "error" });
  });

  it("the record is the one the picker's Save writes; the bearing normalises as before", () => {
    const cs = deriveCrossStreet({
      detection: DETECTION,
      mainlineWayId: "W1",
      mainlineName: null,
      mainlineBearingDeg: 90,
    })!;
    expect(JSON.stringify(intersectionRecord(POINT, cs))).toBe(
      JSON.stringify({
        lat: POINT.lat,
        lng: POINT.lng,
        name: cs.name ?? null,
        highwayClass: cs.highwayClass ?? null,
        postedSpeedMph: cs.speedMph ?? null,
      }),
    );
    expect([normaliseBearing(-90.4), normaliseBearing(359.6), normaliseBearing(725)]).toEqual([270, 0, 5]);
  });
});
