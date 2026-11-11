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
//   restores the selection with ZERO detect calls; a pin move after
//   reopen clears and re-detects.  #507 ruling 4 (RULE 5, stated): the
//   "Re-detect roads" button left the found-roads state; the only
//   fresh-analysis path at an unmoved pin is "Try again", and only after
//   a failed lookup.

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
    // #512: the backend's answer for a one-way trunk (/render/road-travel).
    travel: { travel: "one_way", carriageway: "divided" },
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
    scan_status: "ok",
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
let geocodeFailStatus = 404;
let geocodeFailReason = "";
let geocodeBodies: Array<{ address: string; jurisdiction_key: string | null }> = [];

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
        geocodeBodies.push(JSON.parse(String(init?.body)));
        if (!geocodeResponse) {
          return Promise.resolve({
            ok: false,
            status: geocodeFailStatus,
            json: async () => ({}),
            text: async () => geocodeFailReason,
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
      initial={{ scenarioKind: "shoulder", ...initialExtra }}
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

// #507 ruling 2: the road list's rows (role=radio); a row names the road
// and its distance, so rows are told apart by those, not by way IDs.
const rows = () => screen.queryAllByRole("radio");
const pickedRow = () => rows().find((r) => r.getAttribute("aria-checked") === "true") ?? null;

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: "Save and close",
  }) as HTMLButtonElement;
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  pendingDetects = [];
  geocodeResponse = null;
  geocodeBodies = [];
  geocodeFailStatus = 404;
  geocodeFailReason = "";
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

    await screen.findAllByRole("radio");
    fireEvent.click(rows()[0]);
    expect(pickedRow()?.textContent).toBe("E Baseline RdDivided road · 8 m from your pin");

    // Move the pin; the second request stays unanswered — this IS the
    // stale window.  Nothing from the previous pin may render, not
    // even dimmed: no rows, no selection — only the loading line.
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "40.1000" },
    });
    expect(pendingDetects).toHaveLength(2);
    expect(rows()).toHaveLength(0);
    expect(screen.queryByText(/E Baseline Rd/)).toBeNull();
    expect(screen.queryByTestId("road-pick-panel")).toBeNull();
    expect(screen.getByText(/Looking up the roads at your pin…/)).toBeTruthy();
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
    await screen.findByText("S Public Rd");

    // The old pin's response arrives late — dropped by the token guard.
    await respond(pendingDetects[0], detection([EASTBOUND, WESTBOUND]));
    expect(rows()).toHaveLength(1);
    expect(screen.queryByText(/E Baseline Rd/)).toBeNull();
    expect(pickedRow()?.textContent).toContain("S Public Rd");
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
      "That search found a town or area. Tap the map on the road where the work starts.",
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
        "That search found a town or area. Tap the map on the road where the work starts.",
      ),
    ).toBeNull();
  });
});

