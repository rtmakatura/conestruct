// @vitest-environment happy-dom
//
// #288 Phase 1 clause 7 — rule 15, page-wide, including the footer.
//
// Rule 15: "Every interactive element ≥ 32 px in its smaller dimension at
// 1440 px, ≥ 44 px at 380 px."  #288 absorbs #264's results half, and
// its body forecloses the obvious dodge: "§8.14/rule 30 keep it
// unchanged, rule 15 admits no exemption."
//
// WHAT THIS FILE CAN AND CANNOT DO.  happy-dom lays nothing out, so no
// rect here is real and no test below claims one.  Acceptance line 7's
// "TARGETS probe 0 under 32/44, footer included; axe target-size 0 at
// 380" is the PROD LEG's figure, and that is where the measurement
// belongs.
//
// What this file does instead is the thing the leg cannot: it ENUMERATES
// the interactive elements the mounted page actually renders, and checks
// each one against the set of classes the sheet gives a floor to.  A
// control added later with no floor fails here, at commit time, instead
// of surviving until someone runs a probe at both widths.  That is the
// difference between a spot-check and a contract.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
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
    colorado: { checks: [{ pass: true, label: "Device spacing", citation: "MUTCD 6K.01", detail: "" }] },
    // `case.url` populated DELIBERATELY: without it the "↗ Open {sheet}
    // PDF on CDOT.gov" link never mounts (AuditTrail's `url` guard) and
    // the enumeration below silently checks one fewer control.  Found by
    // the diff-verifier: the first version of this fixture left it out
    // and the comment beside the fix claimed all three ↗ links were
    // runtime-checked.  One was.
    case: { url: "https://www.codot.gov/business/designsupport/standard-plans" },
    flagger: {},
    corridor_validation: { checked: true, warnings: [] },
    geometry_validation: { violations: [], all_pass: true },
    site_adjustments: [],
    site_scan: {
      status: "ok",
      mode: "corridor",
      measured_at: "2026-09-04T12:00:00+00:00",
      buckets: {
        intersections: { detected: true, count: 4, nearest_distance_ft: 30 },
        schools: { detected: false, count: 0 },
      },
      flags: {},
      corrections: [],
    },
  },
  // `items` populated for the same reason: the items branch renders a
  // SECOND ↗ link per entry, and a fixture with only the flat fields
  // never reaches it.
  pending_verification: {
    count: 2,
    note: "one check not automated",
    tracking_issue: "https://github.com/example/repo/issues/286",
    items: [
      {
        kind: "formula_fields",
        label: "Taper formula fields not yet on the wire",
        tracking_issue: "https://github.com/example/repo/issues/286",
      },
      {
        kind: "night_lighting",
        label: "Night lighting not automated",
        tracking_issue: null,
      },
    ],
  },
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
  return user;
}

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

/** Classes the sheet gives an explicit rule-15 floor to. */
const FLOORED = [
  "act",
  "pri",
  "disc-head",
  "dl-btn",
  "reason-chip",
  "site-correction-note",
  "tr-signpost",
  "chip-sum",
  "audit-head",
  "generate-btn",
  "confirm",
  "ghost",
  // #289 Phase 2 — the column's own controls.  Rule 134 puts the fact
  // link's hit box at 32 px (44 at 380); rule 133 the ledger action;
  // rule 135 the kind chip at 44; rule 136 the field at 44.  Each is
  // declared in globals.css under the band-stack block, which is what
  // this list is checking for.
  "a-lk",
  "act-btn",
  "a-chip",
  "a-fld",
  // #289 hand-check, 2026-09-23, defect 2 — the setup line's value links:
  // 32 px on the class, 44 px in the ≤480 block (asserted below).
  "a-val-lk",
];
/** Tailwind-floored controls (the footer's links). */
const TW_FLOOR = /min-h-\[(32|44)px\]/;

