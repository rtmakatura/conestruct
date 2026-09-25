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
      lanes_backward: null, lanes_both_ways: null,
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
    scan_status: "ok",
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
    expect(screen.queryByText("Pick Road")).toBeNull();

    // Picking a road resolves the block: Save enables, the hint leaves,
    // the card collapses to a summary, and road properties load.
    fireEvent.click(screen.getByRole("button", { name: /eastbound/i }));
    expect(saveButton().disabled).toBe(false);
    expect(screen.queryByText("Pick a road to continue")).toBeNull();
    expect(screen.queryByText(/8 m from pin · way 111001/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Change" })).toBeTruthy();
    expect(screen.getByText("Speed limit (mph)")).toBeTruthy();
  });

  it("payload: Save after a pick carries the picked road and its classification — and no bearing (#290)", async () => {
    stubDetection(detection([EASTBOUND, WESTBOUND]));
    mountModal();
    typeCoords();

    await screen.findByText(/Which road\?/i);
    fireEvent.click(screen.getByRole("button", { name: /westbound/i }));
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledTimes(1);
    const result = onSave.mock.calls[0][0];
    // #290: the picker returns no direction — it is derived by the backend
    // from the road and the side the band confirms (ruling 8).  The pick
    // is the confirmed road itself.
    expect("bearingDeg" in result).toBe(false);
    expect(result.confirmedRoad.candidate.way_id).toBe("111002");
    expect(result.classification).not.toBeNull();
    expect(result.classification.raw.roadName).toBe("E Baseline Rd");
    expect(result.classification.speedLimitMph).toBe(45);
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

    expect(onSave.mock.calls[0][0].confirmedRoad.candidate.way_id).toBe("111002");
  });

  it("single candidate: confirmed card with the pre-selected row, no amber hint, Save enabled (#152 A)", async () => {
    stubDetection(detection([EASTBOUND]));
    mountModal();
    typeCoords();

    await screen.findByText("Speed limit (mph)");
    // The rail-top card shows the resolved outcome — a silent single
    // match read as a hang before.
    expect(screen.getByText(/Road detected · 1 match/i)).toBeTruthy();
    expect(screen.queryByText(/Which road\?/i)).toBeNull();
    expect(screen.getByText(/8 m from pin · way 111001/i)).toBeTruthy();
    expect(screen.queryByText("Pick a road to continue")).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });

  it("#290: the typed direction is retired — no field, no Use Detected, no Flip, no length", async () => {
    // FLOW.md §5a: "The typed bearing field retires deliberately (Rule 5)";
    // the band's Extent is the one length control (P2).
    stubDetection(detection([EASTBOUND]));
    mountModal();
    typeCoords();
    await screen.findByText("Speed limit (mph)");
    expect(screen.queryByLabelText("Direction of travel in degrees")).toBeNull();
    expect(screen.queryByRole("button", { name: /Use Detected|Detected \(in use\)/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Flip/ })).toBeNull();
    expect(screen.queryByText(/Work zone length \(ft\)/)).toBeNull();
    expect(screen.queryByText(/travel-direction sign only/)).toBeNull();
  });

  it("zero candidates: explicit empty-state card, Save stays enabled, null classification (accepted boundary)", async () => {
    stubDetection(detection([]));
    mountModal();
    typeCoords();

    await screen.findByText(/No road detected within 30 m/i);
    // #152 A: the outcome card names the empty result — never nothing.
    expect(
      screen.getByText(/Set road properties manually below/i),
    ).toBeTruthy();
    expect(screen.queryByText("Pick a road to continue")).toBeNull();
    expect(saveButton().disabled).toBe(false);

    fireEvent.click(saveButton());
    expect(onSave.mock.calls[0][0].classification).toBeNull();
  });

  it("detection error: explicit empty-state card, Save stays enabled (manual fallback)", async () => {
    stubDetection({ status: 502 });
    mountModal();
    typeCoords();

    await screen.findByText(/Couldn't reach road-detection service/i);
    expect(
      screen.getByText(/Set road properties manually below/i),
    ).toBeTruthy();
    expect(screen.queryByText("Pick a road to continue")).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });

  it("detection in flight: the outcome card shows the skeleton, never nothing (#152 A)", async () => {
    // A never-resolving detect call pins the resolving state open.
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("/api/road-bearing")) {
          return new Promise(() => {});
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({}),
        });
      }),
    );
    mountModal();
    typeCoords();

    expect(await screen.findByText(/Detecting roads at pin…/i)).toBeTruthy();
  });

  it("a moved pin to an unresolved location clears the stale road pick (#149)", async () => {
    // First pin resolves to one road; a later pin move lands on an
    // ambiguous location — the first road's pick is stale and must not
    // linger while the new pick is unresolved.  (#290: there is no typed
    // direction left to go stale; the road pick is what carries over.)
    let phase = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/road-bearing")) {
          const body = phase === 0 ? detection([EASTBOUND]) : detection([EASTBOUND, WESTBOUND]);
          return { ok: true, status: 200, json: async () => body };
        }
        return { ok: false, status: 500, json: async () => ({}) };
      }),
    );
    mountModal();
    typeCoords();

    await screen.findByText(/Road detected · 1 match/i);

    phase = 1;
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "40.1000" },
    });

    await screen.findByText(/Which road\?/i);
    expect(screen.queryByText(/Road detected · 1 match/i)).toBeNull();
    expect(saveButton().disabled).toBe(true); // unresolved gates Save
  });
});
