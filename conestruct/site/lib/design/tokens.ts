// #227 sizing tokens — CHOSEN, unsheeted (rule 12).  The design PDF
// names both needs without numbers: a fixed glyph cell so state glyphs
// align into a column (the #226 GO deferred glyph sizing to this arc),
// and a minimum proportional-bar segment so a short taper next to a
// long work zone never vanishes to a 0-px sliver (p.5: "the bar needs
// a minimum segment width").  The values are the GO ruling 4 choices
// (2026-08-27), not sheeted by the PDF.
//
// This table is the single source; app/globals.css defines the same
// custom properties on .workbench, and tokens.test.ts asserts the two
// stay equal (the type-roles.ts mirror idiom, one directory over).
export const SIZE_TOKENS = {
  /** CHOSEN — glyph column width for state glyphs (⚠ ✓ × ⌁ ◌). */
  "--glyph-cell": "16px",
  /** CHOSEN — corridor proportional bar's minimum segment width. */
  "--bar-seg-min": "6px",
} as const;

export type SizeTokenName = keyof typeof SIZE_TOKENS;
