// #289 fidelity F1 — rules 17–18: the vocabulary and its fixed hues.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SYMBOLS, symClass } from "./symbols";

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8");

describe("rule 18 — every symbol has one fixed hue, from the glyph alone", () => {
  it("rule 17's six plus ⌁ (DESIGN-SPACING's 'proposed', ruled 2026-09-23 Q5)", () => {
    expect([...SYMBOLS].sort()).toEqual(["✓", "▲", "⚠", "◌", "×", "i", "⌁"].sort());
  });

  it("each glyph maps to its rule-18 token", () => {
    const want: Record<string, string> = {
      "✓": "--pass", // #4fd787
      "▲": "--warn", // #f4c020
      "⚠": "--warn", // #f4c020
      "◌": "--none", // #93a0b0
      "×": "--fail", // #ff7a7a
      i: "--act", // #34a9e8
      "⌁": "--ink-on-dark", // DESIGN-SPACING.md:111
    };
    for (const [g, token] of Object.entries(want)) {
      const cls = symClass(g);
      expect(cls, g).not.toBe("");
      const block = new RegExp(`\\.workbench \\.${cls} \\{\\s*color: var\\(${token}\\);`);
      expect(css, `${g} → .${cls} → ${token}`).toMatch(block);
    }
  });

  it("a character outside the vocabulary gets no hue — never a guessed one", () => {
    expect(symClass("○")).toBe("");
    expect(symClass("✕")).toBe("");
    expect(symClass("ℹ")).toBe("");
  });
});
