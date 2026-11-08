// @vitest-environment happy-dom
//
// #456, mounted where the bugs lived (Rule 11): the whole shell, the WHERE
// band's CONFIRM card on its side question.  Ruling 3's load ahead: the
// answer's picture is asked for before the click, so the click asks Mapbox
// for nothing and the box is never blank.  Ruling 2's strip state on the
// stack (the layout itself is CSS, walked in evidence.md), and Hide map /
// Show map holding through an answer.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

vi.mock("../AppNav", () => ({ AppNav: () => null }));
vi.mock("../AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("../AppFooter", () => ({ AppFooter: () => null }));
vi.mock("../OutputCards", () => ({ OutputCards: () => null }));
vi.mock("../QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("../LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "../GeneratorShell";
import { openWhere } from "../__fixtures__/band-helpers";
import { MIN_AUDIT, TEST_PIN } from "../test-fixtures";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario, ShoulderScenario } from "@/lib/scenarios";
import { AERIAL_HIDE, AERIAL_SHOW } from "./BandAerial";
import { mapHiddenNow } from "./WhereBand";

const UNSIDED: ShoulderScenario = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, ...TEST_PIN, pinModel: "work_start" },
};
const OPTIONS = [
  { work: { side: "right", travel: "with_geometry" }, label: "South side · eastbound traffic", built: true },
  { work: { side: "right", travel: "against_geometry" }, label: "North side · westbound traffic", built: true },
];
const seg = [
  [39.7, -104.9],
  [39.701, -104.9],
];

const maps: { stage: string; scenario: Scenario }[] = [];
const geometries: Scenario[] = [];
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/corridor-map")) {
    maps.push(JSON.parse(String(init?.body)));
    return new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
  }
  const json = url.includes("/api/render/corridor-geometry")
    ? (() => {
        const s = (JSON.parse(String(init?.body)) as { scenario: Scenario }).scenario;
        geometries.push(s);
        const sided = Boolean(s.meta.work);
        return {
          status: sided ? "laid_out" : "side_not_confirmed",
          pin_model: "work_start",
          pin: [s.meta.lat, s.meta.lng],
          travel_bearing_deg: sided ? 90 : null,
          work: sided ? { length_ft: 1000, points: seg, parts: [{ points: seg, extended: false }] } : null,
          approaches: [],
          coverage_ft: null,
          message: null,
          side_options: OPTIONS,
        };
      })()
    : url.includes("/api/render/audit")
      ? MIN_AUDIT
      : {};
  return new Response(JSON.stringify(json), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});

beforeEach(() => {
  maps.length = 0;
  geometries.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn() as never;
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:aerial-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function settle(ms = 900) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
const q = (sel: string) => document.querySelector<HTMLElement>(sel);

describe("#456 ruling 3: the side question's answers are loaded ahead", () => {
  it("each side's geometry and picture are asked before the click; the click asks for nothing", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    await settle();
    expect(q('[data-testid="where-questions"] .nyq-q')?.textContent).toMatch(/side of the road/);
    const sidedMaps = maps.filter((m) => m.scenario.meta.work);
    // One picture per choice, both sides, at most once each.
    expect(sidedMaps.map((m) => m.scenario.meta.work?.travel).sort()).toEqual([
      "against_geometry",
      "with_geometry",
    ]);
    // The page's own pin picture lands after its geometry read and the
    // aerial's 300 ms debounce.
    await settle(2500);
    const before = maps.length;
    const geoBefore = geometries.length;
    const srcBefore = q('[data-testid="band-aerial-img"]')?.getAttribute("src");
    await act(async () => {
      q('label.nyq-answer:has([data-testid="side-option"])')!.click();
    });
    // A saved plan's kind is confirmed, so the side's answer fires the
    // checks and the column folds under the write lock until they land.
    await settle(1500);
    expect(maps.length).toBe(before);
    expect(geometries.length).toBe(geoBefore);
    // (With the kind confirmed the column then moves on to WHAT; the swap
    // itself is BandAerial's hold test and the walk's network log.)
    expect(srcBefore).toBeTruthy();
  }, 15000);
});

describe("#456 ruling 2: the strip's state and Hide map", () => {
  it("the stack says the card is open; Hide map holds; Show map brings it back", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    await settle();
    const stack = q(".wq-stack")!;
    expect(stack.getAttribute("data-card")).toBe("open");
    expect(stack.hasAttribute("data-tap")).toBe(false);
    const hide = q('[data-testid="band-aerial-hide"]')!;
    expect(hide.textContent).toBe(AERIAL_HIDE);
    await act(async () => hide.click());
    expect(stack.getAttribute("data-map")).toBe("hidden");
    expect(document.activeElement?.getAttribute("data-testid")).toBe("band-aerial-show");
    // The choice holds while the band re-renders (the walk answers a side
    // and a kind with it hidden, evidence.md).
    await settle();
    expect(q(".wq-stack")!.getAttribute("data-map")).toBe("hidden");
    const show = q('[data-testid="band-aerial-show"]')!;
    expect(show.textContent).toBe(AERIAL_SHOW);
    await act(async () => show.click());
    expect(q(".wq-stack")!.hasAttribute("data-map")).toBe(false);
    expect(document.activeElement?.getAttribute("data-testid")).toBe("band-aerial-hide");
  });
});

describe("#456 ruling 2: Hide map only applies while the card is open", () => {
  it("a hidden choice never hides the map with the card closed, nor for a tap question", () => {
    expect(mapHiddenNow(true, true, false)).toBe(true);
    // Card closed: no strip and no Show map row, so the map shows.
    expect(mapHiddenNow(false, true, false)).toBe(false);
    // M7: a tap question needs the map.
    expect(mapHiddenNow(true, true, true)).toBe(false);
    expect(mapHiddenNow(true, false, false)).toBe(false);
  });
});

describe("#456 ruling 3: the kind question's answers are loaded ahead", () => {
  it("each other kind's geometry is read before the click; the click reads nothing new", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    await settle(2500);
    // Bring the kind's question on screen through its answered record.
    const row = Array.from(document.querySelectorAll<HTMLElement>(".nyq-answered .nyq-row-btn")).find((b) =>
      b.textContent?.includes("What kind of work"),
    )!;
    await act(async () => row.click());
    await settle(1500);
    expect(q('[data-testid="where-questions"] .nyq-q')?.textContent).toMatch(/kind of work/);
    const ahead = geometries.filter((g) => g.kind === "flagger_lane_closure");
    expect(ahead.length).toBeGreaterThan(0);
    const geoBefore = geometries.length;
    await act(async () => {
      q('label.nyq-answer:has([data-testid="kind-chip-flagger_lane_closure"])')!.click();
    });
    await settle(1500);
    const after = geometries.slice(geoBefore);
    // The click's own scenario was read ahead: no flagger read follows it.
    // The question stays on the kind until Next, so the reads after it are
    // the NEXT load-ahead, built from the new scenario (here one: shoulder;
    // the near-intersection kind's scenario is the same as before and is
    // remembered).  This is the walk's `g=1` on a kind answer.
    expect(after.filter((g) => g.kind === "flagger_lane_closure")).toHaveLength(0);
    expect(after.map((g) => g.kind)).toEqual(["shoulder"]);
  }, 20000);
});
