// @vitest-environment happy-dom
//
// #247 + #246 — the results-head slot, one derived state rendered by one
// component.  After Generate the viewport lands on the results zone
// (#152 E); the strip's VERIFYING line sits under the fixed nav there,
// so while a fetch for the generated scenario is in flight the results
// head carries the wait line (#247).  Once the scan settles: the
// detected count with a jump to the strip's correction block (#246);
// no detections ⇒ nothing (rule 10).  The two states never co-render.
// Mounted through the real shell and the real SetupStrip.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
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
const audit = (buckets: unknown) => ({
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
    site_scan: {
      status: "ok",
      mode: "corridor",
      measured_at: "2026-09-04T12:00:00+00:00",
      buckets,
      flags: {},
      corrections: [],
    },
  },
  pending_verification: { count: 0, note: "", tracking_issue: null },
  plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
});
const BREAKDOWN = {
  devices: [],
  total_devices: 4,
  unique_types: 2,
  zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 },
};
const ok = (data: unknown): Response =>
  ({ ok: true, status: 200, json: async () => data }) as unknown as Response;

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
let auditGate: Gate = null;
let breakdownGate: Gate = null;
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) return auditGate ? auditGate.promise : Promise.resolve(ok(served));
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
const jumpLine = () => screen.queryByText(/detected ·/);

describe("#247 + #246 — the results-head slot", () => {
  it("#246: names the settled scan's detected count and jumps to the strip's block (scroll + focus by id)", async () => {
    served = audit(BUCKETS_DETECTED);
    const user = await generate();
    // Two of the five keyed buckets detected; the keyless hospital is not counted.
    const line = screen.getByText("Site conditions — 2 detected ·");
    expect(line.className).toContain("site-jump");
    expect(waitLine()).toBeNull();
    const block = document.getElementById("site-corrections");
    expect(block, "the strip block is mounted with the anchor id").not.toBeNull();
    expect(block!.textContent).toContain("Site conditions — scanned");
    scrolled.length = 0; // drop the #152 E post-generate scroll to the results zone
    await user.click(screen.getByRole("link", { name: "correct in setup ↑" }));
    expect(scrolled).toEqual([block]);
    expect(document.activeElement).toBe(block);
  });

  it("#246: renders no line when the scan detected nothing keyed (absence renders as absence)", async () => {
    served = audit(BUCKETS_NONE);
    await generate();
    expect(document.getElementById("site-corrections")).not.toBeNull();
    expect(jumpLine()).toBeNull();
    expect(waitLine()).toBeNull();
    expect(document.querySelector(".site-jump")).toBeNull();
  });

  it("#247: while the generated scenario's audit is in flight the wait line renders in the results head; it yields to the jump line on settle", async () => {
    served = audit(BUCKETS_DETECTED);
    // Before Generate nothing is in the slot, even with fetches in flight (pre-generate).
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(waitLine()).toBeNull();
    // Generate with the audit held pending: the breakdown settles (the
    // landing fires), the scan has not answered — the wait line shows,
    // in the results zone, and the jump line does not.
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
    expect(jumpLine()).toBeNull();
    // The strip block is the stamped view — absent mid-flight.
    expect(document.getElementById("site-corrections")).toBeNull();
    // Release the audit: the wait line goes, the jump line arrives.
    await act(async () => {
      held.release();
    });
    await settle();
    expect(waitLine()).toBeNull();
    expect(screen.getByText("Site conditions — 2 detected ·")).toBeTruthy();
    expect(document.getElementById("site-corrections")).not.toBeNull();
  });

  it("#247: the two states are mutually exclusive — a pending breakdown also reads as wait, never alongside the jump line", async () => {
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
    expect(jumpLine()).toBeNull();
    expect(document.querySelectorAll(".site-jump")).toHaveLength(1);
    await act(async () => {
      held.release();
    });
    await settle();
    expect(waitLine()).toBeNull();
    expect(jumpLine()).not.toBeNull();
    expect(document.querySelectorAll(".site-jump")).toHaveLength(1);
  });
});
