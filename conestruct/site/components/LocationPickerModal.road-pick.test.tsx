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
    await screen.findByText(/PICK THE ROAD · 2 FOUND/);
    // #435 ruling 4: the row's second line is the class in plain words
    // and the distance; the way ID moved behind "i details".
    expect(screen.getByText("Highway · 8 m from your pin")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("Pick a road to continue")).toBeTruthy();
    expect(screen.queryByText("Pick Road")).toBeNull();

    // Picking a road resolves the block: Save enables, the hint leaves,
    // the card collapses to a summary, and road properties load.
    fireEvent.click(screen.getByRole("radio", { name: /eastbound/i }));
    expect(saveButton().disabled).toBe(false);
    expect(screen.queryByText("Pick a road to continue")).toBeNull();
    // #436 ruling 2: the picked row's line 3 keeps the plain-words class
    // and distance; the picker rows' copy of it is gone.
    expect(screen.queryAllByText(/8 m from your pin/)).toHaveLength(1);
    expect(screen.getByTestId("road-picked").textContent).toContain(
      "Highway · 8 m from your pin · Details",
    );
    expect(screen.getByRole("button", { name: "Change" })).toBeTruthy();
    expect(screen.getByTestId("road-picked")).toBeTruthy();
  });

  it("payload: Save after a pick carries the picked road and its classification — and no bearing (#290)", async () => {
    stubDetection(detection([EASTBOUND, WESTBOUND]));
    mountModal();
    typeCoords();

    await screen.findByText(/PICK THE ROAD/);
    fireEvent.click(screen.getByRole("radio", { name: /westbound/i }));
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

    await screen.findByText(/PICK THE ROAD/);
    fireEvent.click(screen.getByRole("radio", { name: /eastbound/i }));
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("radio", { name: /westbound/i }));
    fireEvent.click(saveButton());

    expect(onSave.mock.calls[0][0].confirmedRoad.candidate.way_id).toBe("111002");
  });

  it("single candidate: confirmed card with the pre-selected row, no amber hint, Save enabled (#152 A)", async () => {
    stubDetection(detection([EASTBOUND]));
    mountModal();
    typeCoords();

    await screen.findByTestId("road-picked");
    // The rail-top card shows the resolved outcome — a silent single
    // match read as a hang before.
    expect(screen.queryByText(/PICK THE ROAD/)).toBeNull();
    // #435 ruling 5 (checkpoint call C6): the road-picked row, with no
    // Change (no other road to change to); the way ID rides "i details".
    expect(screen.getByTestId("road-picked").textContent).toContain("ROAD");
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    // #436 ruling 4: the same three lines, line 1 without Change.
    const one = screen.getByTestId("road-picked");
    expect(one.querySelector(".road-picked-head")?.textContent).toBe("✓ROAD");
    expect(one.querySelector(".road-picked-sub")?.textContent).toMatch(/ m from your pin · Details$/);
    expect(screen.getByTestId("info-road-picked").textContent).toContain("way 111001");
    expect(screen.queryByText("Pick a road to continue")).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });

  it("#301 (R123 Q1): no road-property editor; WHAT is the one place they are set; Re-detect stays", async () => {
    stubDetection(detection([EASTBOUND]));
    mountModal();
    typeCoords();
    await screen.findByTestId("road-picked");
    expect(screen.queryByText(/Road properties/i)).toBeNull();
    expect(screen.queryByText(/Speed limit \(mph\)|Lanes per direction/)).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Road type" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Divided$|^Undivided$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Use \d+ mph/ })).toBeNull();
    expect(screen.getByTestId("picker-subtitle").textContent?.trim()).toBe(
      "Drop a pin where the work starts, and pick the road.",
    );
    expect(screen.getByRole("button", { name: /Re-detect roads/ })).toBeTruthy();
  });

  it("#290: the typed direction is retired — no field, no Use Detected, no Flip, no length", async () => {
    // FLOW.md §5a: "The typed bearing field retires deliberately (Rule 5)";
    // the band's Extent is the one length control (P2).
    stubDetection(detection([EASTBOUND]));
    mountModal();
    typeCoords();
    await screen.findByTestId("road-picked");
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
      screen.getByText(/Set road properties in Step 2/i),
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
      screen.getByText(/Set road properties in Step 2/i),
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

    await screen.findByTestId("road-picked");

    phase = 1;
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "40.1000" },
    });

    await screen.findByText(/PICK THE ROAD/);
    expect(screen.queryByTestId("road-picked")).toBeNull();
    expect(saveButton().disabled).toBe(true); // unresolved gates Save
  });
});

