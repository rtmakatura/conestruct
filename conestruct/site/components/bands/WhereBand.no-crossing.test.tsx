// @vitest-environment happy-dom
//
// #317 (R129) — a near-intersection plan with no crossing marked.  The
// geometry read answers `intersection_not_marked` with the backend's line.
//
// #440 (Rule 5, stated; rulings 2 and 7, X2): the side options never read
// the crossing, so the side question shows its choices while it is
// unmarked, and the not-marked line and its Mark on map leave the band
// (the question card and the aerial).  The crossing is the CONFIRM card's
// third question; its "Use the big map instead" is the picker, armed.
// The line stays on the wire for the ledger and the rail (unchanged).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

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
import { deriveMoveLedger } from "@/lib/scenarios/move-ledger";
import { deriveRail, SIDE_BLOCKER } from "@/lib/scenarios/rail";
import type { CorridorGeometry } from "@/lib/corridor-geometry";
import { SIDES_FAILED } from "./WhereQuestions";

// render_api.INTERSECTION_NOT_MARKED_MESSAGE, as the read returns it.
const LINE = "Mark the cross street on the map to lay out the sides.";
const RIGHT = {
  work: { side: "right", travel: "with_geometry" },
  label: "West side · southbound traffic",
  built: true,
};
// #507 ruling 3: a lone side is picked for you, which would answer the
// side these tests keep open; a two-way street offers both curbs.
const EAST = {
  work: { side: "right", travel: "against_geometry" },
  label: "East side · northbound traffic",
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
    side_options: [RIGHT, EAST],
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
  it("#440 X2/X20: the cross street is asked before the side; the side still shows its choices while the crossing is unmarked, and no not-marked line", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={NO_CROSSING} />);
    await openWhere();
    // Ruling 2: the card is on the cross street, the side listed after it.
    expect(await waitFor('[data-testid="step-next-side"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="where-questions"]')!.textContent).toContain(
      "Which intersection is the work near?",
    );
    await act(async () => {
      fireEvent.click(document.querySelector('[data-testid="step-next-side"]')!);
    });
    expect(await waitFor('[data-testid="side-option"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-testid="side-option"]')).toHaveLength(2);
    expect(document.querySelector('[data-testid="side-control-not-marked"]')).toBeNull();
    expect(document.querySelector('[data-testid="side-control-mark"]')).toBeNull();
    expect(document.querySelector('[data-testid="side-control-note"]')).toBeNull();
    expect(document.body.textContent).not.toContain(SIDES_FAILED);
    // Not on the card, not on the aerial; the rail keeps it (unchanged).
    expect(document.querySelector('[data-testid="where-questions"]')!.textContent).not.toContain(LINE);
    expect(document.querySelector('[data-testid="band-aerial"]')!.textContent).not.toContain(LINE);
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

describe("R131: one voice — WHERE's side row reads the side control's line", () => {
  // #439: the ledger's side row left the band (the CONFIRM card asks the
  // side).  #440 ruling 7: the not-marked line left the card and the
  // aerial too; the band says neither it nor the side sentence.
  it("the band shows neither the not-marked line nor a side sentence", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={NO_CROSSING} />);
    await openWhere();
    // #440 ruling 2: the side is listed after the cross street; bring it
    // on screen once the road's sides are read.
    expect(await waitFor('[data-testid="step-next-side"]')).not.toBeNull();
    await act(async () => {
      fireEvent.click(document.querySelector('[data-testid="step-next-side"]')!);
    });
    expect(await waitFor('[data-testid="side-option"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="move-side"]')).toBeNull();
    const card = document.querySelector('[data-testid="where-questions"]')!;
    expect(card.textContent).not.toContain(LINE);
    expect(document.body.textContent).not.toContain(SIDE_BLOCKER);
  });

  it("the ledger: a stored side doesn't answer the row while the crossing isn't marked", () => {
    const sided = {
      ...NO_CROSSING,
      meta: { ...NO_CROSSING.meta, work: { side: "right", travel: "with_geometry" } },
    } as Scenario;
    const row = deriveMoveLedger(sided, null, true, "West side · southbound traffic", LINE).rows.find(
      (r) => r.id === "side",
    )!;
    expect(row.state).toBe("attention");
    expect(row.value).toBeNull();
    expect(row.subline).toBe(LINE);
    const marked = deriveMoveLedger(sided, null, true, "West side · southbound traffic", null).rows.find(
      (r) => r.id === "side",
    )!;
    expect(marked.state).toBe("done");
    expect(marked.subline).toBeNull();
  });

  it("the rail's side rank is the same line, side stored or not; without it, the side sentence as before", () => {
    const base = { approachConfirm: { pending: false, reason: null }, refusal: null, refusalPending: false };
    const sided = {
      ...NO_CROSSING,
      meta: { ...NO_CROSSING.meta, work: { side: "right", travel: "with_geometry" } },
    } as Scenario;
    for (const s of [NO_CROSSING, sided]) {
      expect(deriveRail({ ...base, scenario: s, notMarkedLine: LINE }).blocker?.message).toBe(LINE);
    }
    expect(deriveRail({ ...base, scenario: NO_CROSSING }).blocker?.message).toBe(SIDE_BLOCKER);
  });
});

describe("#317: the aerial (Q2)", () => {
  it("asks for the pin picture while the crossing isn't marked", () => {
    expect(aerialStage({ status: "intersection_not_marked" } as CorridorGeometry, true)).toBe("pin");
    expect(aerialStage({ status: "intersection_not_marked" } as CorridorGeometry, false)).toBe("pin");
  });
});
