// @vitest-environment happy-dom
//
// #152 Surface E landed the viewport on the results zone at the settle.
// #477 answer 6 (Ryan, 2026-11-09) removed that scroll: the press already
// brings the strip's slot into view (#470 R145-11), and the results start
// right under it.  Mounted-flow tests with releasable breakdown fetches
// now pin that no settle scrolls (post, reduced motion, an edit, APPLY, a
// failure, a declined pair) and that the settle still moves focus (#193).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./ReferenceSections", () => ({ ReferenceSections: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
// #477: GeneratorShell no longer arms the landing check (answer 6); its
// own cases below test it where it lives (BandStack still arms it).
import { armLandingCheck } from "@/lib/landing";
// #186: mounts assert a verdict / enabled Generate — start located.
import { PINNED_SHOULDER, MIN_AUDIT } from "./test-fixtures";
import {
  applyRevision,
  changeOneThing,
  editAfterGenerate,
  openWhat,
  openWhere,
  stageRevision,
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
// #258 (ruling c2): the audit refuses the scan — the prod-captured 400
// shape.  A declined pair is a settled answer with two actions and
// lands like ``post``; a broken breakdown under a clean audit still
// does not (the #152 E no-yank rule, unchanged).
let auditRefuses = false;
const REFUSAL = {
  detail: {
    error: "site_scan_unavailable",
    message:
      "Site scan unavailable. The plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway; the plan says whether the scan ran.",
    site_scan: {
      status: "unavailable",
      error: "scan budget exceeded (20 s)",
      mode: "corridor",
      measured_at: "2026-09-03T15:29:51+00:00",
      budget_s: 20.0,
      proceeded_anyway: false,
    },
    recovery: { retry: true, proceed_field: "site_scan.proceed_if_unavailable" },
  },
};
function refusedBreakdown(): Response {
  return {
    ok: false,
    status: 400,
    json: async () => REFUSAL,
  } as unknown as Response;
}

// #306 (R64): a Generate's breakdown rides the audit (`include_breakdown`).
// The suite's deferred breakdown is still what each test releases; for
// the audit it is wrapped -- an ok breakdown answers the audit with it,
// a failed one fails the audit (the one request) with the same status.
function auditFromBreakdown(r: Response): Response {
  if (!r.ok) return r;
  return {
    ok: true,
    status: 200,
    json: async () => ({ ...MIN_AUDIT, breakdown: await r.json() }),
  } as unknown as Response;
}

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  // The Generate's audit is held like the breakdown it carries, so a
  // refusal lands when the test releases it (`refusedBreakdown`, the
  // same 400 body), not before.
  if (
    url.includes("/api/render/audit") &&
    JSON.parse(String(init?.body ?? "{}"))?.scenario?.include_breakdown
  ) {
    return new Promise<Response>((resolve) => {
      breakdownCalls.push({ resolve: (r) => resolve(auditFromBreakdown(r)) });
    });
  }
  if (url.includes("/api/render/audit") && auditRefuses) {
    return Promise.resolve({
      ok: false,
      status: 400,
      json: async () => REFUSAL,
    } as unknown as Response);
  }
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

let scrollSpy: ReturnType<typeof vi.fn>;
// Any `window.scrollTo` (the press's own needs the slot, absent here).
let pressSpy: ReturnType<typeof vi.fn>;
let reducedMotion = false;

beforeEach(() => {
  breakdownCalls = [];
  auditRefuses = false;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy as never;
  pressSpy = vi.fn();
  vi.stubGlobal("scrollTo", pressSpy);
  reducedMotion = false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion") && reducedMotion,
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

// #477 answer 6 (Ryan, 2026-11-09): "The press already scrolls the strip's
// slot into view, so #152 E's settle scroll does nothing. Remove it."  The
// cases below keep #152 E's shapes (a first Generate, a pending answer,
// reduced motion, an edit, a failure, a declined pair) and now pin that
// the settle scrolls nothing -- neither `scrollIntoView` nor
// `window.scrollTo` -- and still moves focus to the results zone (#193).
// StatusBar is mocked here, so the strip's slot is absent and the press's
// own scroll (#470 R145-11) does not fire: every window scroll this suite
// could see would be the settle's.  The press scroll is pinned with the
// real StatusBar in GeneratorShell.generate-wait.test.tsx.  The landing
// check's own cases (#250 (a), below) stay: BandStack still arms it.
describe("post-generate scroll (#152 E, removed by #477 answer 6)", () => {
  it("Generate's settle scrolls nothing and moves focus to the results zone", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(pressSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());
    await flushDebounce();
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(pressSpy).not.toHaveBeenCalled();
    // Focus lands on the results zone (it holds the hero), once settled.
    const target = document.activeElement as HTMLElement;
    expect(target.querySelector(".hero")).not.toBeNull();
    expect(target.classList.contains("results")).toBe(true);
    expect(document.querySelector(".workbench")?.getAttribute("data-stage")).toBe("post");
  });

  it("#250 (c): the root carries data-stage=pre before Generate", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    expect(document.querySelector(".workbench")?.getAttribute("data-stage")).toBe("pre");
  });

  it("a pending answer: focus waits for it, and its arrival scrolls nothing", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    // The mount fetch is left unreleased: the click arms, the answer has
    // not landed, the focus move waits for it (#193).
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    expect(document.activeElement?.classList.contains("results")).toBe(false);

    await release(breakdownCalls.length - 1, okBreakdown());
    expect(document.activeElement?.classList.contains("results")).toBe(true);
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(pressSpy).not.toHaveBeenCalled();
  });

  it("under prefers-reduced-motion the settle scrolls nothing either", async () => {
    reducedMotion = true;
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());

    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());
    expect(pressSpy).not.toHaveBeenCalled();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("ordinary edits never scroll, and neither does APPLY's settle", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());

    // #289 S7: an edit STAGES and fires a preview, which is a read.  It
    // writes nothing and it lands nothing.
    await stageRevision("35");
    await release(breakdownCalls.length - 1, okBreakdown());
    expect(pressSpy).not.toHaveBeenCalled();

    // APPLY is a GENERATE (ruling e): its settle moves focus, no scroll.
    await applyRevision();
    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());
    await flushDebounce();
    expect(pressSpy).not.toHaveBeenCalled();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("a failed generation scrolls nothing at the settle", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(breakdownCalls.length - 1, errBreakdown());
    await flushDebounce();
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(pressSpy).not.toHaveBeenCalled();
  });

  it("#258 (ruling c2): a declined pair -- focus lands once on the results zone holding the refusal container; no settle scroll", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);

    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    auditRefuses = true; // the generated wire's audit (dispatched on the debounce) refuses
    await flushDebounce();
    await release(breakdownCalls.length - 1, refusedBreakdown());
    await flushDebounce();

    const target = document.activeElement as HTMLElement;
    expect(target.classList.contains("results")).toBe(true);
    expect(target.querySelector(".scan-refusal")).not.toBeNull();
    expect(target.querySelector(".hero")).toBeNull();
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(pressSpy).not.toHaveBeenCalled();
  });
});

