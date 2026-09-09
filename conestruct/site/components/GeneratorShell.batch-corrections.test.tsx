// @vitest-environment happy-dom
//
// #254 (s2-arc26) — corrections are STAGED in the shell and applied as one
// write.  Mounted through the real shell and the real SetupStrip with
// fetch stubbed: staging two corrections opens no request (the fetch
// count is unchanged, no band, the results dimmed behind the "Previous
// answer — N corrections staged" ribbon while downloads stay live);
// Apply opens exactly ONE request per surface whose wire body carries
// the staged set exactly, the band mounts once and names the count;
// Undo on a staged row un-stages without a request; Reopen clears the
// set.  Rule 11: the assertions are on the request log and the DOM.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./PricingCard", () => ({ PricingCard: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
vi.mock("./OutputCards", () => ({
  OutputCards: ({ generated }: { generated?: boolean }) => (
    <button type="button" className="dl-btn" data-read="" disabled={!generated}>
      DOWNLOAD_STUB
    </button>
  ),
}));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({ onGenerate }: { onGenerate: () => void }) => (
    <button type="button" onClick={onGenerate}>
      Generate package
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";

const BUCKETS = {
  intersections: { detected: true, count: 26, nearest_distance_ft: 34.1, details: ["W Alameda Ave"] },
  interchanges: { detected: false, count: 0 },
  sidewalks: { detected: true, count: 18, nearest_distance_ft: 46.6 },
  bike_facilities: { detected: false, count: 0 },
  schools: { detected: false, count: 0 },
};
const SECTIONS = {
  taper: {},
  buffer: {},
  spacing: {},
  advance: {},
  colorado: {},
  case: {},
  flagger: {},
  corridor_validation: { checked: false, warnings: [] },
  geometry_validation: { violations: [], all_pass: true },
};
const TAIL = {
  pending_verification: { count: 0, note: "", tracking_issue: null },
  plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
};
const ADVISORY = "The plan is built to the correction — verify it in the field or on imagery before deploying.";
const audit = (corrections: unknown[] = []) => ({
  summary: {},
  sections: {
    ...SECTIONS,
    site_scan: {
      status: "ok",
      mode: "corridor",
      measured_at: "2026-09-04T12:00:00+00:00",
      buckets: BUCKETS,
      flags: {},
      corrections,
      corrections_advisory: corrections.length ? ADVISORY : null,
    },
  },
  ...TAIL,
});
const BREAKDOWN = {
  devices: [],
  total_devices: 4,
  unique_types: 2,
  zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 },
};
const ok = (data: unknown): Response =>
  ({ ok: true, status: 200, json: async () => data }) as unknown as Response;
type Gate = { promise: Promise<Response>; release: () => void };
function gate(data: unknown): Gate {
  let release!: () => void;
  const promise = new Promise<Response>((r) => {
    release = () => r(ok(data));
  });
  return { promise, release };
}
let served: unknown = audit();
let auditGate: Gate | null = null;
const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) return auditGate ? auditGate.promise : Promise.resolve(ok(served));
  if (url.includes("/api/render/device-breakdown")) return Promise.resolve(ok(BREAKDOWN));
  return Promise.resolve(ok({}));
});
const calls = (kind: "audit" | "device-breakdown") =>
  fetchMock.mock.calls.filter(([input]) => String(input).includes(`/api/render/${kind}`));
