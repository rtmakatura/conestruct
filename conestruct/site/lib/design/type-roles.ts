// The setup panel's four label roles as tokens (issue #226) — the
// single authoritative table.  The design source of record is the
// committed PDF (validation-artifacts/committed/s2-arc9-type-system/),
// p. 3 "Label roles, as designed"; DESIGN-SPACING.md carries the
// human-readable addendum.
//
// The governing rule (PDF p. 3, adopted 2026-08-25): any two label
// roles differ in at least two of family / casing / size / tracking /
// color / decoration.  type-roles.test.ts enumerates the six pairs and
// asserts it, and asserts the .tr-* CSS blocks in app/globals.css match
// this table — the CSS is a mirror (Rule 3 idiom), this file is the
// source.
//
// Weight is deliberately NOT an axis: the PDF's own six-axis list
// excludes it.  The 500/400 weights below are extra, uncounted
// differentiation.
//
// Rule 12 provenance of every value: family/casing/size/tracking/
// decoration are sheeted (PDF p. 3).  The PDF sheets NO color values
// ("brightest ink" / "dim" / "mid") and no font family names — every
// color below and the Inter/JetBrains Mono families are CHOSEN
// (GO ruling 2, 2026-08-26), mapped onto the existing workbench
// palette:
//   section    var(--ink-bright)       "brightest ink" (ruling 3; #ffffff,
//                                      tokenised in #263)
//   step       var(--ink-on-dark-faint) "dim"  (#93a0b0 — 6.19:1 on
//                                      --canvas, 5.61:1 on --canvas-tint)
//   field      var(--ink-on-dark)       "mid"  (#c8d1dd — 10.68:1 / 9.68:1)
//   provenance var(--ink-on-dark-faint) "dim"
// Ratios measured (probes/contrast-measure.py in the arc evidence),
// never asserted (Rule 13).
//
// Casing note (GO ruling 1): the provenance role's "lowercase" is
// VOICE, not CSS — `casing: "lowercase-voice"` maps to
// `text-transform: none`, and provenance strings are authored in
// lowercase voice with acronyms and edition names in canonical casing
// ("MUTCD", "S-630-1", "OSM" — Rule 9 governs).  Nobody re-adds the
// transform.

export const TYPE_AXES = [
  "family",
  "casing",
  "size",
  "tracking",
  "color",
  "decoration",
] as const;

export type TypeAxis = (typeof TYPE_AXES)[number];

export interface TypeRole {
  /** CSS class carrying the role in app/globals.css (workbench scope). */
  cssClass: string;
  family: "mono" | "sans";
  /** Not an axis — see the header comment.  600 arrives with role 5
   *  (#283): the step question is the column's one heavy register. */
  weight: 400 | 500 | 600;
  casing: "uppercase" | "sentence" | "lowercase-voice";
  size: string;
  /** #283 — a role that switches size below 520 px declares the variant
   *  here, so the census can tell a ruled second declaration on the same
   *  selector from an undeclared one.  Same idiom as the hero numeral's
   *  76/60 exception (DESIGN-SPACING: "one selector, two sizes").  Only
   *  role 5 has one (#281 ruling 180: "19 px below 520"). */
  sizeBelow520?: string;
  tracking: string;
  color: string;
  decoration: "none" | "dotted-underline";
}

export const TYPE_ROLES = {
  /** Names a section or card.  One per container, top edge only. */
  section: {
    cssClass: "tr-section",
    family: "mono",
    weight: 500,
    casing: "uppercase",
    size: "10px",
    tracking: "0.20em",
    color: "var(--ink-bright)", // CHOSEN — "brightest ink" (GO rulings 2-3; tokenised #263)
    decoration: "none",
  },
  /** The step number and nothing else — right edge of the section
   *  header; the rail's jump target.  (Recolor --act → dim also
   *  repairs the act=interactive-only role rule — GO ruling 4.) */
  step: {
    cssClass: "tr-step",
    family: "mono",
    weight: 400,
    casing: "uppercase",
    size: "10px",
    tracking: "0.14em",
    color: "var(--ink-on-dark-faint)", // CHOSEN — "dim" (GO ruling 2)
    decoration: "none",
  },
  /** Names one input.  Sentence case is the tell: if it labels a
   *  control, it is never uppercase. */
  field: {
    cssClass: "tr-field",
    family: "sans",
    weight: 500,
    casing: "sentence",
    size: "12px",
    tracking: "0",
    color: "var(--ink-on-dark)", // CHOSEN — "mid" (GO ruling 2)
    decoration: "none",
  },
  /** Where a value came from, and code citations.  The dotted
   *  underline marks it inspectable (echoes the .chain .seg[title]
   *  there's-more idiom, not a fork of it). */
  provenance: {
    cssClass: "tr-prov",
    family: "mono",
    weight: 400,
    casing: "lowercase-voice", // voice, not CSS — GO ruling 1
    size: "10px",
    tracking: "0.04em",
    color: "var(--ink-on-dark-faint)", // CHOSEN — "dim" (GO ruling 2)
    decoration: "dotted-underline",
  },
  /** #283 / #281 ruling 180 — role 5, THE STEP QUESTION.  The four roles
   *  above are a LABEL vocabulary; this one is a question the operator
   *  answers, and the column's one-thing-at-a-time weight rests on it.
   *  Part 2 rule 7: Inter 22 px / 1.25 / 600 / `--ink`, sentence case,
   *  ends in a question mark; 19 px below 520 (ruling 180 — the switch
   *  is 520, not rule 162's 380 phone example).  The size reads the
   *  token rather than a literal so `:root` stays the one source
   *  (GO ruling d); tokens.test.ts asserts the two agree. */
  question: {
    cssClass: "tr-question",
    family: "sans",
    weight: 600,
    casing: "sentence",
    size: "var(--fs-step-question)",
    sizeBelow520: "var(--fs-step-question-520)",
    tracking: "0",
    color: "var(--ink)", // TRACED — Part 2 rule 7 names `--ink` (#eaf0f7 in workbench scope)
    decoration: "none",
  },
} as const satisfies Record<string, TypeRole>;

export type TypeRoleName = keyof typeof TYPE_ROLES;

/** The CSS declarations each token value mirrors to — the shape
 *  type-roles.test.ts asserts inside the .tr-* blocks. */
export function expectedDeclarations(role: TypeRole): string[] {
  const decls = [
    `font-family: var(--font-${role.family})`,
    `font-weight: ${role.weight}`,
    `font-size: ${role.size}`,
    `letter-spacing: ${role.tracking}`,
    `color: ${role.color}`,
    role.casing === "uppercase"
      ? "text-transform: uppercase"
      : "text-transform: none",
  ];
  if (role.decoration === "dotted-underline") {
    // text-decoration (not border-bottom) so multi-line provenance
    // strings underline per line, not per box.
    decls.push("text-decoration: underline dotted");
  }
  return decls;
}
