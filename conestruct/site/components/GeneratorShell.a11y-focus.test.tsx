// @vitest-environment happy-dom
//
// #193 — focus policy for the Generate lifecycle, mounted (rule 11:
// the bug lives in unmount timing, so every assertion reads
// document.activeElement through a real interaction sequence).
// Policy under test (WCAG 2.4.3 focus order / 2.1.1 keyboard):
//   * an ARMED Generate click owns the next focus move — when the
//     staged lifecycle settles (post or error) focus lands on the
//     results zone;
//   * background settles (debounced refetches) never move focus;
//   * Reopen moves focus to the Setup zone (the strip control that was
//     clicked unmounts with the strip).

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
  devices: [],
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

const fetchMock = vi.fn((input: RequestInfo | URL) => {
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

async function release(index: number, response: Response) {
  await act(async () => {
    breakdownCalls[index].resolve(response);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function flushDebounce() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 360));
  });
}

// The results zone is the section holding the results content; the
// setup zone is the section holding the Generate button.  Both carry
// tabIndex={-1}, so activeElement can BE them.
//
// #288 clause 5: the results zone was found by its heading ("MHT
// package") until Part 1 §8.28 dropped the zone headings.  §8.28 also
// says the focus targets "must be re-homed onto the band stack and the
// results stack", so the section now carries `results-stack` — §8.29's
// own name for it — and that is what identifies it.  The CLAIM is
// unchanged: focus lands on the section that holds the results.
function activeIsResultsZone(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLElement &&
    el.tagName === "SECTION" &&
    el.classList.contains("results-stack")
  );
}

function activeIsSetupZone(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLElement &&
    el.tagName === "SECTION" &&
    // #289 Phase 2: the zone holds the band stack now, not the setup
    // panel (§8.16).  The focus TARGET is unchanged — ruling 192 re-homed
    // the Zone 1 target onto the band stack and `setupRef` stays on this
    // section — so only what it contains has changed.
    // #289 S7: in revision the zone holds ONE field and its panel
    // instead of the column (rule 190), so the predicate asks for either
    // — the TARGET is the section, which ruling 192 re-homed and which
    // has not moved.
    (el.querySelector(".band-stack") !== null ||
      el.querySelector('[data-testid="revision-panel"]') !== null)
  );
}

let scrollSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  breakdownCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy as never;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("focus policy after Generate (#193)", () => {
  it("keyboard Generate (Enter) lands focus on the results zone; scroll still fires", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());

    const btn = screen.getByRole("button", { name: /Generate plan/ });
    btn.focus();
    await user.keyboard("{Enter}");
    // S4 (s4-prod/): the landing waits for the generated wire's own
    // answer — the pre-Generate one READY at the keypress is not shown.
    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());

    expect(activeIsResultsZone()).toBe(true);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("with the fetch still in flight, focus moves only when it settles to post", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    // #252: a strip edit mid-flight is impossible (the lock); the
    // in-flight Generate is the click while the mount fetch is pending.
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(activeIsResultsZone()).toBe(false);

    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());
    expect(activeIsResultsZone()).toBe(true);
  });

  it("a failed generation focuses the results zone (it holds the alert) without scrolling", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    scrollSpy.mockClear();

    // The mount fetch is deliberately left PENDING: with it resolved the
    // click lands on a ready breakdown, the lifecycle touches "post" for
    // a frame and the armed scroll fires — which is right, and not the
    // state this case is about.
    //
    // #289: reaching a failed generation no longer needs a Reopen.  The
    // panel-era version generated once, pressed "Edit full setup" — which
    // dropped back to "pre" and refired the pair — and failed the second.
    // CHANGE ONE THING keeps the answer on screen and fires nothing, so
    // the shortest honest route to the state this case is about is to
    // fail the FIRST generate, which is also how an operator meets it.
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(breakdownCalls.length - 1, errBreakdown());

    expect(activeIsResultsZone()).toBe(true);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("a background settle never moves focus (debounced strip edit)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());

    // #289 S7: the post-generate editor is the revision band's own
    // field.  The claim is the one #252 established and is unchanged:
    // typing opens no request, so nothing locks the control under the
    // cursor and focus stays put.  The extent field's own version of it
    // is asserted pre-generate, where that field lives.
    await changeOneThing();
    const input = document.getElementById("revise-speed") as HTMLSelectElement;
    input.focus();
    const calls = breakdownCalls.length;
    await flushDebounce();
    expect(document.activeElement).toBe(input);
    expect(breakdownCalls.length).toBe(calls);
    // Commit: the select's choice IS the commit (a select has no
    // keystroke window to protect — see bands/RevisionBand.tsx), and it
    // fires exactly ONE request: the preview, which is a read.  Its
    // settle never moves focus to the results zone, which is the #193
    // contract and the whole point of this case.
    await act(async () => {
      fireEvent.change(input, { target: { value: "35" } });
    });
    expect(breakdownCalls.length).toBe(calls + 1);
    await release(breakdownCalls.length - 1, okBreakdown());
    expect(activeIsResultsZone()).toBe(false);
  });

  it("CHANGE ONE THING lands focus on the zone the revision opens in", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    // #252: Reopen is a write control — settle the generated pair first.
    await flushDebounce();
    await release(1, okBreakdown());

    await changeOneThing();
    expect(activeIsSetupZone()).toBe(true);
    // #289 S7 (rule 190): what is really back is ONE FIELD and its
    // consequence — not the column, and not a second Generate.  APPLY is
    // the write now (ruling e), so that is the control Tab reaches.
    expect(document.getElementById("revise-speed")).not.toBeNull();
    expect(document.querySelector('[data-testid="revise-apply"]')).not.toBeNull();
  });
});
