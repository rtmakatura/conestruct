import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// #288 §8.29 + rule 28 — the reserved row's CSS contract.
//
// Replaces components/ns-strip-tokens.test.tsx, which asserted the
// next-steps strip's contract (tokens, the pin, the un-pin, the lock).
// Its subject is gone, so it is deleted rather than skipped.  What this
// file pins instead is the ruling: the reserve is --fact-min-h (#289 R9
// renamed it to what it is — a row FLOOR, 48 px), the strip's
// whole CSS run is removed rather than disabled, and the row is no
// longer sticky.
//
// Read from the source, never a pre-baked list — the same idiom the
// retired suite used (#263 P11).

const CSS = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8");

function rule(selector: string): string {
  const i = CSS.indexOf(selector + " {");
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
  return CSS.slice(i, CSS.indexOf("}", i));
}

describe("#288 rule 28 — the reserved first row's CSS contract", () => {
  // Ryan's hand-check at f44377e: the slot is a Phase 1 DEVIATION now.
  // It reserved 44 px for the setup fact line, which Phase 2 builds, so
  // in Phase 1 it held a place for something that never arrived.  The
  // three claims this replaces described that rule's properties; what
  // the suite guards now is that the rule is GONE and the token it read
  // is not, because Phase 2 needs the token back.

  it("the slot rule is deleted — no element, no rule", () => {
    const code = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toContain(".results-head-slot");
  });

  it("--fact-min-h SURVIVES at 48px: rule 56's row floor, corrected by #289 R9", () => {
    // The #283 idiom, deliberately: a size is declared before the phase
    // that draws it, so the declaration is ready and cannot drift.  The
    // token is not debt — it is the reserve's value, waiting for its
    // occupant.
    expect(CSS).toMatch(/--fact-min-h:\s*48px/);
  });

  it("nothing else consumed the slot — deleting it left no dangling reference", () => {
    const code = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/results-head-slot/);
    // #289 Phase 2 — THE TOKEN NOW HAS ITS CONSUMER, and it is the fact
    // line itself rather than the reserve.
    //
    // Phase 1 asserted the opposite ("declared, unused, waiting"), which
    // was the honest state then: the token existed, the surface did not.
    // The surface exists now — `.a-fact` takes the floor as its
    // `min-height` — so the assertion inverts, deliberately, and names
    // the one rule that is allowed to consume it.  The RESERVE is still
    // unbuilt: `ResultsHead` renders null until the S4/S5 commit mounts
    // the setup fact line at the settle, which is what Phase 1's
    // recorded deviation said would happen.
    const consumers = (code.match(/var\(--fact-min-h\)/g) ?? []).length;
    expect(consumers, "exactly one consumer: the fact line's own floor").toBe(1);
    expect(code).toMatch(/\.a-fact \{[^}]*min-height: var\(--fact-min-h\)/);
  });

  it("--strip-h is retired: no declaration and no consumer survives", () => {
    // Comments may name it (the ruling's reason is recorded in them);
    // a DECLARATION or a var() reference must not.
    const code = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/--strip-h\s*:/);
    expect(code).not.toMatch(/var\(--strip-h\)/);
  });

  it("the strip's whole CSS run is deleted, not disabled", () => {
    const code = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const sel of [
      ".ns-strip",
      ".ns-label",
      ".ns-chips",
      ".ns-chip",
      ".ns-name",
      ".ns-index",
      ".ns-count",
      ".ns-glyph",
      ".ns-below",
    ]) {
      expect(code, `${sel} survives`).not.toContain(sel);
    }
  });

  it("--fact-min-h is not overridden at 380: rule 56 does not vary by viewport", () => {
    expect(CSS.match(/--fact-min-h:\s*48px/g) ?? []).toHaveLength(1);
  });
});
