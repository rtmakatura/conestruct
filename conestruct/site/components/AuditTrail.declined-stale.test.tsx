// @vitest-environment happy-dom
//
// #187 — no cited value from a previous input renders under a declined
// (or failed) banner.  Pre-fix, the item builders fell back to
// ``audit.lastReady`` on BOTH loading and error, so a pin move onto a
// refused road kept the previous road's taper/buffer with green checks
// and a live Audit PDF button beneath "unavailable — generation
// declined".  Post-#187 the stale-while-revalidate fallback is
// loading-only (the "(refreshing…)" cue keeps that state honest); an
// audit ERROR blanks the values and disables the PDF.
//
// Deliberate narrowing of the GeneratorShell "AuditTrail keeps its
// stale content" decision — error arm only, recorded at the shell
// comment and approved at the Arc 2 plan checkpoint.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
// #186: mounts assert a verdict / enabled Generate — start located.
import { PINNED_SHOULDER } from "./test-fixtures";
import type { AuditResponse } from "../lib/render-types";

// Breakdown geometry numbers deliberately differ from the audit's cited
// values so "183"/"495" can only come from the audit panel.
const BREAKDOWN = {
  devices: [],
  total_devices: 42,
  unique_types: 6,
  zone_geometry: {
    taper_l_ft: 999,
    buffer_b_ft: 888,
    device_spacing_ft: 77,
    work_len_ft: 500,
  },
};

const READY_AUDIT: AuditResponse = {
  summary: {
    ta: "TA-3",
    cdot_sheet: "S-630-1",
    case_id: "Case 11",
    taper_length_ft: 183,
    taper_label: "L/3 (shoulder taper)",
    buffer_space_ft: 495,
    device_spacing_taper_ft: 55,
    device_spacing_tangent_ft: 110,
    step_count: 8,
  },
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
  },
  pending_verification: { count: 0, note: "", tracking_issue: null },
  plan_flags: {
    validation_warnings: 0,
    compliance_fails: 0,
    v1_limitations: 0,
    is_clean: true,
  },
};

type Deferred = { resolve: (r: Response) => void };
let auditCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    return new Promise<Response>((resolve) => auditCalls.push({ resolve }));
  }
  if (url.includes("/api/render/device-breakdown")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => BREAKDOWN,
    } as unknown as Response);
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

const okAudit = () =>
  ({ ok: true, status: 200, json: async () => READY_AUDIT }) as unknown as Response;
const declined400 = () =>
  ({
    ok: false,
    status: 400,
    json: async () => ({
      detail:
        "Work zone length (50 ft) is shorter than the required shoulder taper.",
    }),
  }) as unknown as Response;
const failed500 = () =>
  ({
    ok: false,
    status: 500,
    json: async () => ({ detail: "render failed: boom" }),
  }) as unknown as Response;

async function releaseAudit(index: number, response: Response) {
  await act(async () => {
    auditCalls[index].resolve(response);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function generateThenEdit(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
  await releaseAudit(0, okAudit());
  await user.click(screen.getByRole("button", { name: /Generate plan/ }));
  // The trail lives in a collapsed ReferenceChip — expand it so the rows
  // under test are actually rendered.
  await user.click(screen.getByText("Verification & audit trail"));
  expect((await screen.findAllByText(/183/)).length).toBeGreaterThan(0); // sanity
  await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
  await user.selectOptions(screen.getByLabelText("Speed"), "35");
  // #182: the edit's refetch reaches the wire through the 350 ms fetch
  // debounce.  Wait it out so auditCalls[1] deterministically exists —
  // without this the suite was timing-marginal (the refetch fired on the
  // leading edge only when the prior interactions happened to take
  // >350 ms).  The audit is dispatched but UNRESOLVED here, so the
  // refetch-in-flight assertions below still see the loading window.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 360));
  });
  return user;
}

const pdfButton = () =>
  screen.getByRole("button", { name: "↓ Audit PDF" }) as HTMLButtonElement;

beforeEach(() => {
  auditCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("audit rows never present a prior input's numbers under a declined banner (#187)", () => {
  it("refetch (loading) keeps last-known rows with the refreshing cue — the sanctioned fallback", async () => {
    await generateThenEdit();
    // Zone 3 stays mounted through the regenerate since #192, so the
    // chip is still expanded.  Audit re-fetch in flight: prior values +
    // "(refreshing…)".
    expect((await screen.findAllByText(/183/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/refreshing…/)).toBeTruthy();
  });

  it("a declined (400) audit blanks the cited values and disables the Audit PDF", async () => {
    await generateThenEdit();
    await releaseAudit(1, declined400());

    expect(
      screen.getByText(/unavailable while generation is declined/i),
    ).toBeTruthy();
    // No cited number from the previous input renders as current.
    expect(screen.queryAllByText(/183/)).toHaveLength(0);
    expect(screen.queryAllByText(/495/)).toHaveLength(0);
    // The rows say why they're blank — never "Computing…" (a refused
    // answer is not a pending one).
    expect(screen.queryAllByText(/Computing…/)).toHaveLength(0);
    expect(pdfButton().disabled).toBe(true);
    expect(pdfButton().title).toMatch(/declined/i);
  });

  it("a failed (5xx) audit blanks the values too, keeping the retry line", async () => {
    await generateThenEdit();
    await releaseAudit(1, failed500());

    expect(screen.getByText(/Audit trail failed/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeTruthy();
    expect(screen.queryAllByText(/183/)).toHaveLength(0);
    expect(pdfButton().disabled).toBe(true);
  });
});
