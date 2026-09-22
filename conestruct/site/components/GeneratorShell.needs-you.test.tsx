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
  Array.from(document.querySelectorAll(".disc-head")).find(
    (h) => h.querySelector(".disc-name")?.textContent === "Reference",
  ) as HTMLButtonElement;
const rows = () => Array.from(document.querySelectorAll(".ny-item"));
const count = () => document.querySelector(".ny-count")?.textContent;

describe("#288 step 3 — NEEDS YOU mounted in the results stack", () => {
  it("S5 with items: the block mounts, the header count is the SUM, and each row carries its citation", async () => {
    served = AUDIT_WITH_ITEMS;
    await generate();
    expect(block(), "the block mounted").not.toBeNull();
    // 2 ▲ site adjustments + 1 ⚠ Colorado FAIL = 3.
    expect(count()).toBe("3");
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
    expect(document.querySelector(".disc-panel")).toBeNull();
    // Rule 89: the reference tier is UNCOUNTED — it says what is inside.
    // Rule 89, scoped to the row it is about: the REFERENCE tier is
    // uncounted and renders no numeral.  The ✓ and ◌ rows clause 4 added
    // above it ARE counted and do show one — which is the same rule's
    // other half, not a violation of it.
    expect(head.querySelector(".disc-count")).toBeNull();
    // §8.31 pulled forward: the row's summary line now carries the
    // jurisdiction context bar's three facts — which jurisdiction, which
    // street class, which spec chain — in place of the generic
    // "jurisdiction rules · permit · audit trail".  Unset reads "Not
    // set" (rule 14: a value that is not known renders as a word).
    expect(head.textContent).toContain("Not set · Not set · MUTCD 11th + CO Suppl.");
    // NEEDS YOU sits ABOVE it and is unaffected by the toggle (rule 89:
    // nothing above the header moves).
    const before = document.querySelectorAll(".ny-item").length;
    await user.click(head);
    // S8.
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".disc-panel")).not.toBeNull();
    expect(document.querySelectorAll(".ny-item").length).toBe(before);
  });

  it("rule 129: the reference discloses, it never writes — the row's control is a read", async () => {
    served = AUDIT_WITH_ITEMS;
    await generate();
    const head = referenceHead();
    expect(head.hasAttribute("data-read")).toBe(true);
    expect(head.hasAttribute("data-write")).toBe(false);
  });

  // ── #288 clause 1 — the corrections block, mounted inside NEEDS YOU ──
  it("clause 1: the condition rows and the Apply row mount INSIDE the block, and the block is the signposts' anchor", async () => {
    served = {
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
    await generate();
    const b = block()!;
    expect(b, "the block mounted").not.toBeNull();
    // Rule 129: the reference's "Correct in setup ↑" signposts jump to
    // NEEDS YOU — the anchor moved WITH the block, so the pointer lands.
    expect(b.id).toBe("site-corrections");
    // The rows are this block's item rows, in its own list.
    const list = b.querySelector(".ny-items")!;
    expect(list.querySelectorAll(".site-correction-row").length).toBe(2);
    expect(list.querySelector(".ny-apply")).not.toBeNull();
    // Rule 78's one write, and the tier rows still carry no button
    // (ruling d) — so every button in the block belongs to a condition.
    expect(within(b as HTMLElement).getByRole("button", { name: "Apply 0 corrections" })).toBeTruthy();
    // Spec 34's aria-busy rides the section now, not the retired block.
    expect(b.getAttribute("aria-busy")).toBeNull();
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
