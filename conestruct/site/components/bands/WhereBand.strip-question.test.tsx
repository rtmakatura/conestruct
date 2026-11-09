// @vitest-environment happy-dom
//
// #461, mounted where the bug lived (Rule 11): the whole shell, the WHERE
// band's CONFIRM card with the narrow strip pinned.  When the question on the
// card changes, or the map is shown again, the question and its sentence are
// brought below the strip with #446 T24's least scroll (N2), only while the
// strip (or the Show map row) is the thing pinned under the nav.  The pin
// itself is CSS; happy-dom gets one rule standing in for the narrow layout's
// sticky, and the scroll margins are pinned against globals.css below.
// Measured in the browser in
// validation-artifacts/committed/missions/ux-followups-465-461-459/issue-461/evidence.md.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

vi.mock("../AppNav", () => ({ AppNav: () => null }));
vi.mock("../AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("../AppFooter", () => ({ AppFooter: () => null }));
vi.mock("../OutputCards", () => ({ OutputCards: () => null }));
vi.mock("../QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("../LocationPickerModal", () => ({ LocationPickerModal: () => null }));
const scrolled = vi.hoisted(() => [] as HTMLElement[]);
vi.mock("@/lib/cross-street-reveal", async (orig) => {
  const real = await orig<typeof import("@/lib/cross-street-reveal")>();
  return {
    ...real,
    scrollAerialPartIn: (el: HTMLElement) => {
      scrolled.push(el);
    },
  };
});

import { GeneratorShell } from "../GeneratorShell";
import { openWhere } from "../__fixtures__/band-helpers";
import { MIN_AUDIT, TEST_PIN } from "../test-fixtures";
import { DEFAULT_NEAR_INTERSECTION, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario, ShoulderScenario } from "@/lib/scenarios";

const UNSIDED: ShoulderScenario = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, ...TEST_PIN, pinModel: "work_start" },
};
// A saved near-intersection plan with no crossing marked: the card opens on
// the tap question (as in WhereBand.no-crossing.test.tsx).
const NO_CROSSING = {
  ...DEFAULT_NEAR_INTERSECTION,
  meta: { ...DEFAULT_NEAR_INTERSECTION.meta, ...TEST_PIN, pinModel: "work_start", intersection: undefined },
} as Scenario;
const OPTIONS = [
  { work: { side: "right", travel: "with_geometry" }, label: "South side · eastbound traffic", built: true },
  { work: { side: "right", travel: "against_geometry" }, label: "North side · westbound traffic", built: true },
];
const seg = [
  [39.7, -104.9],
  [39.701, -104.9],
];
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/corridor-map")) {
    return new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
  }
  const json = url.includes("/api/render/corridor-geometry")
    ? (() => {
        const s = (JSON.parse(String(init?.body)) as { scenario: Scenario }).scenario;
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

// The narrow layout's pin, standing in for the container query happy-dom
// doesn't evaluate.
const NARROW = `
.wq-stack[data-card="open"]:not([data-tap]) .a-aerial-frame { position: sticky; }
.wq-stack[data-card="open"][data-map="hidden"] .a-aerial-showrow { position: sticky; }
`;
let style: HTMLStyleElement | null = null;
const narrow = () => {
  style = document.createElement("style");
  style.textContent = NARROW;
  document.head.appendChild(style);
};

beforeEach(() => {
  scrolled.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn() as never;
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:aerial-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  style?.remove();
  style = null;
  vi.unstubAllGlobals();
});

async function settle(ms = 900) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
const q = (sel: string) => document.querySelector<HTMLElement>(sel);
const questionText = () => q('[data-testid="where-questions"] .nyq-card .nyq-text');
const openKindRow = async () => {
  const row = [...document.querySelectorAll<HTMLElement>(".nyq-row-btn")].find((b) =>
    /kind of work/.test(b.textContent ?? ""),
  );
  expect(row, "the kind question's row").toBeTruthy();
  await act(async () => row!.click());
};

describe("#461 N2: a question change brings the question below the pinned strip", () => {
  it("the first question asks for no scroll; opening another asks for its text block", async () => {
    narrow();
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    await settle();
    expect(q(".wq-stack")!.getAttribute("data-card")).toBe("open");
    expect(questionText()?.textContent).toMatch(/side of the road/);
    // Ruling 184's landing owns the first question's scroll.
    expect(scrolled).toEqual([]);
    await openKindRow();
    expect(questionText()?.textContent).toMatch(/kind of work/);
    expect(scrolled.length).toBe(1);
    expect(scrolled[0]).toBe(questionText());
  });

  it("Show map asks for the question's scroll; Hide map does not", async () => {
    narrow();
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    await settle();
    await act(async () => q('[data-testid="band-aerial-hide"]')!.click());
    expect(q(".wq-stack")!.getAttribute("data-map")).toBe("hidden");
    expect(scrolled).toEqual([]);
    await act(async () => q('[data-testid="band-aerial-show"]')!.click());
    expect(scrolled.length).toBe(1);
    expect(scrolled[0]).toBe(questionText());
  });

  it("opening the tap question asks for no question scroll (M8's map scroll only)", async () => {
    // Every frame pinned, the tap question's too: the stand-in takes the
    // CSS's own exclusion away, so only N2's tap-question bail keeps the
    // question still.
    style = document.createElement("style");
    style.textContent = `.wq-stack[data-card="open"] .a-aerial-frame { position: sticky; }`;
    document.head.appendChild(style);
    render(<GeneratorShell mode="sandbox" initialScenario={NO_CROSSING} />);
    await openWhere();
    await settle();
    // #440 ruling 2: the card opens on the cross street, the tap question.
    expect(q(".wq-stack")!.hasAttribute("data-tap")).toBe(true);
    // M8's own map scroll on the card's first (tap) question, and nothing else.
    expect(scrolled.map((el) => el.getAttribute("data-testid"))).toEqual(["band-aerial-frame"]);
    scrolled.length = 0;
    await openKindRow();
    expect(questionText()?.textContent).toMatch(/kind of work/);
    // The kind question is not a tap question: its text is brought in.
    expect(scrolled).toEqual([questionText()]);
    scrolled.length = 0;
    await act(async () => q('[data-testid="where-questions"] .nyq-card .nyq-foot > button:last-child')!.click());
    expect(q(".wq-stack")!.hasAttribute("data-tap")).toBe(true);
    // M8 brings the map in; nothing asks for the question's text.
    expect(scrolled.some((el) => el.classList.contains("nyq-text"))).toBe(false);
    expect(scrolled.map((el) => el.getAttribute("data-testid"))).toEqual(["band-aerial-frame"]);
  });

  it("in two columns (nothing pinned over the card) a question change scrolls nothing", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    await settle();
    await openKindRow();
    expect(questionText()?.textContent).toMatch(/kind of work/);
    expect(scrolled).toEqual([]);
  });
});

describe("#461 N1: the question's scroll margin clears the strip", () => {
  it("globals.css gives the text block nav + strip + 8, and nav + Show map row + 8, in the narrow layout only", () => {
    const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8");
    const narrowAt = css.indexOf("@container (max-width: 719.98px)");
    expect(narrowAt).toBeGreaterThan(0);
    const narrowBlock = css.slice(narrowAt);
    expect(narrowBlock).toMatch(
      /\.wq-stack\[data-card="open"\]:not\(\[data-tap\]\) \.nyq-text \{\s*scroll-margin-top: calc\(var\(--nav-h\) \+ 150px \+ 8px\);/,
    );
    expect(narrowBlock).toMatch(
      /\.wq-stack\[data-card="open"\]\[data-map="hidden"\] \.nyq-text \{\s*scroll-margin-top: calc\(var\(--nav-h\) \+ 44px \+ 8px\);/,
    );
    // The strip it clears is still 150 px (M4).
    expect(narrowBlock).toMatch(
      /\.wq-stack\[data-card="open"\]:not\(\[data-tap\]\) \.a-aerial-frame \{[^}]*height: 150px;/,
    );
    // Only the narrow layout carries it.
    expect(css.slice(0, narrowAt)).not.toMatch(/\.nyq-text \{[^}]*scroll-margin-top/);
  });
});
