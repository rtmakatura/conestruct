// @vitest-environment happy-dom
//
// #211 mounted-flow tests: the Centerline provenance row in the
// corridor-extent panel, driven through the REAL modal (the road-pick
// suite's pattern — typed coords fire the real detectAt fetch; no
// Mapbox token, so the manual-coords path drives everything).  Rule 11:
// the defect class was a drawing/label surface, so the assertions read
// the rendered panel, not helper internals.
//
// The four states:
//   partial coverage  → "covers 0–N ft, bearing beyond"  (PDF vocabulary)
//   full coverage     → "OSM, full corridor"
//   pending pick      → no Centerline row at all (#186 — no geometry
//                       claim exists until the operator picks)
//   manual (no road)  → "none — straight projection from typed bearing"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocationPickerModal } from "./LocationPickerModal";
import type { RoadCandidate, RoadDetectResponse } from "@/lib/road-detection/types";
import { destinationPoint, M_PER_FT } from "@/lib/geodesy";

const PIN: [number, number] = [40.0176, -105.13];

// Straight-east candidate geometry reaching lengthFt from the pin.
function eastGeometry(lengthFt: number): Array<[number, number]> {
  return [0, lengthFt / 2, lengthFt].map((ft) =>
    destinationPoint(PIN[0], PIN[1], 90, ft * M_PER_FT),
  );
}

function candidate(overrides: Partial<RoadCandidate>): RoadCandidate {
  return {
    way_id: "111001",
    highway_class: "trunk",
    name: "E Baseline Rd",
    ref: "CO 7",
    bearing: 90,
    snap_distance_m: 1.0,
    snapped_lat: PIN[0],
    snapped_lng: PIN[1],
    tags: {
      oneway: null,
      maxspeed: "45 mph",
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

// Zone lengths: with the 400 ft work zone typed below, total = 1,200 ft.
const SPEC_LENGTHS = {
  advance_warning_ft: 500,
  taper_ft: 100,
  buffer_ft: 100,
  downstream_taper_ft: 100,
};

function stubFetches(detect: RoadDetectResponse) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/road-bearing")) {
        return { ok: true, status: 200, json: async () => detect };
      }
      if (String(url).includes("/api/render/corridor-spec")) {
        return { ok: true, status: 200, json: async () => SPEC_LENGTHS };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
}

function detection(candidates: RoadCandidate[]): RoadDetectResponse {
  return {
    candidates,
    primary_index: candidates.length >= 1 ? 0 : null,
    isUrban: true,
    placeName: "Lafayette",
  };
}

function mountModal() {
  return render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder", speedMph: 65, workZoneFt: 400 }}
      onCancel={() => {}}
      onSave={vi.fn()}
    />,
  );
}

function typeCoords() {
  fireEvent.change(screen.getByLabelText("Latitude"), {
    target: { value: String(PIN[0]) },
  });
  fireEvent.change(screen.getByLabelText("Longitude"), {
    target: { value: String(PIN[1]) },
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

describe("the Centerline provenance row (#211)", () => {
  it("partial coverage: 'covers 0–N ft, bearing beyond' in the PDF's vocabulary", async () => {
    stubFetches(detection([candidate({ geometry: eastGeometry(200) })]));
    mountModal();
    typeCoords();
    await screen.findByText("Centerline", undefined, { timeout: 3000 });
    expect(
      await screen.findByText(/covers 0–200 ft, bearing beyond/i, undefined, {
        timeout: 3000,
      }),
    ).toBeTruthy();
  });

  it("full coverage: 'OSM, full corridor'", async () => {
    stubFetches(detection([candidate({ geometry: eastGeometry(2000) })]));
    mountModal();
    typeCoords();
    expect(
      await screen.findByText(/OSM, full corridor/i, undefined, { timeout: 3000 }),
    ).toBeTruthy();
  });

  it("pending multi-candidate pick: no Centerline row (no geometry claim yet)", async () => {
    stubFetches(
      detection([
        candidate({ geometry: eastGeometry(2000) }),
        candidate({ way_id: "111002", bearing: 270, snap_distance_m: 9 }),
      ]),
    );
    mountModal();
    typeCoords();
    await screen.findByText(/Which road\? · 2 detected/i, undefined, { timeout: 3000 });
    // The extent rows themselves stay (backend lengths), but no
    // centerline claim renders while the pick is pending.
    expect(screen.queryByText("Centerline")).toBeNull();
    expect(screen.queryByText(/OSM, full corridor/i)).toBeNull();
  });

  it("manual mode (no road detected): 'none — straight projection from typed bearing'", async () => {
    stubFetches(detection([]));
    mountModal();
    typeCoords();
    expect(
      await screen.findByText(/none — straight projection from typed bearing/i, undefined, {
        timeout: 3000,
      }),
    ).toBeTruthy();
  });
});
