// @vitest-environment happy-dom
//
// #139 mounted-flow tests: the multi-candidate road pick and the Save
// gate, driven through the REAL modal — typed coordinates trigger the
// real detectAt fetch, the real Which-road card renders, a real click
// picks a candidate, and the payload onSave receives is asserted.
// This flow had zero mounted coverage before (the modal is mocked away
// in every GeneratorShell suite; the a11y suite never exercises
// candidates) — the same blind-spot class that let the picker re-apply
// bug (#112) ship green through 198 tests.
//
// No Mapbox token in the test env, so the manual-coords inputs
// auto-show and typed coords drive applyTypedCoords → detectAt —
// detection runs without a map.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocationPickerModal } from "./LocationPickerModal";
import type { RoadCandidate, RoadDetectResponse } from "@/lib/road-detection/types";

function candidate(overrides: Partial<RoadCandidate>): RoadCandidate {
  return {
    way_id: "111001",
    highway_class: "trunk",
    name: "E Baseline Rd",
    ref: "CO 7",
    bearing: 90,
    snap_distance_m: 8.2,
    snapped_lat: 40.0176,
    snapped_lng: -105.13,
    tags: {
      oneway: "yes",
      maxspeed: "45 mph",
      lanes: "2",
      lanes_forward: null,
      lanes_backward: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
    ...overrides,
  };
}

const EASTBOUND = candidate({});
const WESTBOUND = candidate({
  way_id: "111002",
  bearing: 270,
  snap_distance_m: 14.6,
});

// URL-routed fetch stub: /api/road-bearing answers with the configured
// detection; everything else (corridor-spec) fails cleanly — the
// corridor preview names its unavailability, which is irrelevant here.
function stubDetection(response: RoadDetectResponse | { status: number }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/road-bearing")) {
        if ("status" in response && !("candidates" in response)) {
          return { ok: false, status: response.status, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => response };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
}

function detection(candidates: RoadCandidate[]): RoadDetectResponse {
  return {
    candidates,
    primary_index: candidates.length === 1 ? 0 : null,
    isUrban: true,
    placeName: "Lafayette",
  };
}

let onSave: ReturnType<typeof vi.fn>;

function mountModal() {
  onSave = vi.fn();
  return render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder", speedMph: 65 }}
      onCancel={() => {}}
      onSave={onSave}
    />,
  );
}

// Type coordinates into the manual inputs — the tokenless path into the
// real detection pipeline.
function typeCoords() {
  fireEvent.change(screen.getByLabelText("Latitude"), {
    target: { value: "40.0176" },
  });
  fireEvent.change(screen.getByLabelText("Longitude"), {
    target: { value: "-105.1300" },
  });
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: "Save & Close",
  }) as HTMLButtonElement;
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("multi-candidate road pick gates Save (#139)", () => {
  it("two candidates: Save disabled with the footer hint until a road is picked", async () => {
    stubDetection(detection([EASTBOUND, WESTBOUND]));
    mountModal();
    typeCoords();

    // The Which-road card renders off the data, rows carry the
    // disambiguation meta, and Save is blocked with words + glyph —
    // not a silently disabled button.
    await screen.findByText(/Which road\? · 2 detected/i);
    expect(screen.getByText(/8 m from pin · way 111001/i)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("Pick a road to continue")).toBeTruthy();

    // Picking a road resolves the block: Save enables, the hint leaves,
    // the card collapses to a summary, and road properties load.
    fireEvent.click(screen.getByRole("button", { name: /eastbound/i }));
    expect(saveButton().disabled).toBe(false);
    expect(screen.queryByText("Pick a road to continue")).toBeNull();
    expect(screen.queryByText(/8 m from pin · way 111001/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Change" })).toBeTruthy();
    expect(screen.getByText("Speed limit (mph)")).toBeTruthy();
  });

  it("payload: Save after a pick carries the picked candidate's bearing and classification", async () => {
    stubDetection(detection([EASTBOUND, WESTBOUND]));
    mountModal();
    typeCoords();

    await screen.findByText(/Which road\?/i);
    fireEvent.click(screen.getByRole("button", { name: /westbound/i }));
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledTimes(1);
    const result = onSave.mock.calls[0][0];
    expect(result.bearingDeg).toBe(270);
    expect(result.classification).not.toBeNull();
    expect(result.classification.raw.roadName).toBe("E Baseline Rd");
    expect(result.classification.speedLimitMph).toBe(45);
  });

  it("a hand-typed bearing is NOT an escape from the pick (deliberate behavior change)", async () => {
    stubDetection(detection([EASTBOUND, WESTBOUND]));
    mountModal();
    typeCoords();

    await screen.findByText(/Which road\?/i);
    fireEvent.change(
      screen.getByLabelText("Direction of travel in degrees"),
      { target: { value: "45" } },
    );
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("Pick a road to continue")).toBeTruthy();
  });

  it("Change re-expands the picker and a re-pick updates the payload", async () => {
    stubDetection(detection([EASTBOUND, WESTBOUND]));
    mountModal();
    typeCoords();

    await screen.findByText(/Which road\?/i);
    fireEvent.click(screen.getByRole("button", { name: /eastbound/i }));
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: /westbound/i }));
    fireEvent.click(saveButton());

    expect(onSave.mock.calls[0][0].bearingDeg).toBe(270);
  });

  it("single candidate: no card, no hint, Save enabled, bearing auto-applied", async () => {
    stubDetection(detection([EASTBOUND]));
    mountModal();
    typeCoords();

    await screen.findByText("Speed limit (mph)");
    expect(screen.queryByText(/Which road\?/i)).toBeNull();
    expect(screen.queryByText("Pick a road to continue")).toBeNull();
    expect(saveButton().disabled).toBe(false);
    expect(
      (screen.getByLabelText(
        "Direction of travel in degrees",
      ) as HTMLInputElement).value,
    ).toBe("90");
  });

  it("zero candidates: Save stays enabled and the plan saves with null classification (accepted boundary)", async () => {
    stubDetection(detection([]));
    mountModal();
    typeCoords();

    await screen.findByText(/No road detected within 30 m/i);
    expect(screen.queryByText("Pick a road to continue")).toBeNull();
    expect(saveButton().disabled).toBe(false);

    fireEvent.click(saveButton());
    expect(onSave.mock.calls[0][0].classification).toBeNull();
  });

  it("detection error: Save stays enabled (the operator falls back to manual entry)", async () => {
    stubDetection({ status: 502 });
    mountModal();
    typeCoords();

    await screen.findByText(/Couldn't reach road-detection service/i);
    expect(screen.queryByText("Pick a road to continue")).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });
});
