// @vitest-environment happy-dom
//
// #469, the WHERE band keeps one height in two columns (Ryan's Part 2
// rulings 1-4, 2026-11-08; validation-artifacts/committed/missions/
// ux-group6-wait-and-band/issue-469/rulings.md, B1-B8).
//
// Ruling 4's permanent check, in the two layers B6 sets out.  happy-dom has
// no layout engine, so the measured 0 px lives in that folder's walk
// (script/walk469.mjs at 1440x900 and 1198x930); here:
//  1. mounted, where the bug lived (Rule 11): the shell walked through every
//     CONFIRM state, and in each one the stack carries the attributes the
//     reserved height keys on, with the aerial frame and the road row the
//     same nodes throughout (nothing remounts or moves out of the stack);
//  2. the two-column CSS: the one height reaches the aerial column, the frame
//     and the right column, the card stretches with its action row pinned to
//     the card's bottom, and no rule keyed on a CONFIRM state sizes a box
//     outside the card.
// #485 ruling 4, second bullet (Ryan 2026-11-09): the same two layers across
// edit and back to the questions (missions/ux-token-map-load-edit/issue-485/
// rulings.md, E10): the Edit panel's states keep the stack's attributes and
// the same aerial frame and road row, and the panel-mode CSS holds the right
// column at exactly the band's height.  The measured 0 px is that folder's
// walk (script/walk.mjs).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

import type { Scenario } from "@/lib/scenarios";
import type { ConfirmedRoad, RoadCandidate, RoadDetectOk } from "@/lib/road-detection/types";
import { classifyFromCandidate } from "@/lib/road-detection/classify";
import { forgetAerials } from "@/lib/corridor-aerial";
import { coverScale } from "./BandAerial";

vi.mock("../AppNav", () => ({ AppNav: () => null }));
vi.mock("../AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("../AppFooter", () => ({ AppFooter: () => null }));
vi.mock("../OutputCards", () => ({ OutputCards: () => null }));
vi.mock("../QuotePanel", () => ({ QuotePanel: () => null }));

// E Colfax Ave at Race St, Denver (as GeneratorShell.cross-street-tap.test.tsx).
const PIN = { lat: 39.73997, lng: -104.96632 };
const POINT = { lat: 39.7400123, lng: -104.9659876 };
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
    ...over,
  };
}
const MAINLINE = candidate({
  geometry: [
    [39.73997, -104.968],
    [39.73997, -104.962],
  ],
} as Partial<RoadCandidate>);
const ROAD = {
  candidate: MAINLINE,
  classification: classifyFromCandidate(MAINLINE, true, null),
  method: "auto_single",
  isUrban: true,
  placeName: null,
  pinLat: PIN.lat,
  pinLng: PIN.lng,
} as ConfirmedRoad;
const RACE = candidate({
  way_id: "R1",
  name: "Race Street",
  highway_class: "residential",
  bearing: 0,
  snap_distance_m: 4,
  tags: { ...MAINLINE.tags, maxspeed: "25 mph", lanes: "2" },
});
const DETECTION: RoadDetectOk = {
  scan_status: "ok",
  candidates: [MAINLINE, RACE],
  primary_index: 0,
  isUrban: true,
  placeName: null,
};
const SIDE = { work: { side: "right", travel: "with_geometry" }, label: "South side · eastbound traffic", built: true };
// #507 ruling 3: a lone side is picked for you, which would answer the
// side question these states keep open; a two-way street offers both.
const SIDE_NORTH = { work: { side: "right", travel: "against_geometry" }, label: "North side · westbound traffic", built: true };