// #402 (now under #435's picker): after a pick in a multi-road detection the card's head kept
// "⚠ Which road? · N detected" on the amber frame, and the picked line was
// one `truncate` span, so a long road name cut its direction off at 1440
// ("EAST COLFAX AVENUE EAS…").  Read from the mounted picker (Rule 11): the
// head's glyph and words, its frame, and the picked line's whole text.
describe("#402: the picked road's head and line", () => {
  const COLFAX_EB = candidate({
    way_id: "222001",
    highway_class: "primary",
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
  // #435 rulings 4-5 replace #402's frame and caption line: the open
  // question is a neutral panel with "⚠ PICK THE ROAD · N FOUND"; a pick
  // collapses it to the road-picked row, its caption behind "i details".
  const head = () => screen.getByText(/PICK THE ROAD · 2 FOUND/);

  it("unpicked: a neutral panel whose header asks with ⚠, and the rows are radios", async () => {
    stubDetection(detection([COLFAX_EB, COLFAX_WB]));
    mountModal();
    typeCoords();
    await screen.findByText(/PICK THE ROAD · 2 FOUND/);
    const panel = screen.getByTestId("road-pick-panel");
    expect(panel.className).toBe("road-pick-panel");
    expect(panel.className).not.toContain("--warn");
    const glyph = head().previousElementSibling as HTMLElement;
    expect(glyph.textContent).toBe("⚠");
    const group = screen.getByRole("radiogroup", { name: "PICK THE ROAD · 2 FOUND" });
    const rows = group.querySelectorAll('[role="radio"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toBe(
      "East Colfax Avenue, eastboundPrimary road · 8 m from your pin",
    );
    expect(rows[1].textContent).toBe(
      "East Colfax Avenue, westboundPrimary road · 15 m from your pin",
    );
    for (const r of rows) expect(r.getAttribute("aria-checked")).toBe("false");
    // P19: way ID, bearing and source are one click away, not on the rows.
    expect(group.textContent).not.toMatch(/way|°|OSM/);
    const details = screen.getByTestId("info-road-pick");
    expect(details.hidden).toBe(true);
    fireEvent.click(screen.getByTestId("info-toggle-road-pick"));
    expect(details.hidden).toBe(false);
    expect(details.textContent).toContain("East Colfax Avenue, westbound · 270° · way 222002 · from OSM");
  });

  it("picked: the road-picked row, ✓ and ROAD, no ⚠; Change re-opens the list with ✓ and the pick checked (P9)", async () => {
    stubDetection(detection([COLFAX_EB, COLFAX_WB]));
    mountModal();
    typeCoords();
    await screen.findByText(/PICK THE ROAD · 2 FOUND/);
    fireEvent.click(screen.getByRole("radio", { name: /eastbound/i }));

    const row = screen.getByTestId("road-picked");
    // #436 ruling 1: line 1 is ✓, ROAD and Change; the name is line 2.
    const line1 = row.querySelector(".road-picked-head") as HTMLElement;
    expect(line1.textContent).toBe("✓ROADChange");
    expect(row.querySelector(".road-picked-name")?.textContent).toBe(
      "East Colfax Avenue, eastbound",
    );
    expect(row.textContent).not.toContain("⚠");
    expect(screen.queryByText(/PICK THE ROAD/)).toBeNull();

    // CHANGE re-opens the list; the pick still stands, so the head is ✓.
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect((head().previousElementSibling as HTMLElement).textContent).toBe("✓");
    expect(screen.getByRole("radio", { name: /eastbound/i }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /eastbound/i }).className).toContain("is-picked");
  });

  it("picked: the detected-from caption is whole, behind the row's i details", async () => {
    stubDetection(detection([COLFAX_EB, COLFAX_WB]));
    mountModal();
    typeCoords();
    await screen.findByText(/PICK THE ROAD · 2 FOUND/);
    fireEvent.click(screen.getByRole("radio", { name: /westbound/i }));

    const info = screen.getByTestId("info-road-picked");
    expect(info.hidden).toBe(true);
    expect(info.textContent).toBe(
      "Detected from OSM: 270° (East Colfax Avenue westbound, primary) · way 222002",
    );
    fireEvent.click(screen.getByTestId("info-toggle-road-picked"));
    expect(info.hidden).toBe(false);
    // Escape closes the details and leaves the picker open.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(info.hidden).toBe(true);
    expect(screen.getByTestId("road-picked")).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();
  });

  // #436 rulings 1, 2 and 5: three lines; "Details" is a text button in
  // line 3 whose block opens under it and closes on a second click; the
  // mono "i details" leaves the row and stays in the picker's header.
  it("#436: Details is a text button in line 3; click opens and closes the block; no i details in the row", async () => {
    stubDetection(detection([COLFAX_EB, COLFAX_WB]));
    mountModal();
    typeCoords();
    await screen.findByText(/PICK THE ROAD · 2 FOUND/);
    fireEvent.click(screen.getByRole("radio", { name: /westbound/i }));

    const row = screen.getByTestId("road-picked");
    expect(row.querySelector(".a-info-toggle")).toBeNull();
    const line3 = row.querySelector(".road-picked-sub") as HTMLElement;
    const toggle = screen.getByTestId("info-toggle-road-picked");
    expect(line3.contains(toggle)).toBe(true);
    expect(toggle.textContent).toBe("Details");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    const info = screen.getByTestId("info-road-picked");
    expect(info.parentElement).toBe(line3.parentElement);
    expect(line3.nextElementSibling).toBe(info);
    fireEvent.click(toggle);
    expect(info.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(info.hidden).toBe(true);

    // Change re-opens the picker, whose header keeps its own i details.
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByTestId("info-toggle-road-pick")).toBeTruthy();
  });
});
