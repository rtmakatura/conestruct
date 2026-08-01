// @vitest-environment happy-dom
//
// Arc 2 Step 2 — TEMPORARY repro captures (NOT to be committed).
// Each test asserts the DEFECTIVE behavior at HEAD, so a PASS here is a
// reproduction, captured at the rendered-DOM level.  Deleted after the
// output is captured; the post-go red tests invert these assertions.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
// QuotePanel stub exposes the onTotalChange escape hatch so the collapsed
// PricingCard headline can be fed a previewed total (#192's casualty).
vi.mock("./QuotePanel", () => ({
  QuotePanel: (props: { onTotalChange?: (n: number) => void }) => (
    <button onClick={() => props.onTotalChange?.(1794)}>SET_TOTAL</button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { OutputCards } from "./OutputCards";
import { DEFAULT_FLAGGER } from "@/lib/scenarios";
import type { Scenario, FlaggerLaneClosureScenario } from "@/lib/scenarios";
import type { AuditResponse, AuditSummary } from "../lib/render-types";
import type { DeviceBreakdownState } from "./DeviceBreakdown";

const BREAKDOWN = {
  devices: [{ device: "ROAD WORK AHEAD", code: "W20-1", function: "Advance warning", qty: 2 }],
  total_devices: 42,
  unique_types: 6,
  zone_geometry: { taper_l_ft: 183, buffer_b_ft: 495, device_spacing_ft: 55, work_len_ft: 500 },
};

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
  plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
};

const FLOOR_400 =
  "Work zone length (50 ft) is shorter than the required shoulder taper " +
  "(L/3) of 184 ft at 55 mph. Increase the work zone to at least 184 ft, " +
  "or reduce the speed limit.";

const MULTILANE_400 =
  "This road appears to carry more lanes than a flagger operation covers " +
  "— TA-10 applies where one through lane runs in each direction. If " +
  "detection is wrong, confirm 'Road has one through lane in each " +
  "direction' in the form and regenerate.";

const FLAGGER_MULTILANE: FlaggerLaneClosureScenario = {
  ...DEFAULT_FLAGGER,
  detectedLanesTotal: 4,
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
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as unknown as Response);
});

const okAudit = () =>
  ({ ok: true, status: 200, json: async () => CLEAN_AUDIT }) as unknown as Response;
const refusal400 = (message: string) =>
  ({ ok: false, status: 400, json: async () => ({ detail: message }) }) as unknown as Response;
const okBd = () =>
  ({ ok: true, status: 200, json: async () => BREAKDOWN }) as unknown as Response;

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

describe("Arc 2 Step 2 repro captures (defective behavior at HEAD)", () => {
  it("#187: declined audit keeps previous input's cited numbers + live Audit PDF", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);
    await release(bdCalls, 0, okBd());
    await release(auditCalls, 0, okAudit());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await release(bdCalls, 1, okBd());
    await release(auditCalls, 1, refusal400(FLOOR_400));

    // Declined line is up…
    expect(document.body.textContent).toContain(
      "Audit trail unavailable while generation is declined",
    );
    // …and the previous input's cited numbers still render beneath it.
    const auditPanel = screen.getByRole("button", { name: "↓ Audit PDF" })
      .closest("section, div.card, div")!.parentElement!.parentElement!;
    expect(auditPanel.textContent).toContain("183"); // lastReady taper
    expect(document.body.textContent).toContain("✓");
    // The Audit PDF button is fully enabled on the declined path.
    const pdfBtn = screen.getByRole("button", { name: "↓ Audit PDF" });
    expect((pdfBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("#192: post-generate edit unmounts results (total dies) and COMPUTING masks the refusal", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);
    await release(bdCalls, 0, okBd());
    await release(auditCalls, 0, okAudit());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    // Feed the previewed total into the collapsed pricing headline.
    await user.click(screen.getByText("SET_TOTAL"));
    expect(document.body.textContent).toContain("$1,794");

    // Post-generate strip edit → whole results subtree unmounts.
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    expect(screen.getByText("Generating…")).toBeTruthy();
    expect(screen.queryByText("SET_TOTAL")).toBeNull(); // PricingCard gone

    // Audit settles as a refusal for the CURRENT scenario while the
    // breakdown is still in flight: the strip shows COMPUTING, masking it.
    await release(auditCalls, 1, refusal400(FLOOR_400));
    expect(stripText()).toContain("COMPUTING");
    expect(stripText()).not.toContain("DECLINED");
    expect(stripText()).not.toContain("INVALID INPUT");

    // Breakdown lands → the refusal finally surfaces; the previewed
    // total did not survive the round trip.
    await release(bdCalls, 1, okBd());
    expect(stripText()).toMatch(/DECLINED|INVALID INPUT/);
    expect(document.body.textContent).not.toContain("$1,794");
    expect(document.body.textContent).toContain("expand to configure & preview");
  });

  it("#196: Generate re-enables inside the confirm/re-fetch window; second refusal points at an unmounted row", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={FLAGGER_MULTILANE} />);
    await release(bdCalls, 0, okBd());
    await release(auditCalls, 0, refusal400(MULTILANE_400));

    // Settled refusal: CTA gated, affordance row on screen.
    const generate = () =>
      screen.getByRole("button", { name: /Generate plan/ }) as HTMLButtonElement;
    expect(generate().disabled).toBe(true);
    expect(document.body.textContent).toContain("one through lane in each direction");

    // Any edit starts a re-fetch: refusal is nulled for the whole window
    // and the CTA re-enables while the road is still refused.
    const range = document.querySelector('input[type="range"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(range, { target: { value: String(Number(range.value) + 5) } });
    });
    await release(bdCalls, 1, okBd());
    expect(auditCalls.length).toBe(2); // audit re-fetch in flight
    expect(generate().disabled).toBe(false); // THE window

    // Click Generate inside the window; the second refusal then points at
    // a confirm row that is no longer rendered.
    fireEvent.click(generate());
    await release(auditCalls, 1, refusal400(MULTILANE_400));
    expect(document.querySelector(".setup-strip")).not.toBeNull(); // post-generate layout
    expect(document.body.textContent).not.toContain("one through lane in each direction");
    expect(stripText()).toMatch(/DECLINED|NEEDS/);
  });

  it("#183: workbench download href stays pinned to the DB row while the screen recomputes", async () => {
    const user = userEvent.setup();
    render(
      <GeneratorShell
        mode="workbench"
        initialPlanId="p1"
        initialPlanName="Plan A"
      />,
    );
    await release(bdCalls, 0, okBd());
    await release(auditCalls, 0, okAudit());
    await user.click(screen.getByRole("button", { name: /Generate plan/ }));

    const hrefs = () =>
      Array.from(document.querySelectorAll("a[download]")).map((a) =>
        a.getAttribute("href"),
      );
    expect(hrefs()).toContain("/api/plans/p1/pdf");

    // Edit speed on screen; every on-screen number refetches from the
    // live scenario…
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await release(bdCalls, 1, okBd());
    await release(auditCalls, 1, okAudit());
    const bodies = fetchMock.mock.calls
      .filter(([u]) => String(u).includes("device-breakdown"))
      .map((c) => JSON.parse(String((c[1] as RequestInit).body)));
    expect(bodies[bodies.length - 1].scenario.speed).toBe(35);
    // …while the download anchors still resolve the saved row, unchanged.
    expect(hrefs()).toContain("/api/plans/p1/pdf");
  });

  it("#197/OutputCards: a download error sticks after the scenario changes", async () => {
    const SUMMARY: AuditSummary = CLEAN_AUDIT.summary;
    const READY: DeviceBreakdownState = {
      state: "ready",
      data: { devices: [], total_devices: 42, unique_types: 6 },
    };
    const s1 = { meta: { project: "A" }, speed: 55 } as unknown as Scenario;
    const s2 = { meta: { project: "A" }, speed: 30 } as unknown as Scenario;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes("/api/render/")) {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: async () => FLOOR_400,
        } as unknown as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as unknown as Response);
    });

    const view = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "public", scenario: s1 }}
        breakdown={READY}
      />,
    );
    const btn = document.querySelector(".dl-btn") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Try again")).toBeTruthy();

    // The input changes (new scenario object) — the error stays verbatim.
    view.rerender(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "public", scenario: s2 }}
        breakdown={READY}
      />,
    );
    expect(screen.getByText("Try again")).toBeTruthy();
  });
});
