// @vitest-environment happy-dom
//
// #224 phase 2 (s2-arc16, commit 4) — the honest refusal.  A refused
// scan is the backend 400 ``{detail: {error: "site_scan_unavailable",
// message, site_scan, recovery}}`` on BOTH post-generate fetches.  The
// FIRST code-keyed refusal (the #180 header note's "option (i)"):
// matched on ``detail.error`` via matchRefusalCode, never on message
// text; matchRefusalAffordance(scenario) is untouched.
//
//   - the Results zone renders the PLAN DECLINED container: the
//     backend ``message`` verbatim as ONE text node (one voice — the
//     strip shows the pointer, the message renders exactly once on the
//     whole screen), a provenance line, Retry, and the explicit
//     proceed-anyway;
//   - the strip's pill reads SERVICE UNAVAILABLE (ruling 2);
//   - Retry refires both scanned fetches unchanged;
//   - proceed-anyway is a per-input acknowledgement (ruling 1): the next
//     request carries proceed_if_unavailable: true; any edit drops it;
//     a fresh Generate click resets it — never a default, never
//     remembered (suggest-never-set).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Scenario } from "@/lib/scenarios";

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
vi.mock("./SetupStrip", () => ({
  SetupStrip: ({
    onReopen,
    scenario,
    setScenario,
  }: {
    onReopen: () => void;
    scenario: Scenario;
    setScenario: (s: Scenario) => void;
  }) => (
    <>
      <button type="button" onClick={onReopen}>
        Edit full setup
      </button>
      <button
        type="button"
        onClick={() => setScenario({ ...scenario, speed: scenario.speed + 5 })}
      >
        EDIT_SPEED
      </button>
    </>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";

// The prod-captured refusal shape (s2-arc15 after-table, 2026-09-03).
const MESSAGE =
  "Site scan unavailable — the plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway and the plan will carry a NOT-CHECKED disclosure.";
const REFUSAL = {
  detail: {
    error: "site_scan_unavailable",
    message: MESSAGE,
    site_scan: {
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
    },
    recovery: { retry: true, proceed_field: "site_scan.proceed_if_unavailable" },
  },
};
const AUDIT_OK = {
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
const AUDIT_PROCEEDED = {
  ...AUDIT_OK,
  sections: {
    ...AUDIT_OK.sections,
    site_scan: {
      ...REFUSAL.detail.site_scan,
      proceeded_anyway: true,
      disclosure: "SITE CONDITIONS NOT CHECKED — service unavailable at generation.",
    },
  },
};
const BREAKDOWN = {
  devices: [],
  total_devices: 4,
  unique_types: 2,
  zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 },
};

type Call = { url: string; scenario: Record<string, unknown> };
let calls: Call[] = [];
// Scan outcome for the NEXT scanned requests: "refuse" | "ok".
let scanMode: "refuse" | "ok" = "refuse";

function ok(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}
function refused(): Response {
  return { ok: false, status: 400, json: async () => REFUSAL } as unknown as Response;
}

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? "{}")) as { scenario: Record<string, unknown> };
  const scenario = body.scenario;
  calls.push({ url, scenario });
  const scan = scenario.site_scan as { proceed_if_unavailable: boolean } | undefined;
  const isAudit = url.includes("/api/render/audit");
  const isBreakdown = url.includes("/api/render/device-breakdown");
  if (!isAudit && !isBreakdown) return Promise.resolve(ok({}));
  if (!scan) return Promise.resolve(ok(isAudit ? AUDIT_OK : BREAKDOWN));
  if (scanMode === "refuse" && !scan.proceed_if_unavailable) {
    return Promise.resolve(refused());
  }
  if (scan.proceed_if_unavailable && scanMode === "refuse") {
    return Promise.resolve(ok(isAudit ? AUDIT_PROCEEDED : BREAKDOWN));
  }
  return Promise.resolve(ok(isAudit ? AUDIT_OK : BREAKDOWN));
});

