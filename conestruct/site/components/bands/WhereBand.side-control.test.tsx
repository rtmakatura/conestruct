// @vitest-environment happy-dom
//
// #290 hand-check — the WHERE band's side control, mounted.
//
// Item 2 (Ryan, 2026-09-25, superseding the open-points ruling 2): "The
// side control drops the greyed 'median side — not built yet' option
// entirely.  An option the user can't choose, named in jargon, is noise
// (P13, P18).  The buildable sides stay."

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
import type { ShoulderScenario } from "@/lib/scenarios";
import { AERIAL_FAILED } from "./BandAerial";
import { SIDES_FAILED } from "./WhereQuestions";

// A located plan, side not yet answered.
const UNSIDED: ShoulderScenario = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, ...TEST_PIN },
};

// What an OLDER backend sent for a one-way road: the legal right edge, and
// the left edge named and greyed out.  The current backend sends only the
// first; the band must render only the first either way.
const ONE_WAY_OPTIONS = [
  { work: { side: "right", travel: "with_geometry" }, label: "West side · southbound traffic", built: true },
  {
    work: { side: "median", travel: "with_geometry" },
    label: "East side · southbound traffic",
    built: false,
    note: "median side — not built yet",
  },
];

// #491: set to make the geometry read fail (a 502), as a down backend does.
let geometryFails = false;

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (geometryFails && url.includes("/api/render/corridor-geometry")) {
    return Promise.resolve({ ok: false, status: 502, json: async () => ({}) } as unknown as Response);
  }
  const json = url.includes("/api/render/corridor-geometry")
    ? {
        status: "side_not_confirmed",
        pin_model: "work_start",
        pin: null,
        travel_bearing_deg: null,
        work: null,
        approaches: [],
        coverage_ft: null,
        message: null,
        side_options: ONE_WAY_OPTIONS,
      }
    : url.includes("/api/render/audit")
      ? MIN_AUDIT
      : {};
  return Promise.resolve({ ok: true, status: 200, json: async () => json } as unknown as Response);
});

beforeEach(() => {
  geometryFails = false;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** #439 W2: a side's radio row, read as its two lines. */
function sideText(o: HTMLElement): string {
  const l = o.closest("label")!;
  return [l.querySelector(".nyq-label")?.textContent, l.querySelector(".nyq-consequence")?.textContent]
    .filter(Boolean)
    .join(" / ");
}

async function waitForOptions(): Promise<HTMLElement[]> {
  const deadline = Date.now() + 3000;
  for (;;) {
    const found = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="side-option"]'),
    );
    if (found.length > 0 || Date.now() > deadline) return found;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
  }
}

describe("the side control offers only the sides a plan can be built for", () => {
  it("an unbuildable (median / left) side is not rendered — not greyed, not named", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    const options = await waitForOptions();
    expect(options.map(sideText)).toEqual(["West side / Next to southbound traffic"]);
    const control = document.querySelector('[data-testid="where-questions"]');
    expect(control?.textContent).not.toContain("not built");
    expect(control?.textContent).not.toContain("median");
    expect(control?.textContent).not.toContain("East side");
  });
});

// #491: the two failure lines are plain sentences in Inter (group 1
// ruling 2), and neither promises a retry a reopen of the map doesn't run
// (rulings.md, the trace).
describe("#491: a failed geometry read says so in plain sentences", () => {
  it("the side line and the aerial's note read as sentences, both in Inter", async () => {
    geometryFails = true;
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    const deadline = Date.now() + 3000;
    while (!document.querySelector('[data-testid="side-control-note"]')?.textContent?.startsWith("We") && Date.now() < deadline) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });
    }
    const side = document.querySelector('[data-testid="side-control-note"]')!;
    expect(side.textContent).toBe(SIDES_FAILED);
    expect(side.textContent).toBe("We couldn't load this road's sides.");
    expect(side.classList.contains("tr-note")).toBe(true);
    const note = document.querySelector('[data-testid="band-aerial-note"]')!;
    expect(note.textContent).toBe(AERIAL_FAILED);
    expect(note.textContent).toBe("The map didn't load. Edit on map opens the big map at your pin.");
    // Inter (.tr-note), not mono (.tr-prov).
    expect(note.classList.contains("tr-note")).toBe(true);
    expect(note.classList.contains("tr-prov")).toBe(false);
  });
});

// Item 3: "The side control's selected state takes rule 135's chip
// treatment — accent border, the wash, a ✓ — so the choice is visible.
// Fix the spacing between options."
describe("the chosen side is visible, and the options are spaced", () => {
  // #439 ruling 5: the side is a radio row (#437's), its marker the 14 px
  // square (Rule 13: shape, not hue); ● (#407) retires with the chip.
  it("clicking a side checks its radio row; the row marks the choice by shape", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    const [option] = await waitForOptions();
    expect((option as HTMLInputElement).type).toBe("radio");
    expect((option as HTMLInputElement).checked).toBe(false);
    expect(option.closest("label")?.className).toBe("nyq-answer");
    await act(async () => {
      option.click();
    });
    // RULE 5, stated (the kind-before-side fix): this plan's kind is
    // already confirmed, so the side was the last WHERE answer owed and
    // the column moves on to WHAT (deriveBands' `natural`).  Re-open WHERE
    // the way a person does to see the choice: an answered record.
    expect(
      document.querySelector('[data-testid="band-stack"]')?.getAttribute("data-open-band"),
    ).toBe("what");
    await openWhere();
    // #440 ruling 2: the side's record is the card's last (the kind's first).
    const rows = document.querySelectorAll('[data-testid="where-questions"] .nyq-answered');
    const record = rows[rows.length - 1];
    expect(record?.textContent).toContain("Which side of the road is the work on: West side");
    expect(record?.textContent).not.toContain("●");
  });

  it("the checked radio shares the pressed kind chip's accent border and wash; the row keeps rule 135's gap", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf-8");
    const block = css.match(
      /\.workbench \.a-chip\[aria-pressed="true"\],\s*\.workbench \.a-chip\[role="radio"\]\[aria-checked="true"\] \{([^}]*)\}/,
    );
    expect(block).not.toBeNull();
    expect(block![1]).toMatch(/border-color:\s*var\(--act\)/);
    expect(block![1]).toMatch(/background:\s*rgba\(52, 169, 232, 0\.1\)/);
    expect(css).toMatch(/\.workbench \.a-chips \{[^}]*gap:\s*10px/);
    expect(css).toMatch(/\.workbench \.sym-select \{[^}]*color:\s*var\(--act\)/);
  });
});
