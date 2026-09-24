// @vitest-environment happy-dom
//
// #289 acceptance: "Exactly one band open; the rest fact lines or pending
// lines."  Rule 65: the column renders ONE band open; every other band is
// its collapsed fact line (rule 58) or a pending line.  Asserted mounted,
// through the real shell, at every transition a user can make before
// Generate — and after it, where the column is not mounted at all (S5's
// setup fact line stands for it, rule 119) until a value link re-opens
// it, with exactly one band open again.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";
import auditFull from "./__fixtures__/audit-shoulder-full.json";
import { changeOneThing, openBand, openWhat, openWhere } from "./__fixtures__/band-helpers";

const BREAKDOWN = {
  devices: [],
  total_devices: 42,
  unique_types: 6,
  zone_geometry: { taper_l_ft: 183, buffer_b_ft: 495, device_spacing_ft: 55, work_len_ft: 500 },
};

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  const json = url.includes("/api/render/audit")
    ? auditFull
    : url.includes("/api/render/device-breakdown")
      ? BREAKDOWN
      : {};
  return Promise.resolve({ ok: true, status: 200, json: async () => json } as unknown as Response);
});

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
    await Promise.resolve();
  });
}

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn() as never;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const stack = () => document.querySelector('[data-testid="band-stack"]') as HTMLElement;
/** Open bands in the column: rule 61's shell. */
const openBands = () => Array.from(stack().querySelectorAll("section.a-open"));
/** Collapsed / pending lines in the column: rule 56's fact line. */
const factLines = () => Array.from(stack().querySelectorAll('[data-testid^="fact-"]:not([data-testid^="fact-link-"])'));

/** Rule 65 at one moment: `want` open band(s), and every other band is a
 *  fact or pending line — never neither, never a second open shell. */
function assertColumn(want: 1, label: string) {
  const open = openBands();
  expect(open.length, `${label}: open bands`).toBe(want);
  // No fact line sits INSIDE an open band's shell, and each is done or
  // pending (or locked in flight) — any other state is undeclared.
  for (const f of factLines()) {
    expect(open.some((o) => o.contains(f)), `${label}: ${f.getAttribute("data-testid")} inside an open band`).toBe(false);
    expect(["done", "pending", "locked"], `${label}: ${f.getAttribute("data-testid")}`).toContain(
      f.getAttribute("data-fact-state"),
    );
  }
  expect(factLines().length, `${label}: fact lines`).toBeGreaterThan(0);
  expect(openBand(), `${label}: data-open-band names the open band`).toMatch(/^(where|what)$/);
}

describe("#289 acceptance — exactly one band open, the rest fact or pending lines", () => {
  it("pre-generate, at every transition a user can make", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    assertColumn(1, "first render");
    const first = openBand();

    await openWhere();
    await settle();
    expect(openBand()).toBe("where");
    assertColumn(1, "WHERE re-opened");

    await openWhat();
    await settle();
    expect(openBand()).toBe("what");
    assertColumn(1, "WHAT re-opened");

    await openWhere();
    await settle();
    assertColumn(1, "WHERE again");
    expect(first).not.toBeNull();
  });

  it("post-generate: no band open until a value link re-opens one — then exactly one", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await user.click(screen.getByTestId("generate-plan"));
    await settle();
    // S5: the column is gone — no band open, no stack — and the setup
    // fact line (rule 119) is the one line standing for it.
    expect(document.querySelector('[data-testid="band-stack"]'), "S5: no band stack").toBeNull();
    expect(document.querySelectorAll("section.a-open")).toHaveLength(0);
    expect(screen.getByTestId("fact-setup")).toBeTruthy();

    await changeOneThing("location");
    await settle();
    expect(openBand()).toBe("where");
    assertColumn(1, "S5 → WHERE via the location value");

    await openWhat();
    await settle();
    assertColumn(1, "then WHAT");
  });
});
