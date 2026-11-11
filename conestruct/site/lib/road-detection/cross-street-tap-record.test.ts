// #493 — the WHERE tap's record carries the cross street's line it already
// fetched, so the NEEDS YOU map draws it with no second Overpass read.
//
// The real producer end to end: `lookupCrossStreet` → the real
// `/api/road-bearing` handler → `deriveCrossStreet` → `intersectionRecord`,
// with Overpass answered from the recorded E Colfax / Franklin fixture
// (validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/
// c74c32bdc5114bff.json, the vehicular ways within 50 m of the crossing).
// The record it writes is the committed backend fixture
// `tests/fixtures/needs-you/colfax-franklin-tap.json`, which
// tests/test_needs_you_map.py draws: one record, both sides (three-hop wire).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  rateLimitOr429: vi.fn(async () => null),
}));

import { POST } from "@/app/api/road-bearing/route";
import { resetMirrorRest } from "./overpass";
import { GEOMETRY_MAX_NODES } from "./stitch";
import { DEFAULT_NEAR_INTERSECTION } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import { withRelayedCenterline } from "@/lib/scenarios/centerline-relay";
import { intersectionRecord, lookupCrossStreet } from "./cross-street-lookup";

const OVERPASS = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      "../../../../validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json",
    ),
    "utf-8",
  ),
) as { elements: unknown[] };
const TAP_FIXTURE = resolve(
  __dirname,
  "../../../../tests/fixtures/needs-you/colfax-franklin-tap.json",
);

// The tap: the crossing node #484's walk framed on (7402343541), where an
// operator taps "the intersection nearest the work".
const TAP = { lat: 39.7399691, lng: -104.968354 };
// The mainline: East Colfax Avenue, the confirmed road at the work.
const MAIN = { way_id: "1547338997", name: "East Colfax Avenue", bearing: 270 };

let overpassCalls = 0;

beforeEach(() => {
  resetMirrorRest();
  overpassCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: { body?: string }) => {
      if (url === "/api/road-bearing") {
        const body = init?.body ?? "";
        return POST(
          new NextRequest("http://localhost/api/road-bearing", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "content-length": String(Buffer.byteLength(body)),
            },
            body,
          }),
        );
      }
      // Every Overpass round trip (the roads, then the same-name chain)
      // answers the recorded ways.
      overpassCalls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ elements: OVERPASS.elements }),
      };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("#493 the tap's record keeps the cross street's line", () => {
  it("writes Franklin Street with the line the lookup fetched, as the backend fixture holds it", async () => {
    const found = await lookupCrossStreet(TAP, MAIN);
    expect(found.kind).toBe("detected");
    if (found.kind !== "detected") return;
    const record = intersectionRecord(TAP, found.candidate);
    expect(record.name).toBe("Franklin Street");
    expect(record.geometry?.length ?? 0).toBeGreaterThanOrEqual(2);
    // The lookup's own reads only: the record adds none.
    expect(overpassCalls).toBeGreaterThan(0);
    if (process.env.UPDATE_TAP_FIXTURE === "1") {
      writeFileSync(TAP_FIXTURE, `${JSON.stringify(record, null, 2)}\n`);
    }
    expect(record).toEqual(JSON.parse(readFileSync(TAP_FIXTURE, "utf-8")));
  });

  it.each([
    ["no line", null],
    ["a one-point line", [[39.74, -104.968]]],
    [
      "an own-way line over GEOMETRY_MAX_NODES",
      Array.from(
        { length: GEOMETRY_MAX_NODES + 1 },
        (_, i): [number, number] => [39.74 + i * 1e-5, -104.968],
      ),
    ],
  ])(
    "a candidate with %s writes the record as before, with no geometry key",
    (_label, geometry) => {
      const record = intersectionRecord(TAP, {
        name: "Franklin Street",
        highwayClass: "residential",
        legCount: 2,
        signalized: false,
        speedMph: null,
        lanesPerDirection: null,
        lanesSuspect: true,
        lanesSuspectReason: null,
        roadType: "urban_arterial",
        bearingDeg: 0,
        detectedLanesTotal: null,
        detectedLanesForward: null,
        detectedLanesBackward: null,
        detectedLanesBothWays: null,
        geometry: geometry as Array<[number, number]> | null,
      });
      expect(Object.keys(record)).toEqual([
        "lat",
        "lng",
        "name",
        "highwayClass",
        "postedSpeedMph",
      ]);
    },
  );

  it("the worst case still fits the 32 KB render-family cap", () => {
    // 300 points each (GEOMETRY_MAX_NODES), at OSM's 7 decimals: the
    // confirmed road's geometry, the centerline the wire derives from it,
    // and the cross street's line.
    const line = Array.from({ length: 300 }, (_, i): [number, number] => [
      +(39.7399691 + i * 1.234567e-5).toFixed(7),
      +(-104.968354 - i * 1.234567e-5).toFixed(7),
    ]);
    const base = DEFAULT_NEAR_INTERSECTION;
    const scenario = {
      ...base,
      meta: {
        ...base.meta,
        lat: TAP.lat,
        lng: TAP.lng,
        confirmedRoad: {
          candidate: {
            way_id: MAIN.way_id,
            highway_class: "primary",
            name: MAIN.name,
            ref: null,
            bearing: MAIN.bearing,
            snap_distance_m: 1,
            snapped_lat: TAP.lat,
            snapped_lng: TAP.lng,
            tags: {
              oneway: null,
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
            geometry: line,
          },
          pinLat: TAP.lat,
          pinLng: TAP.lng,
        },
        intersection: { ...TAP, name: "Franklin Street", geometry: line },
      },
    } as Scenario;
    const wire = withRelayedCenterline(scenario);
    expect((wire.meta as { centerline?: unknown[] }).centerline).toHaveLength(
      300,
    );
    const body = JSON.stringify({
      scenario: wire,
      flag: "adjacent_intersection",
      width: 846,
      height: 423,
    });
    // The figure in evidence.md (#493), held so a change to it is seen.
    expect(Buffer.byteLength(body)).toBe(24312);
    expect(Buffer.byteLength(body)).toBeLessThan(32 * 1024);
  });
});
