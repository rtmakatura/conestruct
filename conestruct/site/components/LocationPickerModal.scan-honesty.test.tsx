// @vitest-environment happy-dom
//
// #213 mounted-flow tests: an unavailable road scan renders as
// unavailable — never as the measured-absence claim, and never as a
// rural verdict.  Driven through the REAL modal exactly like the #139
// suite: typed coordinates trigger the real detectAt fetch; the
// /api/road-bearing stub answers with the #213 wire shapes.
//
// The masquerade these pin against: an all-mirrors Overpass outage
// used to render "No road detected within 30 m" (a measurement claim)
// and stamp isUrban:false into detection context (the silent rural
// default) — the 2026-08-17 triage capture in #213's body.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocationPickerModal } from "./LocationPickerModal";
import type {
  RoadCandidate,
  RoadDetectResponse,
} from "@/lib/road-detection/types";

function candidate(overrides: Partial<RoadCandidate>): RoadCandidate {
  return {
    way_id: "39508704",
    highway_class: "residential",
    name: "East Bayaud Avenue",
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
    ...overrides,
  };
}

const UNAVAILABLE = {
  scan_status: "unavailable",
  candidates: [],
  primary_index: null,
  isUrban: null,
  placeName: null,
} as unknown as RoadDetectResponse;

function okDetection(candidates: RoadCandidate[]): RoadDetectResponse {
  return {
    scan_status: "ok",
    candidates,
    primary_index: candidates.length === 1 ? 0 : null,
    isUrban: true,
    placeName: "Denver",
  } as unknown as RoadDetectResponse;
}

// FIFO fetch stub for /api/road-bearing — each detect run consumes the
// next scripted response, so "unavailable, then a clean retry" is one
// queue.  Everything else fails cleanly (irrelevant here).
function stubDetectionQueue(responses: RoadDetectResponse[]) {
  const remaining = [...responses];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/road-bearing")) {
        const next = remaining.length > 1 ? remaining.shift() : remaining[0];
        return { ok: true, status: 200, json: async () => next };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
}

function mountModal() {
  return render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder", speedMph: 65 }}
      onCancel={() => {}}
      onSave={() => {}}
    />,
  );
}

function typeCoords() {
  fireEvent.change(screen.getByLabelText("Latitude"), {
    target: { value: "39.71466" },
  });
  fireEvent.change(screen.getByLabelText("Longitude"), {
    target: { value: "-104.94071" },
  });
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("unavailable scan renders as unavailable (#213)", () => {
  it("shows the unavailable copy, never the measured-absence claim", async () => {
    stubDetectionQueue([UNAVAILABLE]);
    mountModal();
    typeCoords();

    await screen.findByText(/Road detection is unavailable right now/i);
    // The absence copy is reserved for a completed scan.
    expect(
      screen.queryByText(/No road detected within 30 m/i),
    ).toBeNull();
    // The retry affordance stands (the existing fresh-analysis control).
    expect(
      screen.getByRole("button", { name: /Re-detect roads/i }),
    ).toBeTruthy();
  });

  it("claims no verdict: the property panel says unavailable, not Rural", async () => {
    stubDetectionQueue([UNAVAILABLE]);
    mountModal();
    typeCoords();

    // The panel names the failure — not "No road detected at this
    // point" (a measurement) and not any road-type claim derived from
    // the silent isUrban:false default.
    await screen.findByText(/Detection service unavailable/i);
    expect(screen.queryByText(/No road detected at this point/i)).toBeNull();
    expect(screen.queryByText(/rural/i)).toBeNull();
  });

  it("retry re-runs detection and recovers to a real result", async () => {
    stubDetectionQueue([UNAVAILABLE, okDetection([candidate({})])]);
    mountModal();
    typeCoords();

    await screen.findByText(/Road detection is unavailable right now/i);
    fireEvent.click(screen.getByRole("button", { name: /Re-detect roads/i }));

    await screen.findByText(/Road detected · 1 match/i);
    expect(
      screen.queryByText(/Road detection is unavailable right now/i),
    ).toBeNull();
  });

  it("a completed empty scan keeps the absence copy (pin)", async () => {
    // Green at baseline: acceptance bullet 2 of #213 — "a genuine
    // empty scan still reads 'No road detected within 30 m'".
    stubDetectionQueue([
      {
        scan_status: "ok",
        candidates: [],
        primary_index: null,
        isUrban: false,
        placeName: null,
      } as unknown as RoadDetectResponse,
    ]);
    mountModal();
    typeCoords();

    await screen.findByText(/No road detected within 30 m/i);
    expect(
      screen.queryByText(/Road detection is unavailable right now/i),
    ).toBeNull();
  });
});