function flooredSomehow(el: Element): boolean {
  if (FLOORED.some((c) => el.classList.contains(c))) return true;
  if (TW_FLOOR.test(el.className?.toString() ?? "")) return true;
  // A VISUALLY HIDDEN input is not the target — its label is.  The
  // dismiss picker's four radios are 1×1px at opacity 0 inside a
  // `.reason-chip` label (#245: the radio stays in the tab order and
  // keeps its native :checked semantics; the chip is what the operator
  // sees and hits).  WCAG 2.5.5 measures the target the pointer lands
  // on, so a floored label covers its own hidden input.
  //
  // This is a refinement of the QUESTION, not a relaxation of the
  // answer: an input with no floored label still fails, and a label that
  // lost its floor fails through the label.  Written out because
  // "skip the inputs" would have been the lazy version of the same
  // green, and would have hidden a real failure later.
  const label = el.closest("label");
  if (el.tagName === "INPUT" && label && FLOORED.some((c) => label.classList.contains(c))) {
    return true;
  }
  return false;
}

/** Open every fold the stack has, in order, until nothing new opens.
 *
 *  The stack folds TWICE in places: a rule-87 disclosure row can contain
 *  an ItemAccordion whose own heads fold again, so a control can be two
 *  clicks deep.  The case-reference ↗ link is one — opening the ✓ row
 *  alone does not reach it.  Found because the coverage assertion below
 *  failed while the suite was otherwise green. */
async function openEverything(user: ReturnType<typeof userEvent.setup>) {
  for (let pass = 0; pass < 4; pass += 1) {
    // `.audit-head` carries NO aria-expanded — its open state is a class
    // on the parent (`.audit-item.open`).  Selecting it by an attribute
    // it does not have is how the first version of this opener silently
    // opened nothing.  Recorded as a finding: a disclosure control that
    // announces no expanded state is an a11y gap, but it is rule 16's,
    // not rule 15's, so clause 7 reports it rather than fixing it here.
    const shut = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.disc-head[aria-expanded="false"], .chip-sum[aria-expanded="false"], .audit-item:not(.open) > .audit-head',
      ),
    );
    if (shut.length === 0) return;
    for (const head of shut) await user.click(head);
  }
}

/** Every interactive element in the results stack and the footer. */
function interactives(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  );
}

