// @vitest-environment happy-dom
//
// #289 acceptance: "Every collapse/re-open lands counted; Zone 1/2 focus
// targets re-homed."  Ruling 184: every change of which band is open is a
// collapse and a re-open, and every one of them LANDS — BandStack scrolls
// the opened band into view, arms the same landing check the Generate
// settle uses (lib/landing.ts armLandingCheck), and focuses it (rule 33).
// The first render is not a transition and does not move the page (P1).
//
// "Counted": one landing per transition, on the band that opened —
// never zero (a re-open that does not land) and never two (a landing
// fired twice moves the page twice).  The count is read off the real
// function, wrapped, not a stub.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const armed: HTMLElement[] = [];
vi.mock("@/lib/landing", async () => {
  const real = await vi.importActual<typeof import("@/lib/landing")>("@/lib/landing");
  return {
    ...real,
    armLandingCheck: (el: HTMLElement, behavior: ScrollBehavior) => {
      armed.push(el);
      return real.armLandingCheck(el, behavior);
    },
  };
});

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

const scrolled: Element[] = [];
beforeEach(() => {
  armed.length = 0;
  scrolled.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  } as never;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The open band's landing target: the element BandStack scrolls to. */
const openShell = () => document.querySelector('[data-testid="band-stack"] section.a-open')!;

describe("#289 acceptance — every collapse / re-open lands, counted", () => {
  it("the first render lands nothing; each transition lands exactly once, on the band it opened, and focuses it", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    // S1/S3 on arrival is not a transition (P1): no scroll, no landing.
    expect(armed).toHaveLength(0);
    expect(scrolled.filter((e) => e.closest('[data-testid="band-stack"]'))).toHaveLength(0);

    const transitions: Array<[() => Promise<void>, string]> = [
      [openWhere, "where"],
      [openWhat, "what"],
      [openWhere, "where"],
    ];
    let n = 0;
    for (const [go, want] of transitions) {
      const before = armed.length;
      await go();
      await settle();
      n += 1;
      expect(openBand(), `transition ${n}`).toBe(want);
      // Counted: exactly one landing for this transition...
      expect(armed.length - before, `transition ${n}: landings`).toBe(1);
      const target = armed.at(-1)!;
      // ...on the band that opened — the same element it scrolled to, and
      // the element that now holds focus (rule 33).
      expect(openShell().contains(target) || target.contains(openShell()), `transition ${n}: target`).toBe(true);
      expect(scrolled.at(-1), `transition ${n}: scrolled to the target`).toBe(target);
      expect(document.activeElement, `transition ${n}: focus`).toBe(target);
    }
    // Three transitions, three landings — none dropped, none doubled.
    expect(armed).toHaveLength(3);
  });

  // "Zone 1/2 focus targets re-homed" (rule 33: "one on the band stack,
  // one on the results stack, both tabIndex −1, never in the tab order").
  it("focus is re-homed: Generate lands on the results stack; a value link lands back in the column — both tabIndex −1", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();

    await user.click(screen.getByTestId("generate-plan"));
    await settle();
    const results = document.activeElement as HTMLElement;
    expect(results.tagName, "Generate focuses the results stack").toBe("SECTION");
    expect(results.getAttribute("tabindex")).toBe("-1");
    expect(results.contains(screen.getByTestId("fact-setup")), "the results stack holds the setup line").toBe(true);

    await changeOneThing("location");
    await settle();
    const column = document.activeElement as HTMLElement;
    expect(column.getAttribute("tabindex"), "the re-open's focus target").toBe("-1");
    expect(
      column.closest('[data-testid="band-stack"]') ?? column.querySelector('[data-testid="band-stack"]'),
      "focus is in (or is) the column",
    ).not.toBeNull();
    expect(results.contains(column)).toBe(false);
  });
});
