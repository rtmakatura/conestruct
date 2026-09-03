// @vitest-environment happy-dom
//
// #224 phase 2 (s2-arc16, commit 3) — Generate sets ``site_scan`` on the
// wire.  The click is a stage flip; what changes is what the debounced
// loop SENDS: once generated, every request — audit, breakdown, the
// bundle — carries the wire scenario ``{...scenario, site_scan}``; before
// it and after Reopen, none does (the pre-generate loop stays scan-free).
// The #197 stamp must compare against that same wire object, or the
// strip reads every post-generate answer as stale (the arc's biggest
// risk — pinned mounted, with the real StatusBar).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
    <button type="button" onClick={onGenerate}>
      Generate package
    </button>
  ),
}));
vi.mock("./SetupStrip", () => ({
  SetupStrip: ({ onReopen }: { onReopen: () => void }) => (
    <button type="button" onClick={onReopen}>
      Edit full setup
    </button>
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
  plan_flags: {
    validation_warnings: 0,
    compliance_fails: 0,
    v1_limitations: 0,
    is_clean: true,
  },
};
const BREAKDOWN = {
  devices: [],
  total_devices: 4,
  unique_types: 2,
  zone_geometry: {
    taper_l_ft: 1,
    buffer_b_ft: 1,
    device_spacing_ft: 1,
    work_len_ft: 1,
  },
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

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? "{}")) as Record<
    string,
    unknown
  >;
  calls.push({ url, body });
  const data = url.includes("/api/render/audit")
    ? AUDIT
    : url.includes("/api/render/device-breakdown")
      ? BREAKDOWN
      : {};
  return Promise.resolve(okResponse(data));
});

beforeEach(() => {
  calls = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<
      string,
      unknown
    >;
    calls.push({ url, body });
    const data = url.includes("/api/render/audit")
      ? AUDIT
      : url.includes("/api/render/device-breakdown")
        ? BREAKDOWN
        : {};
    return Promise.resolve(okResponse(data));
  });
  vi.stubGlobal("fetch", fetchMock);
  // happy-dom implements neither; the bundle path calls both.
  Object.defineProperty(URL, "createObjectURL", {
    value: () => "blob:mock",
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: () => undefined,
    configurable: true,
  });
  HTMLAnchorElement.prototype.click = () => undefined;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function scenarioOf(c: Call): Record<string, unknown> {
  return (c.body.scenario ?? c.body) as Record<string, unknown>;
}
function bodiesFor(path: string): Record<string, unknown>[] {
  return calls.filter((c) => c.url.includes(path)).map(scenarioOf);
}
// #182: edits reach the wire through the 350 ms debounce — wait it out.
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
}
function strip(): string {
  return document.querySelector(".status-bar")?.textContent ?? "";
}

