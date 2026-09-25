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

import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { changeOneThing, openWhat } from "./__fixtures__/band-helpers";
// A REAL audit answer, not a hand-built one: the prod capture committed
// at validation-artifacts/committed/issue-256-scan-chain/acceptance/
// run1-crashed-5d569d7/audit-denver-cold-01.json (TA-3, S-630-1,
// shoulder).  The reference panel walks the whole per-kind trace
// (lib/tier-sources.ts: "it throws on a partial fixture"), so a suite
// that opens that panel needs an answer the backend actually produced.
import auditFull from "./__fixtures__/audit-shoulder-full.json";
import { DEFAULT_SCENARIO } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios";

// #289 §8.21 — the jurisdiction FIELD is a cell in the WHAT band's grid
// now, with ruling 196's three states and no skeleton (rule 14).  Its id
// moved with it: `#jl-jurisdiction` -> `#what-jurisdiction`.  The pin
// SUGGESTION rides the same cell (#201: a confirm sits beside the control
// it applies to), and the street-class field keeps its own slot below the
// grid, so the suggest-never-set contract still has exactly one writer.

const parker = (demo as { jurisdictions: Record<string, unknown> })
  .jurisdictions.parker as JurisdictionBlock;

// #227: the jurisdiction band is pin-gated (pre-pin its body is inert
// + aria-hidden, so the class pills leave the accessibility tree).
// This suite's subject is stale-while-revalidate, not gating — mount
// pinned so the controls are live, exactly as a user switching classes
// would be.
// #289 hand-check, 2026-09-23, correction 2: the schedule is part of the
// mount now.  Pre-generate the hours VERDICT lives in the WHAT band's
// windows block, and that block reports "set dates to check" for a
// schedule nobody entered (#199) — an honest answer, and not the one
// this suite is about.  8:00–16:00 on a weekday straddles Parker's
// 9:00–15:30 window, which is what makes the fixture's `outside` verdict
// the right one to assert.
const PINNED: Scenario = {
  ...DEFAULT_SCENARIO,
  meta: { ...DEFAULT_SCENARIO.meta, lat: 39.5186, lng: -104.7614, work: { side: "right", heading: "N" } /* #290: the side a located plan now carries */ },
  schedule: {
    date_mode: "single",
    work_date: "2026-10-07",
    start_time: 8,
    end_time: 16,
  },
} as Scenario;

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
  // Correction 2: this suite generates before it reads the Reference
  // row, so the audit answer has to be wire-shaped — the results stack
  // renders the audit's sections.  The jurisdiction story under test is
  // the BREAKDOWN's, which the deferred calls above still own.
  if (url.includes("/api/render/audit")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => auditFull,
    } as unknown as Response);
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

// #289 hand-check, 2026-09-23, correction 2: the fetches are released in
// ORDER rather than by a hard-coded index — the numbers were never the
// claim, and re-homing the assertions changed how many there are.
let cursor = 0;
async function releaseNext(response: Response) {
  await release(cursor++, response);
}
/** Fetches dispatched but not yet answered. */
function pending(): number {
  return breakdownCalls.length - cursor;
}

/** Answer every dispatched fetch, and the ones the debounce's trailing
 *  edge dispatches in response, until the page is quiet.  A verdict
 *  presents as CHECKING while any breakdown is in flight (rule 10), so a
 *  suite that asserts a SETTLED verdict has to start from a settled
 *  page. */
async function quiesce(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await flushDebounce();
    if (pending() === 0) return;
    while (pending() > 0) {
      await releaseNext(okBreakdown(true));
    }
  }
}

