// @vitest-environment happy-dom
//
// #317 (R129) — a near-intersection plan with no crossing marked.  The
// geometry read answers `intersection_not_marked` with the backend's line;
// the side control shows "⚠ " + that line and Mark on map, and no chips
// (Q1); Mark on map opens the picker ready to mark the crossing.  The
// band's aerial shows the pin with the same line (Q2).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

vi.mock("../AppNav", () => ({ AppNav: () => null }));
vi.mock("../AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("../AppFooter", () => ({ AppFooter: () => null }));
vi.mock("../OutputCards", () => ({ OutputCards: () => null }));
vi.mock("../QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("../LocationPickerModal", () => ({
  LocationPickerModal: (p: { initial?: { armIntersection?: boolean } }) => (
    <div data-testid="picker-open" data-arm={String(Boolean(p.initial?.armIntersection))} />
  ),
}));

import { GeneratorShell } from "../GeneratorShell";
import { openWhere } from "../__fixtures__/band-helpers";
import { MIN_AUDIT, TEST_PIN } from "../test-fixtures";
import { DEFAULT_NEAR_INTERSECTION, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios";
import { aerialStage } from "@/lib/corridor-aerial";
import type { CorridorGeometry } from "@/lib/corridor-geometry";

// render_api.INTERSECTION_NOT_MARKED_MESSAGE, as the read returns it.
const LINE = "Mark the cross street on the map to lay out the sides.";
const RIGHT = {
  work: { side: "right", travel: "with_geometry" },
  label: "West side · southbound traffic",
  built: true,
};

// The read answers by the request, the way the backend does: a
// near-intersection plan with no `meta.intersection` is not marked.
function geometryFor(body: unknown): CorridorGeometry {
  const s = (body as { scenario: Scenario }).scenario;
  const notMarked = s.kind === "near_intersection" && !s.meta.intersection;
  return {
    status: notMarked ? "intersection_not_marked" : "side_not_confirmed",
    pin_model: "work_start",
    pin: null,
    travel_bearing_deg: null,
    work: null,
    approaches: [],
    coverage_ft: null,
    message: notMarked ? LINE : null,
    side_options: [RIGHT],
  } as unknown as CorridorGeometry;
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
});

async function waitFor(sel: string): Promise<HTMLElement | null> {
  const deadline = Date.now() + 3000;
  for (;;) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el || Date.now() > deadline) return el;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
  }
}

const NO_CROSSING = {
  ...DEFAULT_NEAR_INTERSECTION,
  meta: { ...DEFAULT_NEAR_INTERSECTION.meta, ...TEST_PIN, pinModel: "work_start", intersection: undefined },
} as unknown as Scenario;

describe("#317: no crossing marked", () => {
  it("the side control shows the backend's line with ⚠ and Mark on map, and no chips (Q1)", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={NO_CROSSING} />);
    await openWhere();
    const line = await waitFor('[data-testid="side-control-not-marked"]');
    expect(line?.textContent).toBe(`⚠ ${LINE}`);
    expect(document.querySelectorAll('[data-testid="side-option"]')).toHaveLength(0);
    expect(document.querySelector('[data-testid="side-control-note"]')).toBeNull();
    expect(document.body.textContent).not.toContain("the road's sides are unavailable");
    expect(document.querySelector('[data-testid="side-control-mark"]')?.textContent).toBe("Mark on map");
  });

  it("Mark on map opens the picker ready to mark the crossing", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={NO_CROSSING} />);
    await openWhere();
    const mark = await waitFor('[data-testid="side-control-mark"]');
    expect(document.querySelector('[data-testid="picker-open"]')).toBeNull();
    await act(async () => {
      mark!.click();
    });
    expect(document.querySelector('[data-testid="picker-open"]')?.getAttribute("data-arm")).toBe("true");
  });

  it("a plan with its crossing marked, or another kind, shows the chips as today", async () => {
    const marked = {
      ...NO_CROSSING,
      meta: { ...NO_CROSSING.meta, intersection: { lat: TEST_PIN.lat - 0.001, lng: TEST_PIN.lng, name: "E 11th Ave" } },
    } as Scenario;
    for (const s of [marked, { ...DEFAULT_SHOULDER, meta: { ...DEFAULT_SHOULDER.meta, ...TEST_PIN } } as Scenario]) {
      render(<GeneratorShell mode="sandbox" initialScenario={s} />);
      await openWhere();
      expect(await waitFor('[data-testid="side-option"]')).not.toBeNull();
      expect(document.querySelector('[data-testid="side-control-not-marked"]')).toBeNull();
      cleanup();
    }
  });
});

describe("#317: the aerial (Q2)", () => {
  it("asks for the pin picture while the crossing isn't marked", () => {
    expect(aerialStage({ status: "intersection_not_marked" } as CorridorGeometry, true)).toBe("pin");
    expect(aerialStage({ status: "intersection_not_marked" } as CorridorGeometry, false)).toBe("pin");
  });
});
