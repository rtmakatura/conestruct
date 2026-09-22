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
// Mounted through the real shell and the real band column.
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

describe("#288 Phase 1 deviation from rule 28 — the slot renders NOTHING", () => {
  // Ryan's hand-check on prod at f44377e: the reserved row read as an
  // empty box under the verdict strip.  Rule 28 reserves so the stack
  // does not MOVE when the occupant forms at the settle — and Phase 1
  // never builds that occupant (the setup fact line is Phase 2's, §8.16
  // / §8.27).  A reserve that prevents no movement is 44 px of nothing.
  //
  // The three tests this replaces asserted the slot mounted at Generate,
  // stayed empty at the settle and released under a decline.  Two of
  // those three claims are now about ABSENCE, and the third (the release)
  // is vacuous when nothing ever mounts — so they are rewritten, not
  // deleted: what the suite guards is that no empty box returns, and
  // that the things which DO belong at the top of the stack are there.

  it("#289: the row is RESERVED from the Generate click and released under a decline (rule 28)", async () => {
    served = auditWithScan({ status: "not_run", reason: "not_requested" });
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(slot(), "nothing pre-generate").toBeNull();
    expectNoStrip();
    served = audit(BUCKETS_DETECTED);
    const held = gate(served);
    auditGate = held;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate package" }));
    await settle();
    // Mid-flight: the band is the voice (#252), and there is no empty box
    // waiting beneath the verdict strip for an occupant Phase 1 has not
    // built.
    expect(band(), "band present while the audit is pending").not.toBeNull();
    // #289 Phase 2 closes Phase 1's recorded deviation: the row is
    // RESERVED from the click, which is rule 28's own words.  Here the
    // BREAKDOWN has already landed and only the audit is held, so the
    // stack is showing its answer and the fact line is part of it — the
    // occupant follows `resultsVisible`, the same predicate every other
    // row in the stack follows, rather than a second opinion about when
    // there is something to show.  The genuinely empty case — nothing
    // landed yet — is the next one.
    expect(slot(), "reserved mid-flight").not.toBeNull();
    expect(document.getElementById("site-corrections")).toBeNull();
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
    // At the settle the occupant forms, in the room already allocated:
    // rule 119's one fact line for the whole scenario.
    expect(slot(), "still reserved at the settle").not.toBeNull();
    expect(document.querySelector('[data-testid="fact-setup"]')).not.toBeNull();
    expectNoStrip();
    // What DOES arrive at the settle is the block — the top of the stack
    // is content, not a placeholder.
    expect(document.getElementById("site-corrections")).not.toBeNull();
  });

  it("the occupant follows the stack: present with it, absent without it", async () => {
    // Rule 28 reserves the row from the Generate CLICK; its occupant is
    // part of the answer, so it appears with the rest of the stack and
    // not on a predicate of its own.  That is the claim worth pinning —
    // a second opinion about "is there an answer yet" is exactly how the
    // row would start disagreeing with the hero above it.
    //
    // Note what this suite's harness makes true: the mount fetch has
    // already answered, so a Generate here is #192's REGENERATE — there
    // ARE prior results to hold, and holding them is the rule.  A true
    // S4 (nothing to hold) is the first-ever generate, which the S4
    // commit's own evidence leg walks on a live page.
    served = audit(BUCKETS_DETECTED);
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    const heldAudit = gate(served);
    auditGate = heldAudit;
    const heldBd = gate(BREAKDOWN);
    breakdownGate = heldBd;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate package" }));
    await settle();
    expect(band(), "the band is the voice").not.toBeNull();
    expect(slot(), "the row is reserved from the click").not.toBeNull();
    // The hero is the rest of the stack; the fact line is with it.
    const heroUp = document.querySelector(".hero") !== null;
    const factUp =
      document.querySelector('[data-testid="fact-setup"]') !== null;
    expect(factUp, "the fact line tracks the stack").toBe(heroUp);
    await act(async () => {
      heldBd.release();
      heldAudit.release();
    });
    await settle();
    expect(band()).toBeNull();
    expect(document.querySelector('[data-testid="fact-setup"]')).not.toBeNull();
    expectNoStrip();
  });

  it("the predicate that reserved the row is the one that fills it", async () => {
    // Phase 1 kept `reserve` wired and rendered nothing, so that Phase 2
    // would mount the fact line on exactly that predicate rather than
    // re-deriving a subtly different one.  This is that.
    served = audit(BUCKETS_DETECTED);
    await generate();
    expect(document.querySelectorAll(".results-head-slot")).toHaveLength(1);
    // And under a decline the stack is the refusal's, as spec 31 says —
    // but rule 120 keeps the setup fact line: "Setup fact line unchanged
    // and still changeable."  So the RESERVE is released (rule 28's own
    // word; there is no answer forming below to reserve room for) and
    // the LINE stays, because CHANGE ONE THING is the operator's way
    // back into the input and a refusal leaves them little else.
    cleanup();
    auditGate = null;
    auditRefuses = true;
    await generate();
    expect(document.querySelector(".scan-refusal")).not.toBeNull();
    expect(slot()).not.toBeNull();
    expect(slot()!.className).toContain("is-released");
    expect(document.querySelector('[data-testid="fact-setup"]')).not.toBeNull();
  });
});
