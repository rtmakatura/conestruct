// @vitest-environment happy-dom
//
// #439 (UX group 3, Option B) — the WHERE band after a pin: the done
// summary row (ruling 3), its Edit fold (W9) and Details (ruling 2), the
// CONFIRM card's Undo on each question (W6), the gated-kinds line (ruling 6,
// W5) and the side's two lines (ruling 5, W2).
//
// Authority: validation-artifacts/committed/ux-group3-where/rulings.md.
// Rule 11: the summary, the fold and Undo are asserted on the mounted shell
// (what the operator sees and what reaches the wire); the two string
// helpers are asserted where the strings are made.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { MIN_AUDIT, PINNED_SHOULDER, corridorGeometryResponse } from "./test-fixtures";
import { openBand, openWhere } from "./__fixtures__/band-helpers";
import { gatedKindsLine, sideLines } from "./bands/WhereQuestions";
import { summaryParts } from "./bands/WhereBand";
import { SCENARIO_KINDS, isScenarioKindEnabled } from "@/lib/scenarios";
import { clearWorkLen, setWorkLen } from "@/lib/scenarios/what-writes";
import type { Scenario } from "@/lib/scenarios";

type Call = { url: string; body: Record<string, unknown> };
let calls: Call[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(String(init?.body ?? "{}"));
  } catch {
    body = {};
  }
  calls.push({ url, body });
  if (url.includes("/api/render/corridor-geometry")) return Promise.resolve(corridorGeometryResponse());
  const json = url.includes("/api/render/audit") ? MIN_AUDIT : {};
  return Promise.resolve({ ok: true, status: 200, json: async () => json } as unknown as Response);
});

beforeEach(() => {
  calls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn() as never;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
    await Promise.resolve();
  });
}

async function mountWhere(s: Scenario = PINNED_SHOULDER) {
  render(<GeneratorShell mode="sandbox" initialScenario={s} />);
  await settle();
  await openWhere();
  await settle();
}

const records = () =>
  Array.from(
    document.querySelectorAll('[data-testid="where-questions"] .nyq-answered .nyq-row-text'),
  ).map((r) => r.textContent);
const card = () => document.querySelector('[data-testid="where-questions"] .nyq-card');
const generateBtn = () =>
  screen.getByRole("button", { name: /Generate plan/ }) as HTMLButtonElement;

describe("#439 ruling 5 / W2 — the side's two lines are the backend's words, split", () => {
  it("a bound label: line 2 is 'Next to <bound> traffic'", () => {
    expect(sideLines("North side · westbound traffic")).toEqual({
      line1: "North side",
      line2: "Next to westbound traffic",
    });
  });
  it("the no-road heading form shows its second part as written, capitalised", () => {
    expect(sideLines("East side · traffic heads north")).toEqual({
      line1: "East side",
      line2: "Traffic heads north",
    });
  });
  it("a label with no ' · ' shows whole on line 1", () => {
    expect(sideLines("Right side")).toEqual({ line1: "Right side", line2: null });
  });
});

describe("#439 ruling 6 / W5 — the gated-kinds line", () => {
  it("counts from the same table as the rows; none gated prints nothing", () => {
    expect(gatedKindsLine(0)).toBeNull();
    expect(gatedKindsLine(1)).toBe(
      "1 more kind is coming once it is checked against its standard sheet.",
    );
    expect(gatedKindsLine(4)).toBe(
      "4 more kinds are coming once each is checked against its standard sheet.",
    );
  });

  it("the card prints the table's count under the kind's rows", async () => {
    await mountWhere();
    // Bring the kind's question on screen through its answered record.
    const kindRecord = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-testid="where-questions"] .nyq-answered .nyq-row-btn'),
    ).find((b) => b.textContent?.includes("What kind of work"))!;
    await act(async () => {
      fireEvent.click(kindRecord);
    });
    const gated = SCENARIO_KINDS.length - SCENARIO_KINDS.filter((k) => isScenarioKindEnabled(k.v)).length;
    expect(screen.getByTestId("kind-gate-note").textContent).toBe(gatedKindsLine(gated));
    // The three plain labels (ruling 6), the sheet references behind Details.
    const labels = Array.from(card()!.querySelectorAll(".nyq-label")).map((l) => l.textContent);
    expect(labels).toEqual([
      "Shoulder work",
      "Lane closure with flaggers",
      "Lane closure near an intersection",
    ]);
    const details = card()!.querySelector<HTMLElement>(".nyq-details")!;
    expect(details.hidden).toBe(true);
    expect(details.textContent).toContain("Shoulder work: TA-3/TA-5 · S-630-1");
  });
});

