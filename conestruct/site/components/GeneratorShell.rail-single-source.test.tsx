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
  // disabled with a reason).
  const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
  const el = alerts.find((a) =>
    a.className.includes("text-[color:var(--fail)]"),
  );
  if (!el) throw new Error("no under-CTA reason alert on screen");
  return (el.textContent ?? "").trim();
}

function railBlocker(): string {
  const el = document.querySelector(".progress-rail .rail-blocker");
  if (!el) throw new Error("no rail blocker string on screen");
  return (el.textContent ?? "").trim();
}

describe("rail blocker === CTA disabled-reason (one export)", () => {
  it("pre-pin: the missing-location reason renders identically on both", () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    expect(railBlocker()).toBe(ctaReason());
    expect(railBlocker()).toBe(
      "Set a location first — pick on map or enter manually.",
    );
    // The rail marks Location as the current blocker.
    const loc = screen.getByRole("button", { name: /Location — needs attention/ });
    expect(loc.className).toContain("current");
  });

  it("a no-affordance 400: the decline pointer rides the rail's Generate slot and the CTA equally", async () => {
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
    expect(railBlocker()).toBe(ctaReason());
    expect(railBlocker()).toBe("Generation declined — see the notice below.");
    const gen = screen.getByRole("button", { name: /Generate — blocked:/ });
    expect(gen.querySelector(".rail-blocker")).not.toBeNull();
    // #180 one voice intact: the verbatim 400 renders exactly once
    // (the strip), never on the rail.
    const occurrences =
      (document.body.textContent ?? "").split("Backend floor text.").length - 1;
    expect(occurrences).toBe(1);
  });

  it("all clear: no blocker string anywhere, Generate slot reads ready", async () => {
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
    expect(document.querySelector(".progress-rail .rail-blocker")).toBeNull();
    screen.getByRole("button", { name: "Generate — ready" });
  });
});
