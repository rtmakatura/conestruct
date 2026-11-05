// @vitest-environment happy-dom
//
// #288 Phase 1 clause 4 — the stack's disclosure rows, MOUNTED.
//
// Rule 11 again: clause 4 is a claim about the ORDER and the CONTAINERS
// of the results stack, and neither is visible from a component test.
// DisclosureRow.test.tsx proves the row; this proves the stack.
//
// It also inherits one claim from another suite, deliberately and by
// name: JurisdictionSection.density.test.tsx used to assert #187's
// "◌ previous answer, refreshing…" cue in section 03's reserved slot.
// Clause 4 moved that slot into the stack — a cue inside a closed
// disclosure cannot say the counts above it are stale — so the claim
// moved here rather than being dropped.
//
// #437 branch 3 (ruling 13): the price quote's row left the disclosure
// group for the bottom of the DOWNLOADS section (OutputCards' `quote`
// slot), and is named "Price quote".  The group is the three tier rows.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
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
      {/* #289 Phase 2: the stub stands in for the column, so it carries
          the one cell these cases edit — the WHAT grid's speed select,
          at its own id.  The setup strip and its inline editors are
          deleted (§8.27); a post-generate edit is CHANGE ONE THING and
          then this cell. */}
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
  stageRevision,
} from "./__fixtures__/band-helpers";

const SECTIONS = {
  taper: {},
  buffer: {},
  spacing: {},
  advance: {},
  colorado: {
    checks: [
      { pass: true, label: "Device spacing", citation: "MUTCD 6K.01", detail: "ok" },
      { pass: true, label: "Sign sizes", citation: "MUTCD 6L.02", detail: "ok" },
    ],
  },
  case: {},
  flagger: {},
  corridor_validation: { checked: true, warnings: [] },
  geometry_validation: { violations: [], all_pass: true },
  site_adjustments: [],
  site_scan: { status: "ok", mode: "corridor", buckets: {}, flags: {}, corrections: [] },
};
const AUDIT = {
  summary: {},
  sections: SECTIONS,
  pending_verification: { count: 2, note: "two checks not yet automated", tracking_issue: "#286" },
  plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
};
const BREAKDOWN = {
  devices: [{ device: "Cone", code: "C", function: "channelize", qty: 10 }],
  total_devices: 10,
  unique_types: 1,
};

let auditDelay = 0;
const fetchMock = vi.fn(async (url: string) => {
  if (String(url).includes("/audit")) {
    if (auditDelay) await new Promise((r) => setTimeout(r, auditDelay));
    // #306: the audit answers its own breakdown.
    return {
      ok: true,
      status: 200,
      json: async () => ({ ...AUDIT, breakdown: BREAKDOWN }),
    } as unknown as Response;
  }
  return { ok: true, status: 200, json: async () => BREAKDOWN } as unknown as Response;
});

