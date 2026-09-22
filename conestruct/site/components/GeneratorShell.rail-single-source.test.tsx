// @vitest-environment happy-dom
//
// #221 — the single-source assertion, MOUNTED (rule 11: the claim is
// about two rendered surfaces agreeing, so the test reads both from
// the real shell + sidebar + rail).  The rail's current-blocker string
// and the Generate CTA's disabled-reason must be the same string from
// the same source (lib/scenarios/rail.ts) — asserted as textContent
// equality in two states:
//   * pre-pin: the missing-location reason (rank last by design);
//   * a backend 400 with no affordance: the short decline pointer on
//     the rail's Generate slot (#180: the strip carries the one full
//     voice; neither the CTA nor the rail ever re-states the 400).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";
import { DEFAULT_SCENARIO } from "@/lib/scenarios";

type Deferred = { resolve: (r: Response) => void };
let auditCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    return new Promise<Response>((resolve) => {
      auditCalls.push({ resolve });
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

beforeEach(() => {
  auditCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function ctaReason(): string {
  // The under-Generate alert (GenerateButton renders it only while
  // disabled with a reason).  #228 hardening: selected by its stable
  // hook, not by Tailwind class string.
  const el = document.querySelector('[data-testid="cta-reason"]');
  if (!el) throw new Error("no under-CTA reason alert on screen");
  return (el.textContent ?? "").trim();
}

// #289 Phase 2 — THE RAIL'S SLOT IS GONE; THE STRING IS NOT.
//
// §8.17 replaces the rail, and its Generate slot with it.  What rule 139
// asks for survives and is what this suite now asserts: the blocker chain
// is single-sourced, so its string reaches the surface EXACTLY ONCE and
// that surface is the disabled primary's `cta-reason` alert (#260's one
// live speaker, ruled with a browser leg behind it).  The verdict strip
// keeps carrying the STATE — "AWAITING LOCATION · no site chosen" — and
// not the instruction, which is the same one-voice split #260 ruled.
//
// So "identical on both" becomes "once, and nowhere else": a second
// surface repeating it would now be the defect, where before the rail was
// the sanctioned second.  `deriveRail()` is unchanged and still the one
// derivation — lib/scenarios/rail.test.ts covers it directly.
function blockerOccurrences(text: string): number {
  return ((document.body.textContent ?? "").split(text).length - 1);
}

describe("rail blocker === CTA disabled-reason (one export)", () => {
  it("pre-pin: the missing-location reason renders once, on the CTA", () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    const REASON = "Set a location first — pick on map or enter manually.";
    expect(ctaReason()).toBe(REASON);
    // Once.  The rail used to be the sanctioned second surface; with the
    // rail gone, a second occurrence is a second voice.
    expect(blockerOccurrences(REASON)).toBe(1);
    // And the strip still says the STATE rather than the instruction
    // (#260's split, untouched).
    const strip = document.querySelector(".status-slot .status-bar");
    expect(strip?.textContent).not.toContain(REASON);
  });

  it("a no-affordance 400: the decline pointer rides the CTA, once", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await act(async () => {
      auditCalls[0].resolve({
        ok: false,
        status: 400,
        json: async () => ({ detail: { message: "Backend floor text." } }),
      } as unknown as Response);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(ctaReason()).toBe("Generation declined — see the notice below.");
    expect(
      blockerOccurrences("Generation declined — see the notice below."),
    ).toBe(1);
    // #180 one voice intact: the verbatim 400 renders exactly once
    // (the strip), never beside the button.
    const occurrences =
      (document.body.textContent ?? "").split("Backend floor text.").length - 1;
    expect(occurrences).toBe(1);
  });

  it("all clear: no blocker string anywhere, the primary is enabled", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await act(async () => {
      auditCalls[0].resolve({
        ok: true,
        status: 200,
        json: async () => ({
          summary: {},
          sections: {},
          plan_flags: {
            validation_warnings: 0,
            compliance_fails: 0,
            v1_limitations: 0,
            is_clean: true,
          },
        }),
      } as unknown as Response);
      await Promise.resolve();
      await Promise.resolve();
    });
    // No reason alert at all — GenerateButton renders it only while
    // disabled with a reason.
    expect(document.querySelector('[data-testid="cta-reason"]')).toBeNull();
    const gen = screen.getByRole("button", {
      name: /Generate plan/,
    }) as HTMLButtonElement;
    expect(gen.disabled).toBe(false);
  });
});
