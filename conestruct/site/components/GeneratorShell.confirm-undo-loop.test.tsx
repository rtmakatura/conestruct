// @vitest-environment happy-dom
//
// The #179 arc's centerpiece: the full tick → clean → untick → re-refusal
// loop, mounted through the REAL shell + sidebar + FlaggerForm (rule 11).
// The undo is an input change like any other — the strip re-verifies and
// the backend re-issues the original 400 (rule 10: the restored state is
// honestly re-derived, never a cached verdict).  The CTA stays gated
// through BOTH re-fetch windows: the tick's (#196's prevSettled400) and
// the untick's mirror image (#179's armed-affordance extension — the
// last settled verdict was clean, so only the armed mirror predicate
// knows a refusal is incoming).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import type { FlaggerLaneClosureScenario } from "@/lib/scenarios";
import { PINNED_FLAGGER } from "./test-fixtures";

// The standing E Colfax shape (#86 spot): total 5, forward 3.
const FLAGGER_COLFAX: FlaggerLaneClosureScenario = {
  ...PINNED_FLAGGER,
  detectedLanesTotal: 5,
  detectedLanesForward: 3,
};

const MULTILANE_400 =
  "This road appears to carry more lanes than a flagger operation covers " +
  "— TA-10 applies where one through lane runs in each direction. If " +
  "detection is wrong, confirm 'Road has one through lane in each " +
  "direction' in the form and regenerate.";

const BREAKDOWN = {
  devices: [],
  total_devices: 42,
  unique_types: 6,
  zone_geometry: {
    taper_l_ft: 183,
    buffer_b_ft: 495,
    device_spacing_ft: 55,
    work_len_ft: 500,
  },
};

type Deferred = { resolve: (r: Response) => void };
let auditCalls: Deferred[] = [];
let auditBodies: string[] = [];
let bdCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    auditBodies.push(String(init?.body ?? ""));
    return new Promise<Response>((resolve) => auditCalls.push({ resolve }));
  }
  if (url.includes("/api/render/device-breakdown")) {
    return new Promise<Response>((resolve) => bdCalls.push({ resolve }));
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

const okBd = () =>
  ({ ok: true, status: 200, json: async () => BREAKDOWN }) as unknown as Response;
const refusal400 = () =>
  ({
    ok: false,
    status: 400,
    json: async () => ({ detail: MULTILANE_400 }),
  }) as unknown as Response;
const okAudit = () =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      summary: {
        ta: "TA-10",
        cdot_sheet: "S-630-1",
        case_id: "Case 18",
        taper_length_ft: 100,
        taper_label: "L",
        buffer_space_ft: 200,
        device_spacing_taper_ft: 20,
        device_spacing_tangent_ft: 40,
        step_count: 4,
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
    }),
  }) as unknown as Response;

async function flushDebounce() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 360));
  });
}

async function release(q: Deferred[], index: number, response: Response) {
  await act(async () => {
    q[index].resolve(response);
    await Promise.resolve();
    await Promise.resolve();
  });
}

const generate = () =>
  screen.getByRole("button", { name: /Generate plan/ }) as HTMLButtonElement;
const confirmRow = () =>
  screen.getByRole("checkbox", {
    name: /Road has one through lane in each direction/,
  }) as HTMLButtonElement;
const strip = () => document.querySelector(".status-bar")?.textContent ?? "";

beforeEach(() => {
  auditCalls = [];
  auditBodies = [];
  bdCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("tick → clean → untick → re-refusal, CTA gated through both windows (#179)", () => {
  it("runs the full loop with focus retained and a byte-identical restored payload", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={FLAGGER_COLFAX} />);
    await release(bdCalls, 0, okBd());
    await release(auditCalls, 0, refusal400());

    // Settled refusal: armed row, gated CTA, declined strip.
    expect(strip()).toContain("PLAN DECLINED");
    expect(generate().disabled).toBe(true);
    const row = confirmRow();
    expect(row.getAttribute("aria-checked")).toBe("false");
    row.focus();

    // TICK.  The row stays, checked; the re-fetch window opens and the
    // CTA holds (#196's prevSettled400 leg).
    fireEvent.click(row);
    expect(confirmRow()).toBe(row); // never unmounted
    expect(row.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(row);
    await flushDebounce();
    await release(bdCalls, 1, okBd());
    expect(generate().disabled).toBe(true); // tick window: gated
    await release(auditCalls, 1, okAudit());

    // Clean settle: CTA enables, row still confirmed, focus unmoved by
    // the background settle.
    expect(strip()).toContain("READY");
    expect(generate().disabled).toBe(false);
    expect(row.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(row);

    // UNTICK.  Relays restored; the untick window is the mirror image —
    // the last settled verdict was CLEAN, so only the #179 armed-
    // affordance extension holds the CTA until the 400 lands.
    fireEvent.click(row);
    expect(row.getAttribute("aria-checked")).toBe("false");
    expect(document.activeElement).toBe(row);
    await flushDebounce();
    await release(bdCalls, 2, okBd());
    expect(generate().disabled).toBe(true); // untick window: gated (#179)
    expect(
      document.body.textContent,
    ).toContain("Re-checking the declined input");

    // The original refusal returns — honestly re-derived, not cached.
    await release(auditCalls, 2, refusal400());
    expect(strip()).toContain("PLAN DECLINED");
    expect(generate().disabled).toBe(true);
    expect(confirmRow().getAttribute("aria-checked")).toBe("false");

    // Acceptance: the POST body after tick-then-untick is byte-identical
    // to the never-confirmed body.
    expect(auditBodies.length).toBe(3);
    expect(auditBodies[2]).toBe(auditBodies[0]);
    // And the ticked body differed (the override rode the wire).
    expect(auditBodies[1]).toContain("flagger_multilane_confirm");
    expect(auditBodies[0]).not.toContain("flagger_multilane_confirm");
  });
});
