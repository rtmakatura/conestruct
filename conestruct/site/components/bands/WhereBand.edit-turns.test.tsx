// @vitest-environment happy-dom
//
// #485, editing and the CONFIRM questions take turns in the WHERE band
// (Ryan 2026-11-09, ruling 3 of docs/prompts/cc-prompt-ux-map-load-crossing-
// edit.md; validation-artifacts/committed/missions/ux-token-map-load-edit/
// issue-485/rulings.md, E1-E10).  Mounted, where the bug lived (Rule 11):
// the shell, the band stack and the sidebar's real picker Save, with the
// picker modal stubbed to a Save button that can land on another pin.

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

// E Colfax Ave, Denver (as WhereBand.one-height.test.tsx).
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
const road = (at: { lat: number; lng: number }) =>
  ({
    candidate: MAINLINE,
    classification: classifyFromCandidate(MAINLINE, true, null),
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

// The picker's Save lands on `savePin` (the test moves it for Move), with
// `saveCross` as its crossing (null = none marked, or the person's Clear).
let savePin = PIN;
let saveCross: { lat: number; lng: number; name: string | null } | null = null;
vi.mock("../LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSave({
          address: "E Colfax Ave, Denver",
          lat: savePin.lat,
          lng: savePin.lng,
          classification: road(savePin).classification,
          crossStreet: null,
          intersection: saveCross,
          confirmedRoad: road(savePin),
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
  saveCross = null;
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
const lengthField = () => document.getElementById("band-worklen") as HTMLInputElement;
async function typeLength(v: string) {
  const f = lengthField();
  await act(async () => {
    fireEvent.focus(f);
    fireEvent.change(f, { target: { value: v } });
    fireEvent.keyDown(f, { key: "Enter" });
  });
  await settle();
}

/** The pin and the kind answered, the side question on screen. */
async function toTheSideQuestion() {
  render(<GeneratorShell mode="sandbox" />);
  await click(q("where-open-picker"), "Pick on map");
  await click(byText("SAVE_PIN"), "SAVE_PIN");
  await openWhere();
  await until(() => q("kind-chip-shoulder") !== null && q("band-aerial-frame") !== null, "the kind question");
  await click(q("kind-chip-shoulder"), "the shoulder kind");
  await click(byText("Next question"), "Next question");
  await until(() => q("side-option") !== null, "the side question");
}
/** The pin, the kind and the side answered: the card stays on the side
 *  with Confirm on screen (W8). */
async function toAnsweredQuestions() {
  await toTheSideQuestion();
  await click(q("side-option"), "a side");
  await settle();
  expect(records()).toEqual(["What kind of work is it: Shoulder work"]);
  expect(q("where-confirm")).not.toBeNull();
}
async function openEdit() {
  await click(q("where-edit"), "Edit");
  await until(() => q("where-edit-panel") !== null && !q("where-edit-panel")!.hidden, "the Edit panel");
}

describe("#485 ruling 3: the Edit panel and the collapsed row take the right column", () => {
  it("Edit turns the column into one panel; the card collapses to one row that is not a control", async () => {
    await toAnsweredQuestions();
    const frame = q("band-aerial-frame");
    const summary = q("where-summary");
    await openEdit();
    const panel = q("where-edit-panel")!;
    // The panel: its head, the three rows with their own actions, the foot.
    expect(panel.querySelector("h2")?.textContent).toBe("EDIT");
    expect(panel.textContent).toContain("Where the work is");
    expect(panel.querySelector('[data-testid="move-spot"]')?.textContent).toContain("Road");
    expect(q("move-action-spot")?.textContent).toBe("Change");
    expect(panel.querySelector('[data-testid="move-start"]')?.textContent).toContain("Work starts");
    expect(q("move-action-start")?.textContent).toBe("Move");
    expect(panel.querySelector("#band-worklen")).not.toBeNull();
    expect(panel.querySelector('[data-testid="move-extent"]')).toBeNull();
    expect(q("where-edit-cancel")?.textContent).toBe("Cancel");
    expect(q("where-edit-done")?.textContent).toBe("Done, back to the questions");
    // Focus moves into the panel (E9).
    expect(document.activeElement).toBe(panel.querySelector("h2"));
    // The card is gone; one row says the questions wait, N of M from the card's list.
    expect(q("where-questions")).toBeNull();
    const row = q("where-questions-wait")!;
    expect(row.textContent).toBe("◌Questions wait while you edit · 2 of 2 answered");
    // Not a control: no button, link, input or tab stop, no role.
    expect(row.querySelector("button, a, input, [tabindex]")).toBeNull();
    expect(row.hasAttribute("tabindex") || row.hasAttribute("role") || row.tagName === "BUTTON").toBe(false);
    // The aerial and the summary row are the same nodes; the summary is hidden.
    const stack = document.querySelector<HTMLElement>(".wq-stack")!;
    expect(stack.hasAttribute("data-edit")).toBe(true);
    expect(stack.getAttribute("data-card")).toBe("open");
    expect(q("band-aerial-frame")).toBe(frame);
    expect(q("where-summary")).toBe(summary);
    expect(summary!.closest(".wq-sum-wrap")!.hasAttribute("hidden")).toBe(true);
  });

  it("the count reads what is answered: 1 of 2 with the side open", async () => {
    await toTheSideQuestion();
    await openEdit();
    expect(q("where-questions-wait")!.textContent).toBe("◌Questions wait while you edit · 1 of 2 answered");
  });
});

describe("#485 ruling 3: Cancel undoes the edit (P15, byte-identical wire)", () => {
  it("a typed length: Cancel puts the scenario back exactly as it was", async () => {
    await toAnsweredQuestions();
    await until(() => geometryAsked.length > 0, "the geometry read");
    const before = geometryAsked[geometryAsked.length - 1];
    await openEdit();
    await typeLength("400");
    expect(q("info-toggle-worklen")?.textContent).toBe("✓ yours");
    await click(q("where-edit-cancel"), "Cancel");
    await settle();
    expect(q("where-edit-panel")?.hidden ?? true).toBe(true);
    expect(q("where-questions")).not.toBeNull();
    expect(q("where-questions-wait")).toBeNull();
    expect(records()).toEqual(["What kind of work is it: Shoulder work"]);
    expect(q("side-option")).not.toBeNull();
    expect(lengthField().value).toBe("1000");
    expect(q("info-toggle-worklen")?.textContent).toBe("default");
    await until(() => geometryAsked[geometryAsked.length - 1] === before, "the pre-edit scenario on the wire");
    expect(geometryAsked[geometryAsked.length - 1]).toBe(before);
    // Focus back on the way in (E9).
    expect(document.activeElement).toBe(q("where-edit"));
    // No line: nothing was re-asked.
    expect(q("edit-reasked-note")).toBeNull();
  });

  it("a moved work start: Cancel brings the cleared side back", async () => {
    await toAnsweredQuestions();
    // With two sides offered, BandAerial prefetches the other side's
    // geometry (prefetchGeometry), so the last read is not always the
    // scenario itself: the picked side is the one the plan asked with.
    expect(geometryAsked.some((s) => JSON.stringify(JSON.parse(s).meta.work) === JSON.stringify(SIDE.work))).toBe(true);
    expect((q("side-option") as HTMLInputElement).checked).toBe(true);
    await openEdit();
    savePin = MOVED;
    await click(q("move-action-start"), "Move");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await settle();
    await until(() => JSON.parse(geometryAsked[geometryAsked.length - 1]).meta.lng === MOVED.lng, "the moved pin");
    expect(JSON.parse(geometryAsked[geometryAsked.length - 1]).meta.work).toBeUndefined();
    // Still the panel's turn.
    expect(q("where-questions-wait")).not.toBeNull();
    await click(q("where-edit-cancel"), "Cancel");
    await settle();
    // The pre-edit scenario is back (its geometry answer is the cached one,
    // so no new read is asked): the side is answered again, nothing re-asked.
    await until(() => (q("side-option") as HTMLInputElement | null)?.checked === true, "the side back");
    expect(records()).toEqual(["What kind of work is it: Shoulder work"]);
    expect(q("edit-reasked-note")).toBeNull();
    expect(q("where-questions-wait")).toBeNull();
  });
});

describe("#485 ruling 3: Done, back to the questions (#440 ruling 2's rule)", () => {
  it("a length only: every answer stays and no line shows", async () => {
    await toAnsweredQuestions();
    await openEdit();
    await typeLength("600");
    await click(q("where-edit-done"), "Done");
    await settle();
    expect(q("where-questions-wait")).toBeNull();
    expect(q("where-questions")).not.toBeNull();
    expect(records()).toEqual(["What kind of work is it: Shoulder work"]);
    expect(q("side-option")).not.toBeNull();
    expect((q("side-option") as HTMLInputElement).checked).toBe(true);
    expect(q("edit-reasked-note")).toBeNull();
    expect(q("info-toggle-worklen")?.textContent).toBe("✓ yours");
    expect(document.activeElement).toBe(q("where-edit"));
  });

  it("a moved work start: the side is cleared and re-asked with one line; the kind stays", async () => {
    await toAnsweredQuestions();
    await openEdit();
    savePin = MOVED;
    await click(q("move-action-start"), "Move");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await settle();
    expect(q("where-questions-wait")!.textContent).toBe("◌Questions wait while you edit · 1 of 2 answered");
    // While the panel is open the line waits too.
    expect(q("edit-reasked-note")).toBeNull();
    await click(q("where-edit-done"), "Done");
    await settle();
    await until(() => q("side-option") !== null, "the side question");
    expect(records()).toEqual(["What kind of work is it: Shoulder work"]);
    expect((q("side-option") as HTMLInputElement).checked).toBe(false);
    expect(q("edit-reasked-note")?.textContent).toBe(EDIT_REASKED);
    // Answered again, the line goes.
    await click(q("side-option"), "a side");
    await settle();
    expect(q("edit-reasked-note")).toBeNull();
  });

  // Repair cycle 1 (Rule 10): inside the panel only the person's Clear in the
  // picker removes the crossing (a move or a road change keeps it), so the
  // edit line's reason would be false for it.  It is simply unanswered.
  it("a crossing cleared in the picker: the cross question is open again, with no line", async () => {
    saveCross = { lat: 39.74, lng: -104.9659, name: "Race Street" };
    render(<GeneratorShell mode="sandbox" />);
    await click(q("where-open-picker"), "Pick on map");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await openWhere();
    await until(() => q("kind-chip-near_intersection") !== null && q("band-aerial-frame") !== null, "the kind question");
    await click(q("kind-chip-near_intersection"), "the near-intersection kind");
    // The crossing the picker saved answers the cross question, so Next
    // goes on to the side.
    await click(byText("Next question"), "Next question");
    await until(() => q("side-option") !== null, "the side question");
    expect(records()).toContain("Which intersection is the work near: Race Street");
    await click(q("side-option"), "a side");
    await settle();
    await openEdit();
    expect(q("where-questions-wait")!.textContent).toBe("◌Questions wait while you edit · 3 of 3 answered");
    saveCross = null;
    await click(q("move-action-start"), "Move");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await settle();
    expect(q("where-questions-wait")!.textContent).toBe("◌Questions wait while you edit · 2 of 3 answered");
    await click(q("where-edit-done"), "Done");
    await settle();
    await until(() => q("where-questions") !== null, "the questions back");
    expect(q("cross-row")).toBeNull();
    expect(document.querySelector('[data-testid="where-questions"] .nyq-q')?.textContent).toBe(
      "Which intersection is the work near?",
    );
    expect(q("edit-reasked-note")).toBeNull();
  });

  it("an emptied length: Done keeps the panel open and shows the field's error", async () => {
    await toAnsweredQuestions();
    await openEdit();
    await typeLength("");
    await click(q("where-edit-done"), "Done");
    await settle();
    expect(q("where-edit-panel")!.hidden).toBe(false);
    expect(q("where-questions-wait")).not.toBeNull();
    expect(q("cell-worklen")?.querySelector('[role="alert"]')?.textContent).toContain(
      "Work zone length is required.",
    );
  });
});
