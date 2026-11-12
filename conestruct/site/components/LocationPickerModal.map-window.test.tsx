// @vitest-environment happy-dom
//
// #507 (UX group 8, folds in #506): the map window's states, mounted.
// Rule 11: driven through the real modal; the /api/road-bearing stub
// answers with the route's wire shapes, as in the #213 suite.
//
// #506's path: a lookup that fails leaves no road, and Save used to go
// through anyway ("Zero-candidate and detection-error paths remain
// saveable"), so the plan fell back to a default length and four sides.
// Ruling 6: Save waits for a road, or a direction in the fallback.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocationPickerModal, type LocationPickerResult } from "./LocationPickerModal";
import type { RoadCandidate, RoadDetectResponse } from "@/lib/road-detection/types";

function candidate(overrides: Partial<RoadCandidate>): RoadCandidate {
  return {
    way_id: "1",
    highway_class: "primary",
    name: "East Colfax Avenue",
    ref: null,
    bearing: 90,
    snap_distance_m: 9,
    snapped_lat: 39.73997,
    snapped_lng: -104.96632,
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
    // #512: the backend's answer for an untagged primary (/render/road-travel).
    travel: { travel: "both_ways", carriageway: "not_applicable" },
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

function ok(candidates: RoadCandidate[]): RoadDetectResponse {
  return {
    scan_status: "ok",
    candidates,
    primary_index: candidates.length ? 0 : null,
    isUrban: true,
    placeName: "Denver",
  } as unknown as RoadDetectResponse;
}

let detectCalls = 0;
function stubQueue(responses: RoadDetectResponse[]) {
  const remaining = [...responses];
  detectCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/road-bearing")) {
        detectCalls += 1;
        const next = remaining.length > 1 ? remaining.shift() : remaining[0];
        return { ok: true, status: 200, json: async () => next };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
}

function mount(onSave: (r: LocationPickerResult) => void = () => {}) {
  return render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder" }}
      onCancel={() => {}}
      onSave={onSave}
    />,
  );
}

function typeCoords() {
  fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "39.73997" } });
  fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "-104.96632" } });
}

const saveButton = () => screen.getByRole("button", { name: /^Save (&|and) close$/i });

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("#506: Save needs a road, or a direction when the lookup failed", () => {
  it("a failed lookup leaves Save disabled until a direction is picked", async () => {
    stubQueue([UNAVAILABLE]);
    const onSave = vi.fn();
    mount(onSave);
    typeCoords();
    await screen.findByText("We couldn't look up the roads here.");
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Pick a road, or a direction if the lookup failed.")).toBeTruthy();
    fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Northeast–southwest" }));
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledTimes(1);
    const r = onSave.mock.calls[0][0] as LocationPickerResult;
    expect(r.confirmedRoad).toBeNull();
    expect(r.roadAxis).toBe("northeast_southwest");
  });

  it("#511 (Rule 13): every direction tile carries the road rows' mark; only the picked one is marked picked", async () => {
    stubQueue([UNAVAILABLE]);
    mount();
    typeCoords();
    await screen.findByText("We couldn't look up the roads here.");
    const tiles = screen.getAllByTestId("road-axis");
    expect(tiles).toHaveLength(4);
    for (const t of tiles) expect(t.querySelector(".road-pick-mark")).not.toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "North–south" }));
    const picked = tiles.filter((t) => t.classList.contains("is-picked"));
    expect(picked.map((t) => t.getAttribute("aria-label"))).toEqual(["North–south"]);
    expect(picked[0].getAttribute("aria-checked")).toBe("true");
    // The mark fills only on a picked row, and a picked tile adds a ring
    // a hover doesn't (jsdom loads no CSS, so the rules are read as text).
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
    expect(css).toMatch(/\.road-pick-row\.is-picked \.road-pick-mark \{[^}]*background: var\(--act\)/);
    expect(css).toMatch(/\.mw-axis\.is-picked \{[^}]*box-shadow: inset 0 0 0 1px var\(--act\)/);
    expect(css).not.toMatch(/\.road-pick-row:hover \{[^}]*box-shadow/);
  });

  it("Try again re-runs the lookup, and a found road replaces the fallback", async () => {
    stubQueue([UNAVAILABLE, ok([candidate({})])]);
    mount();
    typeCoords();
    await screen.findByText("We couldn't look up the roads here.");
    const before = detectCalls;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("radio", { name: /East Colfax Avenue/ });
    expect(detectCalls).toBe(before + 1);
    expect(screen.queryByText("Which way does the road run?")).toBeNull();
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("several roads and none picked: Save disabled with the line", async () => {
    stubQueue([ok([candidate({}), candidate({ way_id: "2", name: "Race Street", bearing: 0, snap_distance_m: 30 })])]);
    mount();
    typeCoords();
    await screen.findByRole("radio", { name: /Race Street/ });
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Pick a road, or a direction if the lookup failed.")).toBeTruthy();
  });
});

