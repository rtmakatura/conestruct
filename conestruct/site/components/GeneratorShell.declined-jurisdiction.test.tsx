// @vitest-environment happy-dom
//
// #425 / #406 — the Jurisdiction cell on a declined plan, MOUNTED (Rule
// 11: the decline/failure split lives in the shell's breakdown state, so
// the test drives the shell's own audit fetch and reads the rendered
// cell).
//
// Cause: `jurisdictionCellState` mapped every breakdown error, a 400
// decline included, to "not-evaluated", so a declined plan's cell read
// "the check didn't answer" in error red with its marker dropped.  A
// decline is an answer (Rule 10): the cell now says the plan was
// declined, in the windows line's words, with the ◌ marker, and a pin
// guess keeps "⚠ from the pin".  A failed check that isn't a decline
// keeps its red, on-show line, with the same verb.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";
import type { Scenario } from "@/lib/scenarios";

const PICKED: Scenario = { ...PINNED_SHOULDER, jurisdiction_key: "parker" } as Scenario;
// R108: a jurisdiction guessed at the plan's own pin.
const GUESSED: Scenario = {
  ...PICKED,
  guesses: {
    jurisdiction_key: { lat: PINNED_SHOULDER.meta.lat, lng: PINNED_SHOULDER.meta.lng },
  },
} as Scenario;

type Deferred = { resolve: (r: Response) => void };
let auditCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    return new Promise<Response>((resolve) => auditCalls.push({ resolve }));
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as unknown as Response);
});

const declined400 = () =>
  ({
    ok: false,
    status: 400,
    json: async () => ({ detail: { message: "Detection saw a one-way street.", error: "one_way" } }),
  }) as unknown as Response;
const failed500 = () =>
  ({
    ok: false,
    status: 500,
    json: async () => ({ detail: "render failed: boom" }),
  }) as unknown as Response;

async function settle(ms = 400) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
async function answer(i: number, r: Response) {
  await act(async () => {
    auditCalls[i].resolve(r);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mountAndAnswer(initial: Scenario, r: () => Response) {
  render(<GeneratorShell mode="sandbox" initialScenario={initial} />);
  await settle();
  expect(auditCalls.length, "the shell asked for the audit").toBeGreaterThan(0);
  await answer(auditCalls.length - 1, r());
  await settle();
}

const line = () => screen.getByTestId("prov-jurisdiction");
const toggle = () => screen.queryByTestId("info-toggle-jurisdiction");
// The row's marker, when it has one (FieldCell renders it as `.a-mark`).
const marker = () => {
  const t = toggle();
  return t && t.classList.contains("a-mark") ? t : null;
};
const details = () => screen.getByTestId("info-jurisdiction");
const state = () =>
  document.getElementById("what-jurisdiction")?.getAttribute("data-jurisdiction-state");
const windowsLine = () => screen.getByTestId("what-windows-line").textContent;

const DECLINED_LINE = "not checked: the plan was declined; the option shown stands";
const FAILED_LINE = "not checked: the check didn't answer; the option shown stands";

beforeEach(() => {
  auditCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = function () {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("#425 / #406 — a declined plan's Jurisdiction cell", () => {
  it("says the plan was declined, not that the check didn't answer, in the windows line's words", async () => {
    await mountAndAnswer(PICKED, declined400);
    expect(state()).toBe("declined");
    expect(line().textContent).toBe(DECLINED_LINE);
    expect(line().textContent).not.toContain("didn't answer");
    // One verb in the band (#425): the windows line beside it.
    expect(windowsLine()).toBe("Windows · not checked: the plan was declined");
  });

  it("is not an error: no is-error, and the line sits behind a ◌ marker (Rule 13: glyph and word)", async () => {
    await mountAndAnswer(PICKED, declined400);
    expect(line().classList.contains("is-error")).toBe(false);
    expect(line().classList.contains("is-amber")).toBe(false);
    const m = marker();
    expect(m, "the row has a marker").not.toBeNull();
    expect(m!.textContent).toBe("◌ not checked");
    expect(m!.classList.contains("is-pending")).toBe(true);
    // R98: the line is one click away, in the row's details.
    expect(line().closest('[data-testid="info-jurisdiction"]')).not.toBeNull();
  });

  it("a pin guess keeps '⚠ from the pin', with the decline in its details", async () => {
    await mountAndAnswer(GUESSED, declined400);
    expect(state()).toBe("declined");
    const m = marker();
    expect(m, "the guess keeps its marker").not.toBeNull();
    expect(m!.textContent).toBe("⚠ from the pin");
    expect(line().textContent).toBe("⚠ guessed, not confirmed · from the pin");
    expect(line().classList.contains("is-error")).toBe(false);
    expect(line().classList.contains("is-amber")).toBe(true);
    expect(details().textContent).toContain(DECLINED_LINE);
    // (The pin lookup's own evidence may say the boundary lookup didn't
    // answer; that is a different check, so only the cell's words count.)
    expect(details().textContent).not.toContain("the check didn't answer");
  });
});

describe("#425 / #406 — a check that failed without a decline", () => {
  it("still says the check didn't answer, red and on show, with the band's one verb", async () => {
    await mountAndAnswer(PICKED, failed500);
    expect(state()).toBe("not-evaluated");
    expect(line().textContent).toBe(FAILED_LINE);
    expect(line().classList.contains("is-error")).toBe(true);
    expect(marker(), "an error stays a full line (P3)").toBeNull();
    expect(line().closest('[data-testid="info-jurisdiction"]')).toBeNull();
    expect(windowsLine()).toBe("Windows · not checked: the check didn't answer");
  });

  it("wins over a pin guess (P3, unchanged)", async () => {
    await mountAndAnswer(GUESSED, failed500);
    expect(line().textContent).toBe(FAILED_LINE);
    expect(line().classList.contains("is-error")).toBe(true);
    expect(marker()).toBeNull();
  });
});
