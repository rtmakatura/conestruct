// R116 item 1 / R117 Q1a-c / R118 — a jurisdiction rule's words.
//
// R116: "No raw keys anywhere in the UI."  R117 Q1a: "'Arrow board
// required' when the layout already places it; 'added' only when a count
// was raised."  Q1c: "'{Jurisdiction} work-method rule'".  Q1d: Needs You
// stops showing the rule's sentence (its citation is the source, short).

import { describe, expect, it } from "vitest";

import { deltaCite, deltaDetail, deltaTitle } from "./delta-words";
import type { AppliedDelta } from "./jurisdiction";

// The real Denver rule (data/jurisdictions/denver.json), as the backend
// annotates it (src/rules/jurisdiction.py annotate_count_effects).
const DENVER: AppliedDelta = {
  severity: "count",
  rule: "Arrow board required if closing one or more lanes — Denver's trigger is >=1 lane (vs. Colorado Springs' 4+-lane roadway rule).",
  baseline: "arrow board optional per MUTCD for many single-lane closures",
  effect: { op: "add_device", device: "arrow_board", qty: 1 },
  status: "fires",
  source: { doc: "DOTI PT-116.1", date: "2022-04-01", status: "verified" },
  device_label: "Arrow board",
  raised: false,
};

describe("deltaTitle", () => {
  it("a rule the layout already meets: '{Device} required'", () => {
    expect(deltaTitle(DENVER, "Denver")).toBe("Arrow board required");
  });

  it("a rule that raised a count: '{Device} added'", () => {
    expect(deltaTitle({ ...DENVER, raised: true }, "Denver")).toBe("Arrow board added");
  });

  it("a swap names the device it swaps to", () => {
    const swap = {
      ...DENVER,
      effect: { op: "swap_device", device: "lighted_barricade" },
      device_label: "Lighted barricade",
      raised: undefined,
    };
    expect(deltaTitle(swap, "Littleton")).toBe("Swapped to lighted barricade");
  });

  it("a rule's own note wins: the wire's words", () => {
    expect(deltaTitle({ ...DENVER, effect: { op: "method", note: "Flaggers certified by Thornton" } }, "Thornton")).toBe(
      "Flaggers certified by Thornton",
    );
  });

  it("a method or admin rule with no note: '{Jurisdiction} work-method rule'", () => {
    const op = { ...DENVER, severity: "op" as const, effect: { op: "method" }, device_label: undefined };
    expect(deltaTitle(op, "Denver")).toBe("Denver work-method rule");
  });

  it("never a raw key, even on a recording from before the label existed", () => {
    const old = { ...DENVER, device_label: undefined, raised: undefined };
    const t = deltaTitle(old, "Denver");
    expect(t).not.toMatch(/_/);
    expect(t).not.toMatch(/add_device|arrow_board/);
    expect(t).toBe("Arrow board required");
  });
});

describe("deltaDetail", () => {
  it("one line, the jurisdiction's requirement and what the plan did about it", () => {
    expect(deltaDetail(DENVER, "Denver")).toBe("required by Denver · the plan already places it");
    expect(deltaDetail({ ...DENVER, raised: true }, "Denver")).toBe("required by Denver · added to the plan");
  });
});

describe("deltaCite", () => {
  it("the source document, never the rule's sentence", () => {
    expect(deltaCite(DENVER)).toBe("DOTI PT-116.1");
    expect(deltaCite({ ...DENVER, source: { ...DENVER.source, section: "3.2" } })).toBe("DOTI PT-116.1 § 3.2");
  });
});
