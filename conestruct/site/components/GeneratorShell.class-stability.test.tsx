// @vitest-environment happy-dom
//
// #152 Surface D — class-switch stability, structural layer.  A
// street-class pill switch refires the device-breakdown fetch; before
// the fix the shell recomputed the jurisdiction block as null while
// that refetch was in flight, so the bar and Zone-3 section flashed
// skeleton → content on every switch.  These mounted-flow tests pin
// the stale-while-revalidate contract:
//   - same-key refetch in flight → NO skeleton anywhere, content held
//   - the one class-dependent VERDICT (hours_eval) presents as
//     checking while in flight — never the previous answer as current
//     (rule 10)
//   - a CHANGED jurisdiction key still skeletons (no stale block from
//     another jurisdiction may render)
// The geometric layer (pixel heights across class switches) lives in
// scripts/verify-jbar-stability.mjs, run against the dev server.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import demo from "./__fixtures__/jurisdiction-demo.json";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
// #219: Zone 3 renders REAL here — this suite asserts its content.
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";

const parker = (demo as { jurisdictions: Record<string, unknown> })
  .jurisdictions.parker as JurisdictionBlock;

const BREAKDOWN_BASE = {
  devices: [],
  total_devices: 0,
  unique_types: 0,
  zone_geometry: {
    taper_l_ft: 1,
    buffer_b_ft: 1,
    device_spacing_ft: 1,
    work_len_ft: 1,
  },
};

type Deferred = { resolve: (r: Response) => void; body: unknown };

let breakdownCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/device-breakdown")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    return new Promise<Response>((resolve) => {
      breakdownCalls.push({ resolve, body });
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

function okBreakdown(withJurisdiction: boolean): Response {
  return {
    ok: true,
    status: 200,
    json: async () =>
      withJurisdiction
        ? { ...BREAKDOWN_BASE, jurisdiction: parker }
        : BREAKDOWN_BASE,
  } as unknown as Response;
}

// #182: edits reach the wire through the fetch debounce (leading +
// trailing, 350 ms) — wait it out so the deferred request dispatches.
async function flushDebounce() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 360));
  });
}

async function release(index: number, response: Response) {
  await act(async () => {
    breakdownCalls[index].resolve(response);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  breakdownCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function chainSkeleton(): Element | null {
  return document.querySelector(".jbar .chain-skeleton");
}

function chainSegs(): number {
  return document.querySelectorAll(".jbar .chain .seg").length;
}

async function mountWithParker(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" />);
  await release(0, okBreakdown(false));
  const select = document.querySelector(
    "#jl-jurisdiction",
  ) as HTMLSelectElement;
  await user.selectOptions(select, "parker");
  // First load of the key: skeleton is CORRECT here (no block to hold).
  expect(chainSkeleton()).not.toBeNull();
  await flushDebounce();
  await release(1, okBreakdown(true));
  expect(chainSkeleton()).toBeNull();
  expect(chainSegs()).toBeGreaterThan(1);
  return user;
}

describe("class-switch stability (#152 D)", () => {
  it("a class switch holds bar + section content while the refetch is in flight — no skeleton, one reflow max", async () => {
    const user = await mountWithParker();
    // Settled: the hours verdict renders (parker fixture is "outside")
    // — #219: in the auto-open ⚠ tier, off the same hours_eval.
    expect(screen.getByText(/1 h falls outside the permitted 9:00 AM–3:30 PM window/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Arterial" }));
    await flushDebounce();
    // Refetch pending (index 2) — nothing may flip to skeleton.
    expect(breakdownCalls.length).toBe(3);
    expect(chainSkeleton()).toBeNull();
    expect(chainSegs()).toBeGreaterThan(1);
    expect(screen.queryByText(/Loading jurisdiction rules/)).toBeNull();
    // The section's content is still mounted mid-refetch.
    expect(screen.getByText(/Parker — jurisdiction rules/)).toBeTruthy();

    await release(2, okBreakdown(true));
    expect(screen.getByText(/1 h falls outside the permitted 9:00 AM–3:30 PM window/)).toBeTruthy();
  });

  it("the hours VERDICT presents as checking while the class refetch is in flight — never the stale answer (rule 10)", async () => {
    const user = await mountWithParker();
    expect(screen.getByText(/1 h falls outside the permitted 9:00 AM–3:30 PM window/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Arterial" }));
    // The stale "outside" verdict may not display as current — including
    // DURING the #182 debounce's deferred window, before the fetch has
    // even dispatched.
    expect(
      screen.queryByText(/1 h falls outside the permitted 9:00 AM–3:30 PM window/),
    ).toBeNull();
    expect(
      screen.getByText(/windows for the updated inputs/),
    ).toBeTruthy();

    await flushDebounce();
    expect(
      screen.getByText(/windows for the updated inputs/),
    ).toBeTruthy();
    await release(2, okBreakdown(true));
    expect(
      screen.queryByText(/windows for the updated inputs/),
    ).toBeNull();
    expect(screen.getByText(/1 h falls outside the permitted 9:00 AM–3:30 PM window/)).toBeTruthy();
  });

  it("a CHANGED jurisdiction key still skeletons — a stale block from another jurisdiction never renders", async () => {
    const user = await mountWithParker();
    const select = document.querySelector(
      "#jl-jurisdiction",
    ) as HTMLSelectElement;
    await user.selectOptions(select, "denver");
    // No held content from parker; the chain slot skeletons as before —
    // already in the deferred window, before the fetch dispatches.
    expect(chainSkeleton()).not.toBeNull();
    await flushDebounce();
    expect(chainSkeleton()).not.toBeNull();
    expect(screen.queryByText(/Parker — jurisdiction rules/)).toBeNull();
  });

  it("a breakdown ERROR clears the held block rather than presenting it as live", async () => {
    const user = await mountWithParker();
    await user.click(screen.getByRole("button", { name: "Collector" }));
    await flushDebounce();
    await release(2, {
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "boom",
    } as unknown as Response);
    // The bar falls back to baseline; no stale parker content claims
    // to be evaluated output.
    expect(screen.queryByText(/Parker — jurisdiction rules/)).toBeNull();
  });
});
