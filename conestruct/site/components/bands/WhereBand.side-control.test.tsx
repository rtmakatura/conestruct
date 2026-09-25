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
