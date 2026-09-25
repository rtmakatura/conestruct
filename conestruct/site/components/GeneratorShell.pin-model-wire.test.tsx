// @vitest-environment happy-dom
//
// #290 — every sender carries the scenario version field.  The backend
// reads ``meta.pinModel`` before anything reads the pin
// (tests/test_pin_model.py); this pins the other half at the seam where a
// defect would live (Rule 11): what the mounted shell actually SENDS —
// the debounced audit and breakdown, and the Generate bundle — including
// for a plan saved before the field existed, which enters through
// ``toScenario`` (rulings.md, rulings 3 and 10).  Harness: the scan-wire
// test's stubs, unchanged.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./PricingCard", () => ({ PricingCard: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
vi.mock("./OutputCards", () => ({
  OutputCards: ({ onDownloadAll }: { onDownloadAll?: () => void }) => (
    <button type="button" onClick={onDownloadAll}>
      ALL_ZIP
    </button>
  ),
}));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({ onGenerate }: { onGenerate: () => void }) => (
    <div data-testid="band-stack" data-open-band="what">
      <button type="button" onClick={onGenerate}>
        Generate package
      </button>
    </div>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";
import { toScenario } from "@/lib/scenarios";

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

type Call = { url: string; body: Record<string, unknown> };
let calls: Call[] = [];

function okResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => "",
    blob: async () => new Blob(["zip"]),
  } as unknown as Response;
}

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, body });
      const data = url.includes("/api/render/audit")
        ? AUDIT
        : url.includes("/api/render/device-breakdown")
          ? BREAKDOWN
          : {};
      return Promise.resolve(okResponse(data));
    }),
  );
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:mock", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => undefined, configurable: true });
  HTMLAnchorElement.prototype.click = () => undefined;
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
function renderBodies(): Array<{ url: string; meta: Record<string, unknown> }> {
  return calls
    .filter((c) => c.url.includes("/api/render/"))
    .map((c) => {
      const s = (c.body.scenario ?? c.body) as { meta: Record<string, unknown> };
      return { url: c.url, meta: s.meta };
    });
}

describe("every render sender carries meta.pinModel (#290)", () => {
  it("a fresh plan: the debounced audit and breakdown, then the Generate bundle", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await user.click(screen.getByText("Generate package"));
    await settle();
    await user.click(screen.getByText("ALL_ZIP"));
    await settle();
    const bodies = renderBodies();
    const urls = new Set(bodies.map((b) => b.url.replace(/\?.*$/, "")));
    expect([...urls].some((u) => u.includes("/api/render/audit"))).toBe(true);
    expect([...urls].some((u) => u.includes("/api/render/device-breakdown"))).toBe(true);
    expect([...urls].some((u) => u.includes("/api/render/bundle"))).toBe(true);
    for (const b of bodies) expect(b.meta.pinModel, b.url).toBe("corridor_end");
  });

  it("a plan saved before the field existed is sent as corridor_end, never re-read", async () => {
    const { pinModel: _absent, ...oldMeta } = PINNED_SHOULDER.meta;
    const saved = JSON.parse(JSON.stringify({ ...PINNED_SHOULDER, meta: oldMeta }));
    expect(saved.meta.pinModel).toBeUndefined();
    render(<GeneratorShell mode="sandbox" initialScenario={toScenario(saved)} />);
    await settle();
    const bodies = renderBodies();
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) expect(b.meta.pinModel, b.url).toBe("corridor_end");
  });
});
