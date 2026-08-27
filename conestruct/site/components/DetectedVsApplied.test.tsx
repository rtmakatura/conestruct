// @vitest-environment happy-dom
//
// #227 surface 7 / #214 — the detected-vs-applied block.  Three facts
// of one kind in one place: detection source, detected value, applied
// value.  The #214 acceptance rides the bearing provenance line: with
// road geometry on file the block states the typed bearing's actual
// role BEFORE the user types (the E Bayaud repro: typed 90 over
// detected 85 shows both values plus the governs sentence).  Rule 10:
// no confirmed road at the CURRENT pin → no block (manual path keeps
// today's surfaces, byte-identical).

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_SHOULDER, DEFAULT_FLAGGER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { DetectedVsApplied } from "./DetectedVsApplied";

afterEach(cleanup);

function confirmedRoad(over: Partial<ConfirmedRoad> = {}): ConfirmedRoad {
  return {
    candidate: {
      way_id: "1042",
      highway_class: "secondary",
      name: "E Bayaud Ave",
      ref: null,
      bearing: 85,
      snap_distance_m: 4,
      snapped_lat: 39.71466,
      snapped_lng: -104.94071,
      tags: {
        oneway: null,
        maxspeed: "30 mph",
        lanes: "2",
        lanes_forward: null,
        lanes_backward: null,
        lanes_both_ways: null,
        turn_lanes: null,
        turn_lanes_forward: null,
        turn_lanes_backward: null,
      },
      signal_distance_m: null,
      geometry: [
        [39.714, -104.941],
        [39.715, -104.94],
      ],
    },
    classification: {
      roadType: "urban_arterial",
      divided: false,
      laneWidthFt: 12,
      lanesPerDirection: 1,
      speedLimitMph: 30,
      confidence: "high",
      source: "osm-tags",
      raw: {
        class: "secondary",
        oneway: false,
        roadName: "E Bayaud Ave",
        roadRef: null,
        placeName: "Denver",
        osmLanesTag: "2",
        osmMaxspeedTag: "30 mph",
      },
      fields: {
        speed: { value: 30, confidence: "high", source: "OSM maxspeed tag", method: "measured" },
        lanes: { value: 1, confidence: "medium", source: "OSM lanes tag", method: "measured" },
        roadType: { value: "urban_arterial", confidence: "high", source: "class", method: "measured" },
        divided: { value: false, confidence: "high", source: "oneway", method: "measured" },
      },
    },
    method: "auto_single",
    overrides: {},
    isUrban: true,
    placeName: "Denver",
    pinLat: 39.71466,
    pinLng: -104.94071,
    ...over,
  } as unknown as ConfirmedRoad;
}

function pinnedShoulder(over: Partial<Scenario> = {}): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    speed: 30,
    lanes: 1,
    roadType: "urban_arterial",
    divided: false,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: 39.71466,
      lng: -104.94071,
      bearingDeg: 90,
      confirmedRoad: confirmedRoad(),
    },
    ...over,
  } as Scenario;
}

describe("#227 detected-vs-applied block (closes #214)", () => {
  it("no confirmed road: no block (manual path untouched)", () => {
    render(<DetectedVsApplied scenario={DEFAULT_SHOULDER} />);
    expect(document.querySelector(".dva")).toBeNull();
  });

  it("a stale confirmed road (pin moved) never speaks", () => {
    const s = pinnedShoulder();
    (s.meta as { lat: number }).lat = 39.9999;
    render(<DetectedVsApplied scenario={s} />);
    expect(document.querySelector(".dva")).toBeNull();
  });

  it("#214 repro: typed 90 over detected 85 — both values render, and the role sentence stands before any typing", () => {
    render(<DetectedVsApplied scenario={pinnedShoulder()} />);
    expect(screen.getByText("85°")).toBeTruthy();
    expect(screen.getByText("90°")).toBeTruthy();
    expect(
      screen.getByText(
        /road geometry governs the drawing — the typed bearing sets the travel-direction sign only/,
      ),
    ).toBeTruthy();
    // Source line: OSM detection with the road's identity.
    expect(
      screen.getByText(/OSM detection · E Bayaud Ave · way 1042/),
    ).toBeTruthy();
  });

  it("no geometry on file: the honest inverse sentence (typed bearing drives)", () => {
    const road = confirmedRoad();
    (road.candidate as { geometry: null }).geometry = null;
    render(
      <DetectedVsApplied
        scenario={pinnedShoulder({
          meta: {
            ...pinnedShoulder().meta,
            confirmedRoad: road,
          },
        } as Partial<Scenario>)}
      />,
    );
    expect(
      screen.getByText(
        /no road geometry on file — the typed bearing drives the drawing/,
      ),
    ).toBeTruthy();
  });

  it("rows render only for facts detection reported and the kind carries — flagger gets no lanes/divided rows", () => {
    const flagger = {
      ...DEFAULT_FLAGGER,
      speed: 30,
      meta: {
        ...DEFAULT_FLAGGER.meta,
        lat: 39.71466,
        lng: -104.94071,
        bearingDeg: 85,
        confirmedRoad: confirmedRoad(),
      },
    } as Scenario;
    render(<DetectedVsApplied scenario={flagger} />);
    expect(screen.queryByText("Lanes per direction")).toBeNull();
    expect(screen.queryByText("Divided")).toBeNull();
    expect(screen.getByText("Speed limit")).toBeTruthy();
    expect(screen.getByText("Bearing")).toBeTruthy();
  });
});
