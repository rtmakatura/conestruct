// @vitest-environment happy-dom
//
// #253 — the next-steps strip, mounted through the real shell and the
// real SetupStrip: the states the results-head suite does not walk.
//   · pre-generate: no strip;
//   · a broken breakdown under a clean audit: the strip renders with
//     chip 3 "◌ NOT PRODUCED", aria-disabled (the one inert state);
//   · the c2 declined pair (audit refused AND breakdown 400): no strip
//     (spec 31), the refusal container is the voice;
//   · a count never changes on click — Assert stages ("· 1 STAGED"
//     appended, open unchanged) and only the served answer moves it;
//   · a chip is a data-read link with an in-page href and a jump that
//     scrolls + focuses (#193), never a write.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => <div>REFERENCE</div> }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./PricingCard", () => ({ PricingCard: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";

const BUCKETS = {
  intersections: { detected: true, count: 26, nearest_distance_ft: 34.1 },
  interchanges: { detected: false, count: 0 },
  sidewalks: { detected: true, count: 18, nearest_distance_ft: 46.6 },
  bike_facilities: { detected: false, count: 0 },
  schools: { detected: false, count: 0 },
};
const SECTIONS = {
  taper: {},
  buffer: {},
  spacing: {},
  advance: {},
  colorado: {},
  case: {},
  flagger: {},
  corridor_validation: { checked: false, warnings: [] },
  geometry_validation: { violations: [], all_pass: true },
};
const audit = (corrections: unknown[] = []) => ({
  summary: {},
  sections: {
    ...SECTIONS,
    site_scan: { status: "ok", mode: "corridor", measured_at: "2026-09-04T12:00:00+00:00", buckets: BUCKETS, flags: {}, corrections },
  },
  pending_verification: { count: 1, note: "one item", tracking_issue: null },
  plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
});
const REFUSAL = {
  detail: {
    error: "site_scan_unavailable",
    message:
      "Site scan unavailable — the plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway — the plan says whether the scan ran.",
    site_scan: { status: "unavailable", error: "scan budget exceeded (20 s)", mode: "corridor", measured_at: "2026-09-03T15:29:51+00:00", budget_s: 20.0, proceeded_anyway: false },
    recovery: { retry: true, proceed_field: "site_scan.proceed_if_unavailable" },
  },
};
const BREAKDOWN = { devices: [], total_devices: 4, unique_types: 2, zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 } };
const ok = (data: unknown): Response => ({ ok: true, status: 200, json: async () => data }) as unknown as Response;
const bad = (status: number, data: unknown): Response =>
  ({ ok: false, status, json: async () => data, text: async () => "boom" }) as unknown as Response;

let served: unknown = audit();
let auditRefuses = false;
let breakdownFails: 500 | 400 | null = null;
let breakdownCalls = 0;
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) return Promise.resolve(auditRefuses ? bad(400, REFUSAL) : ok(served));
  if (url.includes("/api/render/device-breakdown")) {
    breakdownCalls += 1;
    // The pre-generate breakdown always answers; the failure is armed for the generated wire.
    if (breakdownFails && breakdownCalls > 1) return Promise.resolve(bad(breakdownFails, breakdownFails === 400 ? REFUSAL : {}));
    return Promise.resolve(ok(BREAKDOWN));
  }
  return Promise.resolve(ok({}));
});
const scrolled: Element[] = [];
beforeEach(() => {
  fetchMock.mockClear();
  scrolled.length = 0;
  served = audit();
  auditRefuses = false;
  breakdownFails = null;
  breakdownCalls = 0;
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
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
const strip = () => document.querySelector(".ns-strip");
const chips = () => Array.from(document.querySelectorAll(".ns-strip .ns-chip")) as HTMLAnchorElement[];
const count = (i: number) => chips()[i].querySelector(".ns-count")!.textContent!.replace(/\s+/g, " ").trim();

describe("#253 — the next-steps strip through the shell", () => {
  it("pre-generate there is no strip and no slot; after Generate the strip carries the three counts and chip 2 reads pending_verification.count", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(strip()).toBeNull();
    expect(document.querySelector(".results-head-slot")).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await settle();
    expect(strip()).not.toBeNull();
    expect([count(0), count(1), count(2)]).toEqual(["2 OPEN/5", "1 OPEN", "4 FILES READY"]);
    expect(chips()[1].querySelector(".ns-glyph")!.textContent).toBe("▲");
  });

  it("a broken breakdown under a clean audit: the strip renders, chip 3 is ◌ NOT PRODUCED and inert (aria-disabled); chips 1-2 stay live", async () => {
    breakdownFails = 500;
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await settle();
    expect(screen.getByText(/Device breakdown failed/)).toBeTruthy();
    expect(strip()).not.toBeNull();
    expect(count(2)).toBe("◌ NOT PRODUCED");
    expect(chips()[2].getAttribute("aria-disabled")).toBe("true");
    expect(chips()[2].className).toBe("ns-chip is-none");
    expect(chips()[0].getAttribute("aria-disabled")).toBeNull();
    expect(count(0)).toBe("2 OPEN/5");
    // The inert chip does not jump.
    scrolled.length = 0;
    await user.click(chips()[2]);
    expect(scrolled).toEqual([]);
  });

  it("spec 31 (the c2 declined pair): the audit refused and the breakdown 400s too — no strip, no slot; the refusal container is the voice", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    auditRefuses = true;
    breakdownFails = 400;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await settle();
    expect(document.querySelector(".scan-refusal")).not.toBeNull();
    expect(strip()).toBeNull();
    expect(document.querySelector(".results-head-slot")).toBeNull();
  });

  it("a count never changes on click: Assert stages (· 1 STAGED appended, open unchanged); only the served answer after Apply moves it", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await settle();
    expect(count(0)).toBe("2 OPEN/5");
    const block = document.getElementById("site-corrections")!;
    const school = within(block).getByText("School zone").closest(".site-correction-row") as HTMLElement;
    await user.click(within(school).getByRole("button", { name: "Assert" }));
    await settle();
    expect(count(0)).toBe("2 OPEN/5 · 1 STAGED");
    // The server's answer after Apply closes a DIFFERENT row (a dismiss
    // record for the intersection): open 2 → 1 comes from the wire, the
    // staged suffix goes with the applied set.
    served = audit([{ flag: "adjacent_intersection", action: "dismiss", reason: "not_on_route", status: "applied", scan_detected: true, disclosure: "Operator dismissed the adjacent intersection." }]);
    await user.click(within(block).getByRole("button", { name: "Apply 1 correction" }));
    await settle();
    expect(count(0)).toBe("1 OPEN/5");
  });

  it("every chip is a data-read in-page link (never a write) and jumps with scroll + focus (#193); the Reference zone and the downloads wrapper carry their anchors", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    await settle();
    for (const a of chips()) {
      expect(a.tagName).toBe("A");
      expect(a.hasAttribute("data-read")).toBe(true);
      expect(a.hasAttribute("data-write")).toBe(false);
      expect(a.getAttribute("href")).toMatch(/^#/);
    }
    const reference = document.getElementById("reference")!;
    expect(reference.tagName).toBe("SECTION");
    expect(reference.textContent).toContain("Reference");
    const downloads = document.getElementById("downloads")!;
    expect(downloads.querySelector(".dls")).not.toBeNull();
    scrolled.length = 0;
    await user.click(chips()[2]);
    expect(scrolled).toEqual([downloads]);
    expect(document.activeElement).toBe(downloads);
  });
});