beforeEach(() => {
  calls = [];
  scanMode = "refuse";
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function scanned(path: string): Array<{ proceed_if_unavailable: boolean } | undefined> {
  return calls
    .filter((c) => c.url.includes(path))
    .map((c) => c.scenario.site_scan as { proceed_if_unavailable: boolean } | undefined);
}
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
}
function strip(): string {
  return document.querySelector(".status-bar")?.textContent ?? "";
}
function container(): HTMLElement {
  const el = document.querySelector(".sys-event.scan-refusal");
  if (!el) throw new Error("refusal container not rendered");
  return el as HTMLElement;
}
async function generateRefused() {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
  await settle();
  await user.click(screen.getByText("Generate package"));
  await settle();
  return user;
}

describe("the code-keyed scan refusal (#224 phase 2)", () => {
  it("renders the PLAN DECLINED container: message verbatim once, provenance, Retry, proceed-anyway; the pill says SERVICE UNAVAILABLE", async () => {
    await generateRefused();
    const c = container();
    expect(c.getAttribute("role")).toBe("alert");
    // The backend message: one text node, verbatim.
    expect(within(c).getByText(MESSAGE)).toBeTruthy();
    // Exactly once on the whole screen (one voice — the strip shows the pointer).
    expect((document.body.textContent ?? "").split(MESSAGE).length - 1).toBe(1);
    // Provenance line 2 carries the scan's own facts.
    expect(c.textContent).toContain("scan budget exceeded (20 s)");
    expect(c.textContent).toContain("2026-09-03T15:29:51+00:00");
    // Glyph + words (rule 13).
    expect(within(c).getByText("⚠")).toBeTruthy();
    expect(within(c).getByRole("button", { name: /Retry scan/ })).toBeTruthy();
    const proceed = within(c).getByRole("button", { name: /Generate without site check/ });
    expect(proceed.textContent).toContain("SITE CONDITIONS NOT CHECKED");
    // The generic breakdown-failed ribbon does not also render.
    expect(document.body.textContent).not.toContain("Device breakdown failed");
    // The strip: declined, service pill, never "needs input".
    expect(strip()).toContain("PLAN DECLINED");
    expect(strip()).toContain("SERVICE UNAVAILABLE");
    expect(strip()).not.toContain("NEEDS INPUT");
    expect(strip()).not.toContain("NEEDS REVIEW");
  });

  it("Retry refires both scanned fetches, still without the acknowledgement", async () => {
    const user = await generateRefused();
    calls = [];
    await user.click(within(container()).getByRole("button", { name: /Retry scan/ }));
    await settle();
    expect(scanned("/api/render/audit")).toEqual([{ proceed_if_unavailable: false }]);
    expect(scanned("/api/render/device-breakdown")).toEqual([
      { proceed_if_unavailable: false },
    ]);
    // Still refused → still the container.
    expect(container()).toBeTruthy();
  });

  it("proceed-anyway sends the acknowledgement once; the plan renders and the container clears", async () => {
    const user = await generateRefused();
    calls = [];
    await user.click(
      within(container()).getByRole("button", { name: /Generate without site check/ }),
    );
    await settle();
    expect(scanned("/api/render/audit")).toEqual([{ proceed_if_unavailable: true }]);
    expect(scanned("/api/render/device-breakdown")).toEqual([
      { proceed_if_unavailable: true },
    ]);
    expect(document.querySelector(".sys-event.scan-refusal")).toBeNull();
    expect(strip()).not.toContain("PLAN DECLINED");
  });

  it("an edit drops the acknowledgement: the next scan must succeed or be re-acknowledged", async () => {
    const user = await generateRefused();
    await user.click(
      within(container()).getByRole("button", { name: /Generate without site check/ }),
    );
    await settle();
    calls = [];
    await user.click(screen.getByText("EDIT_SPEED"));
    await settle();
    expect(scanned("/api/render/audit")).toEqual([{ proceed_if_unavailable: false }]);
    // Overpass still down → refused again, honestly.
    expect(container()).toBeTruthy();
  });

  it("a fresh Generate click resets the acknowledgement (never remembered)", async () => {
    const user = await generateRefused();
    await user.click(
      within(container()).getByRole("button", { name: /Generate without site check/ }),
    );
    await settle();
    await user.click(screen.getByText("Edit full setup"));
    await settle();
    calls = [];
    await user.click(screen.getByText("Generate package"));
    await settle();
    expect(scanned("/api/render/audit")).toEqual([{ proceed_if_unavailable: false }]);
  });

  it("a successful scan after Retry renders the plan with no container and no disclosure", async () => {
    const user = await generateRefused();
    scanMode = "ok";
    await user.click(within(container()).getByRole("button", { name: /Retry scan/ }));
    await settle();
    expect(document.querySelector(".sys-event.scan-refusal")).toBeNull();
    expect(strip()).toContain("READY FOR TCS REVIEW");
  });
});
