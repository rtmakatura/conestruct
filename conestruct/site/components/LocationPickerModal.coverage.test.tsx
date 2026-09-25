// @vitest-environment happy-dom
//
// #211 / #290 mounted-flow tests: the corridor-extent panel of the REAL
// modal, driven the road-pick suite's way (typed coords fire the real
// detectAt fetch; no Mapbox token, so the manual-coords path drives it).
// Rule 11: the defect class was a drawing/label surface, so the
// assertions read the rendered panel and the request the modal sent.
//
// #290 (RULE 5, stated): the panel used to draw from lengths it fetched
// (/api/render/corridor-spec) walked out from the pin along the TYPED
// bearing — the frontend mirror whose direction #298 found inverted.  It
// now draws the BACKEND's geometry (/api/render/corridor-geometry, ruling
// 7).  The states this suite pinned survive; the typed bearing's words
// do not:
//   partial coverage  → "covers 0–N ft, bearing beyond"  (PDF vocabulary)
//   full coverage     → "OSM, full corridor"
//   pending pick      → no Centerline row, no geometry asked (#186)
//   manual (no road)  → "none — straight projection along the heading"
//   side unconfirmed  → the pre-side ruling's sentence, no extent
//   kind unconfirmed  → the work drawn, the lengths wait on the kind

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocationPickerModal } from "./LocationPickerModal";
import type { RoadCandidate, RoadDetectResponse } from "@/lib/road-detection/types";
import type { CorridorGeometry } from "@/lib/corridor-geometry";
import { DEFAULT_SHOULDER, type Scenario } from "@/lib/scenarios";

const PIN: [number, number] = [40.0176, -105.13];

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
    geometry: [
      [PIN[0], PIN[1]],
      [PIN[0], PIN[1] + 0.01],
    ],
    ...overrides,
  };
}

const ROAD = candidate({});

// The band's scenario: pinned at PIN, the road confirmed there, and the
// side confirmed on it (with the road's vertex order).
const SIDED: Scenario = {
  ...DEFAULT_SHOULDER,
  workLen: 400,
  meta: {
    ...DEFAULT_SHOULDER.meta,
    lat: PIN[0],
    lng: PIN[1],
    bearingDeg: 123, // a stale typed value: must never be sent
    work: { side: "right", travel: "with_geometry" },
    confirmedRoad: {
      candidate: ROAD,
      pinLat: PIN[0],
      pinLng: PIN[1],
    } as unknown as NonNullable<Scenario["meta"]["confirmedRoad"]>,
  },
} as Scenario;

// Zone lengths: work 400 + buffer 100 + taper 100 + advance 500 +
// downstream 100 = total 1,200 ft.
function laidOut(coverageFt: number | null): CorridorGeometry {
  const path: Array<[number, number]> = [
    [PIN[0], PIN[1]],
    [PIN[0], PIN[1] + 0.001],
  ];
  const part = (extended = false) => [{ points: path, extended }];
  return {
    status: "laid_out",
    pin_model: "work_start",
    pin: PIN,
    travel_bearing_deg: 90,
    work: { length_ft: 400, points: path, parts: part() },
    approaches: [
      {
        id: "primary",
        travel_bearing_deg: 90,
        zones: [
          { zone: "downstream", length_ft: 100, points: path, parts: part() },
          { zone: "buffer", length_ft: 100, points: path, parts: part() },
          { zone: "transition", length_ft: 100, points: path, parts: part() },
          { zone: "advance_warning", length_ft: 500, points: path, parts: part(true) },
        ],
      },
    ],
    coverage_ft: coverageFt,
    message: null,
    side_options: [
      { work: { side: "right", travel: "with_geometry" }, label: "South side · eastbound traffic", built: true },
    ],
  };
}

const SIDE_NOT_CONFIRMED: CorridorGeometry = {
  ...laidOut(null),
  status: "side_not_confirmed",
  travel_bearing_deg: null,
  work: null,
  approaches: [],
};

