// @vitest-environment happy-dom
//
// #260 (P2) — one voice for the location gate, and the context block's
// place on the page.  Mounted through the real shell on a fresh session
// (no site chosen), the way the audit walked it (F-S1-2).
//
//   (2) Before this arc the gate had three speakers: the rail blocker
//       (visible), the CTA reason (role=alert — the control's own text,
//       ruled the one export in #228) and the strip ("AWAITING LOCATION ·
//       pick a location on the map …", aria-live=polite) — and the quiet
//       jurisdiction band announced its own empty state.  Now: the CTA
//       reason is the ONE live region carrying the instruction; the strip
//       names the state without repeating it ("no site chosen"); the rail
//       blocker is aria-hidden (visual, the same string — #228 untouched);
//       `.jbar-suggest.quiet` carries no live attribute (nothing changed,
//       nothing to announce; the "Checking boundary data…" state keeps its).
//   (1) The context block — the intro sentence, the draft notice and the
//       read-only jurisdiction bar — sits below Results and above
//       Reference at every stage, so the first viewport holds a control
//       (the pick CTA) instead of 550 px of preamble (F-S1-1).  DOM order
//       pinned here; the CTA's bottom is the browser leg's figure.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => <div>OUTPUT-CARDS</div> }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./PricingCard", () => ({ PricingCard: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => <div>REFERENCE</div> }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";

const GATE = "Set a location first — pick on map or enter manually.";

const CLEAN_AUDIT = {
  summary: {},
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
const OK_BD = {
  devices: [],
  total_devices: 12,
  unique_types: 4,
  zone_geometry: { taper_l_ft: 100, buffer_b_ft: 200, device_spacing_ft: 40, work_len_ft: 500 },
};
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  const data = url.includes("/api/render/audit")
    ? CLEAN_AUDIT
    : url.includes("/api/render/device-breakdown")
      ? OK_BD
      : {};
  return Promise.resolve({ ok: true, status: 200, json: async () => data } as unknown as Response);
});

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
}

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const liveRegions = () =>
  Array.from(document.querySelectorAll("[aria-live], [role=status], [role=alert]"));

describe("#260 (2) — one live speaker for the location gate", () => {
  it("fresh session: exactly one live region carries the gate sentence — the CTA reason; the strip says AWAITING LOCATION · no site chosen; the rail blocker is aria-hidden; the quiet band is not live", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await settle();

    const speakers = liveRegions().filter((e) => (e.textContent ?? "").includes(GATE));
    expect(speakers).toHaveLength(1);
    expect(speakers[0].getAttribute("data-testid")).toBe("cta-reason");
    expect(speakers[0].getAttribute("role")).toBe("alert");

    // The strip: the state, not the instruction (no second voice).
    const strip = document.querySelector(".status-slot .status-bar")!;
    expect(strip.textContent).toBe("AWAITING LOCATION · no site chosen");
    expect(strip.textContent).not.toMatch(/pick a location|Set a location/);

    // The rail blocker: the same string, visual only (#228 derivation untouched).
    const blocker = document.querySelector('[data-testid="rail-blocker"]')!;
    expect(blocker.textContent).toBe(GATE);
    expect(blocker.getAttribute("aria-hidden")).toBe("true");

    // The quiet jurisdiction band announces nothing.
    const quiet = document.querySelector(".jbar-suggest.quiet")!;
    expect(quiet.textContent).toContain("Drop a site pin for a jurisdiction suggestion");
    expect(quiet.hasAttribute("aria-live")).toBe(false);

    // The live regions mounted pre-pin: the strip's slot (polite), the
    // CTA reason (alert), the sr-only generation status (empty) — three.
    const regions = liveRegions();
    expect(regions).toHaveLength(3);
    expect(regions.map((e) => e.getAttribute("aria-live") ?? e.getAttribute("role")).sort()).toEqual(
      ["alert", "polite", "status"],
    );
  });

  it("the boundary-data fetch keeps its polite voice — something IS changing", async () => {
    // A pinned mount fires the jurisdiction lookups; the "Checking
    // boundary data…" state renders while they are open.
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    const checking = document.querySelector(".jbar-suggest.quiet");
    if (checking && /Checking boundary data/.test(checking.textContent ?? "")) {
      expect(checking.getAttribute("aria-live")).toBe("polite");
    }
    await settle();
  });
});