beforeEach(() => {
  breakdownCalls = [];
  cursor = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// #288 · §8.31 pulled forward (Ryan's hand-check at f44377e): the
// jurisdiction context bar is DROPPED, so the BAR half of #152 D's
// contract ("holds bar + section content … no skeleton") retires with
// the element it described.  There is no `.jbar` and no chain skeleton
// to hold or to flash.
//
// The SECTION half is the substantive claim and is unchanged: through a
// class refetch the section's content stays mounted, the hours verdict
// presents as checking rather than stale (rule 10), and a CHANGED
// jurisdiction key still refuses to render another jurisdiction's block.
// Those assertions are kept exactly as they were.
//
// What replaces the skeleton check: the bar's three facts now ride the
// Reference row's summary line, so the row is where "no stale answer
// presented as current" is now observable for them.
function jurisdictionCell(): HTMLElement | null {
  return document.querySelector('[data-testid="cell-jurisdiction"]');
}

/** Ruling 196's three states, as the cell declares them: `unset`,
 *  `evaluating`, `evaluated`, `not-evaluated`.  This is the pre-generate
 *  home of "which answer is on screen, and is it current". */
function jurisdictionState(): string | null {
  return (
    document
      .querySelector("#what-jurisdiction")
      ?.getAttribute("data-jurisdiction-state") ?? null
  );
}

/** The cell's provenance line — rule 137's, and the words that say
 *  whether the value was evaluated or merely picked. */
function jurisdictionProv(): string {
  return document.querySelector('[data-testid="prov-jurisdiction"]')?.textContent ?? "";
}

/** The WHAT band's schedule windows block — the pre-generate home of
 *  the one class-dependent VERDICT (hours_eval). */
function windowsBlock(): string {
  return document.querySelector(".sched-windows")?.textContent ?? "";
}

async function mountWithParker(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED} />);
  await releaseNext(okBreakdown(false));
  const select = document.querySelector(
    "#what-jurisdiction",
  ) as HTMLSelectElement;
  await user.selectOptions(select, "parker");
  // First load of the key: the cell says so in a WORD rather than a
  // skeleton (#252: no skeletons anywhere; rule 14: a value that is not
  // known renders as a word).  Ruling 196 named this state.
  expect(jurisdictionState()).toBe("evaluating");
  expect(jurisdictionProv()).toContain("not yet confirmed for this plan");
  await flushDebounce();
  await releaseNext(okBreakdown(true));
  // Settled: the cell carries the EVALUATED answer and says which of the
  // two it is.
  expect(jurisdictionState()).toBe("evaluated");
  expect(jurisdictionCell()?.textContent).toContain("Parker");
  expect(jurisdictionProv()).toContain("evaluated");
  await quiesce();
  return user;
}

// #276 — "three states, no skeleton, no height change".  The words are
// ruling 196's (asserted in mountWithParker above); what this adds is the
// other two clauses at the surface: through unset → evaluating →
// evaluated the provenance is ONE element, never swapped for a
// placeholder, no skeleton appears anywhere, and the sheet reserves the
// line's tallest state so the WHAT row does not re-flow (layout itself
// is the hand-check's — the suite has none).
describe("#276 — the jurisdiction cell's states: no skeleton, one reserved line", () => {
  it("the provenance element survives every state, no skeleton at any point, and its height is reserved", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED} />);
    await releaseNext(okBreakdown(false));
    const prov = document.querySelector('[data-testid="prov-jurisdiction"]');
    expect(jurisdictionState()).toBe("unset");
    expect(prov?.textContent).toBe("MUTCD + Colorado Supplement only");

    const noSkeleton = () =>
      expect(document.querySelector(".jbar-skel-line, [class*='skel'], .animate-pulse")).toBeNull();
    noSkeleton();

    await user.selectOptions(document.querySelector("#what-jurisdiction") as HTMLSelectElement, "parker");
    expect(jurisdictionState()).toBe("evaluating");
    expect(document.querySelector('[data-testid="prov-jurisdiction"]')).toBe(prov);
    noSkeleton();

    await flushDebounce();
    await releaseNext(okBreakdown(true));
    expect(jurisdictionState()).toBe("evaluated");
    expect(document.querySelector('[data-testid="prov-jurisdiction"]')).toBe(prov);
    noSkeleton();

    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
    // The tallest state follows the line's width, swept on prod
    // (rulings.md, "#276's reserve, re-measured"): the cell is the query
    // container, and each tier reserves that width's tallest state.
    expect(css).toMatch(/\.workbench \[data-testid="cell-jurisdiction"\] \{\s*container-type: inline-size;/);
    const sel = String.raw`\.workbench \.a-cell \.tr-prov\[data-testid="prov-jurisdiction"\] \{\s*min-height: `;
    expect(css).toMatch(new RegExp(sel + String.raw`7\.5em;`));
    for (const [w, em] of [["121", "6em"], ["168", "4\\.5em"], ["242", "3em"]]) {
      expect(css, `${w} → ${em}`).toMatch(
        new RegExp(String.raw`@container \(min-width: ${w}px\) \{\s*` + sel + em + ";"),
      );
    }
    expect(css).not.toMatch(/\.jbar-skel-line \{/);
    await quiesce();
  });
});

