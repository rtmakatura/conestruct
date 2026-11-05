// @vitest-environment happy-dom
//
// #254 (s2-arc26) — corrections are STAGED in the shell and applied as one
// write.  Mounted through the real shell and the real band column with
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
vi.mock("./ReferenceSections", () => ({ ReferenceSections: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./PricingCard", () => ({ PricingCard: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
vi.mock("./OutputCards", () => ({
  // pendingAnswers is the Downloads warning row's N (ruling 11): the one
  // voice for staged answers once the #254 ribbon steps aside.
  OutputCards: ({ generated, pendingAnswers }: { generated?: boolean; pendingAnswers?: number }) => (
    <button
      type="button"
      className="dl-btn"
      data-read=""
      data-pending={pendingAnswers ?? 0}
      disabled={!generated}
    >
      DOWNLOAD_STUB
    </button>
  ),
}));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({
    onGenerate,
    scenario,
    setScenario,
  }: {
    onGenerate: () => void;
    scenario: { speed: number };
    setScenario: (s: unknown) => void;
  }) => (
    <div data-testid="band-stack" data-open-band="what">
      <button type="button" onClick={onGenerate}>
        Generate package
      </button>
      {/* #289 Phase 2: the stub stands in for the column and carries the
          one cell these cases edit — the WHAT grid's speed select (the
          setup strip and its inline editors are deleted, §8.27). */}
      <label htmlFor="what-speed">Speed limit</label>
      <select
        id="what-speed"
        value={scenario.speed}
        onChange={(e) => setScenario({ ...scenario, speed: +e.target.value })}
      >
        {[25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75].map((s) => (
          <option key={s} value={s}>
            {s} mph
          </option>
        ))}
      </select>
    </div>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";
import {
  applyRevision,
  changeOneThing,
  editAfterGenerate,
  openWhat,
  openWhere,
  stageRevision,
} from "./__fixtures__/band-helpers";

// #289 Phase 2 — the setup strip is deleted (§8.27; #262 closes by
// deletion).  A post-generate edit is CHANGE ONE THING on the setup fact
// line, then the WHAT grid's own cell: `editAfterGenerate` in
// components/__fixtures__/band-helpers.ts is those two steps.

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
const ADVISORY = "The plan is built to the correction. Verify it in the field or on imagery before deploying.";
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
  if (url.includes("/api/render/audit")) {
    const answer = auditGate ? auditGate.promise : Promise.resolve(ok(served));
    // #306 (R64): a Generate's audit carries the breakdown it used to
    // fetch separately (`include_breakdown`).
    if (!JSON.parse(String(_init?.body ?? "{}"))?.scenario?.include_breakdown) return answer;
    return answer.then(async (r) => ok({ ...((await r.json()) as object), breakdown: BREAKDOWN }));
  }
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
const ribbon = () =>
  Array.from(document.querySelectorAll(".stale-ribbon")).find((r) => /staged/.test(r.textContent ?? "")) ?? null;
const stale = () => document.querySelector(".results-stale");
const download = () => screen.getByText("DOWNLOAD_STUB") as HTMLButtonElement;
const pending = () => Number(download().dataset.pending);
const button = (name: string) => within(block()).getByRole("button", { name }) as HTMLButtonElement;
// #437 ruling 8: the none-found rows (and their Assert) sit in the other-
// conditions row, opened by "Show them".
async function assertSchool(user: ReturnType<typeof userEvent.setup>) {
  const other = document.querySelector(".ny-other") as HTMLElement;
  await user.click(within(other).getByRole("button", { name: "Show them" }));
  const school = within(other).getByText("School zone").closest(".ny-item") as HTMLElement;
  await user.click(within(school).getByRole("button", { name: "Assert" }));
  await settle();
}

// #437 (rulings 3, 5, 6; S1, S2): the two detected conditions are two
// questions.  No site adjustment is on this wire, so ruling 4 keeps the
// scan's order: the intersection first, then the sidewalks.
async function answerBoth(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(block()).getByLabelText(/No, there isn't one/));
  await user.click(button("Next question"));
  await user.click(within(block()).getByLabelText(/Yes, they're there/));
  await settle();
}

describe("#254 — answers stage in the shell and apply as one write (#437)", () => {
  it("staging two answers opens no request, mounts no band, discloses (dim + the Downloads row, no ribbon) and keeps downloads live", async () => {
    const user = await generate();
    const audits = calls("audit").length;
    const breakdowns = calls("device-breakdown").length;
    expect(band()).toBeNull();
    expect(stale()).toBeNull();
    expect(ribbon()).toBeNull();
    await answerBoth(user);
    expect(button("Apply answers").disabled).toBe(false);
    expect(calls("audit").length).toBe(audits);
    expect(calls("device-breakdown").length).toBe(breakdowns);
    expect(band()).toBeNull();
    expect(document.querySelector(".workbench")!.classList.contains("ws-locked")).toBe(false);
    // Disclose, don't lock (P7 / #252; ruling 11).
    expect(stale()).not.toBeNull();
    // #437 hand check (P2): answers only staged, so the Downloads warning
    // row is the one voice; the #254 ribbon does not repeat it.
    expect(ribbon()).toBeNull();
    expect(pending()).toBe(2);
    expect(download().disabled).toBe(false);
  });

  it("Undo on a staged answer un-stages it: no request; the count follows", async () => {
    const user = await generate();
    const audits = calls("audit").length;
    await user.click(within(block()).getByLabelText(/No, there isn't one/));
    await user.click(button("Next question"));
    await settle();
    expect(ribbon()).toBeNull();
    expect(stale()).not.toBeNull();
    await user.click(button("Undo"));
    await settle();
    expect(ribbon()).toBeNull();
    expect(stale()).toBeNull();
    expect(within(block()).getByText("Question 1 of 2")).toBeTruthy();
    expect(calls("audit").length).toBe(audits);
  });

  it("Apply answers opens exactly one request carrying the staged set exactly; the band names the count; the set empties", async () => {
    const user = await generate();
    await answerBoth(user);
    const audits = calls("audit").length;
    const breakdowns = calls("device-breakdown").length;
    const dismissed = {
      flag: "adjacent_intersection",
      action: "dismiss",
      reason: "not_there",
      status: "applied",
      scan_detected: true,
      disclosure: "Operator dismissed the scan's adjacent at-grade intersection: not there. " + ADVISORY,
      record_clause: "Operator dismissed the scan's adjacent at-grade intersection: not there.",
    };
    const confirmed = {
      flag: "pedestrian_facility",
      action: "confirm",
      status: "confirmed",
      scan_detected: true,
      disclosure: "Operator confirmed the scan's pedestrian sidewalks. The plan is unchanged.",
      record_clause: "Operator confirmed the scan's pedestrian sidewalks. The plan is unchanged.",
    };
    served = audit([dismissed, confirmed]);
    const held = gate(served);
    auditGate = held;
    await user.click(button("Apply answers"));
    await settle();
    // One request, not one per answer; the audit carries the breakdown (#306).
    expect(calls("audit").length).toBe(audits + 1);
    expect(calls("device-breakdown").length).toBe(breakdowns);
    const sent = lastBody("audit").meta.siteConditionOverrides!;
    expect(sent.map((m) => (m as { flag: string }).flag)).toEqual([
      "adjacent_intersection",
      "pedestrian_facility",
    ]);
    expect(sent[0]).toMatchObject({ action: "dismiss", reason: "not_there" });
    expect(sent[0]).not.toHaveProperty("note");
    expect(sent[1]).toMatchObject({ action: "confirm" });
    expect(sent[1]).not.toHaveProperty("reason");
    expect(band()).not.toBeNull();
    expect(band()!.querySelector(".wb-verb")!.textContent).toBe("RE-GENERATING");
    expect(band()!.querySelector(".wb-object")!.textContent).toBe("after 2 corrections");
    expect(ribbon()).toBeNull();
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
    expect(calls("audit").length).toBe(audits + 1);
    // Settled: both answers are applied records; nothing staged or dimmed.
    expect(within(block()).getByText("2 of 2 answered")).toBeTruthy();
    expect(
      within(block()).getByText("Intersection: no, there isn't one"),
    ).toBeTruthy();
    expect(
      within(block()).getByText("Sidewalks: yes, they're there"),
    ).toBeTruthy();
    expect(block().querySelectorAll(".ny-advisory")).toHaveLength(1);
    expect(stale()).toBeNull();
  });

  it("CHANGE ONE THING KEEPS the staged set — one Apply carries both halves", async () => {
    // Part 1 §5.5 / ruling 191: the field and the staged answers in one write.
    const user = await generate();
    await answerBoth(user);
    await changeOneThing();
    await settle();
    // The staged answers survive opening the editor: the Downloads row
    // still counts them (the ribbon steps aside for answers, P2).
    expect(pending()).toBe(2);
    expect(stale()).not.toBeNull();
    expect("siteConditionOverrides" in lastBody("audit").meta).toBe(false);
    await applyRevision();
    await settle();
    expect("siteConditionOverrides" in lastBody("audit").meta).toBe(true);
    expect(ribbon()).toBeNull();
  });
});

describe("#289 finding 2 — the staged sentence says what is staged, from the one list", () => {
  it("one FIELD reads '1 field' on the ribbon", async () => {
    await generate();
    await stageRevision("55");
    await settle();
    expect(ribbon()!.textContent).toBe("Previous answer: 1 field staged, not yet applied.");
  });

  it("a field and a correction read '1 field · 1 correction' everywhere the set is named", async () => {
    const user = await generate();
    await stageRevision("55");
    await settle();
    await assertSchool(user);
    expect(ribbon()!.textContent).toBe(
      "Previous answer: 1 field · 1 correction staged, not yet applied.",
    );
    expect(screen.getByTestId("revise-sentence").textContent).toBe(
      "1 field · 1 correction staged · not yet applied",
    );
  });

  it("PAYLOAD: Apply answers writes BOTH halves — a staged field is not dropped", async () => {
    const user = await generate();
    await stageRevision("55");
    await settle();
    await answerBoth(user);
    await user.click(button("Apply answers"));
    await settle();
    const wrote = lastBody("audit") as unknown as {
      speed: number;
      meta: { siteConditionOverrides?: unknown[] };
    };
    expect(wrote.speed).toBe(55);
    expect(wrote.meta.siteConditionOverrides).toHaveLength(2);
    expect(ribbon()).toBeNull();
  });
});
