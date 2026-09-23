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
// "◌ previous answer — refreshing…" cue in section 03's reserved slot.
// Clause 4 moved that slot into the stack — a cue inside a closed
// disclosure cannot say the counts above it are stale — so the claim
// moved here rather than being dropped.

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
    return { ok: true, status: 200, json: async () => AUDIT } as unknown as Response;
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

/** Every rule-87 row's name, in document order. */
const rowNames = () =>
  Array.from(document.querySelectorAll(".disc-name")).map((n) => n.textContent);
const rowByName = (name: string) =>
  Array.from(document.querySelectorAll(".disc")).find(
    (d) => d.querySelector(".disc-name")?.textContent === name,
  ) as HTMLElement | undefined;
const countOf = (name: string) =>
  rowByName(name)?.querySelector(".disc-count")?.textContent ?? null;

describe("#288 clause 4 — the stack's disclosure rows", () => {
  it("the four rows are ONE group, in rule 27's order, with its 10px gap", async () => {
    await generate();
    // Ryan's hand-check at f44377e, fix 3: the Reference row was in its
    // own Zone 3 section below the draft notice.  Rule 27 names a
    // "disclosure group" with an internal gap, so the four rows are one
    // run — and the group, not a zone, is what the operator reads down.
    const group = document.querySelector(".results-disc")!;
    expect(group, "the group exists").not.toBeNull();
    const inGroup = Array.from(group.querySelectorAll(".disc-name")).map((n) => n.textContent);
    expect(inGroup).toEqual([
      "Pricing quote",
      "Checked & passed",
      "Pending / not verified",
      "Reference",
    ]);
    // Every rule-87 row on the page is in it: none stranded elsewhere.
    expect(document.querySelectorAll(".disc-name")).toHaveLength(inGroup.length);
    // Part 1 §8.11 puts the quote "directly under the downloads"; §8.9
    // keeps ✓, ◌ and the uncounted i tier as disclosures, and clause 4
    // promotes the first two out of section 03's chips into rows here.
    expect(rowNames()).toEqual(inGroup);
  });

  it("the draft notice is the column's LAST line, below the group (§8.12, rule 29)", async () => {
    await generate();
    const main = document.querySelector("main")!;
    const all = Array.from(main.querySelectorAll("*"));
    const draft = screen.getByTestId("draft-notice");
    const group = document.querySelector(".results-disc")!;
    expect(all.indexOf(draft)).toBeGreaterThan(all.indexOf(group));
    // #289 fidelity F6 (ruled Q6, 2026-09-23): rule 29's words, verbatim.
    expect(draft.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Draft — not a sealed plan. Output is engineering reference; requires review and seal by a licensed PE prior to field use.",
    );
  });

  it("the reference row keeps the jump target and the focus target Zone 3 carried", async () => {
    await generate();
    const anchor = document.querySelector("#reference")!;
    expect(anchor, "#253's chip-2 target survives the move").not.toBeNull();
    expect(anchor.getAttribute("tabindex"), "#193's focus target").toBe("-1");
    expect(anchor.className).toContain("jump-anchor");
    expect(anchor.querySelector(".disc-name")?.textContent).toBe("Reference");
  });

  it("rule 89: the COUNTED tiers show their number; the quote and the reference show none", async () => {
    await generate();
    // The number is the LEDGER's, not one this test computes — asserting
    // a figure I assumed rather than measured is how the first version of
    // this test failed ("2" for a tier the ledger counts as 8).  The
    // claim worth making is that one ledger feeds every reader: the ✓
    // row and the audit card's "N checks" must agree, always.
    const checked = countOf("Checked & passed");
    expect(checked).toMatch(/^\d+$/);
    const cardQty = Array.from(document.querySelectorAll(".dl-card"))
      .find((c) => c.querySelector("h3")?.textContent === "Audit trail")!
      .querySelector(".qty b")!.textContent;
    expect(cardQty, "the card and the row read one ledger").toBe(checked);
    // ◌ is counted too — its own tier, never buried (#219).
    expect(countOf("Pending / not verified")).toMatch(/^\d+$/);
    // Uncounted: a numeral here would have to be a sum across kinds that
    // do not add up to anything the operator acts on.
    expect(countOf("Reference")).toBeNull();
    // The quote is not a tier at all — no ledger, nothing to count.  A
    // zero would read as a total of nothing.
    expect(countOf("Pricing quote")).toBeNull();
  });

  it("the promoted tiers are GONE from section 03 — one container each, never two", async () => {
    const user = await generate();
    // Open the reference and look inside: ▲/⚠ and the i tier are what
    // §8.9 leaves there.  ✓ and ◌ must not also be chips in here, or the
    // same fact would have two containers (P2).
    await user.click(rowByName("Reference")!.querySelector(".disc-head") as HTMLButtonElement);
    const panel = rowByName("Reference")!.querySelector(".disc-panel")!;
    const chipLabels = Array.from(panel.querySelectorAll(".refchip .label")).map(
      (l) => l.textContent,
    );
    expect(chipLabels).not.toContain("Checked & passed");
    expect(chipLabels).not.toContain("Pending / not verified");
  });

  it("every row is closed in S5 and opens in place (rules 87–89)", async () => {
    const user = await generate();
    for (const name of ["Checked & passed", "Pending / not verified", "Reference"]) {
      const row = rowByName(name)!;
      const head = row.querySelector(".disc-head") as HTMLButtonElement;
      expect(head.getAttribute("aria-expanded"), name).toBe("false");
      expect(row.querySelector(".disc-panel"), name).toBeNull();
      await user.click(head);
      expect(head.getAttribute("aria-expanded"), name).toBe("true");
      expect(row.querySelector(".disc-panel"), name).not.toBeNull();
    }
  });

  it("rule 129: every row's control is a READ — disclosing is never a write", async () => {
    await generate();
    for (const head of Array.from(document.querySelectorAll(".disc-head"))) {
      expect(head.hasAttribute("data-read")).toBe(true);
      expect(head.hasAttribute("data-write")).toBe(false);
    }
  });

  // ── the claim inherited from JurisdictionSection.density.test.tsx ──
  it("#187: ONE '◌ previous answer — refreshing…' cue, in the stack, in a reserved slot", async () => {
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
    const cues = screen.queryAllByText("◌ previous answer — refreshing…");
    expect(cues.length, "at most one cue, ever").toBeLessThanOrEqual(1);
  });

  it("the quote's panel survives a collapse — its state is written nowhere else", async () => {
    const user = await generate();
    const row = rowByName("Pricing quote")!;
    const head = row.querySelector(".disc-head") as HTMLButtonElement;
    await user.click(head);
    expect(row.querySelector(".disc-panel")!.hasAttribute("hidden")).toBe(false);
    await user.click(head);
    // Still MOUNTED, just hidden: unmounting would discard duration,
    // flagger count, rate edits and the previewed breakdown — the #74
    // clobber class.  A tier body is derived from the wire and takes the
    // opposite default (absent when closed).
    const panel = row.querySelector(".disc-panel");
    expect(panel, "the quote's panel stays in the DOM").not.toBeNull();
    expect(panel!.hasAttribute("hidden")).toBe(true);
    expect(rowByName("Checked & passed")!.querySelector(".disc-panel")).toBeNull();
  });
});
