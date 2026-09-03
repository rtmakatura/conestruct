// @vitest-environment happy-dom
//
// #224 phase 2 (s2-arc16, commit 5) — the disclosure reaches the panel
// THROUGH the shell (rule 11: test where the bug lives).  A refused scan,
// proceed-anyway, the proceeded audit lands → the real SetupStrip prints
// the NOT-CHECKED system event from the STAMPED audit view; an edit
// (new input, acknowledgement dropped, scan refused again) blanks it —
// a prior input's disclosure never renders as current.

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

const DISCLOSURE = "SITE CONDITIONS NOT CHECKED — service unavailable at generation.";
const MESSAGE =
  "Site scan unavailable — the plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway and the plan will carry a NOT-CHECKED disclosure.";
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
};
const REFUSAL = {
  detail: {
    error: "site_scan_unavailable",
    message: MESSAGE,
    site_scan: SCAN_UNAVAILABLE,
    recovery: { retry: true, proceed_field: "site_scan.proceed_if_unavailable" },
  },
};
const BASE_AUDIT = {
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
  ...BASE_AUDIT,
  sections: {
    ...BASE_AUDIT.sections,
    site_scan: { ...SCAN_UNAVAILABLE, proceeded_anyway: true, disclosure: DISCLOSURE },
  },
};
const BREAKDOWN = {
  devices: [],
  total_devices: 4,
  unique_types: 2,
  zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 },
};

function ok(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}
const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const { scenario } = JSON.parse(String(init?.body ?? "{}")) as {
    scenario: { site_scan?: { proceed_if_unavailable: boolean } };
  };
  const isAudit = url.includes("/api/render/audit");
  const isBreakdown = url.includes("/api/render/device-breakdown");
  if (!isAudit && !isBreakdown) return Promise.resolve(ok({}));
  const scan = scenario.site_scan;
  if (!scan) return Promise.resolve(ok(isAudit ? BASE_AUDIT : BREAKDOWN));
  if (!scan.proceed_if_unavailable) {
    return Promise.resolve({
      ok: false,
      status: 400,
      json: async () => REFUSAL,
    } as unknown as Response);
  }
  return Promise.resolve(ok(isAudit ? AUDIT_PROCEEDED : BREAKDOWN));
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
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

describe("the NOT-CHECKED disclosure through the shell (#224 phase 2)", () => {
  it("proceed-anyway → the Setup panel prints the disclosure; an edit blanks it", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await user.click(screen.getByText("Generate package"));
    await settle();
    const refusal = document.querySelector(".sys-event.scan-refusal") as HTMLElement;
    expect(refusal).not.toBeNull();
    expect(document.body.textContent).not.toContain(DISCLOSURE);
    await user.click(
      within(refusal).getByRole("button", { name: /Generate without site check/ }),
    );
    await settle();
    // The panel: the #227 system event with the backend sentence.
    const sentence = screen.getByText(DISCLOSURE);
    const container = sentence.closest(".sys-event.site-not-checked");
    expect(container).not.toBeNull();
    expect(container!.textContent).toContain("scan budget exceeded (20 s)");
    // Exactly once on the whole screen (section 03 is stubbed here;
    // its surface is pinned in TieredReference.site-scan.test.tsx).
    expect((document.body.textContent ?? "").split(DISCLOSURE).length - 1).toBe(1);
    // The refusal container is gone; the strip carries the verdict.
    expect(document.querySelector(".sys-event.scan-refusal")).toBeNull();
    // An inline edit from the real strip: new input → acknowledgement
    // dropped → refused again → the disclosure is NOT carried over.
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await settle();
    expect(document.body.textContent).not.toContain(DISCLOSURE);
    expect(document.querySelector(".sys-event.scan-refusal")).not.toBeNull();
  });
});
