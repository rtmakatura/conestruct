// @vitest-environment happy-dom
//
// #488: "Edit on map" (the aerial's corner door onto the picker, no Edit
// panel) says why the side is asked again.  #440 ruling 2's rule, with #485
// E2's line from its one producer (EDIT_REASKED); rulings in
// validation-artifacts/committed/missions/move-walk-side-line/issue-488/
// rulings.md (G1-G4).  Mounted, where the bug lived (Rule 11): the shell,
// the band stack and the sidebar's real picker Save, with the picker modal
// stubbed to a Save button that can land on another pin or another road.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

import type { Scenario } from "@/lib/scenarios";
import type { ConfirmedRoad, RoadCandidate, RoadDetectOk } from "@/lib/road-detection/types";
import { classifyFromCandidate } from "@/lib/road-detection/classify";
import { forgetAerials } from "@/lib/corridor-aerial";

vi.mock("../AppNav", () => ({ AppNav: () => null }));
vi.mock("../AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("../AppFooter", () => ({ AppFooter: () => null }));
vi.mock("../OutputCards", () => ({ OutputCards: () => null }));
vi.mock("../QuotePanel", () => ({ QuotePanel: () => null }));

// E Colfax Ave, Denver (as WhereBand.edit-turns.test.tsx).
const PIN = { lat: 39.73997, lng: -104.96632 };
const MOVED = { lat: 39.73997, lng: -104.9652 };
function candidate(over: Partial<RoadCandidate>): RoadCandidate {
  return {
    way_id: "W1",
    highway_class: "primary",
    name: "East Colfax Avenue",
    ref: null,
    bearing: 90,
    snap_distance_m: 3,
    snapped_lat: PIN.lat,
    snapped_lng: PIN.lng,
    tags: {
      oneway: null,
      maxspeed: "30 mph",
      lanes: "4",
      lanes_forward: null,
      lanes_backward: null,
      lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
    geometry: [
      [39.73997, -104.968],
      [39.73997, -104.962],
    ],
    ...over,
  } as RoadCandidate;
}
const MAINLINE = candidate({});
// Another way at the same pin (a frontage or the other carriageway).
const OTHER_WAY = candidate({ way_id: "W2", name: "East Colfax Avenue" });
const road = (at: { lat: number; lng: number }, c: RoadCandidate) =>
  ({
    candidate: c,
    classification: classifyFromCandidate(c, true, null),
    method: "auto_single",
    isUrban: true,
    placeName: null,
    pinLat: at.lat,
    pinLng: at.lng,
  }) as ConfirmedRoad;
const DETECTION: RoadDetectOk = {
  scan_status: "ok",
  candidates: [MAINLINE],
  primary_index: 0,
  isUrban: true,
  placeName: null,
};
const SIDE = { work: { side: "right", travel: "with_geometry" }, label: "South side · eastbound traffic", built: true };
// #507: a two-way street offers both sides; a lone side is picked for you
// (ruling 3), which would answer the question these tests keep open.
const SIDE_NORTH = { work: { side: "right", travel: "against_geometry" }, label: "North side · westbound traffic", built: true };

// The picker's Save lands on `savePin`, confirming `saveWay`.
let savePin = PIN;
let saveWay = MAINLINE;
vi.mock("../LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSave({
          address: "E Colfax Ave, Denver",
          lat: savePin.lat,
          lng: savePin.lng,
          classification: road(savePin, saveWay).classification,
          crossStreet: null,
          intersection: null,
          confirmedRoad: road(savePin, saveWay),
        })
      }
    >
      SAVE_PIN
    </button>
  ),
}));

import { GeneratorShell } from "../GeneratorShell";
import { openWhere } from "../__fixtures__/band-helpers";
import { MIN_AUDIT } from "../test-fixtures";
import { EDIT_REASKED } from "./WhereQuestions";

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}
/** Every scenario the geometry read was asked for, in order: the wire. */
let geometryAsked: string[] = [];
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  if (url.includes("/api/corridor-map")) {
    return new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
  }
  if (url.includes("/api/render/corridor-geometry")) {
    geometryAsked.push(JSON.stringify((body as { scenario: Scenario }).scenario));
    return json({
      status: "side_not_confirmed",
      pin_model: "work_start",
      pin: null,
      travel_bearing_deg: null,
      work: null,
      approaches: [],
      coverage_ft: null,
      message: null,
      side_options: [SIDE, SIDE_NORTH],
    });
  }
  if (url.includes("/api/road-bearing")) return json(DETECTION);
  if (url.includes("/api/render/nearest-intersection")) return json({ status: "none", text: null, radius_m: 1700 });
  if (url.includes("/api/render/audit")) return json(MIN_AUDIT);
  return json({});
});

