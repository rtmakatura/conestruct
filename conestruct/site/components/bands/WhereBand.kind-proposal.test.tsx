// @vitest-environment happy-dom
//
// #284: the proposed kind.  The corridor-geometry answer carries
// `kind_proposal` only when the road leaves exactly one live kind.  The
// chip says "⚠ proposed" (#411) and the backend's reason prints under the
// row until the chip is picked (Ryan, 2026-10-26), but nothing is pressed until a person clicks (Ryan, 2026-10-14: "never
// pre-selected"), and the scenario's kind is the click's, not the
// proposal's (suggest-never-set).

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
import type { Scenario } from "@/lib/scenarios";
import type { CorridorGeometry } from "@/lib/corridor-geometry";

const BASIS =
  "Only shoulder work fits this road: it carries more lanes than a flagger's one each way; " +
  "and it is divided, and near-intersection plans cover undivided roads.";

let proposal: CorridorGeometry["kind_proposal"] = { kind: "shoulder", basis: BASIS };
const sent: Scenario[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  let json: unknown = {};
  if (url.includes("/api/render/corridor-geometry")) {
    sent.push((JSON.parse(String(init?.body ?? "{}")) as { scenario: Scenario }).scenario);
    json = {
      status: "side_not_confirmed",
      pin_model: "work_start",
      pin: null,
      travel_bearing_deg: null,
      work: null,
      approaches: [],
      coverage_ft: null,
      message: null,
      side_options: [],
      ...(proposal ? { kind_proposal: proposal } : {}),
    };
  } else if (url.includes("/api/render/audit")) {
    json = MIN_AUDIT;
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => json } as unknown as Response);
});

beforeEach(() => {
  proposal = { kind: "shoulder", basis: BASIS };
  sent.length = 0;
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

const PINNED = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, ...TEST_PIN, pinModel: "work_start" },
} as unknown as Scenario;

const chip = (k: string) => document.querySelector<HTMLButtonElement>(`[data-testid="kind-chip-${k}"]`)!;

describe("#284: the proposed kind", () => {
  // A passed-in scenario loads as a saved plan, its kind already chosen
  // (GeneratorShell's kindState starts "confirmed").  So the plan here is a
  // FLAGGER plan and the proposal is shoulder: the person's choice stays
  // pressed, and the proposal presses nothing.
  const FLAGGER = { ...PINNED, kind: "flagger_lane_closure" } as unknown as Scenario;

  it("marks the proposed chip and prints the backend's reason, pressing nothing", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={FLAGGER} />);
    await openWhere();
    const mark = await waitFor('[data-testid="kind-proposed-mark"]');
    // #411 (Ryan, 2026-10-26, amending #284): "⚠ proposed", the ⚠ in its
    // rule-18 hue.
    expect(mark?.textContent).toBe(" · ⚠ proposed");
    expect(mark?.querySelector(".sym-warn")?.textContent).toBe("⚠");
    expect(chip("shoulder").contains(mark)).toBe(true);
    const note = document.querySelector('[data-testid="kind-proposal-note"]');
    expect(note?.textContent).toBe(`⚠ proposed: ${BASIS} Pick it to use it.`);
    expect(note?.querySelector(".sym-warn")?.textContent).toBe("⚠");
    expect(chip("shoulder").getAttribute("aria-pressed")).toBe("false");
    expect(chip("flagger_lane_closure").getAttribute("aria-pressed")).toBe("true");
    expect(chip("near_intersection").getAttribute("aria-pressed")).toBe("false");
  });

  it("a click on the proposed chip picks it like any other chip", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={FLAGGER} />);
    await openWhere();
    await waitFor('[data-testid="kind-proposed-mark"]');
    await act(async () => {
      chip("shoulder").click();
    });
    expect(chip("shoulder").getAttribute("aria-pressed")).toBe("true");
    expect(chip("flagger_lane_closure").getAttribute("aria-pressed")).toBe("false");
  });

  // Ryan, 2026-10-26 (#411, amends #284): "Once the operator picks the
  // proposed kind chip, '⚠ proposed' and its note go away, and ● alone
  // says 'chosen'."
  it("once the proposed chip is picked, its '⚠ proposed' and the note go", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={FLAGGER} />);
    await openWhere();
    await waitFor('[data-testid="kind-proposed-mark"]');
    await act(async () => {
      chip("shoulder").click();
    });
    expect(chip("shoulder").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-testid="kind-proposed-mark"]')).toBeNull();
    expect(document.querySelector('[data-testid="kind-proposal-note"]')).toBeNull();
    expect(chip("shoulder").textContent).not.toContain("⚠");
    expect(chip("shoulder").textContent).not.toContain("proposed");
    // Another kind picked: the proposal is unanswered again, so it shows.
    await act(async () => {
      chip("flagger_lane_closure").click();
    });
    expect(chip("shoulder").getAttribute("aria-pressed")).toBe("false");
    expect(
      document.querySelector('[data-testid="kind-proposed-mark"]')?.textContent,
    ).toBe(" · ⚠ proposed");
    expect(document.querySelector('[data-testid="kind-proposal-note"]')).not.toBeNull();
  });

  it("no proposal: no mark, no note, the chips as before", async () => {
    proposal = null;
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED} />);
    await openWhere();
    await waitFor('[data-testid="kind-chip-shoulder"]');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(document.querySelector('[data-testid="kind-proposed-mark"]')).toBeNull();
    expect(document.querySelector('[data-testid="kind-proposal-note"]')).toBeNull();
  });

  it("the proposal never writes the kind: every request carries the scenario's own", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={FLAGGER} />);
    await openWhere();
    await waitFor('[data-testid="kind-proposed-mark"]');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((s) => s.kind === "flagger_lane_closure")).toBe(true);
  });
});
