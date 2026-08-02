// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Scenario } from "@/lib/scenarios";
import type { AuditResponse } from "@/lib/render-types";

// Frontend-engine-removal Decision 2 (mounted-flow): the moment an input
// changes, the status strip enters an explicit checking state and leaves
// it only when the backend answers.  It never presents the previous
// verdict as current — not while the refetch is in flight, and not on
// the render frame before the fetch effect runs.  A static
// renderToStaticMarkup test can't exercise the change→response window
// (it lives in GeneratorShell's effects), so this file mounts the real
// shell + real StatusBar with a fetch stub whose audit responses resolve
// only when the test says so.

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./AuditTrail", () => ({ AuditTrail: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
// The stub exposes the one control this test drives: a button that
// commits a scenario edit (a longer work zone), exactly as a real form
// field's onChange would.
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

// Audit calls resolve only when the test releases them; everything else
// (device-breakdown) answers immediately and benignly.
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

// #182: edits reach the wire through the fetch debounce (leading +
// trailing, 350 ms) — wait it out so the deferred request dispatches.
async function flushDebounce() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 360));
  });
}

async function releaseAudit(index: number, response: Response) {
  await act(async () => {
    auditCalls[index].resolve(response);
    // Two ticks: the fetch promise, then res.json().
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  auditCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function strip(): string {
  // The verdict strip is the only .status-bar element in this mount
  // (siblings are stubbed out).
  const el = document.querySelector(".status-bar");
  if (!el) throw new Error("status strip not rendered");
  return el.textContent ?? "";
}

describe("StatusBar checking state across the change→response window (Decision 2)", () => {
  it("shows VERIFYING until the first answer, then the verdict", async () => {
    render(<GeneratorShell mode="sandbox" />);
    expect(strip()).toContain("VERIFYING");
    expect(strip()).not.toContain("READY FOR TCS REVIEW");

    await releaseAudit(0, okAudit());
    expect(strip()).toContain("READY FOR TCS REVIEW");
  });

  it("is NOT green in the window between an input change and the backend's answer", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await releaseAudit(0, okAudit());
    expect(strip()).toContain("READY FOR TCS REVIEW");

    // Commit an edit.  The previous (green) verdict answered a scenario
    // that no longer exists on screen — the strip must drop it at once.
    fireEvent.click(screen.getByText("Edit input"));
    expect(strip()).toContain("VERIFYING");
    expect(strip()).not.toContain("READY FOR TCS REVIEW");
    expect(document.querySelector(".status-bar.pass")).toBeNull();

    // The backend answers for the edited scenario → verdict returns.
    await flushDebounce();
    expect(auditCalls.length).toBe(2);
    await releaseAudit(1, okAudit());
    expect(strip()).toContain("READY FOR TCS REVIEW");
  });

  it("a stale answer for a superseded input never lands as current", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await releaseAudit(0, okAudit());
    // Two edits, each flushed through the debounce so each earns its own
    // fetch — the point here is a STALE RESPONSE arriving late, not the
    // debounce's own collapsing (GeneratorShell.debounce.test.tsx).
    fireEvent.click(screen.getByText("Edit input"));
    await flushDebounce();
    fireEvent.click(screen.getByText("Edit input"));
    await flushDebounce();
    expect(auditCalls.length).toBe(3);

    // Release the SECOND call (fetched for the first edit, superseded by
    // the second).  Its answer must not surface a verdict — forScenario
    // no longer matches the scenario on screen.
    await releaseAudit(1, okAudit());
    expect(strip()).toContain("VERIFYING");
    expect(strip()).not.toContain("READY FOR TCS REVIEW");

    await releaseAudit(2, okAudit());
    expect(strip()).toContain("READY FOR TCS REVIEW");
  });

  it("the failure state is reachable from checking: a failed refetch shows UNAVAILABLE, not the old verdict", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await releaseAudit(0, okAudit());
    expect(strip()).toContain("READY FOR TCS REVIEW");

    fireEvent.click(screen.getByText("Edit input"));
    expect(strip()).toContain("VERIFYING");
    await flushDebounce();

    await act(async () => {
      auditCalls[1].reject(new Error("boom"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(strip()).toContain("VERIFICATION UNAVAILABLE");
    expect(strip()).not.toContain("READY FOR TCS REVIEW");
  });
});
