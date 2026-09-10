// @vitest-environment happy-dom
//
// #253 (was #249 + #247 + #246, + #252 + #240) — the results-head slot,
// one derived state rendered by one component.  While the FIRST answer
// for the generated scenario is in flight the slot is reserved and EMPTY
// and the working band is the voice (#252 retired the #247 wait line).
// Once a plan LANDS: the next-steps strip — three chips with server
// counts (chip 1 over the keyed buckets on the wire, chip 2 the pending
// count, chip 3 the zip's parts) and their anchors — REPLACING the #249
// lockup (GO conflict 1: one field, one surface).  A scan that did not
// run renders chip 1 as ◌ NOT SCANNED (a declared change from the
// lockup's null); a declined plan renders no strip (spec 31: the refusal
// container is the voice).  Under the band the strip stays mounted with
// its last confirmed counts.  Mounted through the real shell and the
// real SetupStrip.
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
const waitLine = () => document.querySelector(".results-head-wait");
const lockup = () => document.querySelector(".results-head-lockup");
const strip = () => document.querySelector(".ns-strip") as HTMLElement | null;
const slot = () => document.querySelector(".results-head-slot");
const chips = () => Array.from(document.querySelectorAll(".ns-strip .ns-chip")) as HTMLAnchorElement[];
const count = (a: Element) => a.querySelector(".ns-count")!.textContent!.replace(/\s+/g, " ").trim();
/** The strip with its three counts, in order, and the invariants every
 *  render carries: three chips, the names, the anchors, no "five", no
 *  "done" (rule 12 / spec 9). */
function expectStrip(site: string, pending: string, files: string) {
  const s = strip();
  expect(s, "strip present").not.toBeNull();
  expect(lockup(), "the #249 lockup is deleted").toBeNull();
  const c = chips();
  expect(c).toHaveLength(3);
  expect(c.map(count)).toEqual([site, pending, files]);
  expect(c.map((a) => a.querySelector(".ns-name")!.textContent)).toEqual(["Site conditions", "Pending items", "Download"]);
  expect(c.map((a) => a.querySelector(".ns-index")!.textContent)).toEqual(["01", "02", "03"]);
  expect(c.map((a) => a.getAttribute("href"))).toEqual(["#site-corrections", "#reference", "#downloads"]);
  expect(c.every((a) => a.hasAttribute("data-read"))).toBe(true);
  expect(within(s!).getByText("NEXT — 3 STEPS")).toBeTruthy();
  expect(s!.textContent).not.toMatch(/five|\bdone\b|\bcomplete\b|NOT YET EVALUATED/i);
  return s!;
}
const glyphs = () => chips().map((a) => a.querySelector(".ns-glyph")!.textContent);

