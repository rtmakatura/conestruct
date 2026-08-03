// #140 — the wire-only meta.centerline materialization.
//
// The relay must fire only when the confirmed road's pin key exactly
// matches the scenario's pin (the picker's own staleness rule): a moved
// pin means the geometry no longer describes the site, and relaying it
// would draw a stale road on a crew document.

import { describe, expect, it } from "vitest";
import { DEFAULT_SHOULDER } from "./index";
import type { Scenario } from "./types";
import type { ConfirmedRoad } from "../road-detection/types";
import { withRelayedCenterline } from "./centerline-relay";

const GEOMETRY: Array<[number, number]> = [
  [39.742, -105.239],
  [39.743, -105.24],
  [39.744, -105.241],
];

function confirmedAt(pinLat: number, pinLng: number, geometry: Array<[number, number]> | null): ConfirmedRoad {
  return {
    candidate: {
      way_id: "17070828",
      highway_class: "tertiary",
      name: "Lookout Mountain Road",
      ref: null,
      bearing: 155.9,
      snap_distance_m: 0.5,
      snapped_lat: pinLat,
      snapped_lng: pinLng,
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
      geometry,
    },
    classification: null as never, // not read by the relay
    method: "auto_single",
    overrides: {},
    isUrban: false,
    placeName: null,
    pinLat,
    pinLng,
  };
}

function scenarioWith(meta: Partial<Scenario["meta"]>): Scenario {
  return { ...DEFAULT_SHOULDER, meta: { ...DEFAULT_SHOULDER.meta, ...meta } };
}

describe("withRelayedCenterline", () => {
  it("materializes meta.centerline when the confirmed pin matches", () => {
    const s = scenarioWith({
      lat: 39.742,
      lng: -105.239,
      confirmedRoad: confirmedAt(39.742, -105.239, GEOMETRY),
    });
    expect(withRelayedCenterline(s).meta.centerline).toEqual(GEOMETRY);
    // Input untouched (pure — the stored scenario never carries it).
    expect(s.meta.centerline).toBeUndefined();
  });

  it("does not relay when the pin moved after confirmation", () => {
    const s = scenarioWith({
      lat: 39.9,
      lng: -104.9,
      confirmedRoad: confirmedAt(39.742, -105.239, GEOMETRY),
    });
    expect(withRelayedCenterline(s).meta.centerline).toBeUndefined();
  });

  it("does not relay without a confirmed road or without geometry", () => {
    expect(
      withRelayedCenterline(scenarioWith({ confirmedRoad: null })).meta.centerline,
    ).toBeUndefined();
    const noGeom = scenarioWith({
      lat: 39.742,
      lng: -105.239,
      confirmedRoad: confirmedAt(39.742, -105.239, null),
    });
    expect(withRelayedCenterline(noGeom).meta.centerline).toBeUndefined();
  });
});
