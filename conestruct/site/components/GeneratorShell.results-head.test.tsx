// @vitest-environment happy-dom
//
// #249 + #247 + #246 — the results-head slot, one derived state rendered
// by one component.  After Generate the viewport lands on the results
// zone (#152 E); the strip's VERIFYING line sits under the fixed nav
// there, so while a fetch for the generated scenario is in flight the
// results head carries the wait line (#247).  Once the scan settles and
// RAN: the count lockup — figure, "Site conditions detected / No site
// conditions detected", "of N checked" over the keyed buckets on the
// wire, and the jump to the strip's correction block (#246).  Every
// other scan state renders nothing here: that state's own container is
// the voice (rule 10).  The states never co-render.  Mounted through the
// real shell and the real SetupStrip.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./PricingCard", () => ({ PricingCard: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({ onGenerate }: { onGenerate: () => void }) => (
    <button type="button" onClick={onGenerate}>
      Generate package
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { RESULTS_HEAD_WAIT_COPY } from "./ResultsHead";
import { PINNED_SHOULDER } from "./test-fixtures";

const BUCKETS_DETECTED = {
  intersections: { detected: true, count: 26, nearest_distance_ft: 34.1, details: ["W Alameda Ave"] },
  interchanges: { detected: false, count: 0 },
  sidewalks: { detected: true, count: 18, nearest_distance_ft: 46.6 },
  bike_facilities: { detected: false, count: 0 },
  schools: { detected: false, count: 0 },
  hospitals: { detected: true, count: 1 },
};
const BUCKETS_NONE = {
  intersections: { detected: false, count: 0 },
  interchanges: { detected: false, count: 0 },
  sidewalks: { detected: false, count: 0 },
  bike_facilities: { detected: false, count: 0 },
  schools: { detected: false, count: 0 },
  hospitals: { detected: true, count: 1 }, // keyless: measured, no rule, not counted
};
// Three keyed buckets on the wire (two never sent): the total is what
// was served, never the mirror's five (rule 12 / rule 10).
const BUCKETS_THREE = {
  intersections: { detected: true, count: 4, nearest_distance_ft: 120.0 },
  sidewalks: { detected: false, count: 0 },
  schools: { detected: false, count: 0 },
  hospitals: { detected: false, count: 0 },
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
const TAIL = {
  pending_verification: { count: 0, note: "", tracking_issue: null },
  plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
};
const audit = (buckets: unknown) => ({
  summary: {},
  sections: {
    ...SECTIONS,
    site_scan: {
      status: "ok",
      mode: "corridor",
      measured_at: "2026-09-04T12:00:00+00:00",
      buckets,
      flags: {},
      corrections: [],
    },
  },
  ...TAIL,
});
const auditWithScan = (site_scan: unknown) => ({
  summary: {},
  sections: { ...SECTIONS, site_scan },
  ...TAIL,
});
const DISCLOSURE = "SITE CONDITIONS NOT CHECKED — service unavailable at generation.";
const SCAN_UNAVAILABLE = {
  status: "unavailable",
  reason: null,
  error: "scan budget exceeded (20 s)",
  mode: "corridor",
  measured_at: "2026-09-03T15:29:51+00:00",
  duration_ms: 20525,
  budget_s: 20.0,
  memo_hit: false,
  proceeded_anyway: false,
  flags: {},
  manual_flags_discarded: {},
  disclosure: null,
  corrections: [],
};
const REFUSAL_MESSAGE =
  "Site scan unavailable — the plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway and the plan will carry a NOT-CHECKED disclosure.";
const REFUSAL = {
  detail: {
    error: "site_scan_unavailable",
    message: REFUSAL_MESSAGE,
    site_scan: SCAN_UNAVAILABLE,
    recovery: { retry: true, proceed_field: "site_scan.proceed_if_unavailable" },
  },
};
const BREAKDOWN = {
  devices: [],
  total_devices: 4,
  unique_types: 2,
  zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 },
};
const ok = (data: unknown): Response =>
  ({ ok: true, status: 200, json: async () => data }) as unknown as Response;
