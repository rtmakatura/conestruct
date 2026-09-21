import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// #288 §8.29 + rule 28 — the reserved row's CSS contract.
//
// Replaces components/ns-strip-tokens.test.tsx, which asserted the
// next-steps strip's contract (tokens, the pin, the un-pin, the lock).
// Its subject is gone, so it is deleted rather than skipped.  What this
// file pins instead is the ruling: the reserve is --fact-h, the strip's
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
  it("reserves --fact-h, and --fact-h is 44px: rule 56's fact line, a rule not a measurement", () => {
    expect(rule(".workbench .results-head-slot")).toMatch(/min-height:\s*var\(--fact-h\)/);
    expect(CSS).toMatch(/--fact-h:\s*44px/);
  });

  it("carries rule 27's first gap as the slot's bottom margin", () => {
    expect(rule(".workbench .results-head-slot")).toMatch(/margin-bottom:\s*14px/);
  });

  it("is NOT sticky — it was pinned because the strip was pinned, and rule 32 allows only the nav", () => {
    const slot = rule(".workbench .results-head-slot");
    expect(slot).not.toMatch(/position:\s*sticky/);
    expect(slot).not.toMatch(/z-index/);
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

  it("--fact-h is not overridden at 380: rule 56 does not vary by viewport", () => {
    expect(CSS.match(/--fact-h:\s*44px/g) ?? []).toHaveLength(1);
  });
});