describe("#347 cross-street search", () => {
  function search(q: string) {
    fireEvent.change(
      screen.getByLabelText("Address or intersection search"),
      { target: { value: q } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
  }

  it("sends the selected jurisdiction; an intersection answer places the pin and detects there", async () => {
    geocodeResponse = { lat: 39.739964, lng: -104.966006, placeType: "intersection" };
    mountModal({ jurisdictionKey: "denver" });
    search("Colfax & Williams");

    await act(async () => {
      await Promise.resolve();
    });
    expect(geocodeBodies).toEqual([
      { address: "Colfax & Williams", jurisdiction_key: "denver" },
    ]);
    expect(pendingDetects).toHaveLength(1);
    expect(pendingDetects[0].body).toMatchObject({ lat: 39.739964, lng: -104.966006 });
  });

  it("no jurisdiction selected: sends null; a 422 (no corner in our places) places no pin and asks for a city", async () => {
    geocodeResponse = null;
    geocodeFailStatus = 422;
    mountModal();
    search("Colfax & Main");

    await screen.findByText("Add a city to search cross streets.");
    expect(geocodeBodies).toEqual([{ address: "Colfax & Main", jurisdiction_key: null }]);
    expect(pendingDetects).toHaveLength(0);
    expect(saveButton().disabled).toBe(true);
  });

  it("#376: a typed city outside Colorado reads the route's reason: Colorado roads only, no pin", async () => {
    geocodeResponse = null;
    geocodeFailStatus = 422;
    geocodeFailReason = "outside colorado";
    mountModal();
    search("Colfax & Main, Aurora, IL");

    await screen.findByText("Plans cover Colorado roads only.");
    expect(pendingDetects).toHaveLength(0);
    expect(saveButton().disabled).toBe(true);
  });

  it("the corner not found inside the area: the area answer recenters and asks for a pin", async () => {
    geocodeResponse = { lat: 39.764245, lng: -104.854753, placeType: "place" };
    mountModal({ jurisdictionKey: "denver" });
    search("Colfax & Main");

    await screen.findByText(
      "That search found a town or area. Tap the map on the road where the work starts.",
    );
    expect(pendingDetects).toHaveLength(0);
  });
});

describe("lost confirmations: reopen restores, pin move re-arms", () => {
  it("reopening with a saved pin + confirmed road restores the selection with ZERO detect calls", async () => {
    mountModal(RESTORE_INITIAL);

    // The confirmed road is on screen as-is: its row checked, Save
    // enabled — and no network round trip happened.
    expect(rows()).toHaveLength(1);
    expect(pickedRow()?.textContent).toBe("E Baseline RdDivided road · 8 m from your pin");
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
    // so the panel sits at idle — but nothing claims a confirmed road,
    // and (#507 ruling 6) Save does not pretend one was picked.
    expect(rows()).toHaveLength(0);
    expect(screen.queryByText(/E Baseline Rd/)).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  // #507 ruling 4 (RULE 5, stated): no Re-detect beside a found road.
  it("a restored road offers no re-detect control: nothing re-analyses an unmoved, answered pin", async () => {
    mountModal(RESTORE_INITIAL);
    expect(pendingDetects).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Re-detect roads/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(pendingDetects).toHaveLength(0);
  });

  it("'Try again' (after a failed lookup) is the explicit fresh-analysis path at an unmoved pin", async () => {
    mountModal();
    typeCoords();
    await respond(pendingDetects[0], {
      ...detection([]),
      scan_status: "unavailable",
    } as RoadDetectResponse);
    await screen.findByText("We couldn't look up the roads here.");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    // Detection fires at the SAME pin; the failure clears immediately
    // (the loading line in its place).
    expect(pendingDetects).toHaveLength(2);
    expect(pendingDetects[1].body.lat).toBeCloseTo(40.0176);
    expect(pendingDetects[1].body.lng).toBeCloseTo(-105.13);
    expect(screen.queryByText("We couldn't look up the roads here.")).toBeNull();
    expect(screen.getByText(/Looking up the roads at your pin…/)).toBeTruthy();

    await respond(pendingDetects[1], detection([WESTBOUND]));
    await screen.findByText("Divided road · 15 m from your pin");
  });

  it("a pin move after reopen clears the restored road and re-detects (rule 1 applies)", async () => {
    mountModal(RESTORE_INITIAL);
    expect(pendingDetects).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "40.1000" },
    });

    expect(pendingDetects).toHaveLength(1);
    expect(rows()).toHaveLength(0);
    expect(screen.getByText(/Looking up the roads at your pin…/)).toBeTruthy();

    await respond(pendingDetects[0], detection([OTHER_ROAD]));
    await screen.findByText("S Public Rd");

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
    await screen.findAllByRole("radio");
    fireEvent.click(rows()[1]);
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
    await screen.findByRole("radio", { checked: true });
    fireEvent.click(saveButton());
    expect(onSave.mock.calls[0][0].confirmedRoad.method).toBe("auto_single");
  });

  it("an unresolved save (no road detected) carries a null confirmation — honest invalidation", async () => {
    mountModal();
    typeCoords();
    await respond(pendingDetects[0], detection([]));
    await screen.findByText(/No mapped road runs within 30 m/i);
    // #507 ruling 6: the save needs the way the road runs first.
    fireEvent.click(screen.getByRole("radio", { name: "Northeast–southwest" }));
    fireEvent.click(saveButton());
    expect(onSave.mock.calls[0][0].confirmedRoad).toBeNull();
    expect(onSave.mock.calls[0][0].roadAxis).toBe("northeast_southwest");
  });
});

describe("in-flight detection gates Save (#189)", () => {
  it("Save is disabled with a note while classification resolves; enabled the moment it settles", async () => {
    mountModal();
    typeCoords();
    // Detection is in flight (the request is parked, unanswered) — this
    // is the window where Save used to silently discard the
    // classification and, on gated kinds, the safety relays.
    expect(pendingDetects).toHaveLength(1);
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText(/Looking up the roads. Save turns on/)).toBeTruthy();

    await respond(pendingDetects[0], detection([EASTBOUND]));
    await screen.findByRole("radio", { checked: true });
    expect(saveButton().disabled).toBe(false);
    expect(screen.queryByText(/Looking up the roads. Save turns on/)).toBeNull();
  });

  // #506 / #507 ruling 6 (RULE 5, stated): this used to pin "a settled
  // failure stays saveable".  Reversed on purpose: Save waits for the way
  // the road runs, and the waiting line gives way to the blocked line.
  it("a resolved-failed detection (zero candidates) blocks Save until a direction is picked", async () => {
    mountModal();
    typeCoords();
    await respond(pendingDetects[0], detection([]));
    await screen.findByText(/No mapped road runs within 30 m/i);
    expect(saveButton().disabled).toBe(true);
    expect(screen.queryByText(/Looking up the roads. Save turns on/)).toBeNull();
    expect(screen.getByTestId("picker-save-blocked").textContent).toBe(
      "Pick a road, or a direction if the lookup failed.",
    );
    fireEvent.click(screen.getByRole("radio", { name: "East–west" }));
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(onSave.mock.calls[0][0].classification).toBeNull();
    expect(onSave.mock.calls[0][0].confirmedRoad).toBeNull();
    expect(onSave.mock.calls[0][0].roadAxis).toBe("east_west");
  });
});
