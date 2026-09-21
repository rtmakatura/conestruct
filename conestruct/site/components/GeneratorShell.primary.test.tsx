// @vitest-environment happy-dom
//
// #288 Phase 1 clause 3 — ONE PRIMARY, and the file count stated ONCE.
//
// Rule 11: tested where the bug would live.  lib/results-primary.test.ts
// proves the decision; this proves the two READERS agree on the whole
// mounted page, which is the only place "one primary per state" and
// "stated exactly once" are even meaningful claims.  A unit test of
// either surface alone would pass while the page showed two primaries.
//
// This is also #288's acceptance lines 2 and 4, measured in the suite
// instead of waiting for a prod leg to discover them.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
import { BUNDLE_PART_KINDS } from "@/lib/render-types";

const SECTIONS_CLEAN = {
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
};
const TAIL = {
  pending_verification: { count: 0, note: "", tracking_issue: null },
  plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
};
/** S5 with none: nothing changed the plan, nothing wants the operator. */
const AUDIT_CLEAN = { summary: {}, sections: SECTIONS_CLEAN, ...TAIL };
/** S5 with items: two ▲ site adjustments and one ⚠ Colorado FAIL. */
const AUDIT_WITH_ITEMS = {
  summary: {},
  sections: {
    ...SECTIONS_CLEAN,
    colorado: {
      checks: [
        { pass: false, label: "Flagger certification not stated", citation: "CDOT 630", detail: "" },
      ],
    },
    site_adjustments: [
      { flag: "adjacent_intersection", action: "Devices added", rule: "MUTCD § 6C.02", citation: "MUTCD § 6C.02", devices_added: 2 },
      { flag: "school_zone", action: "Devices modified", rule: "MUTCD § 7B.08", citation: "MUTCD § 7B.08", devices_added: 0, devices_modified: 1 },
    ],
  },
  ...TAIL,
};
/** S5 with none, WITH a served scan — the state where two primaries
 *  could actually appear: nothing changed the plan (count 0, so the zip
 *  is primary) but the block still mounts for its condition rows and its
 *  Apply row.  AUDIT_CLEAN cannot catch that: its scan carries no
 *  buckets, so the block does not mount at all. */
const AUDIT_CLEAN_SCANNED = {
  summary: {},
  sections: {
    ...SECTIONS_CLEAN,
    site_scan: {
      status: "ok",
      mode: "corridor",
      measured_at: "2026-09-04T12:00:00+00:00",
      buckets: { intersections: { detected: false, count: 0 }, schools: { detected: false, count: 0 } },
      flags: {},
      corrections: [],
    },
  },
  ...TAIL,
};
const BREAKDOWN = {
  devices: [{ device: "Cone", code: "C", function: "channelize", qty: 10 }],
  total_devices: 10,
  unique_types: 1,
};

let served: unknown = AUDIT_CLEAN;
const fetchMock = vi.fn(async (url: string) => {
  if (String(url).includes("/audit")) {
    return { ok: true, status: 200, json: async () => served } as unknown as Response;
  }
  return { ok: true, status: 200, json: async () => BREAKDOWN } as unknown as Response;
});