// #250 (a) — the landing check.  happy-dom has no layout (every rect is
// 0 and no stylesheet is loaded), so the mounted cases above prove only
// that the check never ADDS a scroll on the good path; the arming and
// re-issue logic is proven here with mocked rects and a mocked
// scroll-margin: after the landing scroll settles (one ``scrollend``,
// or scrollY stable across frames as the fallback) the zone's top is
// compared with its scroll-margin-top and the scroll is re-issued ONCE
// if off by more than 1 px; a wheel/touch/key from the user disarms it;
// the pair's settle gets one more check, still under the one-re-issue cap.
describe("#250 (a) / #271 (a) — armLandingCheck re-issues the landing at most twice, never a third time", () => {
  let el: HTMLElement;
  let top: number;
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    el = document.createElement("section");
    document.body.appendChild(el);
    top = 136;
    el.getBoundingClientRect = () => ({ top, bottom: top + 100, left: 0, right: 0, width: 0, height: 100, x: 0, y: top, toJSON: () => ({}) });
    vi.stubGlobal("getComputedStyle", () => ({ scrollMarginTop: "136px" }));
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  const settledScroll = () => window.dispatchEvent(new Event("scrollend"));
  const userWheel = () => window.dispatchEvent(new Event("wheel"));
  const flushFrames = (n: number) => {
    for (let i = 0; i < n; i++) {
      const batch = frames.splice(0);
      for (const cb of batch) cb(i * 16);
    }
  };

  it("lands off by more than 1 px → one re-issue with the same behaviour; the scrollend that lands ON target spends the check, and the settle adds nothing", () => {
    top = 140; // under-nav race: the swap landed the zone 4 px low
    const check = armLandingCheck(el, "smooth");
    expect(scrollSpy).not.toHaveBeenCalled();
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.calls[0][0]).toMatchObject({ behavior: "smooth", block: "start" });
    expect(scrollSpy.mock.instances[0]).toBe(el);
    top = 136; // #271 (a): the re-issue landed — THIS scrollend is the landing
    settledScroll();
    flushFrames(100);
    check.settle();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("within 1 px → no re-issue; exactly on target → none", () => {
    top = 137;
    armLandingCheck(el, "smooth").settle();
    settledScroll();
    top = 136;
    armLandingCheck(el, "auto");
    settledScroll();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("a user scroll before the check disarms it — no re-issue at the settle either", () => {
    top = 200;
    const check = armLandingCheck(el, "smooth");
    userWheel();
    settledScroll();
    flushFrames(100);
    check.settle();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("the pair's settle gets one more check: on target at the landing, off at the settle → one re-issue; a further drift is not chased", () => {
    const check = armLandingCheck(el, "auto");
    settledScroll();
    expect(scrollSpy).not.toHaveBeenCalled();
    top = 150;
    check.settle();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    top = 170;
    check.settle();
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("no scrollend (the scroll had nothing to move): the rAF fallback checks once scrollY is stable across frames", () => {
    top = 130;
    armLandingCheck(el, "smooth");
    flushFrames(2);
    expect(scrollSpy).not.toHaveBeenCalled();
    // Six stable frames: the fallback's first window, and its re-issue.
    flushFrames(4);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    top = 136; // #271 (a): the re-issue landed; the next stable window spends the check
    flushFrames(200);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  // #271 — the prod case the one-shot cap could not recover (arc-26
  // prod run at ``3fa7d18``, 380x800 L10): the memoised pair settled at
  // 705 ms while the landing's smooth scroll was still animating; the
  // corrections block mounted ABOVE the zone, Chrome's anchoring held
  // the zone by moving scrollY, and the still-running animation then
  // finished to the destination it had computed BEFORE the settle —
  // the zone ended at 793 instead of 154.  A settle that arrives in
  // flight (``checked === false``) now grants ONE extra round: the
  // check waits for the stale animation's own settle and re-issues with
  // a fresh budget.  Two re-issues per Generate is the cap — never a
  // third, and a settle after the helper has finished adds nothing.
  it("a settle inside the landing scroll: the check that lands mid-animation is followed by one more with a fresh budget — the stale animation's completion is recovered", () => {
    top = 145; // the anchoring-adjusted position at the settle
    const check = armLandingCheck(el, "smooth");
    // The pair settles BEFORE any scrollend — the scroll is in flight.
    check.settle();
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(1);

    // The stale animation finishes to its pre-settle destination.
    top = 793;
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    // #271 (finding 4, ruled 2026-09-10): this re-issue fires after the
    // settle above, so it is the INSTANT reposition, not a second smooth
    // travel.  (Written as "smooth" at 1f7b060, before that ruling.)
    expect(scrollSpy.mock.calls[1][0]).toMatchObject({ behavior: "auto", block: "start" });
    expect(scrollSpy.mock.instances[1]).toBe(el);

    // No round three, and the ``done`` flag holds a late settle off.
    top = 900;
    settledScroll();
    flushFrames(200);
    check.settle();
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  });

  // #271 (a) — Ryan's ruling of 2026-09-10, after the arc-28 evidence run
  // showed the settle-granted round unreachable: "A ``scrollend`` that
  // arrives with the results zone still beyond tolerance is a cancelled
  // scroll, not a landing — re-issue and keep waiting rather than
  // spending the check.  Do not treat it as the terminal signal."
  // The recorded prod sequence (arc 26 L10 / arc 28 380x800-L12): the
  // landing scroll is issued, the stage swap's relayout cancels it and
  // Chrome reports ``scrollend`` ~30 ms later with the zone still 1939 px
  // off; the re-issue's animation is the one that runs, and it finishes
  // to its pre-settle destination (793) after the pair has settled.  Two
  // cancelled scrollends, two re-issues, and the third scrollend is the
  // real landing.
  it("#271 (a): a scrollend with the zone still off tolerance is a cancelled scroll, not a landing — the check re-issues and keeps waiting; only a scrollend within tolerance spends it", () => {
    top = 2085; // the zone 1949 px off: the cancelled scroll's scrollend
    const check = armLandingCheck(el, "smooth");
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.calls[0][0]).toMatchObject({ behavior: "smooth", block: "start" });
    expect(scrollSpy.mock.instances[0]).toBe(el);

    // The stale animation completes to its pre-settle destination.
    top = 793;
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    expect(scrollSpy.mock.calls[1][0]).toMatchObject({ behavior: "smooth", block: "start" });

    // THIS one is the landing: within tolerance, so it spends the check.
    top = 136;
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(2);

    // Spent: a later drift is not chased, and a late settle is held off.
    top = 900;
    settledScroll();
    flushFrames(200);
    check.settle();
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  });

  it("#271 (a): the cap holds — a zone that never reaches tolerance gets two re-issues and no more, and the check stops waiting", () => {
    top = 500;
    const check = armLandingCheck(el, "auto");
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    settledScroll(); // capped: the check spends itself instead of a third
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    settledScroll();
    flushFrames(200);
    check.settle();
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  });

  // #271 (ruling on finding 4, 2026-09-10) — the post-settle correction
  // is INSTANT.  The recovery works, but it recovered by animating: the
  // arc-28 run at ``4c4dce0`` measured the zone travelling 793 -> 154
  // over ~450 ms in four steps, AFTER the answer had landed.  A wander
  // that long once the answer is on screen reads as cheap (P12), and one
  // reposition is easier to understand than four steps.  So a re-issue
  // that fires after the pair has settled carries ``behavior: "auto"``;
  // the initial landing scroll, and any re-issue before the settle, keep
  // the arming behaviour.
  it("#271: a re-issue that fires AFTER the pair's settle is instant; the landing and a pre-settle re-issue keep the arming behaviour", () => {
    top = 2085; // the cancelled scroll's scrollend, before any settle
    const check = armLandingCheck(el, "smooth");
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.calls[0][0]).toMatchObject({ behavior: "smooth", block: "start" });

    // The pair settles; the stale animation then completes to its
    // pre-settle destination and the correction fires after it.
    check.settle();
    top = 793;
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    expect(scrollSpy.mock.calls[1][0]).toMatchObject({ behavior: "auto", block: "start" });
    expect(scrollSpy.mock.instances[1]).toBe(el);

    // Still capped, and still spent by a landing within tolerance.
    top = 136;
    settledScroll();
    flushFrames(200);
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  });

  it("#271: reduced motion is unchanged — an 'auto' arming stays instant on both sides of the settle", () => {
    top = 2085;
    const check = armLandingCheck(el, "auto");
    settledScroll();
    expect(scrollSpy.mock.calls[0][0]).toMatchObject({ behavior: "auto", block: "start" });
    check.settle();
    top = 793;
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    expect(scrollSpy.mock.calls[1][0]).toMatchObject({ behavior: "auto", block: "start" });
  });
});
