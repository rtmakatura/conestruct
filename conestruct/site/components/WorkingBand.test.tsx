// @vitest-environment happy-dom
//
// #252 (s2-arc23) — the global working band, mounted through the real
// shell and the real SetupStrip.  Present iff a request for the
// generated scenario is open (never a timer); the sentence is a true
// statement of what the flight changes; the refusal container never
// shares a frame with it; one live region speaks the flight.
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./PricingCard", () => ({ PricingCard: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({ onGenerate }: { onGenerate: () => void }) => (
    <button type="button" onClick={onGenerate}>
      Generate package
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { CONTROLS_LOCKED } from "./WorkingBand";
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
    },
  },
  ...TAIL,
});
const REFUSAL = {
  detail: {
    error: "site_scan_unavailable",
    message:
      "Site scan unavailable — the plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway and the plan will carry a NOT-CHECKED disclosure.",
    site_scan: { status: "unavailable", error: "scan budget exceeded (20 s)", mode: "corridor", budget_s: 20.0, flags: {}, corrections: [] },
    recovery: { retry: true, proceed_field: "site_scan.proceed_if_unavailable" },
  },
};
const BREAKDOWN = {
  devices: [],
  total_devices: 4,
  unique_types: 2,
  zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 },
};
const ok = (data: unknown): Response =>
  ({ ok: true, status: 200, json: async () => data }) as unknown as Response;
const refused = (data: unknown): Response =>
  ({ ok: false, status: 400, json: async () => data }) as unknown as Response;