describe("#253 — the results-head slot: the next-steps strip", () => {
  it("#253: the strip names the settled scan's open count over the keyed buckets served, the pending count and the zip's parts; the chips jump to the block, the Reference zone and the downloads anchor (scroll + focus by id)", async () => {
    served = audit(BUCKETS_DETECTED);
    const user = await generate();
    // Two of the five keyed buckets detected and uncorrected; the keyless hospital is neither counted nor totalled.
    const s = expectStrip("2 OPEN/5", "0 OPEN", "4 FILES READY");
    expect(glyphs()).toEqual(["▲", "✓", "✓"]);
    expect(chips().map((a) => a.className)).toEqual(["ns-chip is-open", "ns-chip is-clear", "ns-chip is-ready"]);
    // The numeral is the count register's orange only where a number is generated.
    expect(chips().map((a) => a.querySelector(".ns-num")?.textContent ?? null)).toEqual(["2", null, "4"]);
    expect(waitLine()).toBeNull();
    const block = document.getElementById("site-corrections");
    expect(block, "the strip block is mounted with the anchor id").not.toBeNull();
    expect(block!.textContent).toContain("Site conditions — scanned");
    // Chip order inside: index → glyph → name → count (spec 17).
    expect(Array.from(chips()[0].children).map((k) => k.className.split(" ")[0])).toEqual(["ns-index", "ns-glyph", "ns-name", "ns-count"]);
    expect(s.getAttribute("aria-label")).toBe("Next steps");
    scrolled.length = 0; // drop the #152 E post-generate scroll to the results zone
    await user.click(chips()[0]);
    expect(scrolled).toEqual([block]);
    expect(document.activeElement).toBe(block);
    // Chip 2 → the Reference zone; chip 3 → the shell-level downloads anchor.
    scrolled.length = 0;
    await user.click(chips()[1]);
    const reference = document.getElementById("reference")!;
    expect(reference.classList.contains("zone")).toBe(true);
    expect(scrolled).toEqual([reference]);
    expect(document.activeElement).toBe(reference);
    scrolled.length = 0;
    await user.click(chips()[2]);
    const downloads = document.getElementById("downloads")!;
    expect(downloads.classList.contains("jump-anchor")).toBe(true);
    expect(downloads.classList.contains("ns-below")).toBe(true);
    expect(scrolled).toEqual([downloads]);
  });

  it("#253 spec 28: zero detected renders ✓ 0 OPEN/5 — the chip stays, no chip is dropped", async () => {
    served = audit(BUCKETS_NONE);
    await generate();
    expect(document.getElementById("site-corrections")).not.toBeNull();
    expectStrip("0 OPEN/5", "0 OPEN", "4 FILES READY");
    expect(glyphs()).toEqual(["✓", "✓", "✓"]);
    expect(waitLine()).toBeNull();
  });

  it("#253 rule 12: the total is the keyed buckets ON THE WIRE — three served ⇒ 1 OPEN/3", async () => {
    served = audit(BUCKETS_THREE);
    await generate();
    expectStrip("1 OPEN/3", "0 OPEN", "4 FILES READY");
    // The block shows the same three rows (a bucket missing from the wire renders no row).
    expect(document.querySelectorAll("#site-corrections .site-correction-row")).toHaveLength(3);
  });

  it("#253: the pending count is pending_verification.count — 3 renders ▲ 3 OPEN", async () => {
    served = { ...audit(BUCKETS_DETECTED), pending_verification: { count: 3, note: "x", tracking_issue: null } };
    await generate();
    expectStrip("2 OPEN/5", "3 OPEN", "4 FILES READY");
    expect(glyphs()[1]).toBe("▲");
  });

  it("#253 rule 10 (declared change from the lockup's null): not_run and a proceeded outage render ◌ NOT SCANNED with the link live; a refused scan renders NO strip — the refusal container is the voice", async () => {
    // not_run: nothing was checked; the chip says so and its link leads to the block that explains why.
    served = auditWithScan({ status: "not_run", reason: "not_requested" });
    await generate();
    expectStrip("◌ NOT SCANNED", "0 OPEN", "4 FILES READY");
    expect(glyphs()[0]).toBe("◌");
    expect(chips()[0].getAttribute("aria-disabled")).toBeNull();
    expect(waitLine()).toBeNull();
    cleanup();
    // unavailable + proceeded: the strip's NOT CHECKED container speaks for the outage; the chip states the same fact.
    served = auditWithScan({ ...SCAN_UNAVAILABLE, proceeded_anyway: true, disclosure: DISCLOSURE });
    await generate();
    expectStrip("◌ NOT SCANNED", "0 OPEN", "4 FILES READY");
    expect(document.querySelector(".site-not-checked")).not.toBeNull();
    expect(screen.getByText(DISCLOSURE)).toBeTruthy();
    cleanup();
    // refused (400 site_scan_unavailable): no plan landed — no strip, no slot.
    auditRefuses = true;
    await generate();
    expect(strip()).toBeNull();
    expect(slot()).toBeNull();
    expect(document.querySelector(".scan-refusal")).not.toBeNull();
    expect(screen.getByText(REFUSAL_MESSAGE)).toBeTruthy();
  });

  it("#252 (was #247): while the generated scenario's audit is in flight the slot is reserved and empty and the band is up; the strip lands on settle, inside the slot", async () => {
    // Pre-generate the audit runs WITHOUT the scan (withSiteScan applies
    // only once generated): its provenance is not_run.
    served = auditWithScan({ status: "not_run", reason: "not_requested" });
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(waitLine()).toBeNull();
    expect(strip()).toBeNull();
    expect(slot()).toBeNull();
    expect(band()).toBeNull();
    served = audit(BUCKETS_DETECTED);
    const held = gate(served);
    auditGate = held;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate package" }));
    await settle();
    expect(band(), "band present while the audit is pending").not.toBeNull();
    expect(waitLine()).toBeNull();
    // No answer has landed for the generated scenario: the pre-generate
    // not_run answer is NOT shown as this plan's (rule 10) — the slot is
    // reserved, empty.
    expect(strip()).toBeNull();
    expect(slot()).not.toBeNull();
    expect(slot()!.children).toHaveLength(0);
    expect(document.getElementById("site-corrections")).toBeNull();
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
    const s = expectStrip("2 OPEN/5", "0 OPEN", "4 FILES READY");
    expect(s.parentElement).toBe(slot());
    expect(document.getElementById("site-corrections")).not.toBeNull();
  });

  it("#252 (was #247): a pending breakdown also keeps the band up and the slot empty — the strip never renders before the pair has settled", async () => {
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
    expect(strip()).toBeNull();
    expect(slot()!.children).toHaveLength(0);
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
    expectStrip("2 OPEN/5", "0 OPEN", "4 FILES READY");
  });

  // #240 (P1): the slot's room is reserved from the moment the lifecycle
  // leaves "pre" — the strip lands at the settle into height already
  // allocated (`.results-head-slot`, min-height --strip-h).  Released
  // only under a declined plan.  Pre-generate: nothing, not even the slot.
  it("#240: the results-head slot is reserved from Generate, holds the strip at the settle, and is absent pre-generate and under a declined plan", async () => {
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
    expect(slot()).not.toBeNull();
    expect(strip()!.parentElement).toBe(slot());
    expect(document.querySelectorAll(".results-head-slot")).toHaveLength(1);
    cleanup();
    auditGate = null; // the released gate would otherwise keep answering ok
    auditRefuses = true;
    await generate();
    expect(document.querySelector(".scan-refusal")).not.toBeNull();
    expect(slot()).toBeNull();
    expect(strip()).toBeNull();
  });

  // Spec 34 (#249): a correction re-generates the plan; while that
  // re-generation is in flight the block stays MOUNTED with every button
  // disabled, the band is up naming the correction (#252) and the strip
  // stays mounted with its last confirmed counts (#253 spec 21-22: the
  // chips dim under the lock, the counts never tick).
  it("#249 spec 34 + #252 + #253: after Assert → Apply the block stays mounted and disabled, the band names the correction, the strip holds its counts under the lock; on settle the record lands and the counts are the server's", async () => {
    served = audit(BUCKETS_DETECTED);
    const user = await generate();
    const block = () => document.getElementById("site-corrections");
    expect(block()).not.toBeNull();
    expect(block()!.getAttribute("aria-busy")).toBeNull();
    expectStrip("2 OPEN/5", "0 OPEN", "4 FILES READY");
    const asserted = {
      flag: "school_zone",
      action: "assert",
      status: "applied",
      scan_detected: false,
      disclosure: "Operator asserted school zone — the scan found none along the corridor.",
    };
    served = { ...audit(BUCKETS_DETECTED) };
    (served as { sections: { site_scan: { corrections: unknown[] } } }).sections.site_scan.corrections = [asserted];
    const held = gate(served);
    auditGate = held;
    const school = within(block()!).getByText("School zone").closest(".site-correction-row") as HTMLElement;
    await user.click(within(school).getByRole("button", { name: "Assert" }));
    await settle();
    // #254: staged, nothing in flight yet — the chip APPENDS the staged count, never subtracts (open stays the server's 2).
    expect(band()).toBeNull();
    expect(block()!.getAttribute("aria-busy")).toBeNull();
    expectStrip("2 OPEN/5 · 1 STAGED", "0 OPEN", "4 FILES READY");
    await user.click(within(block()!).getByRole("button", { name: "Apply 1 correction" }));
    await settle();
    // In flight: block mounted on the held scan, aria-busy, every button disabled; band up.
    expect(block(), "block stays mounted mid re-generation").not.toBeNull();
    expect(block()!.getAttribute("aria-busy")).toBe("true");
    const buttons = Array.from(block()!.querySelectorAll("button")) as HTMLButtonElement[];
    expect(buttons.length).toBe(6); // five condition rows + the Apply row
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(band()).not.toBeNull();
    expect(band()!.querySelector(".wb-verb")!.textContent).toBe("RE-GENERATING");
    expect(band()!.querySelector(".wb-object")!.textContent).toBe("after a correction to School zone");
    expect(band()!.querySelector(".wb-named")!.textContent).toBe("School zone");
    expect(waitLine()).toBeNull();
    // #253 spec 21-22: the strip stays mounted under the lock with the last confirmed counts — never a placeholder, never a tick.
    expect(document.querySelector(".workbench")!.classList.contains("ws-locked")).toBe(true);
    expectStrip("2 OPEN/5", "0 OPEN", "4 FILES READY");
    expect(chips().every((a) => a.hasAttribute("data-read") && a.getAttribute("aria-disabled") === null)).toBe(true);
    // Release: the record replaces the row, buttons re-enable, the counts are the served answer's.
    await act(async () => {
      held.release();
    });
    await settle();
    expect(block()!.getAttribute("aria-busy")).toBeNull();
    expect(within(block()!).getByText(asserted.disclosure)).toBeTruthy();
    const after = Array.from(block()!.querySelectorAll("button:not(.confirm)")) as HTMLButtonElement[];
    expect(after.some((b) => b.disabled)).toBe(false);
    expect((within(block()!).getByRole("button", { name: "Apply 0 corrections" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(block()!).getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(band()).toBeNull();
    expectStrip("2 OPEN/5", "0 OPEN", "4 FILES READY");
  });
});
