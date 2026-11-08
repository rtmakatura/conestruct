// @vitest-environment happy-dom
//
// #453: what an opened detail reads, and what a search shows inside one,
// mounted on the recorded Denver wire (Rule 11, rendered output).
// Ruling 1: no lowercase fragment opens a Permit line, the zone geometry
// reads plain labels.  Ruling 2: a search shows each list's matching lines
// with "N of M shown" and "Show all", and so do its sentences and rows.  Ruling 3: no "Show all" when every
// line already shows.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { corridorValidationItem } from "./AuditTrail";
import { loadFixture, mountFixture, openRow, openSection, rowOf } from "./reference-test-utils";
import { buildMatcher } from "@/lib/reference-search";

const fx = loadFixture("adv-ni-denver");
const notices = fx.jurisdiction.permit.notices;
const fees = fx.jurisdiction.fees.items;

const type = (q: string) => fireEvent.change(screen.getByRole("searchbox"), { target: { value: q } });
const hits = (q: string, texts: string[]) => {
  const m = buildMatcher(q)!;
  return texts.filter((t) => {
    m.lastIndex = 0;
    return m.test(t);
  }).length;
};

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ruling 1: the Permit detail", () => {
  it("each notice is a line with its audience under it, never a lowercase sentence", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    await openSection(user, "reference");
    const row = rowOf("reference", "Permit")!;
    await openRow(user, row);
    expect(notices.length).toBe(3);
    const lines = Array.from(row.querySelectorAll(".rr-lines li"));
    for (const n of notices) {
      const li = lines.find((l) => l.querySelector(".rr-line-text")?.textContent?.startsWith(n.rule));
      expect(li, n.rule).toBeTruthy();
      expect(li!.querySelector(".rr-line-sub")?.textContent).toBe(`Notice to ${n.audience}`);
    }
    // No sentence opens with a lowercase audience any more.  (The tier
    // reason's own sentence case is the backend's, pinned in
    // tests/test_details_clean_453.py; this recorded wire predates it, X15.)
    for (const p of Array.from(row.querySelectorAll("p.tr-help"))) {
      for (const n of notices) expect(p.textContent).not.toContain(`${n.audience}:`);
    }
  });
});

describe("ruling 2: a search shows only the matching lines of each list", () => {
  it("'sidewalk' opens Permit with its matching notice and fee lines, counted, each list with its Show all", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    type("sidewalk");
    const row = rowOf("reference", "Permit")!;
    const nNotice = hits("sidewalk", notices.map((n) => `${n.rule} Notice to ${n.audience}`));
    const nFee = hits("sidewalk", fees.map((f) => f.label));
    expect(nNotice).toBeGreaterThan(0);
    expect(nNotice).toBeLessThan(notices.length);
    expect(nFee).toBeLessThan(fees.length);
    expect(row.querySelectorAll(".rr-lines li")).toHaveLength(nNotice + nFee);
    const note = row.querySelector(".rr-detail > p.tr-note")!.textContent;
    expect(note).toContain(`${nNotice} of ${notices.length} notices shown.`);
    expect(note).toContain(`${nFee} of ${fees.length} fee lines shown.`);
    // Repair 1: the lead sentences and the label-value rows filter too; the
    // ones that don't mention the word wait behind one "Show all N lines".
    for (const el of Array.from(row.querySelectorAll("p.tr-help, .rr-pair"))) {
      expect(el.textContent).toMatch(/sidewalk/i);
    }
    expect(row.textContent).not.toContain("Courtesy reference.");
    expect(note).toMatch(/ 0 of \d+ lines shown\./);
    await user.click(within(row).getByRole("button", { name: /^Show all \d+ lines$/ }));
    expect(row.textContent).toContain("Courtesy reference. Fees are never quote line items.");
    expect(row.querySelectorAll(".rr-pair").length).toBeGreaterThan(0);
    expect(within(row).queryByRole("button", { name: /^Show all \d+ lines$/ })).toBeNull();
    await user.click(within(row).getByRole("button", { name: `Show all ${fees.length} fee lines` }));
    expect(row.querySelectorAll(".rr-lines li")).toHaveLength(nNotice + fees.length);
    expect(within(row).queryByRole("button", { name: `Show all ${fees.length} fee lines` })).toBeNull();
    await user.click(within(row).getByRole("button", { name: `Show all ${notices.length} notices` }));
    expect(row.querySelectorAll(".rr-lines li")).toHaveLength(notices.length + fees.length);
  });
});

describe("ruling 3: no Show all when every line shows", () => {
  it("'upstream' matches every advance sign: the list shows whole, with no count and no list button", () => {
    mountFixture(fx);
    const signs = (fx.audit.sections.advance as { sign_table: Record<string, string>[] }).sign_table;
    expect(signs.every((s) => /upstream/.test(s["Distance from Taper (ft)"]))).toBe(true);
    type("upstream");
    const row = rowOf("checked", "Warning signs")!;
    expect(row.querySelector(".rr-detail")).not.toBeNull();
    expect(row.querySelectorAll(".rr-lines li")).toHaveLength(signs.length);
    // Ruling 3 names the list's button; the sentences that don't say
    // "upstream" wait behind "Show all N lines" (repair 1).
    expect(within(row).queryByRole("button", { name: `Show all ${signs.length} signs` })).toBeNull();
    expect(row.textContent).not.toMatch(/of \d+ signs shown/);
  });
});

describe("X18: a mono value never breaks badly", () => {
  it("a short value carries the one-line class; a longer one keeps its number and unit together", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    await openSection(user, "checked");
    const row = rowOf("checked", "Taper length")!;
    await openRow(user, row);
    const pairs = Array.from(row.querySelectorAll(".rr-pair"));
    expect(pairs.length).toBeGreaterThan(0);
    for (const p of pairs) {
      const dd = p.querySelector("dd.rr-num")!;
      expect(dd.textContent!.length <= 24).toBe(p.classList.contains("is-short"));
      // A longer value may wrap, but its number and unit stay together.
      if (!p.classList.contains("is-short")) expect(dd.textContent).toMatch(/\d\u00a0ft$/);
    }
  });
});

describe("ruling 1: no internal key under a corridor warning", () => {
  it("a warning line is its message only, never the wire flag", () => {
    const item = corridorValidationItem({
      checked: true,
      warnings: [{ flag: "no_road_at_anchor", level: "warn", message: "No road at the anchor." }],
    })!;
    expect(item.detail.list!.lines).toEqual([{ text: "No road at the anchor." }]);
  });
});
