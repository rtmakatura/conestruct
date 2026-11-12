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
// guess keeps "⚠ from the pin".
//
// Round 4 (Ryan, 2026-10-29, #425 ruling 3): "not checked" only when no
// check ran; a check that ran and failed (5xx, network) reads "check
// failed", no red: a ◌ marker, chromaless (Rule 13: no verdict), and a
// pin guess keeps "⚠ from the pin" with the failed line in its details.

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
import { whyTip } from "./__fixtures__/what-section";

const PICKED: Scenario = { ...PINNED_SHOULDER, jurisdiction_key: "parker" } as Scenario;
// #517 ruling 7: the hours result shows under set dates only, so the
// suites that read the windows line give the plan a date (8:00-16:00 on a
// weekday, as the class-stability suite does).
const PICKED_DATED: Scenario = {
  ...PICKED,
  schedule: { date_mode: "single", work_date: "2026-10-07", start_time: 8, end_time: 16 },
} as Scenario;
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

// #517 (ruling 5, S4, S13): the row's source line ("Set by you", or the
// guess's reason in the box) is one button with its glyph and tone; the
// check's status is a sentence of the why tip.
const line = () => screen.getByTestId("prov-jurisdiction");
const toggle = () => screen.getByTestId("info-toggle-jurisdiction");
const details = () => screen.getByTestId("info-jurisdiction");
const state = () =>
  document.getElementById("what-jurisdiction")?.getAttribute("data-jurisdiction-state");
const windowsLine = () => screen.getByTestId("what-windows-line").textContent;

const DECLINED_LINE = "Not checked: the plan was declined. The option shown stands.";
const FAILED_LINE = "The check didn't answer. The option shown stands.";

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
    await mountAndAnswer(PICKED_DATED, declined400);
    expect(state()).toBe("declined");
    expect(whyTip("jurisdiction")).toContain(DECLINED_LINE);
    expect(details().textContent).not.toContain("didn't answer");
    // One verb in the band (#425): the hours result under the dates.
    expect(windowsLine()).toBe("Not checked: the plan was declined.");
  });

  it("is not an error: no is-error, and the line sits behind a ◌ marker (Rule 13: glyph and word)", async () => {
    await mountAndAnswer(PICKED, declined400);
    // The operator's pick: "Set by you", chromaless (no verdict, Rule 13),
    // never an error tone or an error line.
    expect(line().textContent).toBe("Set by you");
    expect(toggle().classList.contains("is-plain")).toBe(true);
    expect(toggle().classList.contains("is-guess")).toBe(false);
    expect(screen.queryByTestId("error-jurisdiction")).toBeNull();
    // R98: the status is one click away, in the row's why tip.
    expect(details().textContent).toContain(DECLINED_LINE);
  });

  it("a pin guess keeps '⚠ from the pin', with the decline in its details", async () => {
    await mountAndAnswer(GUESSED, declined400);
    expect(state()).toBe("declined");
    // #517 (ruling 2, S13): the guess keeps its ⚠ and its reason line.
    expect(toggle().textContent).toContain("⚠");
    expect(line().textContent).toBe("Based on where your pin is");
    expect(toggle().classList.contains("is-guess")).toBe(true);
    expect(screen.queryByTestId("error-jurisdiction")).toBeNull();
    expect(details().textContent).toContain(DECLINED_LINE);
    // (The pin lookup's own evidence may say the boundary check failed;
    // answer; that is a different check, so only the cell's words count.)
    expect(details().textContent).not.toContain(FAILED_LINE);
  });
});

describe("#425 round 4 — a check that ran and failed reads \"check failed\", no red", () => {
  it("says check failed behind a ◌ marker, not red, and the windows line says the same", async () => {
    await mountAndAnswer(PICKED_DATED, failed500);
    expect(state()).toBe("check-failed");
    expect(whyTip("jurisdiction")).toContain(FAILED_LINE);
    expect(details().textContent).not.toContain("Not checked");
    expect(line().textContent).toBe("Set by you");
    expect(toggle().classList.contains("is-plain")).toBe(true);
    expect(toggle().classList.contains("is-guess")).toBe(false);
    expect(screen.queryByTestId("error-jurisdiction")).toBeNull();
    expect(windowsLine()).toBe("Check failed: the check didn't answer.");
  });

  it("a pin guess keeps '⚠ from the pin', with the failed check in its details", async () => {
    await mountAndAnswer(GUESSED, failed500);
    expect(state()).toBe("check-failed");
    // #517 (ruling 2, S13): the guess keeps its ⚠ and its reason line.
    expect(toggle().textContent).toContain("⚠");
    expect(line().textContent).toBe("Based on where your pin is");
    expect(toggle().classList.contains("is-guess")).toBe(true);
    expect(screen.queryByTestId("error-jurisdiction")).toBeNull();
    expect(details().textContent).toContain(FAILED_LINE);
    expect(details().textContent).not.toContain(DECLINED_LINE);
  });

  it("a decline still reads not checked, never check failed", async () => {
    await mountAndAnswer(PICKED_DATED, declined400);
    expect(details().textContent).not.toContain(FAILED_LINE);
    expect(windowsLine()).not.toContain("Check failed");
  });
});
