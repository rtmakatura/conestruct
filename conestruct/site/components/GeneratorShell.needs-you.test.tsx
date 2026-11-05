// @vitest-environment happy-dom
//
// #288 step 3 — NEEDS YOU, MOUNTED.  Rule 11: tested where the bug would
// live.  The unit suites (NeedsYou.test.tsx, needs-you-items.test.ts)
// prove the block and the mapping in isolation; neither would have caught
// the block failing to mount, rendering outside its gate, or surviving a
// decline — which is the whole content of step 3.
//
// This is also the suite that makes S5-with-items and S5-with-none
// reachable states rather than component states.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
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
import { PINNED_SHOULDER } from "./test-fixtures";

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

/** A clean plan: nothing changed it, nothing wants the operator. */
const AUDIT_CLEAN = { summary: {}, sections: SECTIONS_CLEAN, ...TAIL };

/** Two ▲ (a site adjustment, and a second) and one ⚠ (a Colorado FAIL). */
const AUDIT_WITH_ITEMS = {
  summary: {},
  sections: {
    ...SECTIONS_CLEAN,
    colorado: {
      checks: [
        { pass: false, label: "Flagger certification not stated", citation: "CDOT 630", detail: "no certification on file" },
        { pass: true, label: "Device spacing", citation: "MUTCD 6K.01", detail: "" },
      ],
    },
    site_adjustments: [
      { flag: "adjacent_intersection", action: "Devices added", rule: "MUTCD § 6C.02", citation: "MUTCD § 6C.02", devices_added: 2 },
      { flag: "school_zone", action: "Devices modified", rule: "MUTCD § 7B.08", citation: "MUTCD § 7B.08", devices_added: 0, devices_modified: 1 },
    ],
  },
  ...TAIL,
};

const BREAKDOWN = {
  devices: [{ device: "Cone", code: "C", function: "channelize", qty: 10 }],
  total_devices: 10,
};

let served: unknown = AUDIT_CLEAN;
let auditRefuses = false;