function stubFetches(detect: RoadDetectResponse, geometry: CorridorGeometry) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/road-bearing")) {
        return { ok: true, status: 200, json: async () => detect };
      }
      if (String(url).includes("/api/render/corridor-geometry")) {
        return { ok: true, status: 200, json: async () => geometry };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
}

function detection(candidates: RoadCandidate[]): RoadDetectResponse {
  return {
    scan_status: "ok",
    candidates,
    primary_index: candidates.length >= 1 ? 0 : null,
    isUrban: true,
    placeName: "Lafayette",
  };
}

function mountModal(scenario: Scenario = SIDED, kindConfirmed = true) {
  return render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder", speedMph: 65, scenario, kindConfirmed }}
      onCancel={() => {}}
      onSave={vi.fn()}
    />,
  );
}

function typeCoords(lat = PIN[0], lng = PIN[1]) {
  fireEvent.change(screen.getByLabelText("Latitude"), {
    target: { value: String(lat) },
  });
  fireEvent.change(screen.getByLabelText("Longitude"), {
    target: { value: String(lng) },
  });
}

const geometryBodies = () =>
  (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .filter((c) => String(c[0]).includes("/api/render/corridor-geometry"))
    .map((c) => JSON.parse(String((c[1] as RequestInit).body)).scenario as Scenario);

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// #290 hand-check item 4: "The picker's subtitle no longer mentions
// setting the length."  The length field left the picker; the band's
// Extent is the one length control.
describe("the picker's subtitle", () => {
  it("does not ask for a length; it says the pin marks where the work starts", () => {
    stubFetches(detection([ROAD]), SIDE_NOT_CONFIRMED);
    mountModal();
    const subtitle = screen.getByTestId("picker-subtitle").textContent ?? "";
    expect(subtitle).not.toMatch(/length/i);
    expect(subtitle).toContain("Drop a pin where the work starts");
  });
});

describe("the Centerline provenance row (#211), on the backend's geometry", () => {
  it("partial coverage: 'covers 0–N ft, bearing beyond' in the PDF's vocabulary", async () => {
    stubFetches(detection([ROAD]), laidOut(200));
    mountModal();
    typeCoords();
    await screen.findByText("Centerline", undefined, { timeout: 3000 });
    expect(await screen.findByText(/covers 0–200 ft, bearing beyond/i)).toBeTruthy();
    // The extent rows are the backend's lengths, total included.
    expect(screen.getByText("1,200 ft")).toBeTruthy();
  });

  it("full coverage: 'OSM, full corridor'", async () => {
    stubFetches(detection([ROAD]), laidOut(5000));
    mountModal();
    typeCoords();
    expect(
      await screen.findByText(/OSM, full corridor/i, undefined, { timeout: 3000 }),
    ).toBeTruthy();
  });

  // #290 hand-check (prod N Broadway SB): the way ended past the pin but
  // short of the work's downstream end.  The road-backed range starts
  // past the anchor, and the row names both ends — never "0".
  it("geometry that starts past the anchor: 'covers S–C ft'", async () => {
    stubFetches(detection([ROAD]), { ...laidOut(5000), coverage_start_ft: 36 });
    mountModal();
    typeCoords();
    expect(
      await screen.findByText(/covers 36–1,200 ft, bearing beyond/i, undefined, { timeout: 3000 }),
    ).toBeTruthy();
    expect(screen.queryByText(/OSM, full corridor/i)).toBeNull();
  });

  it("a corridor the backend cannot lay out: its reason is stated, not a blank panel", async () => {
    stubFetches(detection([ROAD]), {
      ...laidOut(null),
      status: "corridor_unbuildable",
      travel_bearing_deg: null,
      work: null,
      approaches: [],
      message: "ValueError: the road geometry cannot carry the corridor",
    });
    mountModal();
    typeCoords();
    const note = await screen.findByTestId("picker-corridor-refused", undefined, { timeout: 3000 });
    expect(note.textContent).toContain("Can't lay the corridor out here");
    expect(note.textContent).toContain("the road geometry cannot carry the corridor");
    expect(note.textContent).not.toContain("ValueError");
    expect(screen.queryByText("Centerline")).toBeNull();
  });

  it("pending multi-candidate pick: no Centerline row, and no geometry asked", async () => {
    stubFetches(
      detection([ROAD, candidate({ way_id: "111002", bearing: 270, snap_distance_m: 9 })]),
      laidOut(5000),
    );
    mountModal();
    typeCoords();
    await screen.findByText(/Which road\? · 2 detected/i, undefined, { timeout: 3000 });
    expect(screen.queryByText("Centerline")).toBeNull();
    await new Promise((r) => setTimeout(r, 400));
    expect(geometryBodies()).toEqual([]);
  });

  it("manual mode (no road): 'none — straight projection along the heading'", async () => {
    stubFetches(detection([]), laidOut(null));
    mountModal({ ...SIDED, meta: { ...SIDED.meta, confirmedRoad: null, work: { side: "right", heading: "E" } } } as Scenario);
    typeCoords();
    expect(
      await screen.findByText(/none — straight projection along the heading/i, undefined, {
        timeout: 3000,
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/typed bearing/i)).toBeNull();
  });
});

describe("#290 — what the panel says before the answers it waits on", () => {
  it("side unconfirmed: the pre-side ruling's sentence, and no extent", async () => {
    stubFetches(detection([ROAD]), SIDE_NOT_CONFIRMED);
    mountModal();
    typeCoords();
    expect(
      await screen.findByText("Say which side is occupied to lay out the work.", undefined, {
        timeout: 3000,
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Centerline")).toBeNull();
    expect(screen.queryByText(/^Total$/i)).toBeNull();
  });

  it("kind unconfirmed: the lengths wait on the kind (#289 finding 1) — no extent rows", async () => {
    stubFetches(detection([ROAD]), laidOut(5000));
    mountModal(SIDED, false);
    typeCoords();
    expect(
      await screen.findByText(/Corridor lengths wait on the kind of work/i, undefined, {
        timeout: 3000,
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/^Total$/i)).toBeNull();
  });
});

describe("#290 — the geometry request: the modal's live pin and road, never a bearing", () => {
  it("carries the pin and the picked road, keeps the side it was confirmed on, drops the typed bearing", async () => {
    stubFetches(detection([ROAD]), laidOut(5000));
    mountModal();
    typeCoords();
    await screen.findByText(/OSM, full corridor/i, undefined, { timeout: 3000 });
    const body = geometryBodies().at(-1)!;
    expect(body.meta.lat).toBe(PIN[0]);
    expect(body.meta.lng).toBe(PIN[1]);
    expect(body.meta.pinModel).toBe("work_start");
    expect(body.meta.work).toEqual({ side: "right", travel: "with_geometry" });
    expect(body.meta.confirmedRoad?.candidate.way_id).toBe("111001");
    expect("bearingDeg" in body.meta).toBe(false);
    // The retired lengths endpoint is never asked.
    const urls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) =>
      String(c[0]),
    );
    expect(urls.some((u) => u.includes("/api/render/corridor-spec"))).toBe(false);
  });

  it("a moved pin asks without the side — it was confirmed on the road at the old pin", async () => {
    stubFetches(detection([ROAD]), SIDE_NOT_CONFIRMED);
    mountModal();
    typeCoords(PIN[0] + 0.001, PIN[1]);
    await screen.findByText("Say which side is occupied to lay out the work.", undefined, {
      timeout: 3000,
    });
    const body = geometryBodies().at(-1)!;
    expect(body.meta.lat).toBe(PIN[0] + 0.001);
    expect(body.meta.work).toBeUndefined();
  });
});