describe("ruling 2: one entry per street", () => {
  it("a grouped dual carriageway lists once, with traffic both ways", async () => {
    const west = candidate({ way_id: "2", bearing: 270, snap_distance_m: 21, tags: { ...candidate({}).tags, oneway: "yes" } });
    const east = candidate({ way_id: "1", snap_distance_m: 9, tags: { ...candidate({}).tags, oneway: "yes" }, twin: west, travel: { travel: "both_ways", carriageway: "undecided" } });
    stubQueue([ok([east, candidate({ way_id: "3", name: "Race Street", bearing: 0, snap_distance_m: 28 })])]);
    mount();
    typeCoords();
    const row = await screen.findByRole("radio", { name: /East Colfax Avenue/ });
    expect(row.textContent).toContain("Traffic both ways · 9 m from your pin");
    expect(screen.getAllByRole("radio", { name: /East Colfax Avenue/ })).toHaveLength(1);
    expect(screen.queryByText(/eastbound|westbound/)).toBeNull();
  });

  it("a one-way street reads One-way", async () => {
    // #507 R145-11: the twin search ran and found no same-name opposite way.
    stubQueue([ok([candidate({ name: "Lincoln Street", bearing: 180, twin_searched: true, twin_distance_m: null, tags: { ...candidate({}).tags, oneway: "yes" }, travel: { travel: "one_way", carriageway: "one_way_street" } })])]);
    mount();
    typeCoords();
    const row = await screen.findByRole("radio", { name: /Lincoln Street/ });
    expect(row.textContent).toContain("One-way · 9 m from your pin");
    expect(row.getAttribute("aria-checked")).toBe("true");
  });

  it("R145-11: a divided road's lone carriageway reads Divided road, never One-way", async () => {
    stubQueue([ok([candidate({ name: "East Speer Boulevard", twin_searched: true, twin_distance_m: 60.5, tags: { ...candidate({}).tags, oneway: "yes" }, travel: { travel: "one_way", carriageway: "divided" } })])]);
    mount();
    typeCoords();
    const row = await screen.findByRole("radio", { name: /East Speer Boulevard/ });
    expect(row.textContent).toContain("Divided road · 9 m from your pin");
    expect(row.textContent).not.toContain("One-way");
  });

  // #512: the words are the backend's answer, never a tag rule here.
  it("#512: an untagged motorway the backend can't name a direction for shows only its distance", async () => {
    stubQueue([ok([candidate({ name: "Interstate 25", highway_class: "motorway", travel: { travel: "unknown", carriageway: "not_applicable" } })])]);
    mount();
    typeCoords();
    const row = await screen.findByRole("radio", { name: /Interstate 25/ });
    expect(row.querySelector(".road-pick-sub")?.textContent).toBe("9 m from your pin");
  });

  it("#512: a reversible way reads Direction changes by time, never Traffic both ways", async () => {
    stubQueue([ok([candidate({ name: "I-25 Express Lanes", tags: { ...candidate({}).tags, oneway: "reversible" }, travel: { travel: "changes_by_time", carriageway: "not_applicable" } })])]);
    mount();
    typeCoords();
    const row = await screen.findByRole("radio", { name: /I-25 Express Lanes/ });
    expect(row.querySelector(".road-pick-sub")?.textContent).toBe("Direction changes by time · 9 m from your pin");
  });

  // #525 (Ryan, 2026-11-11): at an intersection the line adds "at <cross street>".
  it("#525: the street met at the pin is named on the line, after the distance", async () => {
    stubQueue([ok([candidate({ name: "Pennsylvania Street", bearing: 0, snap_distance_m: 1.69, cross_street: "East Colfax Avenue", travel: { travel: "both_ways", carriageway: "not_applicable" } })])]);
    mount();
    typeCoords();
    const row = await screen.findByRole("radio", { name: /Pennsylvania Street/ });
    expect(row.querySelector(".road-pick-sub")?.textContent).toBe("Traffic both ways · 2 m from your pin · at East Colfax Avenue");
  });

  it("#525: with no cross street, or no travel answer, the line is as before", async () => {
    stubQueue([ok([candidate({ cross_street: null, travel: undefined }), candidate({ way_id: "2", name: "Race Street", bearing: 0, snap_distance_m: 20, cross_street: "East Colfax Avenue" })])]);
    mount();
    typeCoords();
    const colfax = await screen.findByRole("radio", { name: /^East Colfax Avenue/ });
    expect(colfax.querySelector(".road-pick-sub")?.textContent).toBe("9 m from your pin");
    const race = screen.getByRole("radio", { name: /Race Street/ });
    expect(race.querySelector(".road-pick-sub")?.textContent).toBe("Traffic both ways · 20 m from your pin · at East Colfax Avenue");
  });

  it("#512: no backend answer shows only the distance, whatever the tag says", async () => {
    stubQueue([ok([candidate({ travel: undefined })])]);
    mount();
    typeCoords();
    const row = await screen.findByRole("radio", { name: /East Colfax Avenue/ });
    expect(row.querySelector(".road-pick-sub")?.textContent).toBe("9 m from your pin");
  });
});
