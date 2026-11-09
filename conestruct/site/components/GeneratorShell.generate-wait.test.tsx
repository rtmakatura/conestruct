// @vitest-environment happy-dom
//
// #470 (UX group 6, Part 1) — the Generate wait, mounted with the real
// StatusBar, NeedsYou, ResultsHead and ResultsHero.  Ryan's rulings
// (2026-11-08), as tested here:
//   1. the press draws an outline of the results in their real places;
//   2. each section swaps in, in place, when its call answers;
//   3. a status line in the strip's slot (spinner, the step, "Step N of M",
//      a bar) until the real strip replaces it;
//   6. a step past its threshold says what is slow (the cold start reuses
//      today's copy).
// The page waits on ONE call after Generate (#306: the audit carries the
// scan, the layout, the check and the device list), so the line names one
// step.  The setup zone empties at the press, not at the settle (the 0.55 /
// 0.87 shift #452 measured was the locked band stack collapsing under the
// arriving plan).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";
import path from "node:path";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./ReferenceSections", () => ({ ReferenceSections: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./PricingCard", () => ({ PricingCard: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
vi.mock("./OutputCards", () => ({
  OutputCards: () => <div data-testid="downloads-stub">DOWNLOADS</div>,
}));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({ onGenerate }: { onGenerate: () => void }) => (
    <div data-testid="band-stack">
      <button type="button" onClick={onGenerate}>
        Generate package
      </button>
    </div>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";

const AUDIT = {
  summary: {},
  sections: {
    taper: {},
    buffer: {},
    spacing: {},
    advance: {},
    colorado: {},
    case: {},
    flagger: {},
    corridor_validation: { checked: false, warnings: [] },
    geometry_validation: { violations: [], all_pass: true },
    site_scan: { status: "not_run", reason: "not_requested" },
  },
  pending_verification: { count: 0, note: "", tracking_issue: null },
  plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
};
const BREAKDOWN = {
  devices: [],
  total_devices: 4,
  unique_types: 2,
  zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 },
};

function okResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => "",
    blob: async () => new Blob(["x"]),
  } as unknown as Response;
}

let release: (() => void) | null = null;
const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? "{}")) as { scenario?: { site_scan?: unknown } };
  if (url.includes("/api/render/audit")) {
    const answer = okResponse({ ...AUDIT, breakdown: BREAKDOWN });
    // The scanned (generated) audit is held until the test lets it answer.
    if (body.scenario?.site_scan) {
      return new Promise<Response>((resolve) => {
        release = () => resolve(answer);
      });
    }
    return Promise.resolve(answer);
  }
  return Promise.resolve(okResponse({}));
});

