// @vitest-environment happy-dom
//
// The confirmed-road persistence seam at the scenario layer: the road
// choice committed in the picker lives on ``scenario.meta`` (not as
// picker-local UI state), so it survives picker close/reopen and — via
// the saved plan's verbatim ``data`` — page reload.  These tests drive
// the mounted GeneratorShell with a scripted picker and assert what the
// shell actually hands BACK to the picker on reopen: the round trip the
// lost-confirmations bug broke.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios";
import type {
  ConfirmedRoad,
  RoadCandidate,
  RoadClassification,
} from "@/lib/road-detection/types";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./AuditTrail", () => ({ AuditTrail: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));

const CANDIDATE: RoadCandidate = {
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
};

const CLASSIFICATION: RoadClassification = {
  roadType: "urban_arterial",
  divided: false,
  laneWidthFt: 12,
  speedLimitMph: 45,
  lanesPerDirection: 2,
  confidence: "high",
  source: "osm-tags",
  raw: {
    class: "trunk",
    oneway: true,
    roadName: "E Baseline Rd",
    roadRef: "CO 7",
    placeName: "Lafayette",
    osmLanesTag: "2",
    osmMaxspeedTag: "45 mph",
  },
  fields: {
    speed: { value: 45, confidence: "high", source: "OSM maxspeed tag", method: "measured" },
    lanes: { value: 2, confidence: "medium", source: "OSM lanes tag", method: "measured" },
    roadType: { value: "urban_arterial", confidence: "high", source: "class", method: "measured" },
    divided: { value: false, confidence: "high", source: "oneway", method: "measured" },
  },
};

const CONFIRMED: ConfirmedRoad = {
  candidate: CANDIDATE,
  classification: CLASSIFICATION,
  method: "operator_pick",
  overrides: {},
  isUrban: true,
  placeName: "Lafayette",
  pinLat: 40.0176,
  pinLng: -105.13,
};

// Scripted picker: records every `initial` it is mounted with (what the
// shell hands back on each open) and exposes a Save that emits a result
// carrying the confirmed road — the LocationPickerResult a real
// pin-drop + road-pick + Save produces.
const capturedInitials: Array<{ confirmedRoad?: ConfirmedRoad | null }> = [];

vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({
    initial,
    onSave,
  }: {
    initial: { confirmedRoad?: ConfirmedRoad | null };
    onSave: (r: unknown) => void;
  }) => {
    capturedInitials.push(initial);
    return (
      <button
        type="button"
        onClick={() =>
          onSave({
            address: "Lafayette, CO",
            lat: 40.0176,
            lng: -105.13,
            bearingDeg: 90,
            workZoneFt: 1000,
            classification: CLASSIFICATION,
            overrides: {},
            crossStreet: null,
            confirmedRoad: CONFIRMED,
          })
        }
      >
        SAVE_WITH_ROAD
      </button>
    );
  },
}));

import { GeneratorShell } from "./GeneratorShell";

const fetchMock = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response),
);

beforeEach(() => {
  capturedInitials.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mountSandbox(initialScenario: Scenario = DEFAULT_SHOULDER) {
  render(<GeneratorShell mode="sandbox" initialScenario={initialScenario} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("confirmed road persists on scenario.meta across picker close/reopen", () => {
  it("reopen hands the saved confirmation back to the picker", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    await user.click(screen.getByText("Pick Location on Map"));
    expect(capturedInitials[0].confirmedRoad ?? null).toBeNull();

    await user.click(screen.getByText("SAVE_WITH_ROAD"));

    await user.click(screen.getByText(/Edit Location & Corridor/));
    const reopened = capturedInitials[capturedInitials.length - 1];
    expect(reopened.confirmedRoad?.candidate.way_id).toBe("111001");
    expect(reopened.confirmedRoad?.method).toBe("operator_pick");
    expect(reopened.confirmedRoad?.pinLat).toBe(40.0176);
  });

  it("reload-equivalent: a scenario restored with meta.confirmedRoad reaches the picker on first open", async () => {
    // Saved plans store the scenario verbatim (data: scenario); a page
    // reload rehydrates it as initialScenario.  The confirmation must
    // ride that path — it is scenario state, not component state.
    const user = userEvent.setup();
    const restored = {
      ...DEFAULT_SHOULDER,
      meta: {
        ...DEFAULT_SHOULDER.meta,
        address: "Lafayette, CO",
        lat: 40.0176,
        lng: -105.13,
        bearingDeg: 90,
        confirmedRoad: CONFIRMED,
      },
    } as Scenario;
    await mountSandbox(restored);

    await user.click(screen.getByText(/Edit Location & Corridor/));
    expect(
      capturedInitials[capturedInitials.length - 1].confirmedRoad?.candidate
        .way_id,
    ).toBe("111001");
  });
});