describe("Generate sets site_scan on the wire (#224 phase 2)", () => {
  it("pre-generate requests are scan-free; the click refetches both with the flag", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(bodiesFor("/api/render/audit").length).toBeGreaterThan(0);
    for (const s of [
      ...bodiesFor("/api/render/audit"),
      ...bodiesFor("/api/render/device-breakdown"),
    ]) {
      expect(s.site_scan).toBeUndefined();
    }
    calls = [];
    await user.click(screen.getByText("Generate package"));
    await settle();
    const audits = bodiesFor("/api/render/audit");
    const breakdowns = bodiesFor("/api/render/device-breakdown");
    expect(audits.length).toBe(1);
    expect(breakdowns.length).toBe(1);
    expect(audits[0].site_scan).toEqual({ proceed_if_unavailable: false });
    expect(breakdowns[0].site_scan).toEqual({ proceed_if_unavailable: false });
    // The rest of the scenario is the user's, untouched.
    expect(audits[0].kind).toBe("shoulder");
    expect((audits[0].meta as { lat: number }).lat).toBe(
      PINNED_SHOULDER.meta.lat,
    );
  });

  it("the bundle download carries the same wire scenario", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await user.click(screen.getByText("Generate package"));
    await settle();
    await user.click(screen.getByText("ALL_ZIP"));
    await waitFor(() => expect(bodiesFor("/api/render/bundle").length).toBe(1));
    expect(bodiesFor("/api/render/bundle")[0].site_scan).toEqual({
      proceed_if_unavailable: false,
    });
  });

  it("the replication snapshot posts the wire scenario too (post-ship follow-up: the sender 6d3baee missed)", async () => {
    // The dev-only button gates on ?debug=1 read from window.location.
    window.history.replaceState({}, "", "/sandbox?debug=1");
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    const snap = await screen.findByRole("button", { name: /replication snapshot/i });
    await user.click(snap);
    await waitFor(() => expect(bodiesFor("/api/replication-snapshot").length).toBe(1));
    expect(bodiesFor("/api/replication-snapshot")[0].site_scan).toBeUndefined();
    await user.click(screen.getByText("Generate package"));
    await settle();
    await user.click(await screen.findByRole("button", { name: /replication snapshot/i }));
    await waitFor(() => expect(bodiesFor("/api/replication-snapshot").length).toBe(2));
    expect(bodiesFor("/api/replication-snapshot")[1].site_scan).toEqual({
      proceed_if_unavailable: false,
    });
    window.history.replaceState({}, "", "/");
  });

  it("the strip settles on the scanned answer — never a permanent VERIFYING (the #197 stamp)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(strip()).toContain("READY FOR TCS REVIEW");
    await user.click(screen.getByText("Generate package"));
    await settle();
    await settle();
    expect(strip()).toContain("READY FOR TCS REVIEW");
    expect(strip()).not.toContain("VERIFYING");
  });

  it("Reopen drops the flag: the next request is scan-free again", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await user.click(screen.getByText("Generate package"));
    await settle();
    calls = [];
    await user.click(screen.getByText("Edit full setup"));
    await settle();
    const audits = bodiesFor("/api/render/audit");
    expect(audits.length).toBe(1);
    expect(audits[0].site_scan).toBeUndefined();
  });

  // Hold every SCANNED breakdown so the wait state stays mounted;
  // ``preGenerate`` decides whether the pre-generate breakdown succeeds
  // (the normal path — a last-known-good exists, the #192 ribbon shows)
  // or fails (no carry — the empty state shows).
  function holdScannedBreakdown(preGenerate: "ok" | "fail"): () => void {
    let release: (() => void) | null = null;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      calls.push({ url, body });
      const scanned = Boolean(
        (body.scenario as { site_scan?: unknown } | undefined)?.site_scan,
      );
      if (url.includes("/api/render/device-breakdown")) {
        if (scanned) {
          return new Promise<Response>((resolve) => {
            release = () => resolve(okResponse(BREAKDOWN));
          });
        }
        if (preGenerate === "fail") {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({}),
            text: async () => "boom",
          } as unknown as Response);
        }
      }
      const data = url.includes("/api/render/audit") ? AUDIT : BREAKDOWN;
      return Promise.resolve(okResponse(data));
    });
    return () => {
      if (!release) throw new Error("scanned breakdown never requested");
      release();
    };
  }

  it("a first Generate shows the recomputing ribbon — and it names the scan", async () => {
    const release = holdScannedBreakdown("ok");
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await user.click(screen.getByText("Generate package"));
    await settle();
    // Not the empty state: the pre-generate breakdown is the carry.
    expect(screen.queryByText("Generating…")).toBeNull();
    expect(document.body.textContent).toContain(
      "⟳ Recomputing — scanning site conditions along the corridor (OpenStreetMap, up to 20 s); values below are the previous answer until this settles.",
    );
    // The strip's COMPUTING line names the scan too.
    expect(strip()).toContain("scanning site conditions");
    await act(async () => {
      release();
      await Promise.resolve();
    });
  });

  it("the generating empty state names the scan (no fabricated stage progress)", async () => {
    const release = holdScannedBreakdown("fail");
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await user.click(screen.getByText("Generate package"));
    await settle();
    expect(screen.getByText("Generating…")).toBeTruthy();
    expect(document.body.textContent).toContain(
      "Scanning site conditions along the corridor (OpenStreetMap, up to 20 s), then computing taper, buffer, device spacing, and sign placement.",
    );
    expect(strip()).toContain("scanning site conditions");
    await act(async () => {
      release();
      await Promise.resolve();
    });
  });
});
