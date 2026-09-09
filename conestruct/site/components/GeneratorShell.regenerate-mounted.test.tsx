// @vitest-environment happy-dom
//
// #192 — the designed post-generate edit path must not punish its own
// use.  Pre-fix: any strip edit swapped the whole results subtree for
// "Generating…" (destroying pricing-panel state), and the strip's
// ``generating`` branch preceded ``inputError``/``refusal`` — a refused
// input could sit behind a reassuring COMPUTING line.  Post-fix: with
// prior results on screen, a regenerate dims and refreshes in place
// under an explicit stale ribbon (stale-while-revalidate, marked —
// same contract as the audit trail's "(refreshing…)"), and a refusal
// or invalid input always outranks "no answer yet".  #252: the working
// band is the one working voice post-generate (the strip's COMPUTING
// line is gone); the ribbon says only that the values are the previous
// answer.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
// The pricing panel's mounted-ness is the state #192 protects; the stub
// makes it observable.
vi.mock("./QuotePanel", () => ({
  QuotePanel: () => <span>QUOTE_PANEL_MOUNTED</span>,
}));

import { GeneratorShell } from "./GeneratorShell";
// #186: mounts assert a verdict / enabled Generate — start located.
import { PINNED_SHOULDER } from "./test-fixtures";
import { StatusBar } from "./StatusBar";
import type { AuditState } from "../lib/render-types";

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
let bdCalls: Deferred[] = [];
let auditCalls: Deferred[] = [];

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/device-breakdown")) {
    return new Promise<Response>((resolve) => bdCalls.push({ resolve }));
  }
  if (url.includes("/api/render/audit")) {
    return new Promise<Response>((resolve) => auditCalls.push({ resolve }));
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

const okBd = () =>
  ({ ok: true, status: 200, json: async () => BREAKDOWN }) as unknown as Response;
const okAudit = () =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      summary: {},
      sections: {},
      pending_verification: { count: 0, note: "", tracking_issue: null },
      plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
    }),
  }) as unknown as Response;
const refusal400 = () =>
  ({
    ok: false,
    status: 400,
    json: async () => ({
      detail:
        "Work zone length (50 ft) is shorter than the required shoulder taper.",
    }),
  }) as unknown as Response;

// #182: edits reach the wire through the fetch debounce (leading +
// trailing, 350 ms) — wait it out so the deferred request dispatches.
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

function stripText(): string {
  return document.querySelector(".status-bar")?.textContent ?? "";
}

async function generateThenEdit() {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
  await release(bdCalls, 0, okBd());
  await user.click(screen.getByRole("button", { name: /Generate plan/ }));
  expect(screen.getByText("QUOTE_PANEL_MOUNTED")).toBeTruthy();
  // #252: settle the generated pair — the strip is locked while it is open.
  await flushDebounce();
  await release(bdCalls, 1, okBd());
  await release(auditCalls, 1, okAudit());
  await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
  await user.selectOptions(screen.getByLabelText("Speed"), "35");
  await flushDebounce();
  return user;
}

beforeEach(() => {
  bdCalls = [];
  auditCalls = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("results stay mounted through regeneration (#192)", () => {
  it("a post-generate edit dims in place: no empty-state swap, panel stays mounted, ribbon marks the refresh", async () => {
    await generateThenEdit();
    // Breakdown refetch in flight: the subtree survives.
    expect(screen.queryByText("Generating…")).toBeNull();
    expect(screen.getByText("QUOTE_PANEL_MOUNTED")).toBeTruthy();
    expect(document.querySelector(".results-stale")).not.toBeNull();
    expect(screen.getByText(/Previous answer/)).toBeTruthy();
    // Last-known hero values stay visible under the dim (marked stale by
    // the ribbon, so this is the sanctioned SWR presentation).
    expect(screen.getByText(/183 ft/)).toBeTruthy();

    // Settling clears the ribbon and the dim.
    await release(bdCalls, 2, okBd());
    expect(screen.queryByText(/Previous answer/)).toBeNull();
    expect(document.querySelector(".results-stale")).toBeNull();
    expect(screen.getByText("QUOTE_PANEL_MOUNTED")).toBeTruthy();
  });

  it("#252: first generate with the answer still in flight shows no 'Generating…' placeholder — the band is the voice", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    // Click Generate while the mount fetch is still pending.
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));
    expect(screen.queryByText("Generating…")).toBeNull();
    const band = document.querySelector(".working-band");
    expect(band).not.toBeNull();
    expect(band!.querySelector(".wb-verb")!.textContent).toBe("GENERATING");
    // The mount fetch settling is not the wire scenario's answer (the
    // Generate click changed it): the band holds through the deferred
    // debounce window until the pair for the generated scenario settles.
    await release(bdCalls, 0, okBd());
    expect(document.querySelector(".working-band")).not.toBeNull();
    await flushDebounce();
    await release(bdCalls, 1, okBd());
    expect(document.querySelector(".working-band")).not.toBeNull();
    await release(auditCalls, 1, okAudit());
    expect(document.querySelector(".working-band")).toBeNull();
  });

  it("#252: a refusal settling mid-regeneration is never masked — the strip says PLAN DECLINED while the band stays up for the open breakdown", async () => {
    await generateThenEdit();
    // Audit answers 400 for the CURRENT scenario while the breakdown is
    // still in flight — the verdict shows; the band stays (a request
    // IS open) and leaves in the frame the breakdown settles.
    await release(auditCalls, 2, refusal400());
    expect(stripText()).toContain("PLAN DECLINED");
    expect(stripText()).not.toContain("COMPUTING");
    expect(document.querySelector(".working-band")).not.toBeNull();
    await release(bdCalls, 2, okBd());
    expect(document.querySelector(".working-band")).toBeNull();
    expect(stripText()).toContain("PLAN DECLINED");
  });
});

describe("StatusBar precedence: input honesty outranks 'no answer yet' (#192, #252)", () => {
  const loadingAudit: AuditState = { state: "loading", lastReady: null };

  it("inputError renders over a pending answer — under the band's voice too", () => {
    render(
      <StatusBar
        inputError="Work zone length is required."
        audit={loadingAudit}
        bandVoice
      />,
    );
    expect(stripText()).toContain("INVALID INPUT");
    expect(stripText()).not.toContain("VERIFYING");
  });

  it("refusal renders over a pending answer — under the band's voice too", () => {
    render(
      <StatusBar
        inputError={null}
        refusal={{ message: "declined", pointer: "see the Road section" }}
        audit={loadingAudit}
        bandVoice
      />,
    );
    expect(stripText()).toContain("PLAN DECLINED");
    expect(stripText()).not.toContain("VERIFYING");
  });

  it("with honest inputs a pending answer is VERIFYING pre-generate and nothing under the band's voice — never COMPUTING", () => {
    const { unmount } = render(<StatusBar inputError={null} audit={loadingAudit} />);
    expect(stripText()).toContain("VERIFYING");
    expect(stripText()).not.toContain("COMPUTING");
    unmount();
    render(<StatusBar inputError={null} audit={loadingAudit} bandVoice />);
    expect(document.querySelector(".status-bar")).toBeNull();
  });
});
