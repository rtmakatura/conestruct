// @vitest-environment happy-dom
//
// #196 — the confirm-tick re-fetch window.  Pre-fix: ticking a confirm
// row (or any edit) after a refusal nulled the refusal for the whole
// re-fetch window — up to ~5.5 s on a Modal cold start — re-enabling
// Generate against a road whose last settled verdict was a 400.
// Clicking it latched the post-generate layout, and the SECOND refusal
// then pointed at a confirm row that was no longer rendered.  Meanwhile
// the audit panel derived ``declined`` from the unstamped auditState
// while the strip read the stamped view, so the two could disagree.
//
// Post-fix: the CTA stays gated while the audit is in flight AND the
// previous settled answer was a 400; the panel receives the same
// stamped ``stripAudit`` the strip reads, so panel and strip cannot
// disagree on declined by construction.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { DEFAULT_FLAGGER } from "@/lib/scenarios";
import type { FlaggerLaneClosureScenario } from "@/lib/scenarios";

// A road whose relays refuse: the #86 multilane gate message, with the
// matching confirm affordance on the flagger form.
const MULTILANE_400 =
  "This road appears to carry more lanes than a flagger operation covers " +
  "— TA-10 applies where one through lane runs in each direction. If " +
  "detection is wrong, confirm 'Road has one through lane in each " +
  "direction' in the form and regenerate.";

const FLAGGER_MULTILANE: FlaggerLaneClosureScenario = {
  ...DEFAULT_FLAGGER,
  detectedLanesTotal: 4,
};

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
let bdCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
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

async function release(q: Deferred[], index: number, response: Response) {
  await act(async () => {
    q[index].resolve(response);
    await Promise.resolve();
    await Promise.resolve();
  });
}

const generate = () =>
  screen.getByRole("button", { name: /Generate plan/ }) as HTMLButtonElement;

async function settleRefusalThenEdit() {
  render(<GeneratorShell mode="sandbox" initialScenario={FLAGGER_MULTILANE} />);
  await release(bdCalls, 0, okBd());
  await release(auditCalls, 0, refusal400());
  expect(generate().disabled).toBe(true); // settled refusal gates
  // Any edit starts the re-fetch window.
  const range = document.querySelector('input[type="range"]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(range, {
      target: { value: String(Number(range.value) + 5) },
    });
  });
  await release(bdCalls, 1, okBd());
  expect(auditCalls.length).toBe(2); // audit re-fetch in flight
}

beforeEach(() => {
  auditCalls = [];
  bdCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("confirm-tick window: CTA stays gated after a refusal (#196)", () => {
  it("Generate stays disabled while the re-fetch is in flight after a settled 400", async () => {
    await settleRefusalThenEdit();
    expect(generate().disabled).toBe(true); // THE window — no bypass click
  });

  it("a clean settle re-enables; a repeat 400 keeps the gate with the refusal pointer", async () => {
    await settleRefusalThenEdit();
    await release(auditCalls, 1, okAudit());
    expect(generate().disabled).toBe(false);

    // Second edit → window: the previous settled answer was CLEAN, so
    // the gate deliberately does not hold (it exists only to bridge a
    // refusal to its next verdict).  The second 400 then re-arms it.
    const range = document.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(range, {
        target: { value: String(Number(range.value) + 5) },
      });
    });
    await release(bdCalls, 2, okBd());
    expect(generate().disabled).toBe(false); // clean-prior window: open
    await release(auditCalls, 2, refusal400());
    expect(generate().disabled).toBe(true);
    expect(
      screen.getAllByText(/one through lane in each direction/).length,
    ).toBeGreaterThan(0);
  });

  it("panel and strip read the same stamped verdict: no declined line while the window is open", async () => {
    await settleRefusalThenEdit();
    // In-flight for the current input: neither surface presents the old
    // 400 as the current verdict.
    expect(
      screen.queryByText(/unavailable — generation declined/),
    ).toBeNull();
    // Settle 400: both surfaces show declined together.
    await release(auditCalls, 1, refusal400());
    expect(
      screen.getByText(/unavailable — generation declined/),
    ).toBeTruthy();
    expect(document.body.textContent).toContain("PLAN DECLINED");
  });
});
