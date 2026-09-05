// @vitest-environment happy-dom
//
// #246 — the results-head jump line.  After Generate the viewport lands
// on the results zone (#152 E), above which the strip's "Site conditions
// — scanned" block holds the only Dismiss / Assert affordances.  When
// the SETTLED scan detected anything, the results head carries one
// read-only line naming the count with a jump to the block; no
// detections ⇒ no line (rule 10).  Mounted through the real shell and
// the real SetupStrip: the jump scrolls + focuses the block by its id.
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

let served: unknown = audit(BUCKETS_DETECTED);
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) return Promise.resolve(ok(served));
  if (url.includes("/api/render/device-breakdown")) return Promise.resolve(ok(BREAKDOWN));
  return Promise.resolve(ok({}));
});
const scrolled: Element[] = [];
beforeEach(() => {
  fetchMock.mockClear();
  scrolled.length = 0;
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

describe("#246 — the results-head jump line", () => {
  it("names the settled scan's detected count and jumps to the strip's block (scroll + focus by id)", async () => {
    served = audit(BUCKETS_DETECTED);
    const user = await generate();
    // Two of the five keyed buckets detected; the keyless hospital is not counted.
    const line = screen.getByText("Site conditions — 2 detected ·");
    expect(line.className).toContain("site-jump");
    const block = document.getElementById("site-corrections");
    expect(block, "the strip block is mounted with the anchor id").not.toBeNull();
    expect(block!.textContent).toContain("Site conditions — scanned");
    scrolled.length = 0; // drop the #152 E post-generate scroll to the results zone
    await user.click(screen.getByRole("link", { name: "correct in setup ↑" }));
    expect(scrolled).toEqual([block]);
    expect(document.activeElement).toBe(block);
  });
  it("renders no line when the scan detected nothing keyed (absence renders as absence)", async () => {
    served = audit(BUCKETS_NONE);
    await generate();
    expect(document.getElementById("site-corrections")).not.toBeNull();
    expect(screen.queryByText(/detected ·/)).toBeNull();
    expect(document.querySelector(".site-jump")).toBeNull();
  });
});
