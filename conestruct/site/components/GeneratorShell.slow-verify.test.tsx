// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Scenario } from "@/lib/scenarios";
import type { AuditResponse } from "@/lib/render-types";

// Cold-start honesty (Refs #122, rule 10): when the audit fetch runs
// past GeneratorShell's SLOW_VERIFY_MS (2 s), the strip's VERIFYING
// copy escalates to say the server is waking up — and drops back the
// moment an answer lands.  The escalation lives in GeneratorShell's
// effect (a timer) and renders through StatusBar, so this is a
// mounted-flow test with fake timers: the same shell + strip wiring a
// user exercises, with the clock and the backend both under test
// control.  (Harness cloned from GeneratorShell.status-pending.test.tsx.)

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./AuditTrail", () => ({ AuditTrail: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({
    scenario,
    setScenario,
  }: {
    scenario: Scenario;
    setScenario: (s: Scenario) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        setScenario({ ...scenario, workLen: scenario.workLen + 100 })
      }
    >
      Edit input
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
// #186: mounts assert a verdict / enabled Generate — start located.
import { PINNED_SHOULDER } from "./test-fixtures";

const CLEAN_AUDIT: AuditResponse = {
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

type Deferred = {
  resolve: (r: Response) => void;
  reject: (e: Error) => void;
};

let auditCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    return new Promise<Response>((resolve, reject) => {
      auditCalls.push({ resolve, reject });
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

function okAudit(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => CLEAN_AUDIT,
  } as unknown as Response;
}

async function releaseAudit(index: number, response: Response) {
  await act(async () => {
    auditCalls[index].resolve(response);
    // Two ticks: the fetch promise, then res.json().
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  auditCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const SLOW_COPY = "waking the verification server";

function strip(): string {
  const el = document.querySelector(".status-bar");
  if (!el) throw new Error("status strip not rendered");
  return el.textContent ?? "";
}

describe("StatusBar cold-start escalation (Refs #122)", () => {
  it("escalates VERIFYING past the 2 s threshold and clears when the answer lands", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    expect(strip()).toContain("VERIFYING");
    expect(strip()).not.toContain(SLOW_COPY);

    // Just under the threshold: still the plain checking copy.
    await advance(1999);
    expect(strip()).not.toContain(SLOW_COPY);

    // Past it: the strip says the truth — the server is waking up.
    // Same chromeless verifying treatment, no error/warn class.
    await advance(1);
    expect(strip()).toContain(SLOW_COPY);
    expect(document.querySelector(".status-bar.idle.verifying")).not.toBeNull();
    expect(document.querySelector(".status-bar.fail")).toBeNull();
    expect(document.querySelector(".status-bar.warn")).toBeNull();

    // The backend answers → verdict replaces the escalated state.
    await releaseAudit(0, okAudit());
    expect(strip()).toContain("READY FOR TCS REVIEW");
    expect(strip()).not.toContain(SLOW_COPY);
  });

  it("a warm-speed answer never shows the escalated copy", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await advance(500);
    await releaseAudit(0, okAudit());
    expect(strip()).toContain("READY FOR TCS REVIEW");

    // And the now-dead timer must not resurface it later.
    await advance(5000);
    expect(strip()).not.toContain(SLOW_COPY);
    expect(strip()).toContain("READY FOR TCS REVIEW");
  });

  it("an input change resets the clock — the refetch starts from plain VERIFYING", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await advance(2500);
    expect(strip()).toContain(SLOW_COPY);
    await releaseAudit(0, okAudit());

    fireEvent.click(screen.getByText("Edit input"));
    expect(strip()).toContain("VERIFYING");
    expect(strip()).not.toContain(SLOW_COPY);

    await advance(1999);
    expect(strip()).not.toContain(SLOW_COPY);
    await advance(1);
    expect(strip()).toContain(SLOW_COPY);

    await releaseAudit(1, okAudit());
    expect(strip()).toContain("READY FOR TCS REVIEW");
  });
});