vi.mock("../LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSave({
          address: "E Colfax Ave & Race St, Denver",
          lat: PIN.lat,
          lng: PIN.lng,
          classification: ROAD.classification,
          crossStreet: null,
          intersection: null,
          confirmedRoad: ROAD,
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

let roadBearing: "ok" | "none" | "fail" = "ok";
function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  if (url.includes("/api/corridor-map")) {
    return new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
  }
  if (url.includes("/api/render/corridor-geometry")) {
    const s = (body as { scenario: Scenario }).scenario;
    const notMarked = s.kind === "near_intersection" && !s.meta.intersection;
    return json({
      status: notMarked ? "intersection_not_marked" : "side_not_confirmed",
      pin_model: "work_start",
      pin: null,
      travel_bearing_deg: null,
      work: null,
      approaches: [],
      coverage_ft: null,
      message: notMarked ? "Mark the cross street on the map to lay out the sides." : null,
      side_options: [SIDE, SIDE_NORTH],
    });
  }
  if (url.includes("/api/aerial-point")) return json(POINT);
  if (url.includes("/api/road-bearing")) {
    if (roadBearing === "fail") return json({ error: "down" }, 502);
    if (roadBearing === "none") return json({ ...DETECTION, candidates: [MAINLINE] });
    return json(DETECTION);
  }
  if (url.includes("/api/render/nearest-intersection")) return json({ status: "none", text: null, radius_m: 1700 });
  if (url.includes("/api/render/audit")) return json(MIN_AUDIT);
  return json({});
});

beforeEach(() => {
  forgetAerials();
  roadBearing = "ok";
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
const rowFor = (re: RegExp) =>
  [...document.querySelectorAll<HTMLElement>(".nyq-row-btn")].find((b) => re.test(b.textContent ?? "")) ?? null;
async function tapCrossing() {
  const img = q("band-aerial-img")!;
  img.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, x: 0, y: 0 }) as DOMRect;
  await act(async () => {
    img.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 352, clientY: 140 }));
  });
}

/** One CONFIRM state: the stack keys the reserved height (B2-B4), and the
 *  frame and the road row are the nodes the first state had. */
function holdsTheBand(name: string, first: { frame: HTMLElement; road: HTMLElement }) {
  const stack = document.querySelector<HTMLElement>(".wq-stack");
  expect(stack, `${name}: the stack`).not.toBeNull();
  expect(stack!.hasAttribute("data-aerial"), `${name}: data-aerial`).toBe(true);
  expect(stack!.getAttribute("data-card"), `${name}: data-card`).toBe("open");
  expect(q("where-questions"), `${name}: the CONFIRM card`).not.toBeNull();
  // The aerial column is the stack's first child, the right column its second.
  expect(stack!.firstElementChild?.getAttribute("data-testid"), `${name}: the aerial column`).toBe("band-aerial");
  expect(stack!.children[1]?.classList.contains("wq-side"), `${name}: the right column`).toBe(true);
  expect(q("band-aerial-frame"), `${name}: the same frame`).toBe(first.frame);
  expect(q("where-summary"), `${name}: the same road row`).toBe(first.road);
  return name;
}

/** #485: one Edit-panel state: the two columns' attributes, the panel's
 *  turn (data-edit, the waiting row, no card), the same frame and road row. */
function holdsTheBandInEdit(name: string, first: { frame: HTMLElement; road: HTMLElement }) {
  const stack = document.querySelector<HTMLElement>(".wq-stack");
  expect(stack, `${name}: the stack`).not.toBeNull();
  expect(stack!.hasAttribute("data-aerial"), `${name}: data-aerial`).toBe(true);
  expect(stack!.getAttribute("data-card"), `${name}: data-card`).toBe("open");
  expect(stack!.hasAttribute("data-edit"), `${name}: data-edit`).toBe(true);
  expect(q("where-questions"), `${name}: no CONFIRM card`).toBeNull();
  expect(q("where-questions-wait"), `${name}: the waiting row`).not.toBeNull();
  expect(q("where-edit-panel")?.hidden, `${name}: the panel`).toBe(false);
  expect(stack!.firstElementChild?.getAttribute("data-testid"), `${name}: the aerial column`).toBe("band-aerial");
  expect(stack!.children[1]?.classList.contains("wq-side"), `${name}: the right column`).toBe(true);
  expect(q("band-aerial-frame"), `${name}: the same frame`).toBe(first.frame);
  expect(q("where-summary"), `${name}: the same road row`).toBe(first.road);
  return name;
}

