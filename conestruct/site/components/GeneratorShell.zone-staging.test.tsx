// @vitest-environment happy-dom
//
// Zone staging (restage inc-1): the page lifecycle derives from the
// Generate click + the real device-breakdown request state — pre →
// generating → post → error, and reopen back to pre.  Mounted-flow
// tests with releasable breakdown fetches: the transitions under test
// are exactly the ones a fake-timer prototype can't exercise.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
// #186: mounts assert a verdict / enabled Generate — start located.
import { PINNED_SHOULDER, MIN_AUDIT } from "./test-fixtures";
import {
  changeOneThing,
  editAfterGenerate,
  openWhat,
  openWhere,
} from "./__fixtures__/band-helpers";

// #289 Phase 2 — the setup strip is deleted (§8.27; #262 closes by
// deletion).  A post-generate edit is CHANGE ONE THING on the setup fact
// line, then the WHAT grid's own cell: `editAfterGenerate` in
// components/__fixtures__/band-helpers.ts is those two steps.

const BREAKDOWN = {
  devices: [
    {
      device: "ROAD WORK AHEAD",
      code: "W20-1",
      function: "Advance warning",
      qty: 2,
    },
  ],
  total_devices: 42,
  unique_types: 6,
  zone_geometry: {
    taper_l_ft: 183,
    buffer_b_ft: 495,
    device_spacing_ft: 55,
    work_len_ft: 500,
  },
};

type Deferred = { resolve: (r: Response) => void };

let breakdownCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/device-breakdown")) {
    return new Promise<Response>((resolve) => {
      breakdownCalls.push({ resolve });
    });
  }
  // #261: the audit answer is wire-shaped (the shell reads it for the
  // audit card's count); the suite's own audit branches above still win.
  if (url.includes("/api/render/audit")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => MIN_AUDIT,
    } as unknown as Response);
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

function okBreakdown(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => BREAKDOWN,
  } as unknown as Response;
}