const lastBody = (kind: "audit" | "device-breakdown") => {
  const c = calls(kind);
  const init = c[c.length - 1][1]!;
  // Both surfaces POST { scenario } (GeneratorShell.tsx:363, :419).
  return (JSON.parse(String(init.body)) as { scenario: { meta: { siteConditionOverrides?: unknown[] } } }).scenario;
};
beforeEach(() => {
  fetchMock.mockClear();
  served = audit();
  auditGate = null;
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = function () {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function settle(ms = 400) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
async function generate() {
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
  await settle();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Generate package" }));
  await settle();
  return user;
}
const block = () => document.getElementById("site-corrections") as HTMLElement;
const band = () => document.querySelector(".working-band") as HTMLElement | null;
const row = (label: string) => within(block()).getByText(label).closest(".sc-row") as HTMLElement;
const apply = (name: string) => within(block()).getByRole("button", { name }) as HTMLButtonElement;
const ribbon = () =>
  Array.from(document.querySelectorAll(".stale-ribbon")).find((r) => /staged/.test(r.textContent ?? "")) ?? null;
const stale = () => document.querySelector(".results-stale");
const download = () => screen.getByText("DOWNLOAD_STUB") as HTMLButtonElement;

async function stageTwo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(row("School zone")).getByRole("button", { name: "Assert" }));
  await user.click(within(row("Pedestrian sidewalks")).getByRole("button", { name: "Dismiss" }));
  const picker = block().querySelector(".site-correction-picker") as HTMLElement;
  await user.click(within(picker).getByRole("radio", { name: "Fenced off" }));
  await user.click(within(picker).getByRole("button", { name: "Confirm dismiss" }));
  await settle();
}

describe("#254 — corrections stage in the shell and apply as one write", () => {
  it("staging two corrections opens no request, mounts no band, discloses (dim + ribbon) and keeps downloads live", async () => {
    const user = await generate();
    const audits = calls("audit").length;
    const breakdowns = calls("device-breakdown").length;
    expect(band()).toBeNull();
    expect(stale()).toBeNull();
    expect(ribbon()).toBeNull();
    await stageTwo(user);
    // Two staged rows, the Apply row says 2, the ribbon says 2.
    expect(row("School zone").classList.contains("sc-staged")).toBe(true);
    expect(row("Pedestrian sidewalks").classList.contains("sc-staged")).toBe(true);
    expect(within(block()).getByText("2 corrections staged · not yet applied")).toBeTruthy();
    expect(apply("Apply 2 corrections").disabled).toBe(false);
    expect(calls("audit").length).toBe(audits);
    expect(calls("device-breakdown").length).toBe(breakdowns);
    expect(band()).toBeNull();
    expect(document.querySelector(".workbench")!.classList.contains("ws-locked")).toBe(false);
    // Disclose, don't lock (P7 / #252): the results dim behind the ribbon,
    // the download control stays live.
    expect(stale()).not.toBeNull();
    expect(ribbon()!.textContent).toBe("Previous answer — 2 corrections staged, not yet applied.");
    expect(download().disabled).toBe(false);
    expect(download().closest(".results-stale")).not.toBeNull();
  });

  it("Undo on a staged row un-stages it — no request; the count follows", async () => {
    const user = await generate();
    const audits = calls("audit").length;
    await stageTwo(user);
    await user.click(within(row("School zone")).getByRole("button", { name: "Undo" }));
    await settle();
    expect(row("School zone").classList.contains("sc-staged")).toBe(false);
    expect(within(row("School zone")).getByRole("button", { name: "Assert" })).toBeTruthy();
    expect(within(block()).getByText("1 correction staged · not yet applied")).toBeTruthy();
    expect(ribbon()!.textContent).toBe("Previous answer — 1 correction staged, not yet applied.");
    await user.click(within(row("Pedestrian sidewalks")).getByRole("button", { name: "Undo" }));
    await settle();
    expect(within(block()).getByText("no corrections staged")).toBeTruthy();
    expect(apply("Apply 0 corrections").disabled).toBe(true);
    expect(ribbon()).toBeNull();
    expect(stale()).toBeNull();
    expect(calls("audit").length).toBe(audits);
  });

  it("Apply opens exactly one request per surface carrying the staged set exactly; the band mounts once and names the count; the set empties on settle", async () => {
    const user = await generate();
    await stageTwo(user);
    const audits = calls("audit").length;
    const breakdowns = calls("device-breakdown").length;
    const asserted = {
      flag: "school_zone",
      action: "assert",
      status: "applied",
      scan_detected: false,
      disclosure: "Operator asserted school zone — the scan found none along the corridor. " + ADVISORY,
      record_clause: "Operator asserted school zone — the scan found none along the corridor.",
    };
    const dismissed = {
      flag: "pedestrian_facility",
      action: "dismiss",
      reason: "fenced",
      status: "applied",
      scan_detected: true,
      disclosure: "Operator dismissed the scan's pedestrian sidewalks: fenced off. " + ADVISORY,
      record_clause: "Operator dismissed the scan's pedestrian sidewalks: fenced off.",
    };
    served = audit([asserted, dismissed]);
    const held = gate(served);
    auditGate = held;
    await user.click(apply("Apply 2 corrections"));
    await settle();
    // One request each — not one per correction.
    expect(calls("audit").length).toBe(audits + 1);
    expect(calls("device-breakdown").length).toBe(breakdowns + 1);
    for (const kind of ["audit", "device-breakdown"] as const) {
      const sent = lastBody(kind).meta.siteConditionOverrides!;
      expect(sent.map((m) => (m as { flag: string }).flag)).toEqual(["school_zone", "pedestrian_facility"]);
      expect(sent[0]).toMatchObject({ flag: "school_zone", action: "assert" });
      expect(sent[1]).toMatchObject({ flag: "pedestrian_facility", action: "dismiss", reason: "fenced" });
      expect(sent[0]).not.toHaveProperty("reason");
      expect(sent[1]).not.toHaveProperty("note");
    }
    // The band is up once, naming the count (not one condition's name).
    expect(band()).not.toBeNull();
    expect(band()!.querySelector(".wb-verb")!.textContent).toBe("RE-GENERATING");
    expect(band()!.querySelector(".wb-object")!.textContent).toBe("after 2 corrections");
    expect(band()!.querySelector(".wb-named")).toBeNull();
    // In flight: the staged set is already empty (Apply consumed it); the
    // staged ribbon is gone — the flight's own ribbon speaks.
    expect(ribbon()).toBeNull();
    expect(apply("Apply 0 corrections").disabled).toBe(true);
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
    expect(calls("audit").length).toBe(audits + 1);
    // Settled: two records, the advisory once, nothing staged, nothing dimmed.
    expect(within(block()).getByText(asserted.record_clause)).toBeTruthy();
    expect(within(block()).getByText(dismissed.record_clause)).toBeTruthy();
    expect(block().querySelectorAll(".sc-foot-advisory")).toHaveLength(1);
    expect(within(block()).getByText("no corrections staged")).toBeTruthy();
    expect(stale()).toBeNull();
    expect(block().querySelectorAll(".sc-staged")).toHaveLength(0);
  });

  it("Reopen clears the staged set: the next Generate carries no marker", async () => {
    const user = await generate();
    await stageTwo(user);
    await user.click(screen.getByText(/Edit full setup/));
    await settle();
    await user.click(screen.getByRole("button", { name: "Generate package" }));
    await settle();
    expect("siteConditionOverrides" in lastBody("audit").meta).toBe(false);
    expect(within(block()).getByText("no corrections staged")).toBeTruthy();
    expect(ribbon()).toBeNull();
  });
});
