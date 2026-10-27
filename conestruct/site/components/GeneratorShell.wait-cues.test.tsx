// @vitest-environment happy-dom
//
// #398 — two wait cues that never ended, MOUNTED (Rule 11: the stale
// state lives in the shell's derivations, not in a component).
//
// W4: "◌ previous answer, refreshing…" stayed under the download cards
// after Generate settled.  Cause (confirmed): `fetchDeferred` compared
// the debounced WIRE scenario against the live `scenario`.  Since #224
// phase 2 the wire scenario is a different object once generated
// (`withSiteScan`), so the comparison never matched again and a held
// jurisdiction block read as revalidating forever.  The cue showed only
// on a plan with a jurisdiction, which is why the older #187 test (no
// jurisdiction) never saw it.
//
// W5: "Windows · ◌ loading" stayed up on a declined plan.  A declined
// audit sends no breakdown, so no jurisdiction block ever arrives; the
// line now says the windows weren't checked and why (Rule 10).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import demo from "./__fixtures__/jurisdiction-demo.json";
import auditFull from "./__fixtures__/audit-shoulder-full.json";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";
import type { Scenario } from "@/lib/scenarios";

const parker = (demo as { jurisdictions: Record<string, unknown> })
  .jurisdictions.parker as JurisdictionBlock;

const WITH_PARKER: Scenario = { ...PINNED_SHOULDER, jurisdiction_key: "parker" } as Scenario;

const BREAKDOWN = {
  devices: [],
  total_devices: 0,
  unique_types: 0,
  zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 },
  jurisdiction: parker,
};

type Deferred = { resolve: (r: Response) => void };
let auditCalls: Deferred[] = [];
let distanceCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    return new Promise<Response>((resolve) => auditCalls.push({ resolve }));
  }
  if (url.includes("/api/distance")) {
    return new Promise<Response>((resolve) => distanceCalls.push({ resolve }));
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as unknown as Response);
});

const okAudit = () =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ ...auditFull, breakdown: BREAKDOWN }),
  }) as unknown as Response;
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
async function answer(list: Deferred[], i: number, r: Response) {
  await act(async () => {
    list[i].resolve(r);
    await Promise.resolve();
    await Promise.resolve();
  });
}

const cue = () => document.querySelector(".tier-cue")?.textContent ?? null;
const windowsLine = () => screen.getByTestId("what-windows-line").textContent;

beforeEach(() => {
  auditCalls = [];
  distanceCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = function () {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("#398 W4 — the refreshing cue ends when the answer lands", () => {
  it("after Generate settles on a plan with a jurisdiction, the cue's slot is empty, with /api/distance landing after the audit", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={WITH_PARKER} />);
    await settle();
    await answer(auditCalls, 0, okAudit());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await settle();
    // The generated wire (site_scan on) is a new audit.
    expect(auditCalls.length).toBe(2);
    await answer(auditCalls, 1, okAudit());
    // The pricing card asks for the delivery distance; it answers AFTER
    // the audit, as on the walkthrough's network log.
    await settle(50);
    expect(distanceCalls.length, "the pricing card asked for the distance").toBeGreaterThan(0);
    for (let i = 0; i < distanceCalls.length; i += 1) {
      await answer(distanceCalls, i, {
        ok: true,
        status: 200,
        json: async () => ({ miles: 12 }),
      } as unknown as Response);
    }
    // One debounce window later, nothing is in flight.
    await settle(400);
    expect(auditCalls.length, "no further audit went out").toBe(2);
    expect(cue(), "the slot stays in the flow (P1)").not.toBeNull();
    expect(cue(), "and is empty: no request is open (P8)").toBe("");
  });
});

describe("#398 W5 — the windows line on a plan with no answer", () => {
  it("a declined plan says the windows weren't checked, never 'loading'", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={WITH_PARKER} />);
    await settle();
    // Before the answer, the check is open and the line says so.
    expect(windowsLine()).toBe("Windows · ◌ loading");
    await answer(auditCalls, 0, declined400());
    await settle();
    expect(windowsLine()).toBe("Windows · not checked: the plan was declined");
    expect(windowsLine()).not.toContain("loading");
  });

  it("a failed check (not a decline) says it didn't answer, never 'loading'", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={WITH_PARKER} />);
    await settle();
    await answer(auditCalls, 0, failed500());
    await settle();
    expect(windowsLine()).toBe("Windows · not checked: the check didn't answer");
  });

  it("a plan that answers still reads the jurisdiction's verdict line", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={WITH_PARKER} />);
    await settle();
    await answer(auditCalls, 0, okAudit());
    await settle();
    expect(windowsLine()).toMatch(/^Parker windows · /);
  });
});
