// @vitest-environment happy-dom
//
// #300 — the WHERE band's side control on a one-way street, mounted.
//
// The backend offers the left curb for shoulder work on a one-way street
// (render_api._side_options under schemas.left_side_built); the control
// renders whatever it offers and writes the option verbatim (Rule 3).
// R119 Q4, #315: a stored left side the backend no longer builds gets the
// backend's one line at the control saying why (`side_refused`, R125); the
// built curbs stay choosable and nothing is reset.

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
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { FlaggerLaneClosureScenario, ShoulderScenario } from "@/lib/scenarios";

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

// #315: the backend's words for a refused left (render_api.SIDE_REFUSAL_MESSAGES
// "not_shoulder"), as the geometry read returns them.
const NOT_SHOULDER =
  "Left-side work is laid out for shoulder work only. Pick a right-side curb, or switch back to Shoulder work.";

// The geometry read answers by the request, the way the backend does (#315's
// acceptance: no options-always mock).  A left side on a scenario whose kind
// isn't shoulder is refused: the read answers the curbs it builds (right
// only) plus `side_refused`.  A shoulder scenario gets `sideOptions`.
function geometryFor(body: unknown) {
  const scenario = (body as { scenario: { kind: string; meta: { work?: { side?: string } } } })
    .scenario;
  const refusedLeft = scenario.kind !== "shoulder" && scenario.meta.work?.side === "left";
  return {
    status: "side_not_confirmed",
    pin_model: "work_start",
    pin: null,
    travel_bearing_deg: null,
    work: null,
    approaches: [],
    coverage_ft: null,
    message: null,
    side_options: refusedLeft ? [RIGHT] : sideOptions,
    ...(refusedLeft
      ? { side_refused: { side: "left", cause: "not_shoulder", message: NOT_SHOULDER } }
      : {}),
  };
}

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const json = url.includes("/api/render/corridor-geometry")
    ? geometryFor(JSON.parse(String(init?.body ?? "{}")))
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

  it("a stored left side the backend refuses shows the built curb and the backend's line; nothing is reset", async () => {
    // #315: the prod repro, a flagger plan still holding the shoulder's left
    // curb.  The line is the backend's `side_refused.message`, behind ⚠.
    const staleLeft: FlaggerLaneClosureScenario = {
      ...DEFAULT_FLAGGER,
      meta: {
        ...DEFAULT_FLAGGER.meta,
        ...TEST_PIN,
        work: { side: "left", travel: "with_geometry" },
      },
    };
    render(<GeneratorShell mode="sandbox" initialScenario={staleLeft} />);
    await openWhere();
    const options = await waitForOptions();
    expect(options.map((o) => o.textContent)).toEqual(["West side · southbound traffic"]);
    expect(options.map((o) => o.getAttribute("aria-checked"))).toEqual(["false"]);
    const line = document.querySelector('[data-testid="side-control-stale"]');
    expect(line?.textContent).toBe(`⚠ ${NOT_SHOULDER}`);
    expect(document.querySelector('[data-testid="side-control-note"]')).toBeNull();
    // Picking the offered curb writes it, and the line goes.
    await act(async () => {
      options[0].click();
    });
    await openWhere();
    await waitForOptions();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    const checked = document.querySelector<HTMLElement>(
      '[data-testid="side-option"][aria-checked="true"]',
    );
    expect(checked?.textContent).toBe("✓ West side · southbound traffic");
    expect(document.querySelector('[data-testid="side-control-stale"]')).toBeNull();
  });

  it("the line is the backend's call: no side_refused, no line, even with a left side stored", async () => {
    // The old frontend predicate (a stored left the options lack) is gone.
    sideOptions = [RIGHT];
    const leftOnShoulder: ShoulderScenario = {
      ...UNSIDED,
      meta: { ...UNSIDED.meta, work: { side: "left", travel: "with_geometry" } },
    };
    render(<GeneratorShell mode="sandbox" initialScenario={leftOnShoulder} />);
    await openWhere();
    await waitForOptions();
    expect(document.querySelector('[data-testid="side-control-stale"]')).toBeNull();
  });
});