beforeEach(() => {
  fetchMock.mockClear();
  auditDelay = 0;
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

/** The sections' names, in document order. */
const sectionNames = () =>
  Array.from(document.querySelectorAll(".results-disc .rs-name")).map((n) => n.textContent);
type Id = "checked" | "pending" | "reference";
const section = (id: Id) => document.querySelector(`[data-section=${id}]`) as HTMLElement;
const summaryOf = (id: Id) => section(id).querySelector(".rs-summary")?.textContent ?? "";
// Ruling 3: a counted section says its count in words; the numeral leads.
const countOf = (id: Id) => summaryOf(id).match(/^\d+/)?.[0] ?? null;

describe("#288 clause 4, #443 — the stack's sections", () => {
  it("the three sections are ONE group, in rule 27's order; the quote row closes the downloads", async () => {
    await generate();
    const group = document.querySelector(".results-disc")!;
    expect(group, "the group exists").not.toBeNull();
    // X6: section 3 is "<jurisdiction> rules and site facts", "Site facts" without one.
    expect(sectionNames()).toEqual(["Checked and passed", "Not checked yet", "Site facts"]);
    // #437 branch 3: the quote is the downloads section's last row.
    const downloads = screen.getByTestId("downloads");
    const quoteSlot = downloads.lastElementChild!;
    expect(quoteSlot.classList.contains("dl-quote")).toBe(true);
    expect(quoteSlot.querySelector(".disc-name")!.textContent).toBe("Price quote");
    expect(group.querySelector(".disc-name")).toBeNull();
  });

  it("the draft notice is the column's LAST line, below the group (§8.12, rule 29)", async () => {
    await generate();
    const main = document.querySelector("main")!;
    const all = Array.from(main.querySelectorAll("*"));
    const draft = screen.getByTestId("draft-notice");
    const group = document.querySelector(".results-disc")!;
    expect(all.indexOf(draft)).toBeGreaterThan(all.indexOf(group));
    // #435: Ryan's checkpoint wording (2026-11-02), verbatim; it replaced
    // rule 29's (#289 fidelity F6, Q6 2026-09-23).
    expect(draft.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Draft, not a sealed plan. This is engineering reference, with every dimension cited to MUTCD or CDOT. A licensed PE must review and seal it before field use.",
    );
  });

  it("section 3 keeps the jump target and the focus target Zone 3 carried", async () => {
    await generate();
    const anchor = document.querySelector("#reference")!;
    expect(anchor, "#253's chip-2 target survives the move").not.toBeNull();
    expect(anchor.getAttribute("tabindex"), "#193's focus target").toBe("-1");
    expect(anchor.className).toContain("jump-anchor");
    expect(anchor.querySelector("[data-section=reference]")).not.toBeNull();
  });

  it("Rule 12: the counted sections read the ledger; section 3 shows no number", async () => {
    await generate();
    // The number is the LEDGER's, not one this test computes: the ✓ section
    // and the audit card's "N checks" must agree, always.
    const checked = countOf("checked");
    expect(checked).toMatch(/^\d+$/);
    const cardQty = Array.from(document.querySelectorAll(".dl-card"))
      .find((c) => c.querySelector("h3")?.textContent === "Audit trail")!
      .querySelector(".desc b")!.textContent;
    expect(cardQty, "the card and the section read one ledger").toBe(checked);
    expect(countOf("pending")).toMatch(/^\d+$/);
    expect(summaryOf("checked")).toMatch(/^\d+ checks?, each cited$/);
    expect(summaryOf("pending")).toMatch(/^\d+ items? for the TCS$/);
    expect(section("checked").querySelector(".rs-summary")!.classList.contains("tr-note")).toBe(true);
    expect(summaryOf("reference")).toBe("For reference, never blocks the plan");
    // The quote is not a tier at all: no ledger, nothing to count.
    expect(Array.from(document.querySelectorAll(".disc-count"))).toHaveLength(0);
  });

  it("every section is closed in S5 (X2) and opens in place", async () => {
    const user = await generate();
    for (const id of ["checked", "pending", "reference"] as const) {
      const head = section(id).querySelector("button.rs-head") as HTMLButtonElement;
      expect(head.getAttribute("aria-expanded"), id).toBe("false");
      expect(section(id).querySelector(".rs-body"), id).toBeNull();
      await user.click(head);
      expect(head.getAttribute("aria-expanded"), id).toBe("true");
      expect(section(id).querySelector(".rs-body"), id).not.toBeNull();
    }
  });

  it("rule 129: every head is a READ — disclosing is never a write", async () => {
    const user = await generate();
    for (const id of ["checked", "pending", "reference"] as const) {
      await user.click(section(id).querySelector("button.rs-head") as HTMLButtonElement);
    }
    const heads = Array.from(document.querySelectorAll(".results-disc .rs-head, .results-disc .rr-head"));
    expect(heads.length).toBeGreaterThan(3);
    for (const head of heads) {
      expect(head.hasAttribute("data-read")).toBe(true);
      expect(head.hasAttribute("data-write")).toBe(false);
    }
  });

  // ── the claim inherited from JurisdictionSection.density.test.tsx ──
  it("#187: ONE '◌ previous answer, refreshing…' cue, in the stack, in a reserved slot", async () => {
    await generate();
    // Settled: the slot is in the flow at its reserved height (P1) and
    // empty — not absent, or the stack would shift when it appears.
    const slot = document.querySelector(".tier-cue");
    expect(slot, "the slot stays in the flow").not.toBeNull();
    expect(slot!.textContent).toBe("");
    // Mid-refetch: the cue says the values on screen are the previous
    // answer.  Stated ONCE — it qualifies every tier count above it, and
    // three copies of it would be the noise §8.29 dropped a strip for.
    auditDelay = 5_000;
    const user = userEvent.setup();
    // #289 S7: an in-flight refetch post-generate is APPLY's generate —
    // an edit stages and previews (a read), and APPLY is the write
    // (ruling e).  The cue is about the values on screen being the
    // previous answer, which is exactly what APPLY's flight makes true.
    await stageRevision("35");
    await applyRevision();
    await settle(60);
    const cues = screen.queryAllByText("◌ previous answer, refreshing…");
    expect(cues.length, "at most one cue, ever").toBeLessThanOrEqual(1);
  });

  it("the quote's panel survives a collapse — its state is written nowhere else", async () => {
    const user = await generate();
    const row = Array.from(document.querySelectorAll(".disc")).find(
      (d) => d.querySelector(".disc-name")?.textContent === "Price quote",
    ) as HTMLElement;
    const head = row.querySelector(".disc-head") as HTMLButtonElement;
    await user.click(head);
    expect(row.querySelector(".disc-panel")!.hasAttribute("hidden")).toBe(false);
    await user.click(head);
    // Still MOUNTED, just hidden: unmounting would discard duration, flagger
    // count, rate edits and the previewed breakdown (the #74 clobber class).
    const panel = row.querySelector(".disc-panel");
    expect(panel, "the quote's panel stays in the DOM").not.toBeNull();
    expect(panel!.hasAttribute("hidden")).toBe(true);
  });
});

// #438 item 1 (Ryan, 2026-11-03), Rule 11: the strip's two counts are the
// counts the two sections it names print, in the same mounted render.
describe("#438 item 1 — the N = 0 strip names where the flags are", () => {
  const notClean = (warnings: Array<{ flag: string; level: string; message: string }>) => {
    const saved = { flags: AUDIT.plan_flags, cv: SECTIONS.corridor_validation };
    SECTIONS.corridor_validation = { checked: true, warnings } as typeof SECTIONS.corridor_validation;
    AUDIT.plan_flags = {
      validation_warnings: warnings.length,
      compliance_fails: 0,
      v1_limitations: 2,
      is_clean: false,
    };
    return () => {
      AUDIT.plan_flags = saved.flags;
      SECTIONS.corridor_validation = saved.cv;
    };
  };
  const strip = () =>
    document.querySelector('[data-testid="strip-field-checks"] .status-questions');
  const needsYouRows = () =>
    document.querySelectorAll("#site-corrections .ny-items > li").length;

  it("P is the Not checked yet section's count, and A is the rows NEEDS YOU lists", async () => {
    const restore = notClean([
      { flag: "bearing_conflict", level: "warning", message: "Declared bearing diverges." },
    ]);
    try {
      await generate();
      const p = countOf("pending");
      expect(p).toMatch(/^[1-9]\d*$/);
      const a = needsYouRows();
      expect(a).toBeGreaterThan(0);
      const words = `${a} item${a === 1 ? "" : "s"} above and ${p} under Pending need a check before field use.`;
      expect(strip()?.textContent).toBe(`Plan ready. ${words}`);
      expect(document.body.textContent).not.toMatch(/plan flags?/);
    } finally {
      restore();
    }
  });

  it("with nothing in NEEDS YOU, the strip names Pending alone", async () => {
    const restore = notClean([]);
    try {
      await generate();
      expect(document.getElementById("site-corrections")).toBeNull();
      const p = countOf("pending");
      expect(strip()?.textContent).toBe(
        `Plan ready. ${p} under Pending ${p === "1" ? "needs" : "need"} a check before field use.`,
      );
    } finally {
      restore();
    }
  });
});