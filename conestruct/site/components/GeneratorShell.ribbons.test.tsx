// @vitest-environment happy-dom
//
// #288 Phase 1 clause 6 — rule 102: THE RIBBON IS NOT DIMMED.
//
// The defect (#259) is not that the ribbon was styled badly — it is that
// the line whose whole job is to say "what follows is stale" was the
// least legible thing on the page, because it sat inside the dim it was
// explaining and measured 2.39:1.
//
// The composited contrast figure is the PROD LEG's to take (#288's
// acceptance line 6: "Ribbon ≥ 4.5:1 measured mid-flight on the
// composited surface").  happy-dom composites nothing and applies no
// stylesheet, so nothing here claims a ratio.  What this file pins is
// the STRUCTURE that makes the measurement possible: the ribbon is not a
// descendant of the dimmed wrapper, in any state that dims.  Get that
// wrong and the leg measures 2.39 again.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
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

let breakdownFails = false;
const fetchMock = vi.fn(async (url: string) => {
  const u = String(url);
  if (u.includes("/audit")) {
    return { ok: true, status: 200, json: async () => AUDIT } as unknown as Response;
  }
  if (breakdownFails && u.includes("device-breakdown")) {
    return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
  }
  return { ok: true, status: 200, json: async () => BREAKDOWN } as unknown as Response;
});

beforeEach(() => {
  fetchMock.mockClear();
  breakdownFails = false;
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

const ribbons = () => Array.from(document.querySelectorAll(".stale-ribbon"));
const dim = () => document.querySelector(".results-stale");

describe("#288 clause 6 — rule 102: the dim starts BELOW the ribbon", () => {
  it("a failed breakdown dims the results and leaves its ribbon outside the dim", async () => {
    breakdownFails = true;
    await generate();
    const r = ribbons();
    expect(r, "the failure ribbon renders").toHaveLength(1);
    expect(r[0].textContent).toContain("Device breakdown failed");
    // The state that dims is present...
    expect(dim(), "the results below are dimmed").not.toBeNull();
    // ...and the ribbon is NOT inside it.  This is the whole of #259.
    expect(dim()!.contains(r[0])).toBe(false);
    expect(r[0].closest(".results-stale")).toBeNull();
  });

  it("no ribbon is ever a descendant of the dim, in any state that dims", async () => {
    // The claim generalised: whatever puts the wrapper into its dimmed
    // state, no ribbon may be inside it.  A future fourth ribbon added
    // in the wrong place fails here.
    breakdownFails = true;
    await generate();
    for (const r of ribbons()) {
      expect(r.closest(".results-stale"), r.textContent ?? "").toBeNull();
    }
  });

  it("the ribbon precedes the dimmed content in the DOM — it explains what follows", async () => {
    breakdownFails = true;
    await generate();
    const all = Array.from(document.querySelectorAll("*"));
    expect(all.indexOf(ribbons()[0])).toBeLessThan(all.indexOf(dim()!));
  });

  it("rule 101: the three strings stay mutually exclusive — never two at once", async () => {
    breakdownFails = true;
    await generate();
    expect(ribbons().length).toBeLessThanOrEqual(1);
  });

  it("settled and clean: no ribbon, and nothing dimmed", async () => {
    await generate();
    expect(ribbons()).toHaveLength(0);
    expect(dim()).toBeNull();
  });
});

describe("#288 clause 6 — rules 100–102's treatment", () => {
  const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(
    /\r\n/g,
    "\n",
  );
  const block = (() => {
    const i = css.indexOf(".workbench .stale-ribbon {");
    return css.slice(i, css.indexOf("}", i));
  })();

  it("rule 100: 1px --rule, a 2px --act left edge, the ruled ground and inset", () => {
    expect(block).toMatch(/border:\s*1px solid var\(--rule\)/);
    expect(block).toMatch(/border-left:\s*2px solid var\(--act\)/);
    expect(block).toMatch(/background:\s*var\(--da-ground\)/);
    expect(block).toMatch(/padding:\s*11px 14px/);
  });

  it("rule 102: the ribbon stops wearing failure chrome — it is not a failure", () => {
    // The ⚠ in the breakdown string carries that state in the TEXT,
    // where rule 13 wants it; the container's hue never carried it alone.
    expect(block).toMatch(/color:\s*var\(--ink-on-dark\)/);
    expect(block).not.toMatch(/var\(--fail/);
  });

  it("the dim itself is unchanged — clause 6 moved the ribbon, not the wash", () => {
    const wash = (() => {
      const i = css.indexOf(".workbench .results-stale {");
      return css.slice(i, css.indexOf("}", i));
    })();
    expect(wash).toMatch(/opacity:\s*0\.5/);
    expect(wash).toMatch(/grayscale\(0\.4\)/);
  });
});
