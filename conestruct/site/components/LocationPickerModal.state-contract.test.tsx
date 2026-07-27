// @vitest-environment happy-dom
//
// The picker's detection-state contract: "confirmed choices are
// permanent until the pin moves; nothing else triggers re-analysis."
// Mounted-flow tests through the REAL modal (the road-pick suite's
// tokenless harness) covering both halves:
//
//   STALE SUGGESTIONS — a pin move instantly clears the previous pin's
//   candidate list and selection (a stale selection silently feeds
//   street class into jurisdiction rules); out-of-order responses from
//   superseded pins never render; a coarse geocode ("Lafayette, CO")
//   fires zero detect calls.
//
//   LOST CONFIRMATIONS — reopening with a saved pin + confirmed road
//   restores the selection with ZERO detect calls; the explicit
//   "Re-detect roads" affordance is the only fresh-analysis path at an
//   unmoved pin; a pin move after reopen clears and re-detects.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocationPickerModal } from "./LocationPickerModal";
import { classifyFromCandidate } from "@/lib/road-detection/classify";
import type {
  ConfirmedRoad,
  RoadCandidate,
  RoadDetectResponse,
} from "@/lib/road-detection/types";

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
const OTHER_ROAD = candidate({
  way_id: "222001",
  name: "S Public Rd",
  ref: null,
});

function detection(candidates: RoadCandidate[]): RoadDetectResponse {
  return {
    candidates,
    primary_index: candidates.length === 1 ? 0 : null,
    isUrban: true,
    placeName: "Lafayette",
  };
}

const CONFIRMED: ConfirmedRoad = {
  candidate: EASTBOUND,
  classification: classifyFromCandidate(EASTBOUND, true, "Lafayette"),
  method: "operator_pick",
  overrides: {},
  isUrban: true,
  placeName: "Lafayette",
  pinLat: 40.0176,
  pinLng: -105.13,
};

// Controllable fetch: every /api/road-bearing call parks here until the
// test responds to it — the lever for stale-window and out-of-order
// assertions.  /api/geocode answers synchronously from `geocodeResponse`.
interface PendingDetect {
  body: { lat: number; lng: number };
  respond: (r: RoadDetectResponse) => void;
}

let pendingDetects: PendingDetect[] = [];
let geocodeResponse: {
  lat: number;
  lng: number;
  placeType: string | null;
} | null = null;

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/road-bearing")) {
        return new Promise((resolve) => {
          pendingDetects.push({
            body: JSON.parse(String(init?.body)) as { lat: number; lng: number },
            respond: (r) =>
              resolve({ ok: true, status: 200, json: async () => r }),
          });
        });
      }
      if (u.includes("/api/geocode")) {
        if (!geocodeResponse) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: async () => ({}),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => geocodeResponse,
        });
      }
      // corridor-spec etc. fail cleanly; irrelevant here.
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    }),
  );
}

async function respond(p: PendingDetect, r: RoadDetectResponse) {
  await act(async () => {
    p.respond(r);
    await Promise.resolve();
  });
}

let onSave: ReturnType<typeof vi.fn>;

function mountModal(initialExtra: Record<string, unknown> = {}) {
  onSave = vi.fn();
  return render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder", speedMph: 65, ...initialExtra }}
      onCancel={() => {}}
      onSave={onSave}
    />,
  );
}

const RESTORE_INITIAL = {
  address: "Lafayette, CO",
  lat: 40.0176,
  lng: -105.13,
  bearingDeg: 90,
  workZoneFt: 300,
  confirmedRoad: CONFIRMED,
};

