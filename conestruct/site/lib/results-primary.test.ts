// #288 Phase 1 clause 3 — the primary derivation, tested ONCE.
//
// Clause 3: "one derivation ... tested once, read by both surfaces"
// (clause c of the first ruling, restated by the finish ruling).  The
// two READERS are tested where they render — OutputCards.test.tsx and
// GeneratorShell.needs-you.test.tsx — so this file tests the decision
// and nothing else.

import { describe, expect, it } from "vitest";

import { derivePrimaryOwner } from "./results-primary";

describe("#288 clause 3 — one derivation for the results primary", () => {
  it("count > 0: NEEDS YOU's actions are primary", () => {
    for (const n of [1, 2, 3, 17]) {
      expect(derivePrimaryOwner(n)).toBe("needs-you");
    }
  });

  it("count 0: '↓ All (.zip)' is the primary", () => {
    expect(derivePrimaryOwner(0)).toBe("download-all");
  });

  it("the answer is a single OWNER, so two surfaces can never both be primary", () => {
    // Acceptance line 2 — "one primary per state at both widths" — holds
    // by construction here rather than by two call sites agreeing.  A
    // pair of booleans could be true twice; an owner cannot.
    for (const n of [0, 1, 5]) {
      const owner = derivePrimaryOwner(n);
      const isNeedsYou = owner === "needs-you";
      const isDownloads = owner === "download-all";
      expect(isNeedsYou && isDownloads).toBe(false);
      expect(isNeedsYou || isDownloads).toBe(true);
    }
  });

  it("the derivation takes no width — clause 3's 'same at 380' is the absence of a parameter", () => {
    // There is nothing to assert about a breakpoint because the function
    // cannot see one.  That is the point: rule 86 ("not rendered at
    // 1440") and rule 168 ("primary at 380") were the two halves clause 3
    // supersedes, and a width-blind derivation is how it does it.
    expect(derivePrimaryOwner.length).toBe(1);
  });
});
