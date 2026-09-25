// @vitest-environment happy-dom
//
// #234 — the picker's half of "fact line <-> modal agree on the
// intersection", on the REAL modal: handed a saved intersection
// (near_intersection), it restores the crossing — named by the same
// crossStreetLabel the WHERE fact line reads — without a detection call
// at the crossing, and its Save hands the same intersection back.  The
// marker itself is a Mapbox object (no token in the suite); its creation
// is the map-load branch beside the main pin's.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocationPickerModal, type LocationPickerResult } from "./LocationPickerModal";
import { crossStreetLabel } from "@/lib/road-detection/labels";
import type { RoadCandidate } from "@/lib/road-detection/types";

const PIN = { lat: 39.9936, lng: -105.0897 };
const X = { lat: 39.9941, lng: -105.0897, name: "W 38th Ave" };

const MAIN: RoadCandidate = {
  way_id: "700001",
  highway_class: "secondary",
  name: "N Main St",
  ref: null,
  bearing: 0,
  snap_distance_m: 5,
  snapped_lat: PIN.lat,
  snapped_lng: PIN.lng,
  tags: {
    oneway: null,
    maxspeed: "35 mph",
    lanes: "2",
    lanes_forward: null,
    lanes_backward: null,
    lanes_both_ways: null,
    turn_lanes: null,
    turn_lanes_forward: null,
    turn_lanes_backward: null,
  },
  signal_distance_m: null,
};

const bearingCalls: Array<{ lat: number; lng: number }> = [];
beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  bearingCalls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/road-bearing")) {
        bearingCalls.push(JSON.parse(String(init?.body ?? "{}")));
        return {
          ok: true,
          status: 200,
          json: async () => ({ scan_status: "ok", candidates: [MAIN], primary_index: 0, isUrban: true, placeName: "Lafayette" }),
        };
      }
      if (String(url).includes("/api/render/corridor-spec")) {
        return { ok: true, status: 200, json: async () => ({ advance_warning_ft: 500, taper_ft: 100, buffer_ft: 100, downstream_taper_ft: 50 }) };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(intersection: typeof X | null) {
  const onSave = vi.fn<(r: LocationPickerResult) => void>();
  render(
    <LocationPickerModal
      open
      initial={{
        scenarioKind: "near_intersection",
        speedMph: 35,
        // #290: no bearing, no length — the picker takes neither now.
        address: "Lafayette, CO",
        lat: PIN.lat,
        lng: PIN.lng,
        intersection,
      }}
      onCancel={() => {}}
      onSave={onSave}
    />,
  );
  return onSave;
}

describe("#234 — the picker restores a saved intersection and hands it back", () => {
  it("restored: the crossing is named by crossStreetLabel, and no detection fires AT the crossing", async () => {
    mount(X);
    const line = await screen.findByTestId("cross-restored");
    expect(line.textContent).toContain(crossStreetLabel(X.name));
    // The main pin may be detected; the crossing is not re-looked-up.
    expect(bearingCalls.some((b) => b.lat === X.lat && b.lng === X.lng)).toBe(false);
    expect(screen.getByRole("button", { name: /Move the intersection pin/ })).toBeTruthy();
  });

  it("Save hands the same intersection back — the column's copy and the picker's stay one", async () => {
    const onSave = mount(X);
    await screen.findByTestId("cross-restored");
    const save = screen.getByRole("button", { name: /Save & Close/ }) as HTMLButtonElement;
    for (let i = 0; i < 30 && save.disabled; i += 1) await new Promise((r) => setTimeout(r, 100));
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].intersection).toEqual(X);
  });

  it("Clear, then Save: the intersection is gone from the result", async () => {
    const onSave = mount(X);
    await screen.findByTestId("cross-restored");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByTestId("cross-restored")).toBeNull();
    const save = screen.getByRole("button", { name: /Save & Close/ }) as HTMLButtonElement;
    for (let i = 0; i < 30 && save.disabled; i += 1) await new Promise((r) => setTimeout(r, 100));
    fireEvent.click(save);
    expect(onSave.mock.calls[0][0].intersection).toBeNull();
  });

  it("no saved intersection: nothing restored", async () => {
    mount(null);
    await screen.findByText(/Mark the intersection on the map/);
    expect(screen.queryByTestId("cross-restored")).toBeNull();
  });
});
