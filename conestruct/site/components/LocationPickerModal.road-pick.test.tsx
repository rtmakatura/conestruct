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
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
let onCancel: ReturnType<typeof vi.fn>;

function mountModal() {
  onSave = vi.fn();
  onCancel = vi.fn();
  return render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder" }}
      onCancel={onCancel}
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
    name: "Save and close",
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

const rows = () => screen.getAllByRole("radio");

describe("multi-candidate road pick gates Save (#139)", () => {
  it("two candidates: Save disabled with the footer line until a road is picked", async () => {
    stubDetection(detection([EASTBOUND, WESTBOUND]));
    mountModal();
    typeCoords();

    // #507 ruling 2: one radio list under "Which road is the work on?";
    // each row's second line says how traffic runs and how far it is.
    await screen.findByText("Which road is the work on?");
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByText("Divided road · 8 m from your pin")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByTestId("picker-save-blocked").textContent).toBe(
      "Pick a road, or a direction if the lookup failed.",
    );
    expect(screen.queryByText("Pick Road")).toBeNull();

    // Picking a road resolves the block: Save enables, the line leaves,
    // and the list stays a list with the pick checked (no summary row).
    fireEvent.click(rows()[0]);
    expect(saveButton().disabled).toBe(false);
    expect(screen.queryByTestId("picker-save-blocked")).toBeNull();
    expect(rows()).toHaveLength(2);
    expect(rows()[0].getAttribute("aria-checked")).toBe("true");
    expect(rows()[1].getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByTestId("road-picked")).toBeNull();
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
  });

  it("payload: Save after a pick carries the picked road and its classification — and no bearing (#290)", async () => {
    stubDetection(detection([EASTBOUND, WESTBOUND]));
    mountModal();
    typeCoords();

    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(rows()[1]);
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledTimes(1);
    const result = onSave.mock.calls[0][0];
    // #290: the picker returns no direction — it is derived by the backend
    // from the road and the side the band confirms (ruling 8).  The pick
    // is the confirmed road itself.
    expect("bearingDeg" in result).toBe(false);
    expect(result.confirmedRoad.candidate.way_id).toBe("111002");
    expect(result.roadAxis).toBeNull();
    expect(result.classification).not.toBeNull();
    expect(result.classification.raw.roadName).toBe("E Baseline Rd");
    expect(result.classification.speedLimitMph).toBe(45);
  });

  // #507 ruling 2 (RULE 5, stated): Change left with the summary row; the
  // list stays open, so a re-pick is one click on the other row.
  it("a re-pick in the open list updates the payload (no Change step)", async () => {
    stubDetection(detection([EASTBOUND, WESTBOUND]));
    mountModal();
    typeCoords();

    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(rows()[0]);
    fireEvent.click(rows()[1]);
    expect(rows()[0].getAttribute("aria-checked")).toBe("false");
    expect(rows()[1].getAttribute("aria-checked")).toBe("true");
    fireEvent.click(saveButton());

    expect(onSave.mock.calls[0][0].confirmedRoad.candidate.way_id).toBe("111002");
  });

  it("single candidate: its one row is picked already, no blocked line, Save enabled (#152 A)", async () => {
    stubDetection(detection([EASTBOUND]));
    mountModal();
    typeCoords();

    // The resolved outcome is shown, not a hang: the sole row, checked.
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0].getAttribute("aria-checked")).toBe("true");
    expect(rows()[0].textContent).toBe("E Baseline RdDivided road · 8 m from your pin");
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    expect(screen.queryByTestId("picker-save-blocked")).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });

  it("#301 (R123 Q1): no road-property editor; WHAT is the one place they are set; no Re-detect once roads are found", async () => {
    stubDetection(detection([EASTBOUND]));
    mountModal();
    typeCoords();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.queryByText(/Road properties/i)).toBeNull();
    expect(screen.queryByText(/Speed limit \(mph\)|Lanes per direction/)).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Road type" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Divided$|^Undivided$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Use \d+ mph/ })).toBeNull();
    expect(screen.getByTestId("picker-subtitle").textContent?.trim()).toBe(
      "Search an address or tap the map where the work starts, then pick the road.",
    );
    // #507 ruling 4: Try again exists only when the lookup failed.
    expect(screen.queryByRole("button", { name: /Re-detect roads/ })).toBeNull();
    expect(screen.queryByTestId("picker-redetect")).toBeNull();
  });

  it("#290: the typed direction is retired — no field, no Use Detected, no Flip, no length", async () => {
    // FLOW.md §5a: "The typed bearing field retires deliberately (Rule 5)";
    // the band's Extent is the one length control (P2).
    stubDetection(detection([EASTBOUND]));
    mountModal();
    typeCoords();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.queryByLabelText("Direction of travel in degrees")).toBeNull();
    expect(screen.queryByRole("button", { name: /Use Detected|Detected \(in use\)/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Flip/ })).toBeNull();
    expect(screen.queryByText(/Work zone length \(ft\)/)).toBeNull();
    expect(screen.queryByText(/travel-direction sign only/)).toBeNull();
  });

  // #507 ruling 6 / #506 (RULE 5, stated): a lookup with no road used to
  // save with no road; Save now waits for the way the road runs.
  it("zero candidates: the no-road panel and four directions; Save waits for a direction, then carries it", async () => {
    stubDetection(detection([]));
    mountModal();
    typeCoords();

    const status = await screen.findByTestId("road-lookup-status");
    expect(status.textContent).toContain("We didn't find a road at your pin.");
    expect(status.textContent).toContain(
      "No mapped road runs within 30 m. Move the pin onto the road, or tell us which way the road runs and carry on.",
    );
    // A lookup that answered offers no Try again.
    expect(screen.queryByTestId("picker-redetect")).toBeNull();
    expect(screen.getAllByText("Which way does the road run?").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("road-axis")).toHaveLength(4);
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByTestId("picker-save-blocked")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "East–west" }));
    expect(saveButton().disabled).toBe(false);
    expect(screen.queryByTestId("picker-save-blocked")).toBeNull();
    fireEvent.click(saveButton());
    const result = onSave.mock.calls[0][0];
    expect(result.classification).toBeNull();
    expect(result.confirmedRoad).toBeNull();
    expect(result.roadAxis).toBe("east_west");
  });

  it("detection error: the failed panel with Try again and four directions; Save waits for a direction", async () => {
    stubDetection({ status: 502 });
    mountModal();
    typeCoords();

    const status = await screen.findByTestId("road-lookup-status");
    expect(status.textContent).toContain("We couldn't look up the roads here.");
    expect(status.textContent).toContain(
      "The road data service didn't answer. Try again, or tell us which way the road runs and carry on.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getAllByTestId("road-axis").map((b) => b.getAttribute("aria-label"))).toEqual([
      "East–west",
      "North–south",
      "Northeast–southwest",
      "Northwest–southeast",
    ]);
    expect(saveButton().disabled).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "North–south" }));
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(onSave.mock.calls[0][0].roadAxis).toBe("north_south");
    expect(onSave.mock.calls[0][0].confirmedRoad).toBeNull();
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

    expect(await screen.findByText(/Looking up the roads at your pin…/i)).toBeTruthy();
    expect(screen.getByText("Looking up the roads. Save turns on when that's done.")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
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

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0].getAttribute("aria-checked")).toBe("true");

    phase = 1;
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "40.1000" },
    });

    await waitFor(() => expect(rows()).toHaveLength(2));
    for (const r of rows()) expect(r.getAttribute("aria-checked")).toBe("false");
    expect(saveButton().disabled).toBe(true); // unresolved gates Save
  });
});

