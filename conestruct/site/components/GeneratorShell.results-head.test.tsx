// @vitest-environment happy-dom
//
// #288 Phase 1 (s2-arc33) — the results stack's RESERVED FIRST ROW.
//
// This suite was #253's next-steps-strip suite.  §8.29 dropped the strip,
// so every chip assertion retired with it: the three chips, their counts,
// their anchors, the ◌ NOT SCANNED state, the dim-under-the-lock rule.
// They are not commented out or skipped — a test whose subject no longer
// exists is deleted, and the six that only described the strip are gone.
//
// What is kept, because rule 28 kept it: the slot is mounted from the
// Generate click, it is EMPTY while the first answer for the generated
// scenario is in flight (the working band is the voice, #252), it stays
// mounted at the settle, and it is released under a declined plan
// (spec 31: the refusal container is the voice).  The reserve is now
// --fact-h, rule 56's 44 px fact line — a rule, not a measurement.
//
// The row is empty at the settle in this commit too: what forms in it is
// the setup fact line, which arrives with the stack container.  The
// reserve holds whether or not its occupant is built yet, which is the
// point of reserving by rule rather than by measurement.
//
// Mounted through the real shell and the real SetupStrip.
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
  "Site scan unavailable — the plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway — the plan says whether the scan ran.";
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
// #252: the in-flight voice is the band; the slot itself has one state.
const band = () => document.querySelector(".working-band");
const slot = () => document.querySelector(".results-head-slot");
/** §8.29's absence, asserted rather than assumed: no strip, no chip, no
 *  label, anywhere — the run was deleted, not disabled. */
function expectNoStrip() {
  expect(document.querySelector(".ns-strip"), "the strip is gone").toBeNull();
  expect(document.querySelectorAll(".ns-chip")).toHaveLength(0);
  expect(document.body.textContent).not.toContain("NEXT — 3 STEPS");
}

describe("#288 rule 28 — the results stack's reserved first row", () => {
  it("is reserved and EMPTY while the generated scenario's audit is in flight; the band is the voice", async () => {
    // Pre-generate the audit runs WITHOUT the scan (withSiteScan applies
    // only once generated): its provenance is not_run.
    served = auditWithScan({ status: "not_run", reason: "not_requested" });
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(slot(), "nothing pre-generate, not even the slot").toBeNull();
    expect(band()).toBeNull();
    expectNoStrip();
    served = audit(BUCKETS_DETECTED);
    const held = gate(served);
    auditGate = held;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate package" }));
    await settle();
    expect(band(), "band present while the audit is pending").not.toBeNull();
    // No answer has landed for the generated scenario: the pre-generate
    // not_run answer is NOT shown as this plan's (rule 10).
    expect(slot()).not.toBeNull();
    expect(slot()!.children).toHaveLength(0);
    expect(document.getElementById("site-corrections")).toBeNull();
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
    // The settle does not fill the row — the setup fact line arrives with
    // the stack container.  The reserve is a rule, so it holds anyway.
    expect(slot(), "the slot stays mounted at the settle").not.toBeNull();
    expect(slot()!.children).toHaveLength(0);
    expectNoStrip();
    expect(document.getElementById("site-corrections")).not.toBeNull();
  });

  it("a pending breakdown also keeps the band up and the row empty", async () => {
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
    expect(band()).not.toBeNull();
    expect(slot()!.children).toHaveLength(0);
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
    expect(slot()).not.toBeNull();
    expectNoStrip();
  });

  it("is absent pre-generate, mounted exactly once from Generate, and RELEASED under a declined plan", async () => {
    served = auditWithScan({ status: "not_run", reason: "not_requested" });
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(slot()).toBeNull();
    served = audit(BUCKETS_DETECTED);
    const held = gate(served);
    auditGate = held;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate package" }));
    await settle();
    expect(slot(), "slot reserved while the audit is pending").not.toBeNull();
    expect(slot()!.children).toHaveLength(0);
    expect(band()).not.toBeNull();
    await act(async () => {
      held.release();
    });
    await settle();
    expect(document.querySelectorAll(".results-head-slot")).toHaveLength(1);
    cleanup();
    auditGate = null; // the released gate would otherwise keep answering ok
    auditRefuses = true;
    await generate();
    expect(document.querySelector(".scan-refusal")).not.toBeNull();
    expect(slot(), "released under a decline").toBeNull();
  });
});