const refused = (data: unknown): Response =>
  ({ ok: false, status: 400, json: async () => data }) as unknown as Response;

// Per-endpoint gates: when a gate holds a deferred promise, that fetch
// stays in flight until the test releases it (the "held pending" idiom).
type Gate = { promise: Promise<Response>; release: () => void } | null;
function gate(data: unknown): NonNullable<Gate> {
  let release!: () => void;
  const promise = new Promise<Response>((r) => {
    release = () => r(ok(data));
  });
  return { promise, release };
}
let served: unknown = audit(BUCKETS_DETECTED);
let auditRefuses = false;
let auditGate: Gate = null;
let breakdownGate: Gate = null;
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    if (auditGate) return auditGate.promise;
    return Promise.resolve(auditRefuses ? refused(REFUSAL) : ok(served));
  }
  if (url.includes("/api/render/device-breakdown"))
    return breakdownGate ? breakdownGate.promise : Promise.resolve(ok(BREAKDOWN));
  return Promise.resolve(ok({}));
});
const scrolled: Element[] = [];
beforeEach(() => {
  fetchMock.mockClear();
  scrolled.length = 0;
  auditGate = null;
  breakdownGate = null;
  auditRefuses = false;
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
async function generate() {
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
  await settle();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Generate package" }));
  await settle();
  return user;
}
const waitLine = () => document.querySelector(".results-head-wait");
const lockup = () => document.querySelector(".results-head-lockup") as HTMLElement | null;
const slotStates = () => document.querySelectorAll(".results-head-wait, .results-head-lockup");
function expectLockup(count: number, total: number) {
  const l = lockup();
  expect(l, "lockup present").not.toBeNull();
  const figure = l!.querySelector(".rh-figure")!;
  expect(figure.textContent).toBe(String(count));
  expect(figure.classList.contains(count > 0 ? "rh-detected" : "rh-none")).toBe(true);
  expect(within(l!).getByText(count > 0 ? "Site conditions detected" : "No site conditions detected")).toBeTruthy();
  expect(within(l!).getByText(`of ${total} checked`)).toBeTruthy();
  expect(within(l!).getByRole("link", { name: "correct in setup ↑" })).toBeTruthy();
  // Rule 12: no number word, no literal five outside the counted total.
  expect(l!.textContent).not.toMatch(/five/i);
  return l!;
}

describe("#249 + #247 + #246 — the results-head slot", () => {
  it("#246/#249: the lockup names the settled scan's detected count over the keyed buckets served and jumps to the strip's block (scroll + focus by id)", async () => {
    served = audit(BUCKETS_DETECTED);
    const user = await generate();
    // Two of the five keyed buckets detected; the keyless hospital is neither counted nor totalled.
    const l = expectLockup(2, 5);
    expect(waitLine()).toBeNull();
    const block = document.getElementById("site-corrections");
    expect(block, "the strip block is mounted with the anchor id").not.toBeNull();
    expect(block!.textContent).toContain("Site conditions — scanned");
    // Lockup order: figure → labels (line 1 then line 2) → link (spec 54).
    expect(Array.from(l.children).map((k) => k.className.split(" ")[0])).toEqual(["rh-figure", "rh-labels", "tr-signpost"]);
    scrolled.length = 0; // drop the #152 E post-generate scroll to the results zone
    await user.click(screen.getByRole("link", { name: "correct in setup ↑" }));
    expect(scrolled).toEqual([block]);
    expect(document.activeElement).toBe(block);
  });

  it("#249 (GO ruling d, a stated change from arc-19/20): zero detected still renders — 0 · No site conditions detected · of 5 checked", async () => {
    served = audit(BUCKETS_NONE);
    await generate();
    expect(document.getElementById("site-corrections")).not.toBeNull();
    expectLockup(0, 5);
    expect(waitLine()).toBeNull();
    expect(slotStates()).toHaveLength(1);
  });

  it("#249 rule 12: the total is the keyed buckets ON THE WIRE — three served ⇒ of 3 checked", async () => {
    served = audit(BUCKETS_THREE);
    await generate();
    expectLockup(1, 3);
    // The block shows the same three rows (a bucket missing from the wire renders no row).
    expect(document.querySelectorAll("#site-corrections .site-correction-row")).toHaveLength(3);
  });

  it("#249 rule 10: not_run, a proceeded outage, and a refused scan render NO lockup — each state's own container is the voice", async () => {
    // not_run: nothing was checked; no block exists to correct.
    served = auditWithScan({ status: "not_run", reason: "not_requested" });
    await generate();
    expect(lockup()).toBeNull();
    expect(waitLine()).toBeNull();
    expect(document.getElementById("site-corrections")).toBeNull();
    cleanup();
    // unavailable + proceeded: the strip's NOT CHECKED container speaks.
    served = auditWithScan({ ...SCAN_UNAVAILABLE, proceeded_anyway: true, disclosure: DISCLOSURE });
    await generate();
    expect(lockup()).toBeNull();
    expect(waitLine()).toBeNull();
    expect(document.querySelector(".site-not-checked")).not.toBeNull();
    expect(screen.getByText(DISCLOSURE)).toBeTruthy();
    cleanup();
    // refused (400 site_scan_unavailable): the refusal container speaks.
    auditRefuses = true;
    await generate();
    expect(lockup()).toBeNull();
    expect(waitLine()).toBeNull();
    expect(document.querySelector(".scan-refusal")).not.toBeNull();
    expect(screen.getByText(REFUSAL_MESSAGE)).toBeTruthy();
  });

  it("#247: while the generated scenario's audit is in flight the wait line renders in the results head; it yields to the lockup on settle", async () => {
    served = audit(BUCKETS_DETECTED);
    // Before Generate nothing is in the slot, even with fetches in flight (pre-generate).
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(waitLine()).toBeNull();
    expect(lockup()).toBeNull();
    // Generate with the audit held pending: the breakdown settles (the
    // landing fires), the scan has not answered — the wait line shows,
    // in the results zone, and the lockup does not.
    const held = gate(served);
    auditGate = held;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate package" }));
    await settle();
    const wait = waitLine();
    expect(wait, "wait line present while the audit is pending").not.toBeNull();
    expect(wait!.textContent).toBe(RESULTS_HEAD_WAIT_COPY);
    expect(wait!.querySelector(".rh-spin[aria-hidden]")).not.toBeNull();
    const results = document.querySelectorAll("section.zone")[1];
    expect(results.contains(wait!)).toBe(true);
    expect(lockup()).toBeNull();
    // The strip block is the stamped view — absent mid-flight.
    expect(document.getElementById("site-corrections")).toBeNull();
    // Release the audit: the wait line goes, the lockup arrives.
    await act(async () => {
      held.release();
    });
    await settle();
    expect(waitLine()).toBeNull();
    expectLockup(2, 5);
    expect(document.getElementById("site-corrections")).not.toBeNull();
  });

  it("#247: the two states are mutually exclusive — a pending breakdown also reads as wait, never alongside the lockup", async () => {
    served = audit(BUCKETS_DETECTED);
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    const held = gate(BREAKDOWN);
    breakdownGate = held;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate package" }));
    await settle();
    // The audit answered (the block is up) but generation is still computing.
    expect(document.getElementById("site-corrections")).not.toBeNull();
    expect(waitLine()).not.toBeNull();
    expect(lockup()).toBeNull();
    expect(slotStates()).toHaveLength(1);
    await act(async () => {
      held.release();
    });
    await settle();
    expect(waitLine()).toBeNull();
    expect(lockup()).not.toBeNull();
    expect(slotStates()).toHaveLength(1);
  });
});