// #402 / #435 / #436 built a picked-road summary (✓ ROAD, Change, a
// Details caption) over a "⚠ PICK THE ROAD · N FOUND" list.  #507 rulings
// 1–2 (RULE 5, stated) retire all of it: the road is one radio list whose
// row names the road whole (no ", westbound" cut-off risk) and says how
// traffic runs and how far it is.  Read from the mounted picker (Rule 11).
describe("#507 ruling 2: the road list's rows", () => {
  const COLFAX_EB = candidate({
    way_id: "222001",
    highway_class: "primary",
    // #512: the backend's answer: tagged one-way, no twin search ran.
    travel: { travel: "one_way", carriageway: "undecided" },
    name: "East Colfax Avenue",
    ref: null,
    bearing: 90,
  });
  const COLFAX_WB = candidate({
    way_id: "222002",
    highway_class: "primary",
    name: "East Colfax Avenue",
    ref: null,
    bearing: 270,
    snap_distance_m: 14.6,
  });
  const MAIN_ST = candidate({
    way_id: "333001",
    highway_class: "secondary",
    travel: { travel: "both_ways", carriageway: "not_applicable" },
    name: "Main Street",
    ref: null,
    bearing: 0,
    snap_distance_m: 20.4,
    tags: { ...candidate({}).tags, oneway: null },
  });

  it("unpicked: the question heading, radios with the whole name and a traffic line, no glyph head or details", async () => {
    stubDetection(detection([COLFAX_EB, MAIN_ST]));
    mountModal();
    typeCoords();
    await waitFor(() => expect(rows()).toHaveLength(2));
    const panel = screen.getByTestId("road-pick-panel");
    expect(panel.className).not.toContain("--warn");
    expect(panel.textContent).not.toMatch(/⚠|✓|PICK THE ROAD|FOUND/);
    const group = screen.getByRole("radiogroup", { name: "Which road is the work on?" });
    const rs = group.querySelectorAll('[role="radio"]');
    expect(rs).toHaveLength(2);
    // R145-11: tagged one-way, no twin search ran: no road kind is claimed.
    expect(rs[0].textContent).toBe("East Colfax AvenueTraffic one way here · 8 m from your pin");
    expect(rs[1].textContent).toBe("Main StreetTraffic both ways · 20 m from your pin");
    for (const r of rs) expect(r.getAttribute("aria-checked")).toBe("false");
    // P19: no way ID, bearing or source on the rows, and no Details toggle.
    expect(group.textContent).not.toMatch(/way \d|°|OSM|eastbound|westbound/);
    expect(screen.queryByTestId("info-road-pick")).toBeNull();
    expect(screen.queryByTestId("info-toggle-road-pick")).toBeNull();
    expect(screen.getByText("You'll pick the side of the road next, on the page.")).toBeTruthy();
  });

  it("picked: the row is checked in place; no road-picked summary, no Change, no ✓/⚠ head", async () => {
    stubDetection(detection([COLFAX_EB, COLFAX_WB]));
    mountModal();
    typeCoords();
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(rows()[0]);

    expect(rows()[0].getAttribute("aria-checked")).toBe("true");
    expect(rows()[0].className).toContain("is-picked");
    expect(rows()[1].className).not.toContain("is-picked");
    expect(screen.queryByTestId("road-picked")).toBeNull();
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    expect(screen.getByTestId("road-pick-panel").textContent).not.toMatch(/⚠|✓/);
  });

  it("picked: no detected-from caption and no Details button anywhere in the rail", async () => {
    stubDetection(detection([COLFAX_EB, COLFAX_WB]));
    mountModal();
    typeCoords();
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(rows()[1]);

    expect(screen.queryByTestId("info-road-picked")).toBeNull();
    expect(screen.queryByTestId("info-toggle-road-picked")).toBeNull();
    expect(screen.queryByText(/Detected from OSM/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Details" })).toBeNull();
  });
});