beforeEach(() => {
  fetchMock.mockClear();
  served = AUDIT_CLEAN;
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

/** Every control on the page wearing rule 130's primary treatment. */
const primaries = () => Array.from(document.querySelectorAll("button.pri"));
/** Every control in NEEDS YOU wearing the filled "recommended action"
 *  pair — deliberately NOT scoped to `.owns-primary`.  Scoping the query
 *  the same way the CSS scopes the treatment would make the test unable
 *  to see the treatment escaping its scope, which is precisely the
 *  regression it exists to catch (found by injecting that regression:
 *  the un-scoped rule passed a scoped assertion). */
const filledActions = () => Array.from(document.querySelectorAll(".needs-you .act.is-on"));
/** Does the sheet scope the filled pair to the block that OWNS the
 *  primary?  happy-dom applies no stylesheet, so the DOM cannot answer
 *  this; the CSS contract can. */
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8");
const zip = () =>
  Array.from(document.querySelectorAll("button")).find((b) =>
    /All \(\.zip\)/.test(b.textContent ?? ""),
  ) as HTMLButtonElement | undefined;

describe("#288 clause 3 — acceptance line 2: ONE primary per state", () => {
  it("S5 with items: NEEDS YOU's actions are primary and the zip is a ghost (ruling 182)", async () => {
    served = AUDIT_WITH_ITEMS;
    await generate();
    // The block owns it, and says so with the class the CSS scopes on.
    const block = document.querySelector(".needs-you")!;
    expect(block.classList.contains("owns-primary")).toBe(true);
    // The zip renders — clause 3 supersedes rule 86's "not at 1440" —
    // but as rule 133's ghost, not rule 130's primary.
    expect(zip(), "the zip renders at this width").toBeTruthy();
    expect(zip()!.className).toContain("act");
    expect(zip()!.className).not.toContain("pri");
    expect(primaries()).toHaveLength(0);
    // Ruling 182: the download row stays a flat four-card row — not
    // promoted, and NEEDS YOU not demoted to a disclosure.
    expect(document.querySelectorAll(".dls .dl-card")).toHaveLength(4);
    expect(document.querySelector(".needs-you .disc-head")).toBeNull();
  });

  it("S5 with none: the zip IS the primary and no filled action survives beside it", async () => {
    served = AUDIT_CLEAN;
    await generate();
    expect(zip()).toBeTruthy();
    expect(zip()!.className).toContain("pri");
    expect(primaries()).toHaveLength(1);
    // The block either does not mount (clean plan, no scan rows) or
    // mounts without owning the primary — never with a second filled
    // control beside the page's one primary.
    expect(document.querySelector(".needs-you.owns-primary")).toBeNull();
    expect(filledActions()).toHaveLength(0);
  });

  it("S5 with none but SCANNED: the block mounts for its rows, and does NOT keep a filled action", async () => {
    // The state the first two tests cannot reach: count 0 (zip primary)
    // with NEEDS YOU mounted.  If the filled Apply treatment were not
    // scoped to the primary's owner, this is where the page would show
    // two primaries — and it is the only state where it would.
    served = AUDIT_CLEAN_SCANNED;
    await generate();
    const block = document.querySelector(".needs-you");
    expect(block, "the block mounts for its condition rows").not.toBeNull();
    expect(block!.classList.contains("owns-primary")).toBe(false);
    expect(zip()!.className).toContain("pri");
    expect(primaries()).toHaveLength(1);
    // The Apply row is still there (rule 78: always present post-scan) —
    // it just is not the page's primary.
    expect(block!.querySelector(".ny-apply")).not.toBeNull();
  });

  it("the filled action treatment is SCOPED to the primary's owner in the sheet", () => {
    // The DOM cannot answer this (happy-dom applies no stylesheet), so
    // the claim is made against the CSS contract instead of asserted by
    // a selector that assumes its own answer.
    const i = css.indexOf(".act.is-on {");
    expect(i, "the filled pair is declared").toBeGreaterThan(-1);
    const selector = css.slice(css.lastIndexOf("\n", i) + 1, i + ".act.is-on".length);
    expect(selector).toContain(".needs-you.owns-primary");
    // And nothing declares it un-scoped.
    expect(css).not.toMatch(/\.workbench \.needs-you \.act\.is-on\s*[,{]/);
  });

  it("in EVERY state the page carries at most one rule-130 primary", async () => {
    for (const audit of [AUDIT_CLEAN, AUDIT_CLEAN_SCANNED, AUDIT_WITH_ITEMS]) {
      served = audit;
      await generate();
      // The page-wide claim, which is what acceptance line 2 actually
      // says — not "each surface behaved", but "the page showed one".
      expect(primaries().length + filledActions().length).toBeLessThanOrEqual(1);
      cleanup();
    }
  });

  it("pre-generate there is no primary at all — nothing to download yet", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(primaries()).toHaveLength(0);
    expect(zip()).toBeUndefined();
  });
});

describe("#288 clause 3 — acceptance line 4: the file count, stated ONCE", () => {
  it("the count appears exactly once on the settled page, and it is the bundle's own", async () => {
    served = AUDIT_WITH_ITEMS;
    await generate();
    const label = `${BUNDLE_PART_KINDS.length} files`;
    expect(BUNDLE_PART_KINDS.length).toBe(4);
    const text = document.body.textContent ?? "";
    expect(text.split(label).length - 1, `"${label}" stated exactly once`).toBe(1);
    // Rule 12: it traces to the zip's own parts, and it sits beside the
    // control it describes.
    expect(document.querySelector(".dl-all .dl-all-count")!.textContent).toBe(label);
  });

  it("it is stated once in the OTHER state too — the count does not follow the primary", async () => {
    served = AUDIT_CLEAN;
    await generate();
    const label = `${BUNDLE_PART_KINDS.length} files`;
    expect((document.body.textContent ?? "").split(label).length - 1).toBe(1);
  });

  it("no OTHER file-count numeral is printed anywhere — the retired chip is not back", async () => {
    served = AUDIT_WITH_ITEMS;
    await generate();
    const text = document.body.textContent ?? "";
    // The next-steps strip's chip 3 read "4 FILES READY"; §8.29 dropped
    // the strip and kept the once-only rule.  Nothing should restate it.
    expect(text).not.toMatch(/FILES READY/i);
    // No \b after "files": textContent runs adjacent elements together
    // ("4 filesPlan sheet"), so a word boundary never lands there.  The
    // claim is about how many times a file COUNT is printed, not about
    // what follows it.
    expect(text.match(/\d+ files/gi) ?? []).toHaveLength(1);
  });
});
