// @vitest-environment happy-dom
//
// #402 (round 4), Ryan's ruling 2 of 2026-10-29
// (validation-artifacts/committed/missions/walkthrough-round-3/ryan-rulings.md:8; its "in the picker only" reading at :9):
// "#402 side sentence: "Save, then say which side is occupied." in the
// picker only."  It supersedes, in the picker, the #290 pre-side sentence
// "Say which side is occupied to lay out the work"; the band's SIDE_BLOCKER
// keeps the #290 words (lib/scenarios/rail.ts).
//
// Rule 11: the sentence is drawn in two places, the map overlay and the
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

const ROAD = {
  way_id: "111001",
  name: "East Colfax Avenue",
  highway: "primary",
  bearing_deg: 90,
  distance_m: 4,
  oneway: false,
} as unknown as RoadCandidate;

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

describe("#402 ruling 2: the picker's side sentence", () => {
  it("a pin waiting on its side: the map overlay and the panel both read the ruled sentence", async () => {
    render(
      <LocationPickerModal
        open
        initial={{ lat: PIN[0], lng: PIN[1], scenarioKind: "shoulder", scenario: PINNED, kindConfirmed: true }}
        onCancel={() => {}}
        onSave={vi.fn()}
      />,
    );
    const overlay = await screen.findByTestId("picker-side-sentence", undefined, { timeout: 3000 });
    expect(overlay.textContent).toBe("Save, then say which side is occupied.");
    await waitFor(() =>
      expect(screen.getByTestId("picker-corridor-note").textContent).toBe(
        "Save, then say which side is occupied.",
      ),
    );
    // The #290 words are gone from the picker...
    expect(document.body.textContent).not.toContain("lay out the work");
    // ...and stay in the band's own constant (ruling 2: "in the picker only").
    expect(SIDE_BLOCKER).toBe("Say which side is occupied to lay out the work");
  });
});
