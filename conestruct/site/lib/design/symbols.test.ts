// #289 fidelity F1 — rules 17–18: the vocabulary and its fixed hues.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SYMBOLS, symClass } from "./symbols";

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8");

describe("rule 18 — every symbol has one fixed hue, from the glyph alone", () => {
  it("rule 17's six plus ⌁ (DESIGN-SPACING's 'proposed', ruled 2026-09-23 Q5) and ● (selection, Ryan 2026-10-25, #407)", () => {
    expect([...SYMBOLS].sort()).toEqual(["✓", "▲", "⚠", "◌", "×", "i", "⌁", "●"].sort());
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
      "●": "--act", // #34a9e8, the pressed border's own accent (#407)
    };
    for (const [g, token] of Object.entries(want)) {
      const cls = symClass(g);
      expect(cls, g).not.toBe("");
      const block = new RegExp(`\\.workbench \\.${cls} \\{\\s*color: var\\(${token}\\);`);
      expect(css, `${g} → .${cls} → ${token}`).toMatch(block);
    }
  });

  it("#407: ● is the selection mark, and its class names selection, not a verdict", () => {
    // Ryan, 2026-10-25 (issues/407#issuecomment-6403916392): "✓ stays a
    // provenance mark only ... A selected chip or toggle gets its own
    // mark, for example a filled dot, and never a ✓."
    expect(symClass("●")).toBe("sym-select");
    expect(symClass("✓")).toBe("sym-pass");
  });

  it("a character outside the vocabulary gets no hue — never a guessed one", () => {
    expect(symClass("○")).toBe("");
    expect(symClass("✕")).toBe("");
    expect(symClass("ℹ")).toBe("");
  });
});

describe("#407 — a chosen option is marked ●, never ✓ (Ryan, 2026-10-25)", () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Every rule whose selector keys on a pressed or checked state.
  const selectionRules = [...bare.matchAll(/([^{}]*aria-(?:pressed|checked)[^{}]*)\{([^}]*)\}/g)].map(
    (m) => ({ sel: m[1].trim(), body: m[2] }),
  );

  it("no selection rule draws a ✓", () => {
    expect(selectionRules.length).toBeGreaterThan(0);
    for (const r of selectionRules) expect(r.body, r.sel).not.toContain("✓");
  });

  it("every selection rule that draws a glyph draws ● in .sym-select's token", () => {
    const drawn = selectionRules.filter((r) => /content:/.test(r.body));
    // The kind chip's reserved slot and the segmented option's hung mark.
    expect(drawn.map((r) => r.sel)).toEqual([
      ".workbench .a-chip[aria-pressed] > .tr-field::after",
      '.workbench .a-seg > button[aria-pressed="true"] > .a-seg-label::before',
    ]);
    for (const r of drawn) {
      expect(r.body, r.sel).toMatch(/content:\s*"[^"]*●[^"]*"\s*\/\s*"";/);
      expect(r.body, r.sel).toMatch(/color:\s*var\(--act\);/);
    }
  });

  it("the side chip's one-off .a-chip-check rule is gone; its ● takes symClass", () => {
    expect(bare).not.toMatch(/\.a-chip-check/);
  });
});
