// @vitest-environment happy-dom
//
// #288 Phase 1 clause 5 — the intro and the results-area zone headings
// are DROPPED, and the focus target is re-homed onto the results stack.
//
// Part 1 §8.28: "Zone headings (01 Setup / 02 Results / 03 Reference) —
// DROPPED as visible headings.  The column has one narrative … The
// programmatic focus targets on Zone 1 and Zone 2 must be re-homed onto
// the band stack and the results stack."
// Part 1 §8.30: "the intro paragraph is DROPPED (it restates the download
// cards' captions); the draft notice is kept (8.12)."
//
// Two of these claims are about ABSENCE, which is the kind of claim that
// silently stops being true: a heading can come back in a later edit and
// nothing fails.  That is what this file is for.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./PricingCard", () => ({ PricingCard: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({ onGenerate }: { onGenerate: () => void }) => (
    <button type="button" onClick={onGenerate}>
      Generate package
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";

const AUDIT = {
  summary: {},
  sections: {
    taper: {},
    buffer: {},
    spacing: {},
    advance: {},
    colorado: { checks: [] },
    case: {},
    flagger: {},
    corridor_validation: { checked: true, warnings: [] },
    geometry_validation: { violations: [], all_pass: true },
    site_adjustments: [],
    site_scan: { status: "ok", mode: "corridor", buckets: {}, flags: {}, corrections: [] },
  },
  pending_verification: { count: 0, note: "", tracking_issue: null },
  plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
};
const BREAKDOWN = { devices: [], total_devices: 10, unique_types: 1 };

const fetchMock = vi.fn(async (url: string) =>
  ({
    ok: true,
    status: 200,
    json: async () => (String(url).includes("/audit") ? AUDIT : BREAKDOWN),
  }) as unknown as Response,
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = function () {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
}
async function generate() {
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
  await settle();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Generate package" }));
  await settle();
}

describe("#288 clause 5 — §8.28: the results-area zone headings are gone", () => {
  it("no '02 · Results' and no '03 · Reference' heading renders, at any stage", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    const preText = document.body.textContent ?? "";
    expect(preText).not.toContain("MHT package");
    expect(preText).not.toContain("Rules, permit & audit");
    cleanup();
    await generate();
    const postText = document.body.textContent ?? "";
    expect(postText).not.toContain("MHT package");
    expect(postText).not.toContain("Rules, permit & audit");
    // The tags went with them: no "02"/"03" zone index on the page.
    const tags = Array.from(document.querySelectorAll(".zone-tag")).map((t) => t.textContent);
    expect(tags.some((t) => /02/.test(t ?? ""))).toBe(false);
    expect(tags.some((t) => /03/.test(t ?? ""))).toBe(false);
  });

  it("the SETUP heading stays — Phase 2 owns that surface and this ruling does not touch it", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    const tags = Array.from(document.querySelectorAll(".zone-tag")).map((t) => t.textContent);
    expect(tags.some((t) => /01/.test(t ?? ""))).toBe(true);
  });

  it("the stage-direction note is gone with the heading it sat in", async () => {
    await generate();
    expect(document.body.textContent).not.toContain("device & type counts drive your estimate");
    expect(document.querySelector(".zone-note")).toBeNull();
  });

  it("§8.28: the focus target is RE-HOMED onto the results stack, and the stack is named", async () => {
    await generate();
    const stack = document.querySelector("section.results-stack");
    expect(stack, "the results stack carries its own name now").not.toBeNull();
    // tabIndex -1: a programmatic target, never in the Tab order (#193).
    expect(stack!.getAttribute("tabindex")).toBe("-1");
    // The landing the arc-28 legs measure is this element's top; losing
    // the name would leave those legs pointing at nothing (ruling 184).
    expect(stack!.classList.contains("zone")).toBe(true);
  });
});

describe("#288 clause 5 — §8.30: the intro is dropped, the draft notice kept", () => {
  it("the intro paragraph renders nowhere, at any stage", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(screen.queryByText(/Generate a CDOT-compliant MHT package/)).toBeNull();
    cleanup();
    await generate();
    expect(screen.queryByText(/Generate a CDOT-compliant MHT package/)).toBeNull();
    // §8.30's reason, held to: the captions it restated are still there.
    expect(document.body.textContent).toContain("Plan sheet");
  });

  it("§8.12: the draft notice is UNCHANGED — both sentences, last in the column", async () => {
    await generate();
    expect(screen.getByText("Draft — not a sealed plan")).toBeTruthy();
    expect(
      screen.getByText(
        /Output is engineering reference\. Requires review and seal by a licensed Professional Engineer prior to field use\./,
      ),
    ).toBeTruthy();
  });

  it("the announcement region is untouched — the ruling's 'unchanged' set", async () => {
    await generate();
    // The ruling names the band, the verdict strip, the refusal
    // container, the draft notice and this region as unchanged.  A
    // heading removal that swept up a live region would be the kind of
    // collateral damage §8.28 does not licence.
    const status = document.querySelector('[role="status"].sr-only');
    expect(status, "the sr-only generation announcer still mounts").not.toBeNull();
  });
});