describe("#469 ruling 4 (mounted): every CONFIRM state keeps the band's reserved height", () => {
  it("kind, side, the row, Undo, and the near-intersection kind", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await click(q("where-open-picker"), "Pick on map");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await openWhere();
    await until(() => q("kind-chip-shoulder") !== null && q("band-aerial-frame") !== null, "the kind question");
    const first = { frame: q("band-aerial-frame")!, road: q("where-summary")! };
    const seen = [holdsTheBand("kind question", first)];
    await click(q("kind-chip-shoulder"), "the shoulder kind");
    seen.push(holdsTheBand("kind answered", first));
    await click(byText("Next question"), "Next question");
    await until(() => q("side-option") !== null, "the side question");
    seen.push(holdsTheBand("side question", first));
    await click(q("side-option"), "a side");
    await settle();
    seen.push(holdsTheBand("side answered", first));
    await click(rowFor(/kind of work/), "the kind row");
    seen.push(holdsTheBand("kind reopened", first));
    await click(q("step-undo-side"), "the side's Undo");
    await until(() => q("side-option") !== null, "the side question again");
    seen.push(holdsTheBand("side undone", first));
    await click(rowFor(/kind of work/), "the kind row");
    await click(q("kind-chip-near_intersection"), "the near-intersection kind");
    await settle();
    seen.push(holdsTheBand("near intersection chosen (the tallest, B1)", first));
    expect(seen).toHaveLength(7);
  });

  it("the tap question: asked, failed, none, found, Undo, found again, then the side", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await click(q("where-open-picker"), "Pick on map");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await openWhere();
    await until(() => q("kind-chip-near_intersection") !== null && q("band-aerial-frame") !== null, "the kind question");
    const first = { frame: q("band-aerial-frame")!, road: q("where-summary")! };
    await click(q("kind-chip-near_intersection"), "the near-intersection kind");
    await click(byText("Next question"), "Next question");
    await until(() => q("band-aerial-bar") !== null, "the armed aerial");
    const seen = [holdsTheBand("tap question", first)];
    expect(document.querySelector(".wq-stack")!.hasAttribute("data-tap")).toBe(true);
    roadBearing = "fail";
    await tapCrossing();
    await until(() => q("cross-failed") !== null, "the failure line");
    seen.push(holdsTheBand("tap failed", first));
    roadBearing = "none";
    await tapCrossing();
    await until(() => q("cross-none") !== null, "the no-street line");
    seen.push(holdsTheBand("tap none", first));
    roadBearing = "ok";
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the found row");
    seen.push(holdsTheBand("tap found", first));
    await click(q("cross-undo"), "the cross street's Undo");
    await until(() => q("cross-row") === null, "the Undo");
    seen.push(holdsTheBand("tap undone", first));
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the found row again");
    seen.push(holdsTheBand("tap found again", first));
    await click(byText("Next question"), "Next question");
    await until(() => q("side-option") !== null, "the side question");
    seen.push(holdsTheBand("side after the tap", first));
    await click(q("side-option"), "a side");
    await settle();
    seen.push(holdsTheBand("side answered after the tap", first));
    expect(seen).toHaveLength(8);
  });

  it("#485: edit, Cancel, edit again with a length, Done, and the questions back", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await click(q("where-open-picker"), "Pick on map");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await openWhere();
    await until(() => q("kind-chip-shoulder") !== null && q("band-aerial-frame") !== null, "the kind question");
    const first = { frame: q("band-aerial-frame")!, road: q("where-summary")! };
    await click(q("kind-chip-shoulder"), "the shoulder kind");
    await click(byText("Next question"), "Next question");
    await until(() => q("side-option") !== null, "the side question");
    await click(q("side-option"), "a side");
    await settle();
    const seen = [holdsTheBand("side answered", first)];
    await click(q("where-edit"), "Edit");
    seen.push(holdsTheBandInEdit("edit open", first));
    await click(q("where-edit-cancel"), "Cancel");
    await settle();
    seen.push(holdsTheBand("cancelled", first));
    await click(q("where-edit"), "Edit");
    seen.push(holdsTheBandInEdit("edit open again", first));
    const len = document.getElementById("band-worklen") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(len, { target: { value: "600" } });
      fireEvent.keyDown(len, { key: "Enter" });
    });
    await settle();
    seen.push(holdsTheBandInEdit("length changed", first));
    await click(q("where-edit-done"), "Done");
    await settle();
    seen.push(holdsTheBand("back to the questions", first));
    expect(q("where-edit-panel")?.hidden).toBe(true);
    expect(document.querySelector(".wq-stack")!.hasAttribute("data-edit")).toBe(false);
    expect(seen).toHaveLength(6);
  });

  // Ryan's B4b answer (2026-11-09, Part 2 ruling 5; ux-wait-band-followups/
  // issue-469/rulings.md R1-R5): the kind question's Details is step 2's
  // popover (useDetailsToggle + the `a-info a-pop` panel), floating over the
  // page, so opening it changes nothing in the band's flow.
  it("the kind question's Details floats (step 2's popover): click opens, Esc and a click outside close", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await click(q("where-open-picker"), "Pick on map");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await openWhere();
    await until(() => q("kind-chip-shoulder") !== null && q("band-aerial-frame") !== null, "the kind question");
    const first = { frame: q("band-aerial-frame")!, road: q("where-summary")! };
    const card = q("where-questions")!;
    // The card's own toggle (the road row has a "Details" of its own).
    const toggle = card.querySelector<HTMLButtonElement>(".nyq-details-btn")!;
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    // The text is the popover panel inside the toggle's own box in the foot,
    // not a block in the question's flow after the action row.
    expect(panel.classList.contains("a-info") && panel.classList.contains("a-pop"), panel.className).toBe(true);
    expect(panel.tagName).toBe("SPAN");
    expect(panel.parentElement!.classList.contains("nyq-tip-box")).toBe(true);
    expect(panel.parentElement!.contains(toggle)).toBe(true);
    expect(panel.closest(".nyq-foot")).not.toBeNull();
    expect(card.querySelector(".nyq-card > .nyq-details")).toBeNull();
    expect(panel.hidden).toBe(true);
    await click(toggle, "Details");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain("Shoulder work: TA-3/TA-5 · S-630-1");
    holdsTheBand("kind, Details open", first);
    // Esc closes it, focus back on the toggle (R101).
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
    // A click outside closes it too.
    await click(toggle, "Details");
    expect(panel.hidden).toBe(false);
    await act(async () => {
      fireEvent.pointerDown(q("where-summary")!);
    });
    expect(panel.hidden).toBe(true);
    // Moving to the next question takes the panel with it (R5).
    await click(q("kind-chip-shoulder"), "the shoulder kind");
    await click(card.querySelector(".nyq-details-btn"), "Details");
    await click(byText("Next question"), "Next question");
    await until(() => q("side-option") !== null, "the side question");
    expect(card.querySelector(".nyq-tip-box")).toBeNull();
    holdsTheBand("side question", first);
  });
});