type Gate = { promise: Promise<Response>; release: () => void } | null;
function gate(data: unknown): NonNullable<Gate> {
  let release!: () => void;
  const promise = new Promise<Response>((r) => {
    release = () => r(ok(data));
  });
  return { promise, release };
}
let served: unknown = audit();
let auditRefuses = false;
let auditGate: Gate = null;
let breakdownGate: Gate = null;
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    if (auditGate) return auditGate.promise;
    return Promise.resolve(auditRefuses ? refused(REFUSAL) : ok(served));
  }
  if (url.includes("/api/render/device-breakdown"))
    return breakdownGate ? breakdownGate.promise : Promise.resolve(ok(BREAKDOWN));
  return Promise.resolve(ok({}));
});
beforeEach(() => {
  fetchMock.mockClear();
  served = audit();
  auditGate = null;
  breakdownGate = null;
  auditRefuses = false;
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
async function generate(scenario = PINNED_SHOULDER) {
  render(<GeneratorShell mode="sandbox" initialScenario={scenario} />);
  await settle();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Generate package" }));
  await settle();
  return user;
}
const band = () => document.querySelector(".working-band") as HTMLElement | null;
const verb = () => band()?.querySelector(".wb-verb")?.textContent ?? null;
const object = () => band()?.querySelector(".wb-object")?.textContent ?? null;
const named = () => band()?.querySelector(".wb-named")?.textContent ?? null;
const locked = () => document.querySelector(".workbench")!.classList.contains("ws-locked");
const refusalContainer = () => document.querySelector(".scan-refusal");
const holdAudit = () => {
  const held = gate(served);
  auditGate = held;
  return held;
};

describe("#252 — the working band is present iff a request for the generated scenario is open", () => {
  it("absent pre-generate (the per-edit pair never locks typing); mounts on Generate; unmounts when the pair settles; the root lock follows it", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    // Mount: both pre-generate fetches are in flight right now.
    expect(band()).toBeNull();
    expect(locked()).toBe(false);
    await settle();
    const held = holdAudit();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate package" }));
    await settle();
    expect(band()).not.toBeNull();
    expect(locked()).toBe(true);
    // No timer anywhere: the band is read off the open request.  Held
    // well past any threshold the shell owns (SLOW_VERIFY_MS is 2 s) it
    // stays exactly as it was.
    await settle(2500);
    expect(band()).not.toBeNull();
    expect(verb()).toBe("GENERATING");
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
    expect(locked()).toBe(false);
  });

  it("the band and its derivation own no clock: no timer, no Date, no animation frame in either module", () => {
    for (const rel of ["./WorkingBand.tsx", "../lib/working-band.ts"]) {
      const src = fs.readFileSync(path.resolve(__dirname, rel), "utf-8");
      expect(src, rel).not.toMatch(/setTimeout|setInterval|requestAnimationFrame|Date\.|performance\./);
    }
  });

  it("GENERATING · new plan · the address the user typed (sans), or the pin when there is none — never a placeholder", async () => {
    holdAudit();
    await generate({
      ...PINNED_SHOULDER,
      meta: { ...PINNED_SHOULDER.meta, address: "E Colfax Ave & Race St, Denver" },
    });
    expect(verb()).toBe("GENERATING");
    expect(object()).toBe("new plan · E Colfax Ave & Race St, Denver");
    expect(named()).toBe("E Colfax Ave & Race St, Denver");
    cleanup();
    holdAudit();
    await generate();
    expect(object()).toBe("new plan · pin 39.7400, -104.9663");
    expect(named()).toBe("39.7400, -104.9663");
    expect(document.body.textContent).not.toMatch(/unnamed|untitled/i);
  });

  it("RE-GENERATING · after a correction to {condition} on Assert; after undoing the correction on Undo", async () => {
    const user = await generate();
    expect(band()).toBeNull();
    const block = () => document.getElementById("site-corrections")!;
    const asserted = {
      flag: "school_zone",
      action: "assert",
      status: "applied",
      scan_detected: false,
      disclosure: "Operator asserted school zone — the scan found none along the corridor.",
    };
    served = audit([asserted]);
    let held = holdAudit();
    const school = within(block()).getByText("School zone").closest(".site-correction-row") as HTMLElement;
    await user.click(within(school).getByRole("button", { name: "Assert" }));
    await settle();
    expect(verb()).toBe("RE-GENERATING");
    expect(object()).toBe("after a correction to School zone");
    expect(named()).toBe("School zone");
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
    // Undo: the marker leaves the wire; the band says so.
    served = audit();
    held = holdAudit();
    await user.click(within(block()).getByRole("button", { name: "Undo" }));
    await settle();
    expect(object()).toBe("after undoing the correction to School zone");
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
  });

  it("RE-GENERATING · after an edit to speed from the strip's inline editor — up from the deferred debounce window, not only the fetch", async () => {
    const user = await generate();
    holdAudit();
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    // The edit is on screen; the debounced fetch may not have fired yet —
    // the verdict derivations treat the window as in flight, so does the band.
    expect(band()).not.toBeNull();
    expect(object()).toBe("after an edit to speed");
    expect(named()).toBeNull();
    await settle();
    expect(object()).toBe("after an edit to speed");
  });

  it("spec 31: the refusal container never shares a frame with the band — it renders once the pair has settled; Retry says 'retrying the site scan', proceed-anyway 'without the site check'", async () => {
    auditRefuses = true;
    const heldBreakdown = gate(BREAKDOWN);
    breakdownGate = heldBreakdown;
    const user = await generate();
    // The audit refused; the breakdown is still open: band up, no container.
    expect(band()).not.toBeNull();
    expect(refusalContainer()).toBeNull();
    // The strip's verdict is unchanged and unmasked (#192).
    expect(document.querySelector(".status-bar")!.textContent).toContain("PLAN DECLINED");
    await act(async () => {
      heldBreakdown.release();
    });
    await settle();
    expect(band()).toBeNull();
    expect(refusalContainer()).not.toBeNull();
    // Retry re-sends the same wire object.
    auditRefuses = false;
    let held = holdAudit();
    await user.click(screen.getByRole("button", { name: "↻ Retry scan" }));
    await settle();
    expect(band()).not.toBeNull();
    expect(refusalContainer()).toBeNull();
    expect(verb()).toBe("RE-GENERATING");
    expect(object()).toBe("retrying the site scan");
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
    expect(refusalContainer()).toBeNull();
  });

  it("RE-GENERATING · without the site check when proceed-anyway is the acknowledgement that opened the request", async () => {
    auditRefuses = true;
    const user = await generate();
    expect(band()).toBeNull();
    expect(refusalContainer()).not.toBeNull();
    auditRefuses = false;
    const held = holdAudit();
    await user.click(screen.getByRole("button", { name: /Generate without site check/ }));
    await settle();
    expect(band()).not.toBeNull();
    expect(verb()).toBe("RE-GENERATING");
    expect(object()).toBe("without the site check");
    expect(named()).toBeNull();
    await act(async () => {
      held.release();
    });
    await settle();
    expect(band()).toBeNull();
  });

  it("aria: the band's row is the one polite region that speaks the flight; the strip's region is empty while it is up; the sentence is the visible text", async () => {
    holdAudit();
    await generate();
    const row = band()!.querySelector("[role=status]")!;
    expect(row.getAttribute("aria-live")).toBe("polite");
    expect(row.textContent).toBe(`◌GENERATINGnew plan · pin 39.7400, -104.9663${CONTROLS_LOCKED}`);
    expect(row.querySelector(".wb-glyph")!.getAttribute("aria-hidden")).toBe("true");
    // The strip's live wrapper stays mounted and says nothing.
    expect(document.querySelector(".status-bar")).toBeNull();
    // Exactly one live region carries the flight's words.
    const speakers = Array.from(document.querySelectorAll("[aria-live], [role=status], [role=alert]")).filter((e) =>
      /GENERATING|CONTROLS LOCKED/.test(e.textContent ?? ""),
    );
    expect(speakers).toHaveLength(1);
    expect(speakers[0]).toBe(row);
    // No retired working voice anywhere on the page.
    expect(document.body.textContent).not.toMatch(/COMPUTING|VERIFYING|Generating…|Recomputing|scanning site conditions/);
  });
});
