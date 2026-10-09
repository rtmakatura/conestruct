// @vitest-environment happy-dom
//
// #300 — the WHERE band's side control on a one-way street, mounted.
//
// The backend offers the left curb for shoulder work on a one-way street
// (render_api._side_options under schemas.left_side_built); the control
// renders whatever it offers and writes the option verbatim (Rule 3).
// R119 Q4: a stored left side the backend no longer offers gets one line
// at the control saying why; nothing is reset.

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

const RIGHT = {
  work: { side: "right", travel: "with_geometry" },
  label: "West side · southbound traffic",
  built: true,
};
const LEFT = {
  work: { side: "left", travel: "with_geometry" },
  label: "East side · southbound traffic",
  built: true,
};

let sideOptions: unknown[] = [RIGHT, LEFT];

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
        side_options: sideOptions,
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
  sideOptions = [RIGHT, LEFT];
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

const UNSIDED: ShoulderScenario = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, ...TEST_PIN },
};

describe("#300: the side control on a one-way street", () => {
  it("renders both curbs the backend offers, and the left one is choosable", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={UNSIDED} />);
    await openWhere();
    const options = await waitForOptions();
    expect(options.map((o) => o.textContent)).toEqual([
      "West side · southbound traffic",
      "East side · southbound traffic",
    ]);
    await act(async () => {
      options[1].click();
    });
    // The side was the last WHERE answer owed, so the column moves on to
    // WHAT; re-open WHERE to read the choice (as the #290 suite does).
    await openWhere();
    await waitForOptions();
    const checked = document.querySelector<HTMLElement>(
      '[data-testid="side-option"][aria-checked="true"]',
    );
    expect(checked?.textContent).toBe("✓ East side · southbound traffic");
    expect(document.querySelector('[data-testid="side-control-stale"]')).toBeNull();
  });

  it("a stored left side the backend no longer offers says why, and nothing is reset", async () => {
    sideOptions = [RIGHT];
    const staleLeft: ShoulderScenario = {
      ...UNSIDED,
      meta: { ...UNSIDED.meta, work: { side: "left", travel: "with_geometry" } },
    };
    render(<GeneratorShell mode="sandbox" initialScenario={staleLeft} />);
    await openWhere();
    const options = await waitForOptions();
    expect(options.map((o) => o.getAttribute("aria-checked"))).toEqual(["false"]);
    const line = document.querySelector('[data-testid="side-control-stale"]');
    expect(line?.textContent).toBe(
      "The left curb is offered only for shoulder work on a one-way street. Choose a side.",
    );
  });
});
