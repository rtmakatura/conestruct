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
// #283 — Direction A's nine type sizes (#281 Phase 0, GO 2026-09-16).
//
// Every size below is TRACED, not CHOSEN: its owner is the Part 2 build
// rule that consumes it, named in the doc comment so the census fails by
// name if a size outlives its owner (GO ruling a).  They are defined on
// `:root` rather than `.workbench` because the type-census parser
// excludes `:root` — that is what lets them be declared BEFORE any
// surface uses them (#281: "never as debt") without the declaration
// going stale against an empty observed set.  `.tr-question` is the one
// consumer in this commit; the other eight wait for their phases.
export const SIZE_TOKENS = {
  /** CHOSEN — glyph column width for state glyphs (⚠ ✓ × ⌁ ◌). */
  "--glyph-cell": "16px",
  /** CHOSEN — corridor proportional bar's minimum segment width. */
  "--bar-seg-min": "6px",

  /** Part 2 rule 7 — type role 5, STEP QUESTION. The open band's question. */
  "--fs-step-question": "22px",
  /** Part 2 rules 7 + 162 — the step question below 520 (#281 ruling 180;
   *  520, not 380 — rule 162's 380 is the phone example, not the switch). */
  "--fs-step-question-520": "19px",
  /** Part 2 rule 131 — PRIMARY XL (.pri.xl), GENERATE PLAN only. */
  "--fs-primary-xl": "17.5px",
  /** Part 2 rule 130 — PRIMARY (.pri). */
  "--fs-primary": "15.5px",
  /** Part 2 rule 9 — the refusal sentence, the one item-body exception. */
  "--fs-refusal": "15px",
  /** Part 2 rules 8 + 9 — body value and item body. */
  "--fs-body-value": "13.5px",
  /** Part 2 rules 5 + 17 — type role 3 field label, and the text symbols
   *  (✓ ▲ ⚠ ◌ × i) that ride the same size. */
  "--fs-field-label": "12.5px",
  /** Part 2 rules 10 + 81 — the counts hero's generated numerals. */
  "--fs-hero-numeral": "62px",
  /** Part 2 rule 169 — the counts hero's numerals at 380. */
  "--fs-hero-numeral-380": "42px",
} as const;

export type SizeTokenName = keyof typeof SIZE_TOKENS;