// ── the two-column CSS ────────────────────────────────────────────────────
const CSS = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

/** The body of the first `@container (<cond>) {` block, braces balanced. */
function block(cond: string): { body: string; start: number; end: number } {
  const head = `@container (${cond}) {`;
  let at = -1;
  let from = 0;
  // The #456 block's own query (the last one with this condition before
  // the narrow block).
  for (;;) {
    const i = CSS.indexOf(head, from);
    if (i < 0) break;
    if (CSS.slice(i, i + 400).includes(".wq-stack")) at = i;
    from = i + 1;
  }
  expect(at, head).toBeGreaterThan(0);
  let depth = 0;
  for (let i = at + head.length - 1; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}" && --depth === 0) return { body: CSS.slice(at + head.length, i), start: at, end: i };
  }
  throw new Error(`unbalanced ${head}`);
}
/** Plain rules of a CSS text (comments dropped): selector list and body. */
function rules(text: string): { sel: string; body: string }[] {
  const out: { sel: string; body: string }[] = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}@]+)\{([^{}]*)\}/g;
  for (let m = re.exec(clean); m; m = re.exec(clean)) out.push({ sel: m[1].trim(), body: m[2] });
  return out;
}
const decl = (body: string, prop: string) =>
  body.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+);`))?.[1].replace(/\s+/g, " ").trim() ?? null;
const rule = (list: { sel: string; body: string }[], sel: string) => {
  const r = list.find((x) => x.sel.split(",").some((s) => s.trim() === sel));
  expect(r, sel).toBeTruthy();
  return r!.body;
};

const STATE = /\[data-tap\]|\[data-map|\[data-bar|\[data-held|\.is-armed|\.has-bar|\[data-flag/;
const BOX = /(?:^|[;\s])(height|min-height|max-height|margin(?:-top|-bottom)?|padding(?:-top|-bottom)?|border(?:-top|-bottom)?(?:-width)?|display|flex|position|top|inset)\s*:/;

describe("#469 rulings 1-3 (CSS): one height in two columns, the 390 strip untouched", () => {
  it("B1, B2: the band's height and the line slot are the wrapper's own properties", () => {
    const wrap = rule(rules(CSS.slice(0, block("min-width: 720px").start)), ".workbench .wq-wrap");
    // #490 C7: re-traced (missions/ux-columns-copy-maps/issue-490/rulings.md).
    expect(decl(wrap, "--wq-band-h")).toBe("655px");
    expect(decl(wrap, "--wq-line-slot")).toBe("calc(8px + 10.5px * 1.5)");
    // The slot is the line's own margin and one .tr-prov line.
    expect(decl(rule(rules(CSS), ".workbench .a-aerial-line"), "margin")).toBe("8px 0 0");
    const prov = rule(rules(CSS), ".workbench .tr-prov");
    expect([decl(prov, "font-size"), decl(prov, "line-height")]).toEqual(["10.5px", "1.5"]);
  });

  it("ruling 1: the aerial column, the frame and the open card's right column take the one height", () => {
    const wide = rules(block("min-width: 720px").body);
    // #490: the one height is the row's: the right column starts at the
    // band's height, and the aerial column and its frame stretch to it.
    // Repair 2: a grid whose first row stretches its cells (grid's default).
    expect(decl(rule(wide, ".workbench .wq-stack[data-aerial]"), "display")).toBe("grid");
    expect(decl(rule(wide, ".workbench .wq-stack[data-aerial] > .wq-side"), "min-height")).toBe("var(--wq-band-h)");
    expect(decl(rule(wide, ".workbench .wq-stack[data-aerial] .a-aerial-frame"), "height")).toBe("auto");
    const open = '.workbench .wq-stack[data-aerial][data-card="open"]';
    // The card stretches; its content at the top, and the room for its
    // action row (the 16 px gap, the 44 px button, the 24 px inset) reserved
    // at its bottom.
    const card = rule(wide, `${open} .wq`);
    expect([decl(card, "flex"), decl(card, "position"), decl(card, "padding-bottom")]).toEqual([
      "1 0 auto",
      "relative",
      "calc(var(--space-block) + 44px + var(--space-section))",
    ]);
    // B4: the action row is pinned to the card's bottom (offset 0 past the
    // card's own inset), so it is in one place on every question.
    const foot = rule(wide, `${open} .nyq-foot`);
    expect([decl(foot, "position"), decl(foot, "left"), decl(foot, "right"), decl(foot, "bottom")]).toEqual([
      "absolute",
      "var(--space-block)",
      "var(--space-block)",
      "var(--space-section)",
    ]);
    // B4b, answered (Ryan 2026-11-09, ruling 5): Details floats, so no rule
    // keyed on an open Details moves the action row or resizes the card, at
    // any width; the WHERE adapter asks for the floating Details, and the
    // box anchoring the popover is the one rule it needs.
    expect(CSS).not.toMatch(/\.nyq-details:not\(\[hidden\]\)/);
    const where = readFileSync(join(__dirname, "WhereQuestions.tsx"), "utf-8");
    expect(where).toMatch(/<QuestionSteps[\s\S]*?\bdetailsTip\b[\s\S]*?\/>/);
    expect(decl(rule(rules(CSS), ".workbench .nyq-tip-box"), "position")).toBe("relative");
    // Its inset is the question block's own: the card's padding.
    expect(decl(rule(rules(CSS), ".workbench .nyq-card"), "padding")).toBe("var(--space-section) var(--space-block)");
    // The reserved 44 is the action button's own height.
    expect(decl(rule(rules(CSS), ".workbench .a-pri.wq-next"), "height")).toBe("44px");
    // Nothing else in the card is resized or reordered (B4a: DOM order kept).
    expect(block("min-width: 720px").body).not.toMatch(/\border\s*:|\.nyq-row\b|\.nyq-card\s*\{/);
  });

  it("#485 E8: with the Edit panel open the right column is the band's height, the panel filling it", () => {
    const wide = rules(block("min-width: 720px").body);
    const edit = ".workbench .wq-stack[data-aerial][data-edit]";
    // #490: a minimum (the row's, as in every two-column state), so a panel
    // that needs more grows both columns together.
    expect(wide.some((r) => r.sel.includes(`${edit} > .wq-side`))).toBe(false);
    expect([decl(rule(wide, `${edit} .wq-panel`), "flex"), decl(rule(wide, `${edit} .wq-panel`), "min-height")]).toEqual([
      "1 1 auto",
      "0",
    ]);
    expect(decl(rule(wide, `${edit} .wq-wait`), "flex")).toBe("none");
    // The waiting row's own height, and nothing in the narrow block keys on
    // the panel (the strip stays #456's).
    expect(decl(rule(rules(CSS), ".workbench .wq-wait"), "min-height")).toBe("48px");
    expect(block("max-width: 719.98px").body).not.toMatch(/data-edit/);
  });

  it("ruling 2: no rule keyed on a CONFIRM state sizes the band, the aerial, the frame or the right column", () => {
    const narrow = block("max-width: 719.98px");
    const outsideNarrow = CSS.slice(0, narrow.start) + CSS.slice(narrow.end + 1);
    // Every two-column rule: none is keyed on a state.
    for (const r of rules(block("min-width: 720px").body)) {
      expect(STATE.test(r.sel), r.sel).toBe(false);
    }
    // Anywhere but the narrow block: a state rule on one of the band's boxes
    // (not a pseudo-element, not a child inside the frame) sizes nothing.
    const boxes = /(?:\.wq-wrap|\.wq-stack(?:\[[^\]]*\])*|\.a-aerial(?:\.[\w-]+|\[[^\]]*\])*|\.a-aerial-frame(?:\.[\w-]+|\[[^\]]*\])*|\.wq-side)$/;
    const offenders = rules(outsideNarrow).flatMap((r) =>
      r.sel
        .split(",")
        .map((s) => s.trim())
        .filter((s) => STATE.test(s) && !s.includes("::") && boxes.test(s) && BOX.test(r.body)),
    );
    expect(offenders).toEqual([]);
  });

  it("ruling 3: the narrow block still carries #456's strip, and none of #469's properties", () => {
    const narrow = block("max-width: 719.98px").body;
    expect(narrow).toMatch(/\.wq-stack\[data-card="open"\]:not\(\[data-tap\]\) \.a-aerial-frame \{[^}]*height: 150px;/);
    expect(narrow).not.toMatch(/--wq-band-h|--wq-line-slot/);
  });
});

// #490 (Ryan 2026-11-10): "Columns that sit side by side always end
// together."  The measured 0 px is scripts/verify-columns-end-together.mjs
// (every WHERE state and variant at 1024, 1198 and 1440, at 100 and 200%
// text; missions/ux-columns-copy-maps/issue-490/); here the CSS that makes
// it structural, and the cover scale.
describe("#490: the two WHERE columns end together", () => {
  const wide = () => rules(block("min-width: 720px").body);
  const stack = ".workbench .wq-stack[data-aerial]";

  it("one grid whose first row stretches both columns; no box in it has a fixed height that could drift", () => {
    const w = wide();
    const g = rule(w, stack);
    expect([decl(g, "display"), decl(g, "grid-template-columns"), decl(g, "grid-template-rows")]).toEqual([
      "grid",
      "minmax(0, 1fr) minmax(0, 1fr)",
      "auto minmax(var(--wq-line-slot), auto)",
    ]);
    // Grid items stretch by default: nothing in the block overrides it.
    expect(w.some((r) => /align-(items|self)\s*:/.test(r.body))).toBe(false);
    expect([decl(rule(w, `${stack} > .a-aerial > .a-aerial-frame`), "grid-row"), decl(rule(w, `${stack} > .wq-side`), "grid-row")]).toEqual(["1", "1"]);
    for (const sel of [`${stack} .a-aerial-frame`, `${stack} > .wq-side`]) {
      expect(decl(rule(w, sel), "max-height"), sel).toBeNull();
    }
    // No rule in the block sets a fixed height on a column or its boxes; the
    // one height is the picture's drawn size (below).  The frame's is reset.
    const fixed = w.filter((r) => ![null, "auto"].includes(decl(r.body, "height"))).map((r) => r.sel);
    expect(fixed).toEqual([`${stack} .a-aerial-canvas`]);
    expect(decl(rule(w, `${stack} > .a-aerial`), "display")).toBe("contents");
    // The right column's last box fills it (the card, or the waiting row
    // under the Edit panel, which the panel pushes down).
    expect(decl(rule(w, `${stack} > .wq-side > :last-child`), "flex")).toBe("1 0 auto");
  });

  it("the aerial's line is in flow in row 2, a slot at least one line tall that grows with its text", () => {
    const w = wide();
    expect(decl(rule(w, stack), "padding-bottom")).toBeNull();
    const line = rule(w, `${stack} > .a-aerial > .a-aerial-line`);
    expect([decl(line, "grid-row"), decl(line, "grid-column"), decl(line, "position")]).toEqual(["2", "1", null]);
    // The key's containing block is the stack (the aerial column has no box).
    expect(decl(rule(w, stack), "position")).toBe("relative");
  });

  it("the picture keeps its drawn size and is scaled to cover a taller frame", () => {
    const canvas = rule(wide(), `${stack} .a-aerial-canvas`);
    expect(decl(canvas, "height")).toBe("calc(var(--wq-band-h) - 2px)");
    expect(decl(canvas, "transform")).toBe("translateY(-50%) scale(var(--aerial-cover, 1))");
    expect(coverScale({ width: 409, height: 646 }, { width: 409, height: 646 })).toBe(1);
    expect(coverScale({ width: 409, height: 800 }, { width: 409, height: 646 })).toBeCloseTo(800 / 646, 6);
    // Never below 1 (the phone strip's frame is shorter than its canvas).
    expect(coverScale({ width: 328, height: 148 }, { width: 328, height: 248 })).toBe(1);
    expect(coverScale({ width: 0, height: 0 }, { width: 0, height: 0 })).toBe(1);
  });
});
