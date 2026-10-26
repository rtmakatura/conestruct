// #289 fidelity F1 — Part 2 rules 17–18: the symbol vocabulary and its
// fixed hues, in one table.
//
// Rule 17: "Symbols are text, not icons: ✓ ▲ ⚠ ◌ × i, mono 12.5 px / 1".
// Rule 18: "Symbol colours, fixed across the whole page: ✓ #4fd787 ·
// ▲ #f4c020 · ⚠ #f4c020 · ◌ #93a0b0 · × #ff7a7a · i #34a9e8.  A symbol
// never changes hue by context."
//
// ⌁ is the seventh: DESIGN-SPACING.md's reconciled vocabulary gives it
// "proposed — a suggestion awaiting Confirm/Dismiss", --ink-on-dark.
// Part 2 rule 17's list omitted it (ruled 2026-09-23, fidelity Q5).
//
// ● is the eighth, for one meaning only: "the option chosen on this
// control" (a pressed chip or toggle option, the checked side), in the
// accent --act like the pressed border it sits in.  Ryan, 2026-10-25
// (#407, https://github.com/rtmakatura/conestruct/issues/407#issuecomment-6403916392):
// "No exception to Rule 18 ... ✓ stays a provenance mark only ... A
// selected chip or toggle gets its own mark, for example a filled dot,
// and never a ✓."
//
// A component renders a glyph with `symClass(glyph)` and the hue follows
// from the glyph alone — which is rule 18's "never by context" made
// structural: there is no prop a caller could pass to colour it
// differently.  The classes are declared in globals.css (the #263 ink gate
// keeps hexes in the token block).

const SYMBOL_CLASS: Readonly<Record<string, string>> = {
  "✓": "sym-pass",
  "▲": "sym-warn",
  "⚠": "sym-warn",
  "◌": "sym-none",
  "×": "sym-fail",
  i: "sym-info",
  "⌁": "sym-proposed",
  "●": "sym-select",
};

/** The rule-18 hue class for a glyph, or "" for a character outside the
 *  vocabulary (which then keeps its container's ink rather than a guess). */
export function symClass(glyph: string): string {
  return SYMBOL_CLASS[glyph] ?? "";
}

/** The vocabulary itself, for tests that assert every glyph is covered. */
export const SYMBOLS: readonly string[] = Object.keys(SYMBOL_CLASS);
