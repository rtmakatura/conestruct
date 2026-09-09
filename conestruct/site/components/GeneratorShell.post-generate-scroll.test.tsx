// @vitest-environment happy-dom
//
// #152 Surface E — Generate lands the viewport on the results zone.
// The results populate ABOVE the Generate button, so without the
// scroll the user hunts upward for what they just made.  Mounted-flow
// tests with releasable breakdown fetches: scroll fires exactly once
// per Generate click when the lifecycle reaches ``post``, honors
// prefers-reduced-motion, never fires on ordinary edits, and disarms
// on a failed generation.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell, armLandingCheck } from "./GeneratorShell";
// #186: mounts assert a verdict / enabled Generate — start located.
import { PINNED_SHOULDER } from "./test-fixtures";

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
      "Site scan unavailable — the plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway — the plan says whether the scan ran.",
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

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
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
let reducedMotion = false;

beforeEach(() => {
  breakdownCalls = [];
  auditRefuses = false;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy as never;
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

describe("post-generate scroll (#152 E)", () => {
  it("Generate scrolls the results zone into view once, smoothly", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    expect(scrollSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.calls[0][0]).toMatchObject({
      behavior: "smooth",
      block: "start",
    });
    // The scrolled element is the results zone (it holds the hero).
    const target = scrollSpy.mock.instances[0] as unknown as HTMLElement;
    expect(target.querySelector(".hero")).not.toBeNull();
    // #250 (c): the zone carries the class the post-generate landing rule
    // keys on, and the root's data-stage has left "pre" (the rail is gone,
    // so --pin-h is 0 and the results rule budgets the strip instead).
    // The click also refires the breakdown for the generated wire, so the
    // stage read here is "generating" or "post" — never "pre".
    expect(target.classList.contains("results")).toBe(true);
    expect(["generating", "post"]).toContain(
      document.querySelector(".workbench")?.getAttribute("data-stage"),
    );
  });

  it("#250 (c): the root carries data-stage=pre before Generate", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    expect(document.querySelector(".workbench")?.getAttribute("data-stage")).toBe("pre");
  });

  it("waits for a pending breakdown: scroll fires when generating resolves to post", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());
    scrollSpy.mockClear();

    // #252: a strip edit mid-flight is locked; reopen (settled) →
    // Generate with the pre-generate refire still pending must scroll
    // only when the generated answer lands.
    await user.click(screen.getByText(/Edit full setup/));
    await flushDebounce(); // the pre-generate refire dispatches and stays pending
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    // #192: with prior results the in-flight state dims in place under
    // the stale ribbon (no "Generating…" empty-state swap; #252 wording).
    expect(screen.getByText(/Previous answer/)).toBeTruthy();
    expect(scrollSpy).not.toHaveBeenCalled();

    await flushDebounce();
    await release(breakdownCalls.length - 1, okBreakdown());
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("respects prefers-reduced-motion: instant jump, no animation", async () => {
    reducedMotion = true;
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());

    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.calls[0][0]).toMatchObject({ behavior: "auto" });
  });

  it("ordinary edits never scroll — only a Generate click arms it", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());
    scrollSpy.mockClear();

    // A strip edit refetches and re-lands on post — no new scroll.
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await flushDebounce();
    await release(2, okBreakdown());
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("a failed generation disarms the scroll instead of yanking the viewport", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());
    scrollSpy.mockClear();

    // Reopen (settled) and regenerate; the fetch then FAILS: no scroll
    // on the error.
    await user.click(screen.getByText(/Edit full setup/));
    await flushDebounce(); // the pre-generate refire dispatches and stays pending
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(breakdownCalls.length - 1, errBreakdown());
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("#258 (ruling c2): a declined pair — the audit refused and the breakdown 400s too — lands the results zone once, on the refusal container", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await release(0, okBreakdown());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await flushDebounce();
    await release(1, okBreakdown());
    scrollSpy.mockClear();

    // The same shape as the "failed generation" case above — Reopen,
    // Generate with the pre-generate refire pending, so the landing
    // waits for the generated answer — except the pair is DECLINED: the
    // audit refuses and the breakdown 400s too.  Before c2 this path
    // scrolled nowhere (audit F-S5-3); a first Generate with a ready
    // pre-generate breakdown scrolls at the click regardless (case 1).
    await user.click(screen.getByText(/Edit full setup/));
    await flushDebounce(); // the pre-generate refire dispatches and stays pending
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    auditRefuses = true; // the generated wire's audit (dispatched on the debounce) refuses
    await flushDebounce();
    expect(scrollSpy).not.toHaveBeenCalled();
    await release(breakdownCalls.length - 1, refusedBreakdown());
    await flushDebounce();

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.calls[0][0]).toMatchObject({
      behavior: "smooth",
      block: "start",
    });
    const target = scrollSpy.mock.instances[0] as unknown as HTMLElement;
    expect(target.querySelector(".scan-refusal")).not.toBeNull();
    expect(target.querySelector(".hero")).toBeNull();
    // Focus lands there too (#193), and only once: the arming is spent.
    expect(document.activeElement).toBe(target);
    await flushDebounce();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
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
describe("#250 (a) — armLandingCheck re-issues the landing once, never twice", () => {
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

  it("lands off by more than 1 px → one re-issue with the same behaviour; a second scrollend and the settle add nothing", () => {
    top = 140; // under-nav race: the swap landed the zone 4 px low
    const check = armLandingCheck(el, "smooth");
    expect(scrollSpy).not.toHaveBeenCalled();
    settledScroll();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.calls[0][0]).toMatchObject({ behavior: "smooth", block: "start" });
    expect(scrollSpy.mock.instances[0]).toBe(el);
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
    flushFrames(30);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    flushFrames(200);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });
});
