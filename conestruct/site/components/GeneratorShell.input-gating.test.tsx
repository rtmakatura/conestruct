// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { AuditResponse } from "@/lib/render-types";

// Engine-removal PR D (mounted-flow, the layer-11 wiring test): the
// frontend taper-floor mirror is deleted; the ONLY source of the
// invalid-input verdict for a short work zone is the backend's HTTP 400
// on the audit fetch (validators.py WORK_ZONE_SHORTER_THAN_TAPER).
// This file mounts the REAL shell + REAL StatusBar + REAL sidebar (the
// Generate button under test lives there) with releasable fetches and
// asserts:
//   * a 400 turns the strip red with the BACKEND's message and disables
//     Generate;
//   * a 200 shows READY and enables Generate;
//   * while the answer is in flight Generate stays enabled (no
//     per-keystroke flicker; the server re-validates every render call);
//   * a network failure shows VERIFICATION UNAVAILABLE and NEVER a
//     locally-derived floor message;
//   * the POST body carries the typed scenario unchanged (payload-level).

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./AuditTrail", () => ({ AuditTrail: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
// Cut the mapbox edge — the modal isn't part of this flow.
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
// #186: mounts assert a verdict / enabled Generate — start located.
import { PINNED_SHOULDER } from "./test-fixtures";
import { DEFAULT_SCENARIO } from "@/lib/scenarios";

// The backend's own floor message (validators.py:1490-1496 phrasing) —
// what the deleted client mirror used to preempt.
const BACKEND_FLOOR_MSG =
  "Work zone length (50 ft) is shorter than the required shoulder taper " +
  "(L/3) of 184 ft at 55 mph. Increase the work zone to at least 184 ft, " +
  "or reduce the speed limit.";

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
    corridor_spec: {
      taper_ft: 183,
      buffer_ft: 495,
      advance_warning_ft: 1500,
      downstream_taper_ft: 100,
      road_category: "rural",
    },
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
let auditBodies: string[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    auditBodies.push(String(init?.body ?? ""));
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

function floor400(): Response {
  return {
    ok: false,
    status: 400,
    json: async () => ({ detail: { message: BACKEND_FLOOR_MSG } }),
  } as unknown as Response;
}

async function releaseAudit(index: number, response: Response) {
  await act(async () => {
    auditCalls[index].resolve(response);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  auditCalls = [];
  auditBodies = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function strip(): string {
  const el = document.querySelector(".status-bar");
  if (!el) throw new Error("status strip not rendered");
  return el.textContent ?? "";
}

function generateButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: /Generate plan/,
  }) as HTMLButtonElement;
}

describe("input gating rides the backend 400 (engine-removal PR D)", () => {
  it("audit 400 → red PLAN DECLINED with the backend's message exactly once, Generate disabled", async () => {
    // #180: the geometry floor 400 has no confirm affordance, so the
    // strip is the refusal's ONE voice — full message, declined
    // vocabulary, and no other surface repeats the text verbatim.
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await releaseAudit(0, floor400());

    expect(strip()).toContain("PLAN DECLINED");
    expect(strip()).toContain(BACKEND_FLOOR_MSG);
    expect(strip()).toContain("NEEDS INPUT");
    expect(strip()).not.toContain("INVALID INPUT");
    expect(document.querySelector(".status-bar.fail")).not.toBeNull();
    expect(generateButton().disabled).toBe(true);
    // The disabled CTA points at the strip instead of re-quoting the 400.
    expect(screen.getAllByRole("alert").some((el) =>
      (el.textContent ?? "").includes("Generation declined — see the notice below."),
    )).toBe(true);
    // One voice: the verbatim 400 renders exactly once on the screen.
    const occurrences = (document.body.textContent ?? "").split(
      BACKEND_FLOOR_MSG,
    ).length - 1;
    expect(occurrences).toBe(1);
  });

  it("audit 200 → READY and Generate enabled", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await releaseAudit(0, okAudit());

    expect(strip()).toContain("READY FOR TCS REVIEW");
    expect(generateButton().disabled).toBe(false);
  });

  it("while the answer is in flight Generate stays enabled (no flicker; server backstop)", () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    // Nothing released — the audit call is pending.
    expect(strip()).toContain("VERIFYING");
    expect(generateButton().disabled).toBe(false);
  });

  it("network failure → VERIFICATION UNAVAILABLE, never a locally-derived floor message", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await act(async () => {
      auditCalls[0].reject(new Error("boom"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(strip()).toContain("VERIFICATION UNAVAILABLE");
    // The deleted mirror's vocabulary must not resurface from anywhere:
    // no client computes a floor when the backend can't be reached.
    const page = document.body.textContent ?? "";
    expect(page).not.toContain("must be at least");
    expect(page).not.toContain("MUTCD § 6C.08");
    expect(strip()).not.toContain("INVALID INPUT");
    // #180: broken is not declined — a network failure is never reframed.
    expect(strip()).not.toContain("PLAN DECLINED");
    // Not blocked either — the server re-validates every render call.
    expect(generateButton().disabled).toBe(false);
  });

  it("payload-level: the POST body carries the typed scenario unchanged", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    expect(auditBodies.length).toBe(1);
    const sent = JSON.parse(auditBodies[0]) as { scenario: unknown };
    // #186: the mount is the pinned default — the body must carry it
    // verbatim, coordinates included.
    expect(sent.scenario).toEqual(PINNED_SHOULDER);
  });
});