describe("#288 clause 7 — rule 15 reaches every control in the results stack", () => {
  it("every interactive element in the stack carries a declared floor", async () => {
    await generate();
    const stack = document.querySelector("section.results-stack")!;
    const unfloored = interactives(stack)
      .filter((el) => !flooredSomehow(el))
      .map((el) => `${el.tagName.toLowerCase()}.${el.className} "${el.textContent?.trim().slice(0, 40)}"`);
    expect(unfloored, "controls with no rule-15 floor").toEqual([]);
  });

  it("the fixture REACHES all three ↗ links — coverage is a claim, so it is asserted", async () => {
    // The diff-verifier caught the first version of this suite claiming
    // to check three links while the fixture rendered one: `case.url` and
    // `pending_verification.items` were both absent, so two branches
    // never mounted.  A coverage claim that nothing asserts is exactly
    // the kind that stays true in a comment and false in the code.
    const user = await generate();
    await openEverything(user);
    const arrows = Array.from(document.querySelectorAll("a")).filter((a) =>
      (a.textContent ?? "").includes("↗"),
    );
    const labels = arrows.map((a) => a.textContent?.trim());
    expect(labels.some((l) => /Open .* PDF on CDOT\.gov/.test(l ?? "")), "the case-reference link").toBe(
      true,
    );
    expect(labels.some((l) => /Tracking issue \(/.test(l ?? "")), "the per-item tracking link").toBe(
      true,
    );
    // All of them, whichever branch produced them, carry the floor.
    for (const a of arrows) {
      expect(a.className, a.textContent ?? "").toMatch(/min-h-\[32px\]/);
      expect(a.className, a.textContent ?? "").toMatch(/max-\[480px\]:min-h-\[44px\]/);
    }
  });

  it("the same holds with the disclosures OPEN — a panel's controls are controls too", async () => {
    const user = await generate();
    await openEverything(user);
    const stack = document.querySelector("section.results-stack")!;
    const unfloored = interactives(stack)
      .filter((el) => !flooredSomehow(el))
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    expect(unfloored, "controls revealed by opening a disclosure").toEqual([]);
  });

  it("and with the dismiss picker open — its chips and note are controls", async () => {
    const user = await generate();
    const dismiss = screen.queryAllByRole("button", { name: "Dismiss" })[0];
    expect(dismiss, "the fixture detects a condition, so a Dismiss renders").toBeTruthy();
    await user.click(dismiss);
    const stack = document.querySelector("section.results-stack")!;
    const unfloored = interactives(stack)
      .filter((el) => !flooredSomehow(el))
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    expect(unfloored).toEqual([]);
  });
});

describe("#288 clause 7 — §8.14's 'unchanged' footer is not exempt", () => {
  it("both footer links carry a hit box at both widths, and their words are untouched", async () => {
    await generate();
    const footer = document.querySelector("footer")!;
    const links = Array.from(footer.querySelectorAll("a"));
    expect(links.map((l) => l.textContent)).toEqual(["Terms", "Privacy"]);
    for (const l of links) {
      expect(l.className, l.textContent ?? "").toMatch(/min-h-\[32px\]/);
      expect(l.className, l.textContent ?? "").toMatch(/max-\[480px\]:min-h-\[44px\]/);
      // BOTH dimensions.  Rule 15 measures "the smaller dimension", and
      // the prod leg at f44377e measured "Terms" at 35x44 — tall enough,
      // too narrow.  This suite passed that build, because a class check
      // that only reads min-h cannot see a width.  It reads both now.
      expect(l.className, l.textContent ?? "").toMatch(/min-w-\[32px\]/);
      expect(l.className, l.textContent ?? "").toMatch(/max-\[480px\]:min-w-\[44px\]/);
      // The box grew; the type did not.  §8.14 keeps the footer
      // unchanged in CONTENT, and it is.
      expect(l.className).toMatch(/inline-flex/);
    }
    // The footer's own copy, verbatim — unchanged is a claim worth pinning.
    expect(footer.textContent).toContain("© 2026 Conestruct · Built in Colorado");
    expect(footer.textContent).toContain(
      "Output requires TCS review · Not a substitute for licensed judgment",
    );
  });

  it("the footer still declares no min-height of its own (#264's original finding)", () => {
    // #264 verified `AppFooter.tsx:8-13` carried no min-height; that is
    // still true of the FOOTER — the floor is on the links, which is
    // where the target is.
    const src = readFileSync(join(__dirname, "AppFooter.tsx"), "utf-8");
    const footerTag = src.slice(src.indexOf("<footer"), src.indexOf(">", src.indexOf("<footer")));
    expect(footerTag).not.toMatch(/min-h-/);
  });
});

describe("#288 clause 7 — the ≤480 sweep is declared in one place", () => {
  it("the narrow-width floors live in a single block, so an omission is visible", () => {
    const i = css.indexOf("#288 Phase 1 clause 7 · RULE 15, PAGE-WIDE");
    expect(i, "the clause 7 block exists").toBeGreaterThan(-1);
    const block = css.slice(i, css.indexOf("\n}\n", i));
    expect(block).toMatch(/@media \(max-width: 480px\)/);
    for (const sel of ["tr-signpost", "chip-sum", "audit-head", "disc-head", "dl-btn", "strip-edit-all", "a-val-lk"]) {
      expect(block, sel).toContain(`.${sel}`);
    }
    expect(block).toMatch(/min-height:\s*44px/);
  });

  it("rule 134: the signpost's hit box grew without moving its text", () => {
    const i = css.indexOf(".workbench .tr-signpost {");
    const block = css.slice(i, css.indexOf("}", i));
    expect(block).toMatch(/min-height:\s*32px/);
    expect(block).toMatch(/display:\s*inline-flex/);
    // The type is untouched: same size, same tracking, same ink.
    expect(block).toMatch(/font-size:\s*10px/);
    expect(block).toMatch(/color:\s*var\(--act\)/);
  });
});