describe("class-switch stability (#152 D)", () => {
  it("a class switch holds the jurisdiction's content while the refetch is in flight — no skeleton, one reflow max", async () => {
    const user = await mountWithParker();
    // Settled: the hours verdict renders (parker fixture is "outside").
    expect(windowsBlock()).toContain("PARKER WINDOWS");
    expect(windowsBlock()).toContain(
      "1 h outside the permitted 9:00 AM–3:30 PM window",
    );

    await user.click(screen.getByRole("button", { name: "Arterial" }));
    await flushDebounce();
    // Refetch pending — nothing may flip to skeleton.
    expect(pending()).toBe(1);
    // Mid-refetch the cell keeps the settled answer — it does not flash
    // "Checking…" for a jurisdiction that has not changed.
    expect(jurisdictionCell()?.textContent).toContain("Parker");
    expect(jurisdictionState()).toBe("evaluated");
    expect(screen.queryByText(/Loading jurisdiction rules/)).toBeNull();
    // The content is still mounted mid-refetch.
    expect(windowsBlock()).toContain("PARKER WINDOWS");

    await releaseNext(okBreakdown(true));
    expect(windowsBlock()).toContain(
      "1 h outside the permitted 9:00 AM–3:30 PM window",
    );
  });

  it("the hours VERDICT presents as checking while the class refetch is in flight — never the stale answer (rule 10)", async () => {
    const user = await mountWithParker();
    expect(windowsBlock()).toContain(
      "1 h outside the permitted 9:00 AM–3:30 PM window",
    );

    await user.click(screen.getByRole("button", { name: "Arterial" }));
    // The stale "outside" verdict may not display as current — including
    // DURING the #182 debounce's deferred window, before the fetch has
    // even dispatched.  The row keeps its shape and loses its claim.
    expect(windowsBlock()).not.toContain(
      "1 h outside the permitted 9:00 AM–3:30 PM window",
    );
    expect(windowsBlock()).toContain("checking these inputs");

    await flushDebounce();
    expect(windowsBlock()).not.toContain(
      "1 h outside the permitted 9:00 AM–3:30 PM window",
    );
    await releaseNext(okBreakdown(true));
    expect(windowsBlock()).toContain(
      "1 h outside the permitted 9:00 AM–3:30 PM window",
    );
  });

  it("a CHANGED jurisdiction key says CHECKING — a stale block from another jurisdiction never renders", async () => {
    const user = await mountWithParker();
    const select = document.querySelector(
      "#what-jurisdiction",
    ) as HTMLSelectElement;
    await user.selectOptions(select, "denver");
    // No held content from Parker.  The bar used to skeleton here; §8.31
    // dropped the bar and §8.21 moved the field into the WHAT grid, so
    // the same fact is stated in the cell's own word — and, critically,
    // the cell must NOT still present Parker's evaluated block while
    // Denver is loading.  That is the rule-10 claim this test has always
    // made; only the surface carrying it changed.
    expect(jurisdictionState()).toBe("evaluating");
    expect(jurisdictionProv()).toContain("not yet confirmed for this plan");
    expect(windowsBlock()).not.toContain("PARKER WINDOWS");
    await flushDebounce();
    expect(jurisdictionState()).toBe("evaluating");
    expect(windowsBlock()).not.toContain("PARKER WINDOWS");
  });

  it("a breakdown ERROR clears the held block rather than presenting it as live", async () => {
    const user = await mountWithParker();
    await user.click(screen.getByRole("button", { name: "Collector" }));
    await flushDebounce();
    await releaseNext({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "boom",
    } as unknown as Response);
    // Ruling 196's fourth state: the check did not answer, and the cell
    // says exactly that instead of holding Parker's block as current.
    expect(jurisdictionState()).toBe("not-evaluated");
    expect(jurisdictionProv()).toContain("the check did not answer");
    expect(windowsBlock()).not.toContain("PARKER WINDOWS");
  });
});