function typeCoords(lat = "40.0176", lng = "-105.1300") {
  fireEvent.change(screen.getByLabelText("Latitude"), {
    target: { value: lat },
  });
  fireEvent.change(screen.getByLabelText("Longitude"), {
    target: { value: lng },
  });
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: "Save & Close",
  }) as HTMLButtonElement;
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  pendingDetects = [];
  geocodeResponse = null;
  installFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stale suggestions: pin moves invalidate instantly", () => {
  it("a pin move clears the candidate list AND the selection while the new detect is in flight", async () => {
    mountModal();
    typeCoords();
    await respond(pendingDetects[0], detection([EASTBOUND, WESTBOUND]));

    await screen.findByText(/Which road\? · 2 detected/i);
    fireEvent.click(screen.getByRole("button", { name: /eastbound/i }));
    // Appears in both the collapsed card summary and the bearing caption.
    expect(screen.getAllByText(/way 111001/).length).toBeGreaterThan(0);

    // Move the pin; the second request stays unanswered — this IS the
    // stale window.  Nothing from the previous pin may render, not
    // even dimmed: no card, no selection caption, no property rows —
    // only the loading skeleton.
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "40.1000" },
    });
    expect(pendingDetects).toHaveLength(2);
    expect(screen.queryByText(/Which road\?/i)).toBeNull();
    expect(screen.queryByText(/way 111001/)).toBeNull();
    expect(screen.queryByText("Speed limit (mph)")).toBeNull();
    expect(screen.getByText(/Classifying road…/)).toBeTruthy();
  });

  it("out-of-order responses: a slow answer from a superseded pin never renders", async () => {
    mountModal();
    typeCoords(); // request 0 — will resolve LAST
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "40.1000" },
    }); // request 1 — the current pin
    expect(pendingDetects).toHaveLength(2);

    // Fast new response renders.
    await respond(pendingDetects[1], detection([OTHER_ROAD]));
    await screen.findAllByText(/way 222001/);

    // The old pin's response arrives late — dropped by the token guard.
    await respond(pendingDetects[0], detection([EASTBOUND, WESTBOUND]));
    expect(screen.queryByText(/Which road\?/i)).toBeNull();
    expect(screen.queryByText(/way 111001/)).toBeNull();
    expect(screen.getAllByText(/way 222001/).length).toBeGreaterThan(0);
  });

  it("a coarse geocode (locality) fires ZERO detect calls and asks for a pin", async () => {
    geocodeResponse = { lat: 39.9936, lng: -105.0897, placeType: "place" };
    mountModal();

    fireEvent.change(
      screen.getByLabelText("Address or intersection search"),
      { target: { value: "Lafayette, CO" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText(
      "Area located — drop a pin on the road to detect roads.",
    );
    expect(pendingDetects).toHaveLength(0);
    // No pin was placed either — Save stays gated on a pin.
    expect(saveButton().disabled).toBe(true);
  });

  it("control: an address-precision geocode still places the pin and detects", async () => {
    geocodeResponse = { lat: 40.0176, lng: -105.13, placeType: "address" };
    mountModal();

    fireEvent.change(
      screen.getByLabelText("Address or intersection search"),
      { target: { value: "400 E Baseline Rd, Lafayette" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(pendingDetects).toHaveLength(1);
    expect(
      screen.queryByText(
        "Area located — drop a pin on the road to detect roads.",
      ),
    ).toBeNull();
  });
});

describe("lost confirmations: reopen restores, pin move re-arms", () => {
  it("reopening with a saved pin + confirmed road restores the selection with ZERO detect calls", async () => {
    mountModal(RESTORE_INITIAL);

    // The confirmed road is on screen as-is: selection caption, road
    // properties, Save enabled — and no network round trip happened.
    expect(screen.getAllByText(/way 111001/).length).toBeGreaterThan(0);
    expect(screen.getByText("Speed limit (mph)")).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
    expect(pendingDetects).toHaveLength(0);

    // Re-saving carries the same road identity and keeps the original
    // determination method (it was an operator pick, and stays one
    // even though the restored list holds a single candidate).
    fireEvent.click(saveButton());
    const result = onSave.mock.calls[0][0];
    expect(result.confirmedRoad.candidate.way_id).toBe("111001");
    expect(result.confirmedRoad.method).toBe("operator_pick");
    expect(result.confirmedRoad.pinLat).toBe(40.0176);
  });

  it("a confirmation for a DIFFERENT pin is stale and does not restore", async () => {
    mountModal({
      ...RESTORE_INITIAL,
      confirmedRoad: { ...CONFIRMED, pinLat: 39.0, pinLng: -104.0 },
    });
    // No restored selection; tokenless env runs no auto-detect either,
    // so the panel sits at idle — but nothing claims a confirmed road.
    expect(screen.queryByText(/way 111001/)).toBeNull();
    expect(screen.queryByText("Speed limit (mph)")).toBeNull();
  });

  it("'Re-detect roads' is the explicit fresh-analysis path at an unmoved pin", async () => {
    mountModal(RESTORE_INITIAL);
    expect(pendingDetects).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Re-detect roads/ }));

    // Detection fires at the SAME pin; the restored selection clears
    // immediately (skeleton in its place).
    expect(pendingDetects).toHaveLength(1);
    expect(pendingDetects[0].body.lat).toBeCloseTo(40.0176);
    expect(pendingDetects[0].body.lng).toBeCloseTo(-105.13);
    expect(screen.queryByText(/way 111001/)).toBeNull();
    expect(screen.getByText(/Classifying road…/)).toBeTruthy();

    await respond(pendingDetects[0], detection([WESTBOUND]));
    await screen.findAllByText(/way 111002/);
  });

  it("a pin move after reopen clears the restored road and re-detects (rule 1 applies)", async () => {
    mountModal(RESTORE_INITIAL);
    expect(pendingDetects).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "40.1000" },
    });

    expect(pendingDetects).toHaveLength(1);
    expect(screen.queryByText(/way 111001/)).toBeNull();
    expect(screen.getByText(/Classifying road…/)).toBeTruthy();

    await respond(pendingDetects[0], detection([OTHER_ROAD]));
    await screen.findAllByText(/way 222001/);

    // The re-save is keyed to the NEW pin with the new road.
    fireEvent.click(saveButton());
    const result = onSave.mock.calls[0][0];
    expect(result.confirmedRoad.candidate.way_id).toBe("222001");
    expect(result.confirmedRoad.pinLat).toBeCloseTo(40.1);
    expect(result.confirmedRoad.method).toBe("auto_single");
  });

  it("a fresh operator pick records method 'operator_pick'; a sole candidate 'auto_single'", async () => {
    mountModal();
    typeCoords();
    await respond(pendingDetects[0], detection([EASTBOUND, WESTBOUND]));
    await screen.findByText(/Which road\?/i);
    fireEvent.click(screen.getByRole("button", { name: /westbound/i }));
    fireEvent.click(saveButton());
    expect(onSave.mock.calls[0][0].confirmedRoad.method).toBe("operator_pick");
    expect(onSave.mock.calls[0][0].confirmedRoad.candidate.way_id).toBe(
      "111002",
    );

    cleanup();
    installFetch();
    pendingDetects = [];
    mountModal();
    typeCoords();
    await respond(pendingDetects[0], detection([EASTBOUND]));
    await screen.findByText("Speed limit (mph)");
    fireEvent.click(saveButton());
    expect(onSave.mock.calls[0][0].confirmedRoad.method).toBe("auto_single");
  });

  it("an unresolved save (no road detected) carries a null confirmation — honest invalidation", async () => {
    mountModal();
    typeCoords();
    await respond(pendingDetects[0], detection([]));
    await screen.findByText(/No road detected within 30 m/i);
    fireEvent.click(saveButton());
    expect(onSave.mock.calls[0][0].confirmedRoad).toBeNull();
  });
});
