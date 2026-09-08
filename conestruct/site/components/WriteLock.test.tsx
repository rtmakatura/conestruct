// @vitest-environment happy-dom
//
// #252 (s2-arc23, GO ruling b) — the write lock's honesty test.  With a
// request for the generated scenario held open, EVERY control in the
// post-generate DOM must be one of: a write control (``data-write``,
// disabled — or aria-disabled for an anchor), a read control
// (``data-read``, live), or a route link.  Anything else fails BY NAME:
// a new control cannot ship without declaring what it is (rule 11 —
// the test lives where the bug would).  The real shell, strip, cards,
// pricing panel, tiered reference, nav and footer are mounted; only the
// pre-generate sidebar and the picker are stubs (they unmount on
// Generate and never face the lock).
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({ onGenerate }: { onGenerate: () => void }) => (
    <button type="button" onClick={onGenerate}>
      Generate package
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";

const BUCKETS = {
  intersections: { detected: true, count: 26, nearest_distance_ft: 34.1, details: ["W Alameda Ave"] },
  interchanges: { detected: false, count: 0 },
  sidewalks: { detected: true, count: 18, nearest_distance_ft: 46.6 },
  bike_facilities: { detected: false, count: 0 },
  schools: { detected: false, count: 0 },
};
const AUDIT = {
  summary: { ta: "TA-3", cdot_sheet: "S-630-1" },
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
    site_scan: {
      status: "ok",
      mode: "corridor",
      measured_at: "2026-09-04T12:00:00+00:00",
      buckets: BUCKETS,
      flags: {},
      corrections: [],
    },
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
const ok = (data: unknown): Response =>
  ({ ok: true, status: 200, json: async () => data, text: async () => "" }) as unknown as Response;
type Gate = { promise: Promise<Response>; release: () => void } | null;
function gate(data: unknown): NonNullable<Gate> {
  let release!: () => void;
  const promise = new Promise<Response>((r) => {
    release = () => r(ok(data));
  });
  return { promise, release };
}
let auditGate: Gate = null;
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) return auditGate ? auditGate.promise : Promise.resolve(ok(AUDIT));
  if (url.includes("/api/render/device-breakdown")) return Promise.resolve(ok(BREAKDOWN));
  return Promise.resolve(ok({}));
});
beforeEach(() => {
  fetchMock.mockClear();
  auditGate = null;
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = function () {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
}

type Control = HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLAnchorElement;
const CONTROL = "button, input, select, textarea, a[href]";
function describe_(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
  const label = el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 40);
  return `${tag}${id}${cls} "${label}"`;
}
function controls(): Control[] {
  return Array.from(document.querySelectorAll(`main ${CONTROL.split(", ").join(", main ")}, nav ${CONTROL.split(", ").join(", nav ")}, footer a[href]`)) as Control[];
}
const isRouteLink = (el: Element) =>
  el.tagName === "A" && /^\/(?!api\/)/.test(el.getAttribute("href") ?? "") && !el.hasAttribute("download");
// Off = ``disabled``, or ``aria-disabled`` (an anchor, which has no
// ``disabled``; the strip's openers, which must stay focusable).
const isOff = (el: Control) =>
  el.tagName === "A"
    ? el.getAttribute("aria-disabled") === "true" && el.tabIndex === -1
    : (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true";

/** Every control, classified; returns the names that fail the rule. */
function walk(locked: boolean): string[] {
  const bad: string[] = [];
  for (const el of controls()) {
    if (el.closest(".working-band")) bad.push(`band carries a control: ${describe_(el)}`);
    if (el.hasAttribute("data-write")) {
      if (locked && !isOff(el)) bad.push(`write control live under the lock: ${describe_(el)}`);
    } else if (el.hasAttribute("data-read")) {
      if (isOff(el)) bad.push(`read control disabled: ${describe_(el)}`);
    } else if (!isRouteLink(el)) {
      bad.push(`unclassified control (declare data-write or data-read): ${describe_(el)}`);
    }
  }
  return bad;
}

async function generateHeld() {
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
  await settle();
  const user = userEvent.setup();
  // Generate settles once (the strip's block, the lockup, the cards all
  // mount on a scanned plan), then a correction holds the next request.
  await user.click(screen.getByRole("button", { name: "Generate package" }));
  await settle();
  expect(document.querySelector(".working-band")).toBeNull();
  // Open every disclosure so their controls are in the DOM to enumerate.
  await user.click(screen.getByRole("button", { name: /Pricing quote/i }));
  const held = gate(AUDIT);
  auditGate = held;
  const block = document.getElementById("site-corrections")!;
  const school = within(block).getByText("School zone").closest(".site-correction-row") as HTMLElement;
  await user.click(within(school).getByRole("button", { name: "Assert" }));
  await settle();
  expect(document.querySelector(".working-band"), "the request is held open").not.toBeNull();
  expect(document.querySelector(".workbench")!.classList.contains("ws-locked")).toBe(true);
  return { user, held };
}

describe("#252 — the write lock's enumeration is honest", () => {
  it("under the lock every control is a disabled write, a live read, or a route link — anything else fails by name", async () => {
    const { user } = await generateHeld();
    const seen = controls();
    // The walk is only meaningful over a real page: the strip's editors
    // and correction buttons, the cards, the quote's rates, the reference.
    expect(seen.length).toBeGreaterThan(20);
    expect(walk(true)).toEqual([]);
    // The classes are both populated — a page with no writes or no reads
    // would pass the walk vacuously.
    expect(seen.filter((e) => e.hasAttribute("data-write")).length).toBeGreaterThan(10);
    expect(seen.filter((e) => e.hasAttribute("data-read")).length).toBeGreaterThan(0);
    expect(seen.filter(isRouteLink).length).toBeGreaterThan(0);
    // Reads stay usable: a disclosure toggles under the lock.
    const head = document.querySelector(".audit-head") as HTMLButtonElement | null;
    if (head) {
      const item = head.closest(".audit-item")!;
      const before = item.classList.contains("open");
      await user.click(head);
      expect(item.classList.contains("open")).toBe(!before);
    }
    // Writes write nothing: a click on a locked correction button is inert.
    const calls = fetchMock.mock.calls.length;
    const block = document.getElementById("site-corrections")!;
    for (const b of Array.from(block.querySelectorAll("button"))) await user.click(b);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("at settle every write control re-enables unless it has a reason of its own; the root drops the lock", async () => {
    const { held } = await generateHeld();
    await act(async () => {
      held.release();
    });
    await settle();
    expect(document.querySelector(".working-band")).toBeNull();
    expect(document.querySelector(".workbench")!.classList.contains("ws-locked")).toBe(false);
    expect(walk(false)).toEqual([]);
    const stillOff = controls()
      .filter((e) => e.hasAttribute("data-write") && isOff(e))
      .map(describe_);
    // Own reasons only: none on a settled, scanned sandbox plan.
    expect(stillOff).toEqual([]);
  });

  it("the one dim rule sits after the block's own disabled ink, which steps aside under the lock (spec 25: one tier)", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf-8");
    const rule = css.indexOf(".workbench.ws-locked [data-write]:disabled,");
    const sc = css.indexOf(".workbench:not(.ws-locked) .jbar-suggest .sc-grid button:disabled,");
    expect(rule).toBeGreaterThan(sc);
    expect(sc).toBeGreaterThan(-1);
    expect(css).toMatch(
      /\.workbench\.ws-locked \[data-write\]:disabled,\s*\.workbench\.ws-locked \[data-write\]\[aria-disabled="true"\] \{\s*opacity: 0\.45;\s*pointer-events: none;\s*cursor: default;\s*\}/,
    );
    // No other selector reaches for the lock class: the block's
    // step-aside and the one dim rule (the band's room is a spacer
    // sibling, .ws-spacer, not root padding — a suppression trigger).
    const selectors = css
      .split(/\r?\n/)
      .filter((l) => /^\.workbench(\.|:not\(\.)ws-locked/.test(l));
    expect(selectors).toEqual([
      ".workbench:not(.ws-locked) .jbar-suggest .sc-grid button:disabled,",
      ".workbench:not(.ws-locked) .jbar-suggest .sc-grid button:disabled:hover,",
      ".workbench:not(.ws-locked) .jbar-suggest .sc-picker button:disabled,",
      ".workbench:not(.ws-locked) .jbar-suggest .sc-picker button:disabled:hover {",
      ".workbench.ws-locked [data-write]:disabled,",
      ".workbench.ws-locked [data-write][aria-disabled=\"true\"] {",
    ]);
    expect(css).toMatch(/\.workbench \.ws-spacer \{\s*height: 150px;\s*\}/);
    expect(css).not.toMatch(/\.ws-locked \{[^}]*padding/);
  });
});