describe("#439 ruling 3 — the done summary row", () => {
  it("summaryParts prints only what is done: an unset length is not printed", () => {
    const set = summaryParts(setWorkLen(PINNED_SHOULDER, 1200), "200 ft north of Clarkson St");
    expect(set).toEqual(["starts 200 ft north of Clarkson St", "1,200 ft"]);
    expect(summaryParts(clearWorkLen(PINNED_SHOULDER), null)).toEqual([]);
  });

  it("the starting length says '(default)', and only then", () => {
    const parts = summaryParts(PINNED_SHOULDER, null);
    expect(parts).toEqual([
      `${PINNED_SHOULDER.workLen.toLocaleString("en-US")} ft (default)`,
    ]);
  });

  it("mounted: one ✓ row with the values; Edit and Details closed", async () => {
    await mountWhere();
    expect(openBand()).toBe("where");
    const row = screen.getByTestId("where-summary");
    expect(row.textContent).toContain("✓");
    expect(screen.getByTestId("where-summary-text").textContent).toBe(
      summaryParts(PINNED_SHOULDER, null).join(" · "),
    );
    const edit = screen.getByTestId("where-edit");
    expect(edit.textContent).toBe("Edit");
    expect(edit.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("where-edit-fold").hidden).toBe(true);
    expect(screen.getByTestId("where-details").getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("where-provenance").hidden).toBe(true);
  });
});

describe("#439 W9 — the Edit fold", () => {
  it("Edit opens today's rows in place, with the address and work-zone length fields", async () => {
    await mountWhere();
    const edit = screen.getByTestId("where-edit");
    await act(async () => {
      fireEvent.click(edit);
    });
    expect(edit.getAttribute("aria-expanded")).toBe("true");
    const fold = screen.getByTestId("where-edit-fold");
    expect(fold.hidden).toBe(false);
    expect(fold.querySelector('input[aria-label="Address or cross streets"]')).toBeTruthy();
    expect(fold.querySelector("#band-worklen")).toBeTruthy();
    for (const id of ["spot", "start", "extent"]) {
      expect(fold.querySelector(`[data-testid="move-${id}"]`), id).toBeTruthy();
    }
    // Pressed again, it closes.
    await act(async () => {
      fireEvent.click(edit);
    });
    expect(fold.hidden).toBe(true);
  });

  it("the fold opens by itself while the length is unset (an open item keeps its control on screen)", async () => {
    await mountWhere(clearWorkLen(PINNED_SHOULDER));
    expect(screen.getByTestId("where-edit").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("where-edit-fold").hidden).toBe(false);
  });
});

describe("#439 W6 — Undo returns a question to unanswered and writes nothing in its place", () => {
  it("kind Undo: the kind is unchosen, its question re-opens, Generate waits on it", async () => {
    await mountWhere();
    expect(records()).toEqual([
      "Which side of the road is the work on: East side",
      "What kind of work is it: Shoulder work",
    ]);
    expect(generateBtn().disabled).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByTestId("step-undo-kind"));
    });
    await settle();
    expect(card()?.getAttribute("data-flag")).toBe("kind");
    const checked = Array.from(
      document.querySelectorAll<HTMLInputElement>('[data-testid^="kind-chip-"]'),
    ).filter((r) => r.checked);
    expect(checked).toEqual([]);
    expect(records()).toEqual(["Which side of the road is the work on: East side"]);
    expect(generateBtn().disabled).toBe(true);
    expect(
      document.querySelector('[data-testid="fact-what"]')?.getAttribute("data-fact-state"),
    ).toBe("pending");
  });

  it("side Undo, PAYLOAD: no check after it carries a side", async () => {
    await mountWhere();
    await act(async () => {
      fireEvent.click(screen.getByTestId("step-undo-side"));
    });
    await settle();
    expect(card()?.getAttribute("data-flag")).toBe("side");
    expect(
      Array.from(document.querySelectorAll<HTMLInputElement>('[data-testid="side-option"]')).filter(
        (r) => r.checked,
      ),
    ).toEqual([]);
    expect(generateBtn().disabled).toBe(true);
    calls = [];
    await settle();
    const checks = calls.filter(
      (c) => c.url.includes("/api/render/audit") || c.url.includes("/api/render/device-breakdown"),
    );
    expect(checks).toEqual([]);
  });
});