beforeEach(() => {
  release = null;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:mock", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => undefined, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function settle(ms = 400) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
async function pressGenerate() {
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
  await settle();
  await userEvent.setup().click(screen.getByText("Generate package"));
  await settle();
}
async function answer() {
  await act(async () => {
    release!();
    await Promise.resolve();
  });
  await settle();
}
const q = (s: string) => document.querySelector(s);

describe("#470 the Generate wait", () => {
  it("ruling 1: the press draws an outline of every section, in the results' own order, and empties the setup zone", async () => {
    await pressGenerate();
    // Rule 117's placeholder is gone; the outline stands in its place.
    expect(q('[data-testid="results-placeholder"]')).toBeNull();
    expect(document.body.textContent).not.toContain("No package yet");
    const top = q('[data-testid="results-outline"]');
    const bottom = q('[data-testid="results-outline-plan"]');
    expect(top).not.toBeNull();
    expect(bottom).not.toBeNull();
    const parts = [...document.querySelectorAll("[data-outline]")].map((e) => e.getAttribute("data-outline"));
    // The order is the finished stack's: NEEDS YOU, other conditions,
    // Setup, Your plan, Downloads, the search and reference group.
    expect(parts).toEqual(["needs", "other", "setup", "plan", "downloads", "refs"]);
    // Nothing that stands through the wait sits among the outlines (R145-3):
    // ResultsHead's reserved row and the reference group mount at the swap.
    expect(q('[data-testid="results-head-slot"]')).toBeNull();
    expect(q(".results-disc")).toBeNull();
    // The NEEDS YOU outline carries the road picture's label (ruling 4).
    expect(q('[data-outline="needs"]')!.textContent).toContain("Checking this stretch of road");
    // The setup zone is empty from the press: the locked band stack no
    // longer stands above the arriving plan.
    expect(q('[data-testid="band-stack"]')).toBeNull();
    expect(q("[data-outline] .ro-block")).not.toBeNull();
    // Presentation only: the outline is hidden from assistive tech.
    expect(top!.getAttribute("aria-hidden")).toBe("true");
  });

  it("ruling 3 (R145-11): the press scrolls the strip's slot into view, a scroll only; focus and the settle's landing are unchanged", async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    const into = vi.fn();
    Element.prototype.scrollIntoView = into;
    await pressGenerate();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(into).not.toHaveBeenCalled();
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true);
    await answer();
    // #152 E: the settle lands the results, once.
    expect(into).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("ruling 3: the strip's slot carries the status line (spinner, the one step, Step 1 of 1, a bar) until the real strip replaces it", async () => {
    await pressGenerate();
    const line = q(".status-slot .wait-line");
    expect(line).not.toBeNull();
    expect(line!.querySelector(".wait-spin")).not.toBeNull();
    expect(line!.querySelector(".wait-bar")).not.toBeNull();
    expect(line!.textContent).toContain("Checking the road and laying out the taper, buffer and devices…");
    expect(line!.textContent).toContain("Step 1 of 1");
    await answer();
    // ruling 2 + 3: the answer swaps every section in and the strip in.
    expect(q(".wait-line")).toBeNull();
    expect(q('[data-testid="results-outline"]')).toBeNull();
    expect(q('[data-testid="results-outline-plan"]')).toBeNull();
    expect(q(".status-slot .status-bar")!.textContent).toContain("VERIFIED");
    expect(q('[data-testid="your-plan"]')).not.toBeNull();
    expect(q('[data-testid="downloads-stub"]')).not.toBeNull();
  });

  it("ruling 6: past 2 s the line adds today's cold-start sentence; past 14 s it turns to the warn look and names the road data service", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await pressGenerate();
    const line = () => q(".status-slot .wait-line")!;
    // The longer sentences sit in the NEEDS YOU outline's reserved note,
    // so a slow step grows nothing (the strip keeps --status-h).
    const note = () => q('[data-outline="needs"] .ro-note')!;
    expect(note().textContent).toBe("");
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(note().textContent).toBe(
      "The first plan after a quiet spell can take a few extra seconds while the server wakes up.",
    );
    expect(line().classList.contains("is-slow")).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(12500);
    });
    expect(line().classList.contains("is-slow")).toBe(true);
    expect(line().classList.contains("caution")).toBe(true);
    expect(line().textContent).toContain("The road data service is slow right now.");
    expect(note().textContent).toBe(
      "The road check stops after 20 seconds. If it does, the page will say so and offer a retry.",
    );
    // No "Finish without it": the backend can't finish without the scan
    // and still ask its questions (rulings.md R145-6).
    expect(document.body.textContent).not.toContain("Finish without it");
  });
});

describe("#470 the wait's CSS (rulings 4, 5, 9)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
  const block = css.slice(css.indexOf("/* #470"), css.indexOf("/* #470 end */"));
  it("the sheen sweeps in 1.4 s, the arrival is 420 ms with a 6 px rise", () => {
    expect(block).toMatch(/animation:\s*ro-sheen 1\.4s/);
    expect(block).toMatch(/animation:\s*ro-arrive 420ms/);
    expect(block).toMatch(/translateY\(6px\)/);
  });
  it("reduced motion: no sheen, no fade, no rise, no spin -- the reset WINS the cascade for every animated selector", () => {
    // Cascade, not selector strings (repair 2): every rule in the block
    // that animates must be matched by a reset rule with the SAME selector
    // (so the same specificity) that comes LATER in the sheet, inside the
    // reduce query.  A more specific animated selector (the strip's
    // `:not(.wait-line)`, 0,4,0 against a 0,3,0 reset) would beat a later,
    // weaker reset; this check fails on it.
    const code = block.replace(/\/\*[\s\S]*?\*\//g, "");
    const at = code.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(at).toBeGreaterThan(-1);
    const rules = (s: string) =>
      [...s.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({
        selectors: m[1].split(",").map((x) => x.trim()).filter(Boolean),
        body: m[2],
      }));
    const animated = rules(code.slice(0, at))
      .filter((r) => /animation:\s*(?!none)[\w-]+/.test(r.body))
      .flatMap((r) => r.selectors);
    const resets = rules(code.slice(at))
      .filter((r) => /animation:\s*none/.test(r.body))
      .flatMap((r) => r.selectors);
    expect(animated.length).toBeGreaterThan(8);
    const unreset = animated.filter((s) => !resets.includes(s));
    expect(unreset).toEqual([]);
  });

  it("no new hex: every colour in the block is a token", () => {
    const code = block.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code.length).toBeGreaterThan(500);
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
