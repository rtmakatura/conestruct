// @vitest-environment happy-dom
//
// #402 (round 4), Ryan's ruling 2 of 2026-10-29
// (validation-artifacts/committed/missions/walkthrough-round-3/ryan-rulings.md:8; its "in the picker only" reading at :9):
// "#402 side sentence: "Save, then say which side is occupied." in the
// picker only."  It supersedes, in the picker, the #290 pre-side sentence
// "Say which side is occupied to lay out the work"; the band's SIDE_BLOCKER
// keeps the #290 words (lib/scenarios/rail.ts).
//
// #507 ruling 1 (Ryan, 2026-11-10; validation-artifacts/committed/missions/
// ux-group8-map-window/rulings.md) retires that sentence and the map
// overlay that carried it (RULE 5, stated): the map carries zoom only, and
// W1's line under the road list, "You'll pick the side of the road next,
// on the page.", says what the sentence said.  This file now pins that.
//
// Rule 11: the sentence was drawn in two places, the map overlay and the
// panel note, so the test mounts the REAL modal and reads both.  The overlay
// lives inside the map pane, which renders only with a Mapbox token, so this
// file sets one and stubs `mapbox-gl` with an object that accepts any call
// (no "load" ever fires; the pin comes from the plan the modal opens on).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { RoadCandidate } from "@/lib/road-detection/types";
import type { CorridorGeometry } from "@/lib/corridor-geometry";
import { DEFAULT_SHOULDER, type Scenario } from "@/lib/scenarios";
import { SIDE_BLOCKER } from "@/lib/scenarios/rail";

vi.mock("mapbox-gl", () => {
  // Every property is this same callable, constructible object; never a thenable.
  const any: object = new Proxy(function () {}, {
    get: (_t, prop) => (prop === "then" || typeof prop === "symbol" ? undefined : any),
    apply: () => any,
    construct: () => any,
  });
  return { default: any };
});

import { LocationPickerModal } from "./LocationPickerModal";

const PIN: [number, number] = [39.74, -104.98];

const ROAD: RoadCandidate = {
  way_id: "111001",
  highway_class: "primary",
  name: "East Colfax Avenue",
  ref: null,
  bearing: 90,
  snap_distance_m: 4,
  snapped_lat: PIN[0],
  snapped_lng: PIN[1],
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
};

const PINNED: Scenario = {
  ...DEFAULT_SHOULDER,
  workLen: 400,
  meta: {
    ...DEFAULT_SHOULDER.meta,
    lat: PIN[0],
    lng: PIN[1],
    confirmedRoad: {
      candidate: ROAD,
      pinLat: PIN[0],
      pinLng: PIN[1],
    } as unknown as NonNullable<Scenario["meta"]["confirmedRoad"]>,
  },
} as Scenario;

const SIDE_NOT_CONFIRMED: CorridorGeometry = {
  status: "side_not_confirmed",
  pin_model: "work_start",
  pin: PIN,
  travel_bearing_deg: null,
  work: null,
  approaches: [],
  coverage_ft: null,
  message: null,
  side_options: [
    { work: { side: "right", travel: "with_geometry" }, label: "South side · eastbound traffic", built: true },
  ],
} as unknown as CorridorGeometry;

beforeEach(() => {
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/render/corridor-geometry")) {
        return { ok: true, status: 200, json: async () => SIDE_NOT_CONFIRMED };
      }
      if (String(url).includes("/api/road-bearing")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            scan_status: "ok",
            candidates: [ROAD],
            primary_index: 0,
            isUrban: true,
            placeName: "Denver",
          }),
        };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
});

describe("#507 ruling 1: the picker's side line (was #402 ruling 2's sentence)", () => {
  it("a pin waiting on its side: W1's side-next line shows; no map overlay, no panel note, no #402 sentence", async () => {
    render(
      <LocationPickerModal
        open
        initial={{ lat: PIN[0], lng: PIN[1], scenarioKind: "shoulder", scenario: PINNED, kindConfirmed: true }}
        onCancel={() => {}}
        onSave={vi.fn()}
      />,
    );
    // The lookup on open finds the one road; the line sits under the list.
    expect(
      await screen.findByText("You'll pick the side of the road next, on the page.", undefined, {
        timeout: 3000,
      }),
    ).toBeTruthy();
    // The geometry was asked and answered "side not confirmed"...
    await waitFor(() =>
      expect(
        (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.some((c) =>
          String(c[0]).includes("/api/render/corridor-geometry"),
        ),
      ).toBe(true),
    );
    await new Promise((r) => setTimeout(r, 50));
    // ...and neither the overlay nor the panel speaks #402's sentence.
    expect(screen.queryByTestId("picker-side-sentence")).toBeNull();
    expect(screen.queryByTestId("picker-corridor-note")).toBeNull();
    expect(document.body.textContent).not.toContain("Save, then say which side is occupied.");
    // The #290 words are gone from the picker...
    expect(document.body.textContent).not.toContain("lay out the work");
    // ...and stay in the band's own constant.
    expect(SIDE_BLOCKER).toBe("Say which side is occupied to lay out the work");
  });
});
