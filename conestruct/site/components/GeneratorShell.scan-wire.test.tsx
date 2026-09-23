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
  GeneratorSidebar: ({
    onGenerate,
    scenario,
    setScenario,
  }: {
    onGenerate: () => void;
    scenario: { speed: number };
    setScenario: (s: unknown) => void;
  }) => (
    <div data-testid="band-stack" data-open-band="what">
      <button type="button" onClick={onGenerate}>
        Generate package
      </button>
      {/* #289 Phase 2: the stub stands in for the column and carries the
          one cell these cases edit — the WHAT grid's speed select (the
          setup strip and its inline editors are deleted, §8.27). */}
      <label htmlFor="what-speed">Speed limit</label>
      <select
        id="what-speed"
        value={scenario.speed}
        onChange={(e) => setScenario({ ...scenario, speed: +e.target.value })}
      >
        {[25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75].map((s) => (
          <option key={s} value={s}>
            {s} mph
          </option>
        ))}
      </select>
    </div>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";
import {
  changeOneThing,
  editAfterGenerate,
  openWhat,
  openWhere,
} from "./__fixtures__/band-helpers";

// #289 Phase 2 — the setup strip is deleted (§8.27; #262 closes by
// deletion).  A post-generate edit is CHANGE ONE THING on the setup fact
// line, then the WHAT grid's own cell: `editAfterGenerate` in
// components/__fixtures__/band-helpers.ts is those two steps.

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

  it("the strip settles on the scanned answer and the band unmounts — never a permanent in-flight state (the #197 stamp, #252)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(strip()).toContain("READY FOR TCS REVIEW");
    await user.click(screen.getByText("Generate package"));
    await settle();
    await settle();
    expect(strip()).toContain("READY FOR TCS REVIEW");
    expect(strip()).not.toContain("VERIFYING");
    expect(document.querySelector(".working-band")).toBeNull();
  });

  it("an edit under CHANGE ONE THING re-scans, and carries no earlier acknowledgement", async () => {
    // #289 Phase 2 — this case's SUBJECT is gone and its FACT moved.
    //
    // The panel-era Reopen dropped back to "pre" and refired the pair
    // scan-free, which is what "Reopen drops the flag" watched.  CHANGE
    // ONE THING does not drop back: Part 1 §5.4 keeps the answer on
    // screen, so an edit made under it is a re-generation of the plan
    // that is showing — and a re-generation asks for a scan, exactly as
    // the Generate click did.
    //
    // What must NOT survive is the ACKNOWLEDGEMENT.  A
    // `proceed_if_unavailable: true` from an earlier "Generate anyway"
    // is consent for one plan, and the next request asks again from
    // scratch.  That is the fact this case now pins, and its sibling
    // below ("an edit drops the acknowledgement") pins the other half.
    //
    // The scan-free PRE-generate path is unchanged and still covered:
    // every request before the first Generate in this suite carries no
    // `site_scan` at all.
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await user.click(screen.getByText("Generate package"));
    await settle();
    calls = [];
    // #289 S7: the edit STAGES and APPLY is the re-generation (ruling
    // e), so the request this case is about is APPLY's.  The fact is
    // unchanged: a re-generation asks for a scan, and it asks from
    // scratch — no earlier acknowledgement rides along.
    await editAfterGenerate("what-speed", "35");
    await settle();
    const audits = bodiesFor("/api/render/audit");
    expect(audits.length).toBe(1);
    expect(audits[0].site_scan).toEqual({ proceed_if_unavailable: false });
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

  it("#252: a first Generate raises the band naming the new plan; the ribbon says only that the values are the previous answer", async () => {
    const release = holdScannedBreakdown("ok");
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await user.click(screen.getByText("Generate package"));
    await settle();
    // Not the empty state: the pre-generate breakdown is the carry.
    expect(screen.queryByText("Generating…")).toBeNull();
    expect(screen.getByText("Previous answer — values below predate the request in flight.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Recomputing");
    const band = document.querySelector(".working-band")!;
    expect(band.querySelector(".wb-verb")!.textContent).toBe("GENERATING");
    expect(band.querySelector(".wb-object")!.textContent).toBe("new plan · pin 39.7400, -104.9663");
    // No second working voice anywhere on the page.
    expect(document.body.textContent).not.toMatch(/COMPUTING|VERIFYING|scanning site conditions/);
    await act(async () => {
      release();
      await Promise.resolve();
    });
  });

  it("#252: with no prior breakdown to hold there is no 'Generating…' placeholder either — the band alone speaks", async () => {
    const release = holdScannedBreakdown("fail");
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await user.click(screen.getByText("Generate package"));
    await settle();
    expect(screen.queryByText("Generating…")).toBeNull();
    expect(document.body.textContent).not.toContain("then computing taper");
    expect(document.querySelector(".working-band")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/COMPUTING|VERIFYING|scanning site conditions/);
    await act(async () => {
      release();
      await Promise.resolve();
    });
  });
});