beforeEach(() => {
  forgetAerials();
  savePin = PIN;
  saveWay = MAINLINE;
  geometryAsked = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:aerial-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
async function settle(ms = 60) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
async function until(test: () => boolean, what: string) {
  const deadline = Date.now() + 4000;
  while (!test()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await settle(50);
  }
}
async function click(el: Element | null, what: string) {
  if (!el) throw new Error(`no ${what} on screen`);
  await act(async () => {
    fireEvent.click(el);
  });
}
const byText = (text: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => b.textContent === text) ?? null;
const records = () =>
  Array.from(document.querySelectorAll('[data-testid="where-questions"] .nyq-answered .nyq-row-text')).map(
    (r) => r.textContent,
  );
/** Was any geometry read asked for a scenario whose meta matches? */
const asked = (test: (m: Scenario["meta"]) => boolean) =>
  geometryAsked.some((s) => test((JSON.parse(s) as Scenario).meta));
/** The aerial's corner door, "Edit on map" (not the Edit panel's Move). */
const editOnMap = () => {
  const b = document.querySelector<HTMLElement>('[data-testid="band-aerial"] [data-testid="where-open-picker"]')
    ?? q("where-open-picker");
  return b?.textContent === "Edit on map" ? b : null;
};

/** The pin, the kind and the side answered: the card stays on the side
 *  with Confirm on screen (W8). */
async function toAnsweredQuestions() {
  render(<GeneratorShell mode="sandbox" />);
  await click(q("where-open-picker"), "Pick on map");
  await click(byText("SAVE_PIN"), "SAVE_PIN");
  await openWhere();
  await until(() => q("kind-chip-shoulder") !== null && q("band-aerial-frame") !== null, "the kind question");
  await click(q("kind-chip-shoulder"), "the shoulder kind");
  await click(byText("Next question"), "Next question");
  await until(() => q("side-option") !== null, "the side question");
  await click(q("side-option"), "a side");
  await settle();
  expect(records()).toEqual(["What kind of work is it: Shoulder work"]);
  expect((q("side-option") as HTMLInputElement).checked).toBe(true);
  await until(() => asked((m) => m.work !== undefined), "the side on the wire");
}
/** "Edit on map", then the picker's Save. */
async function saveThroughEditOnMap() {
  await click(editOnMap(), "Edit on map");
  // The door is the picker's, not the panel's: no Edit panel opened.
  expect(q("where-edit-panel")?.hidden ?? true).toBe(true);
  expect(q("where-questions-wait")).toBeNull();
  await click(byText("SAVE_PIN"), "SAVE_PIN");
  await settle();
}

describe("#488: a Save through Edit on map that clears the side says why", () => {
  it("a moved work start: the side is re-asked with #485's line; the kind stays", async () => {
    await toAnsweredQuestions();
    savePin = MOVED;
    await saveThroughEditOnMap();
    // The band's own read of the moved pin carries no side (the load-ahead
    // reads, one per side answer, carry one each, so "last" is not the
    // scenario).
    await until(() => asked((m) => m.lng === MOVED.lng && m.work === undefined), "the moved pin, unsided, on the wire");
    await until(() => q("side-option") !== null, "the side question");
    expect((q("side-option") as HTMLInputElement).checked).toBe(false);
    expect(records()).toEqual(["What kind of work is it: Shoulder work"]);
    // Exactly one line, the one producer's string.
    const notes = document.querySelectorAll('[data-testid="edit-reasked-note"]');
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toBe(EDIT_REASKED);
    expect(q("side-changed-note")).toBeNull();
    // Answered again, the line goes (X21 / E2).
    await click(q("side-option"), "a side");
    await settle();
    expect(q("edit-reasked-note")).toBeNull();
  });

  it("a changed road at the same pin: the side is re-asked with the line", async () => {
    await toAnsweredQuestions();
    saveWay = OTHER_WAY;
    await saveThroughEditOnMap();
    await until(
      () => asked((m) => m.confirmedRoad?.candidate.way_id === "W2" && m.work === undefined),
      "the other road, unsided, on the wire",
    );
    await until(() => q("side-option") !== null, "the side question");
    expect((q("side-option") as HTMLInputElement).checked).toBe(false);
    expect(records()).toEqual(["What kind of work is it: Shoulder work"]);
    expect(document.querySelectorAll('[data-testid="edit-reasked-note"]')).toHaveLength(1);
    expect(q("edit-reasked-note")?.textContent).toBe(EDIT_REASKED);
  });

  it("a Save that changes nothing: the side stays and no line shows (Rule 10)", async () => {
    await toAnsweredQuestions();
    await saveThroughEditOnMap();
    await settle(200);
    expect((q("side-option") as HTMLInputElement).checked).toBe(true);
    expect(records()).toEqual(["What kind of work is it: Shoulder work"]);
    expect(q("edit-reasked-note")).toBeNull();
  });

  it("a move while the side is unanswered: nothing was cleared, so no line", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await click(q("where-open-picker"), "Pick on map");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await openWhere();
    await until(() => q("kind-chip-shoulder") !== null && q("band-aerial-frame") !== null, "the kind question");
    await click(q("kind-chip-shoulder"), "the shoulder kind");
    await click(byText("Next question"), "Next question");
    await until(() => q("side-option") !== null, "the side question");
    savePin = MOVED;
    await saveThroughEditOnMap();
    await until(() => asked((m) => m.lng === MOVED.lng), "the moved pin on the wire");
    await until(() => q("side-option") !== null, "the side question");
    expect(q("edit-reasked-note")).toBeNull();
  });
});