const fetchMock = vi.fn(async (url: string) => {
  if (String(url).includes("/audit")) {
    if (auditRefuses) {
      return { ok: false, status: 400, json: async () => ({ detail: "declined" }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => served } as unknown as Response;
  }
  return { ok: true, status: 200, json: async () => BREAKDOWN } as unknown as Response;
});

beforeEach(() => {
  fetchMock.mockClear();
  served = AUDIT_CLEAN;
  auditRefuses = false;
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

const block = () => document.querySelector(".needs-you");
/** The i REFERENCE row's control, by name — not by document order. */
const referenceHead = () =>
  document.querySelector("[data-section=reference] button.rs-head") as HTMLButtonElement;
const rows = () => Array.from(document.querySelectorAll(".ny-item"));
const count = () => document.querySelector(".ny-count")?.textContent;

describe("#288 step 3 — NEEDS YOU mounted in the results stack", () => {
  it("S5 with items: the block mounts, the header count is the SUM, and each row carries its citation", async () => {
    served = AUDIT_WITH_ITEMS;
    await generate();
    expect(block(), "the block mounted").not.toBeNull();
    // 2 ▲ site adjustments + 1 ⚠ Colorado FAIL = 3 rows.  #437 (P2): the
    // header numeral is gone; the split stays in words below.
    expect(count()).toBeUndefined();
    expect(rows()).toHaveLength(3);
    // Ruling 185: the split is words on the provenance line, not a second numeral.
    const sub = document.querySelector(".ny-sub")?.textContent ?? "";
    expect(sub).toContain("2 changed this plan");
    expect(sub).toContain("1 needs attention");
    // ▲ before ⚠ (consequence first), and the citations are the wire's.
    expect(rows()[0].className).toContain("is-changed");
    expect(rows()[2].className).toContain("is-attention");
    expect(rows()[2].textContent).toContain("CDOT 630");
    // A PASSING Colorado check is not lifted — only FAILs are ⚠.
    expect(document.querySelector(".needs-you")?.textContent).not.toContain("Device spacing");
  });

  it("S5 with none: a clean plan mounts NO block at all — not an empty one", async () => {
    served = AUDIT_CLEAN;
    await generate();
    expect(block(), "no block on a clean plan").toBeNull();
    expect(document.body.textContent).not.toContain("NEEDS YOU");
  });

  it("pre-generate: the block does not exist before there is a plan to want anything about", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    expect(block()).toBeNull();
  });

  it("S6 declined: the refusal container is the voice — no NEEDS YOU beside it (spec 31, rule 10)", async () => {
    auditRefuses = true;
    await generate();
    expect(block(), "a declined plan shows no plan").toBeNull();
  });

  it("ruling d on a real mount: no row renders a button while the writes still live in the corrections block", async () => {
    served = AUDIT_WITH_ITEMS;
    await generate();
    expect(block()).not.toBeNull();
    expect(block()!.querySelectorAll("button")).toHaveLength(0);
  });

  it("S8: the reference disclosure is CLOSED in S5 and opens in place — nothing above it moves", async () => {
    served = AUDIT_WITH_ITEMS;
    const user = await generate();
    // #288 clause 4 put THREE more rule-87 rows in the stack above this
    // one (quote, ✓ checked, ◌ pending), so ".disc-head" alone now finds
    // the quote.  The reference row is named, so name it.
    const head = referenceHead();
    expect(head, "the reference disclosure row mounted").not.toBeNull();
    // S5: closed, and the panel is not in the DOM at all.
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("[data-section=reference] .rs-body")).toBeNull();
    // Rule 89: the reference tier is UNCOUNTED — it says what is inside.
    // Rule 89, scoped to the row it is about: the REFERENCE tier is
    // uncounted and renders no numeral.  The ✓ and ◌ rows clause 4 added
    // above it ARE counted and do show one — which is the same rule's
    // other half, not a violation of it.
    expect(head.querySelector(".rs-summary")?.textContent).not.toMatch(/\d/);
    // §8.31 pulled forward: the row's summary line now carries the
    // jurisdiction context bar's three facts — which jurisdiction, which
    // street class, which spec chain — in place of the generic
    // "jurisdiction rules · permit · audit trail".  Unset reads "Not
    // set" (rule 14: a value that is not known renders as a word).
    // #443 ruling 3: the summary is the mock-up's words.
    expect(head.textContent).toContain("For reference, never blocks the plan");
    // NEEDS YOU sits ABOVE it and is unaffected by the toggle (rule 89:
    // nothing above the header moves).
    const before = document.querySelectorAll(".ny-item").length;
    await user.click(head);
    // S8.
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("[data-section=reference] .rs-body")).not.toBeNull();
    // §8.31: the three facts lead the opened section (Rule 14: unset reads "Not set").
    expect(document.querySelector("[data-section=reference] .rs-intro")?.textContent).toContain(
      "Not set · Not set · MUTCD 11th + CO Suppl.",
    );
    expect(document.querySelectorAll(".ny-item").length).toBe(before);
  });

  it("rule 129: the reference discloses, it never writes — the row's control is a read", async () => {
    served = AUDIT_WITH_ITEMS;
    await generate();
    const head = referenceHead();
    expect(head.hasAttribute("data-read")).toBe(true);
    expect(head.hasAttribute("data-write")).toBe(false);
  });

  // ── #437: the detected conditions as questions, mounted inside NEEDS YOU ──
  const withScan = {
    ...AUDIT_WITH_ITEMS,
    sections: {
      ...AUDIT_WITH_ITEMS.sections,
      site_scan: {
        status: "ok",
        mode: "corridor",
        measured_at: "2026-09-04T12:00:00+00:00",
        buckets: {
          intersections: { detected: true, count: 26, nearest_distance_ft: 34.1 },
          schools: { detected: false, count: 0 },
        },
        flags: {},
        corrections: [],
      },
    },
  };

  it("#437 ruling 3: the question mounts INSIDE the block, and the block is the signposts' anchor", async () => {
    served = withScan;
    await generate();
    const b = block()! as HTMLElement;
    // Rule 129 / D10: the reference's "Correct in setup ↑" signposts jump
    // to NEEDS YOU, and the anchor is still on the block.
    expect(b.id).toBe("site-corrections");
    expect(within(b).getByText("Question 1 of 1")).toBeTruthy();
    // #438 item 5: NEEDS YOU is h2, so the question title is h3.
    expect(within(b).getByRole("heading", { level: 3 }).textContent).toBe(
      "Is there an intersection next to the work?",
    );
    // One question, so its button is the Apply (ruling 6), off until answered.
    const apply = within(b).getByRole("button", { name: "Apply answers" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    // The tier rows sit under "Also on this plan" (S5).
    expect(within(b).getByText("Also on this plan")).toBeTruthy();
    // Spec 34's aria-busy rides the section.
    expect(b.getAttribute("aria-busy")).toBeNull();
  });

  it("#437 ruling 8: what needs nothing folds into ONE row under the block, with Show them", async () => {
    served = withScan;
    const user = await generate();
    const b = block()! as HTMLElement;
    expect(within(b).queryByText("School zone")).toBeNull();
    const other = document.querySelector(".ny-other") as HTMLElement;
    // 1 none found + 2 manual keys not asserted; the plan has other items
    // (▲ school, ⚠ Colorado), so "Nothing else needs you." is withheld.
    expect(other.querySelector(".ny-other-text")!.textContent).toBe("3 other conditions checked.");
    // Ruling 1's order: NEEDS YOU, then this row.
    expect(b.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const toggle = within(other).getByRole("button", { name: "Show them" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);
    expect(within(other).getByText("School zone")).toBeTruthy();
  });

  it("R99 / ruling 5: a detected condition and the adjustment it caused are ONE question (P2)", async () => {
    // AUDIT_WITH_ITEMS carries the intersection adjustment (+2 devices)
    // and a school-zone one (1 modified).  The intersection's count is in
    // its question's lines; the school one has no question and stays an item.
    served = withScan;
    await generate();
    const b = block()! as HTMLElement;
    expect(within(b).getByText("The 2 devices come off the plan.")).toBeTruthy();
    expect(within(b).getByText(/Source: MUTCD § 6C.02 · map data from OpenStreetMap/)).toBeTruthy();
    const tierTitles = Array.from(b.querySelectorAll(".ny-item.is-changed .ny-body")).map((x) => x.textContent);
    expect(tierTitles.some((t) => /intersection/i.test(t ?? ""))).toBe(false);
    expect(tierTitles.some((t) => /school/i.test(t ?? ""))).toBe(true);
    // No header numeral (P2): the strip says the count once, in words.
    expect(count()).toBeUndefined();
    expect(document.querySelector('[data-testid="strip-questions"]')?.textContent).toContain(
      "Plan ready. Answer 1 quick question before you send it.",
    );
  });

  it("ruling 186 on a real mount: always expanded — every item is on screen, no caret in the header", async () => {
    served = AUDIT_WITH_ITEMS;
    await generate();
    const head = document.querySelector(".ny-head");
    expect(head?.querySelector("button")).toBeNull();
    expect(head?.textContent).not.toContain("›");
    expect(rows()).toHaveLength(3);
  });
});