function errBreakdown(): Response {
  return {
    ok: false,
    status: 500,
    json: async () => ({}),
    text: async () => "boom",
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

function zones(): HTMLElement[] {
  return Array.from(document.querySelectorAll("section.zone"));
}

describe("zone staging lifecycle", () => {
  it("pre: dominant setup panel, empty results, no strip", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());

    const [setup, results] = zones();
    expect(setup.className).toContain("dominant");
    // #289 Phase 2 — the setup panel and its heading are gone (§8.16,
    // §8.28); the band stack is what the zone holds now, and it says
    // which step it is on in role 4 rather than naming the zone.
    expect(setup.querySelector(".band-stack")).not.toBeNull();
    expect(setup.textContent).toMatch(/STEP \d OF 4/);
    expect(setup.querySelector(".setup-panel")).toBeNull();
    expect(setup.querySelector(".setup-strip")).toBeNull();
    expect(results.className).not.toContain("dominant");
    // #289 hand-check, 2026-09-22: Part 1 §2.1 — "no results zone … no
    // download empty-state panel".  The zone is still MOUNTED (it is the
    // landing target and the focus target, ruling 192), and it is empty.
    expect(results.textContent).toBe("");
    expect(document.querySelector(".hero")).toBeNull();
  });

  it("generating: a regenerate with prior results dims in place (#192); the placeholder is first-generate only", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());

    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    // Post (breakdown already ready).  #252: settle the generated pair
    // — a strip edit is locked while it is open.
    await flushDebounce();
    await release(1, okBreakdown());
    // #289 Phase 2: the setup strip is deleted (§8.27); post-generate
    // the setup is ONE fact line in the results stack's reserved first
    // row (rules 28 and 119).
    expect(document.querySelector(".setup-strip")).toBeNull();
    expect(document.querySelector('[data-testid="fact-setup"]')).not.toBeNull();

    // #289 S7: a post-generate edit is a REVISION — it stages, and
    // APPLY is the write that refires the pair.  `editAfterGenerate`
    // does both (components/__fixtures__/band-helpers.ts), so the claim
    // is unchanged: the subtree stays mounted, dimmed under the
    // recomputing ribbon, hero holding the carried previous answer
    // (#192 — no empty-state swap, no panel-state destruction).
    await editAfterGenerate("what-speed", "35");
    await flushDebounce();
    expect(screen.queryByText("Generating…")).toBeNull();
    expect(document.querySelector(".results-stale")).not.toBeNull();
    expect(screen.getByText(/Previous answer/)).toBeTruthy();
    expect(document.querySelector(".hero")).not.toBeNull();

    // Resolve → back to post, ribbon and dim gone.  The preview fired
    // by the staged edit is answered first: it is a read on the same
    // route, and leaving it open would hold the page in flight.
    // Two are open: the staged edit's PREVIEW (a read, #282's flag) and
    // APPLY's generate.  Both are answered, oldest first.
    for (let i = 2; i < breakdownCalls.length; i += 1) {
      await release(i, okBreakdown());
    }
    expect(screen.queryByText(/Previous answer/)).toBeNull();
    expect(document.querySelector(".results-stale")).toBeNull();
    expect(document.querySelector(".hero")).not.toBeNull();
  });

  it("post: results zone is dominant with hero numerals and geometry rendered verbatim", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    const [setup, results] = zones();
    expect(results.className).toContain("dominant");
    expect(setup.className).not.toContain("dominant");

    const hero = document.querySelector(".hero")!;
    const nums = Array.from(hero.querySelectorAll(".num")).map(
      (n) => n.textContent,
    );
    expect(nums).toEqual(["42", "6"]);
    expect(hero.textContent).toContain("183 ft"); // taper_l_ft, as returned
    expect(hero.textContent).toContain("495 ft"); // buffer_b_ft
    expect(hero.textContent).toContain("55 ft o.c."); // device_spacing_ft
  });

  it("error: breakdown failure after generate shows the stale ribbon, not a silent blank", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());

    await editAfterGenerate("what-speed", "35");
    await flushDebounce();
    await release(2, errBreakdown());

    expect(document.querySelector(".stale-ribbon")).not.toBeNull();
    expect(document.querySelector(".results-stale")).not.toBeNull();
  });

  it("CHANGE ONE THING re-opens ONE FIELD and KEEPS the answer on screen", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(document.querySelector(".hero")).not.toBeNull();
    await flushDebounce();
    await release(1, okBreakdown());

    await changeOneThing();
    const [setup, results] = zones();
    expect(setup.className).toContain("dominant");
    // #289 Phase 2, S7 (rule 190): the verb re-opens ONE FIELD, in
    // place, with its consequence shown — not the whole column, which is
    // what it did between the S4 commit and this one.  This is where the
    // old "Edit full setup" and the new verb part company.  Part 1 §5.4:
    // "The results below dim to 50% under a stale ribbon ... Downloads,
    // quote and save stay live — that is inherited from the current
    // corrections block and is not negotiable: staging must stay
    // abandonable."  So the answer stays on screen.
    expect(document.querySelector('[data-testid="revision-panel"]')).not.toBeNull();
    expect(document.getElementById("revise-speed")).not.toBeNull();
    expect(document.querySelector(".hero"), "the answer stays").not.toBeNull();
    // And the results zone is not emptied — the stack is still there,
    // which is the difference from the panel-era Reopen.
    expect(results.textContent).not.toBe("");
  });

  it("panel schedule entry reaches the POSTed scenario (payload-level, inc-8)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());

    // #289 hand-check, 2026-09-23, fix 1: the dates are ONE control in
    // the WHAT grid and the mode DERIVES from them — the Single day /
    // Date range / Not set chips are gone, because they wrote the same
    // answer as the date input.  #199's claim is unchanged and now made
    // by the field itself: a schedule nobody entered is "Not set"
    // because there is no date.  Every edit still rides the same
    // scenario.schedule the strip and the hours chip read.
    await openWhat();
    const dateInput = document.getElementById("what-date") as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput, { target: { value: "2026-08-04" } });
    await flushDebounce();
    await release(1, okBreakdown());

    let bodies = fetchMock.mock.calls
      .filter(([u]) => String(u).includes("device-breakdown"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    let last = bodies[bodies.length - 1] as {
      scenario: { schedule?: { date_mode: string; work_date?: string } };
    };
    expect(last.scenario.schedule?.work_date).toBe("2026-08-04");
    expect(last.scenario.schedule?.date_mode).toBe("single");

    // Clearing the date is the deliberate "Not set": no date, no mode.
    fireEvent.change(dateInput, { target: { value: "" } });
    await flushDebounce();
    bodies = fetchMock.mock.calls
      .filter(([u]) => String(u).includes("device-breakdown"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    last = bodies[bodies.length - 1] as {
      scenario: { schedule?: { date_mode: string } };
    };
    expect(last.scenario.schedule?.date_mode).toBe("tbd");
  });

  it("strip inline edit writes the scenario and refires the request (payload-level)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());

    await editAfterGenerate("what-speed", "35");
    await flushDebounce();

    // The refetch carries the edited speed in the POSTed scenario.
    const bodies = fetchMock.mock.calls
      .filter(([u]) => String(u).includes("device-breakdown"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    const last = bodies[bodies.length - 1] as {
      scenario: { speed: number };
    };
    expect(last.scenario.speed).toBe(35);
  });
});
