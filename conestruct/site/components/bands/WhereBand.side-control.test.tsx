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

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
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
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
    expect(options.map((o) => o.textContent)).toEqual(["West side · southbound traffic"]);
    const control = document.querySelector('[data-testid="side-control"]');
    expect(control?.textContent).not.toContain("not built");
    expect(control?.textContent).not.toContain("median");
    expect(control?.textContent).not.toContain("East side");
  });
});

// Item 3: "The side control's selected state takes rule 135's chip
// treatment — accent border, the wash, a ✓ — so the choice is visible.
// Fix the spacing between options."
describe("the chosen side is visible, and the options are spaced", () => {
  it("clicking a side checks it: aria-checked, a leading ✓, the kind chip's class", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    const [option] = await waitForOptions();
    expect(option.className).toBe("a-chip a-chip-side");
    expect(option.getAttribute("aria-checked")).toBe("false");
    expect(option.textContent).not.toContain("✓");
    await act(async () => {
      option.click();
    });
    // RULE 5, stated (the kind-before-side fix): this plan's kind is
    // already confirmed, so the side was the last WHERE answer owed and
    // the column moves on to WHAT (deriveBands' `natural`).  Re-open WHERE
    // the way a person does to see the choice.
    expect(
      document.querySelector('[data-testid="band-stack"]')?.getAttribute("data-open-band"),
    ).toBe("what");
    await openWhere();
    await waitForOptions();
    const checked = document.querySelector<HTMLElement>(
      '[data-testid="side-option"][aria-checked="true"]',
    );
    expect(checked?.textContent).toBe("✓ West side · southbound traffic");
    // The glyph is decoration; aria-checked is what is announced.
    expect(checked?.querySelector(".a-chip-check")?.getAttribute("aria-hidden")).toBe("true");
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
    expect(css).toMatch(/\.workbench \.a-chip-check \{[^}]*color:\s*var\(--act\)/);
  });
});
