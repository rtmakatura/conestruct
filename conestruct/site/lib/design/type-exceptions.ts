// #263 — the type census declaration (Rule 5: declare, then enforce).
//
// Every `font-size` in app/globals.css (outside :root) and every Tailwind
// size class (`text-[Npx]`, `text-xs` … `text-9xl`) in components/ and
// app/ is one of three things:
//
//   role       a `.tr-*` block — the four-role table in type-roles.ts
//   exception  a named register the ruling keeps outside the table
//              (GO 2026-09-09, bucket D: 76/60, 28, 24, 20/17, 16, 14, 9)
//   debt       everything else — declared here with an owner, folded
//              into roles one surface at a time in later rounds
//
// type-census.test.ts parses the sources and asserts the observed set
// equals this declaration in BOTH directions: a new size or a new site
// fails, and so does a stale row. Editing a font-size therefore means
// editing this file in the same commit — that is the point. The count
// this round: 63 rendered tuples on /sandbox (audit 2e0b25e) → 63; zero
// folds (declare first). The rendered census (Playwright, type-census.mjs)
// is the evidence leg; this file is the CI gate.
//
// Sizes are the literal CSS/Tailwind strings; selectors are the
// innermost rule selector with whitespace collapsed (a selector list is
// one row). Tailwind rows carry the use count per file.

export interface CssSite {
  readonly selector: string;
  readonly size: string;
}

export interface TsxSite {
  readonly file: string;
  readonly cls: string;
  readonly count: number;
}

export interface TypeException {
  readonly name: string;
  readonly sizes: readonly string[];
  readonly reason: string;
  readonly css: readonly CssSite[];
  readonly tsx: readonly TsxSite[];
}

export interface TypeDebt {
  /** Who folds it, or "later round" — the surface owner in the batch. */
  readonly owner: string;
  readonly css: readonly CssSite[];
  readonly tsx: readonly TsxSite[];
}

/** The `.tr-*` classes that ARE the table (type-roles.ts). `.tr-signpost`
 *  is not one of them — it is a debt row below. */
export const ROLE_CLASSES = [
  "tr-section",
  "tr-step",
  "tr-field",
  "tr-prov",
  // #283 — role 5, the step question (#281 ruling 180).  Two declarations,
  // not one: the base and its ≤519px container variant, both reading
  // :root tokens rather than literals (GO ruling d).
  "tr-question",
] as const;

export const TYPE_EXCEPTIONS: readonly TypeException[] = [
  {
    name: "hero numerals",
    sizes: ["var(--fs-hero-numeral)", "var(--fs-hero-numeral-380)"],
    reason:
      "the counts hero's big figures — display numerals, not a label register.  #288 Phase 1 clause 2 restyled the hero to Part 2 rules 80–83 and 169, so the chosen 76/60 give way to the RULED 62/42, which #283 had already declared as :root tokens ahead of their surface — the cells now read the tokens and the census records the var() names",
    css: [
      { selector: ".workbench .hero-cell .num", size: "var(--fs-hero-numeral)" },
      { selector: ".workbench .hero-cell .num", size: "var(--fs-hero-numeral-380)" },
    ],
    tsx: [],
  },
  // "page h1" (28px) is DELETED — #289 fidelity F4 (ruled Q2): the visible
  // H1 is removed from the screen; it stays in the DOM as `sr-only`, which
  // carries no size, so the exception has no site left.
  // "results-head figure" (24px) left with the #249 lockup — #253 conflict
  // 1 ruled the next-steps strip REPLACES it (one field, one surface).
  {
    name: "zone h2",
    sizes: ["20px", "17px"],
    reason:
      "the zone titles — 20 for the dominant zone, 17 for the rest",
    css: [
      { selector: ".workbench .zone-title", size: "17px" },
      { selector: ".workbench .zone.dominant .zone-title", size: "20px" },
    ],
    tsx: [],
  },
  {
    name: "the primary control",
    sizes: ["var(--fs-primary)"],
    reason:
      "rule 130's .pri — the results area's ONE primary action, whose 15.5px #283 declared on :root ahead of this surface (like the hero numeral).  Not a role: a role is a text register, and this is a control's own type.  Which surface WEARS it is decided once (lib/results-primary.ts), so the size has exactly one site",
    css: [
      { selector: ".workbench .pri", size: "var(--fs-primary)" },
    ],
    tsx: [],
  },
  {
    name: "audit formula line",
    sizes: ["16px"],
    reason:
      "the one mono formula line inside an open audit body",
    css: [
      { selector: ".audit-body .formula", size: "16px" },
    ],
    tsx: [],
  },
  {
    name: "body copy",
    sizes: ["14px"],
    reason:
      "sans 14 body copy: form inputs, check labels, audit prose, the intro paragraph, the card title",
    css: [
      { selector: ".check-row .check-lbl", size: "14px" },
      { selector: ".field-input", size: "14px" },
      { selector: ".audit-body", size: "14px" },
      { selector: ".check-list-item .check-list-lbl", size: "14px" },
      { selector: ".empty-state .arrow", size: "14px" },
      // #289 fidelity F2: the download card title left for rule 5 (12.5 px) — its row moved to the fidelity pass's debt row.
    ],
    tsx: [
      { file: "app/onboarding/page.tsx", cls: "text-[14px]", count: 1 },
      // #288 clause 5: the intro paragraph was the shell's one 14px site
      // and Part 1 §8.30 dropped it, so the row is DELETED.  106 -> 105
      // sites, 319 -> 318 uses.  14px stays in the register: five other
      // files carry sans body copy at it.
      // #289 Phase 2: the sidebar's one 14px site was the setup panel's
      // "Plan" heading, and §8.16 drops it — "each band now carries its
      // own header".  Row DELETED with the panel.
      { file: "components/PlanRow.tsx", cls: "text-[14px]", count: 3 },
      { file: "components/QuotePanel.tsx", cls: "text-[14px]", count: 1 },
    ],
  },
  {
    name: "control glyphs",
    sizes: ["9px", "11px"],
    reason:
      "single-glyph controls (the strip's edit pencil, the citation ✓, the ledger's verdict mark) — a glyph cell, not text. The ledger's ✓ / ⚠ / ◌ sits in the 16px --glyph-cell gutter at the same 11px the next-steps strip chose for the same reason (#253 spec 17)",
    css: [
      { selector: ".audit-body .citation .check", size: "9px" },
      { selector: ".workbench .setup-strip .sv .edit-ic", size: "9px" },
      { selector: ".workbench .dva .dva-glyph", size: "11px" },
    ],
    tsx: [],
  },
  {
    name: "the band stack's controls (#289 Phase 2)",
    sizes: [
      "var(--fs-field-label)",
      "var(--fs-body-value)",
      // Carried twice across the census, by #288's primary and by this
      // one: rule 130's size is one ruled value with two surfaces, and
      // each row declares the sizes ITS selectors use.
      "var(--fs-primary)",
      "var(--fs-primary-xl)",
      // #289 fidelity F7: "var(--fs-provenance)" is DELETED.  The token
      // was never declared (no `--fs-provenance:` anywhere in the sheet),
      // so the status row that read it fell through to the inherited
      // size; it now states rule 95.4's 10.5 px (a debt row, below).
    ],
    reason:
      "Part 2's own control sizes, each traced to the rule that states it: the fact line's symbol (rules 17/56, 12.5) and value (rule 8, 13.5), the fact link (rule 134, 9.5), the ledger action (rule 133, 9.5), the field (rule 136, 13.5), the primary (rule 130, 15.5) and the XL primary (rule 131, 17.5) — which the generate frame applies to GenerateButton's own element rather than to a second button, so the control keeps its string, its disabled title and its cta-reason alert.  Every size is already a register in this sheet; what is new is the selector",
    css: [
      { selector: ".workbench .a-fact .a-sym", size: "var(--fs-field-label)" },
      { selector: ".workbench .a-fact .a-val", size: "var(--fs-body-value)" },
      // #289 hand-check, 2026-09-23, correction 3: the move ledger's rows
      // take rule 68's form, so a move VALUE is the same register as a
      // fact value — the same token, read again rather than re-typed.
      { selector: ".workbench .a-moves .a-move .a-val", size: "var(--fs-body-value)" },
      // #289 hand-check, 2026-09-23, correction 1: the second group's
      // two-state answers are the kind chips' control at cell width, so
      // the chip's own label register (rule 17's --fs-field-label, which
      // this sheet already carries for every field label and symbol) is
      // read once more rather than a new size being introduced.
      { selector: ".workbench .a-chip-flat", size: "var(--fs-field-label)" },
      // #289 fidelity F7 — rule 93's was / → / now at role 3's 12.5 (the
      // symbols' and field labels' token), and rule 94's APPLY at 13.5
      // (rule 8's body-value token).
      {
        selector:
          ".workbench .a-panel-row .a-was, .workbench .a-panel-row .a-arrow, .workbench .a-panel-row .a-now",
        size: "var(--fs-field-label)",
      },
      { selector: ".workbench .a-panel-foot .a-apply", size: "var(--fs-body-value)" },
      { selector: ".workbench .a-fld", size: "var(--fs-body-value)" },
      // Ryan, 2026-09-24: "'Pick on map' / 'Edit on map' text drops to
      // the body value size (rule 8, 13.5 px) — too large."  FIND's box
      // is rule 114's; its label reads rule 8's token again (rulings.md,
      // "After the S4 prod run"), overriding F6's 15.5.
      { selector: ".workbench .a-findrow .a-pri", size: "var(--fs-body-value)" },
      { selector: ".workbench .a-pri", size: "var(--fs-primary)" },
      { selector: ".workbench .a-pri.is-xl", size: "var(--fs-primary-xl)" },
      { selector: ".workbench .a-genframe .generate-btn", size: "var(--fs-primary-xl)" },
    ],
    tsx: [],
  },
  {
    name: "the fidelity pass (#289, fidelity-audit.md F1–F8)",
    sizes: ["var(--fs-field-label)"],
    reason:
      "Rules 17–18's one symbol treatment (mono 12.5 px), for symbols the audit measured on prod with NO declared size — they inherited the root's 16 px.  The --fs-field-label token is read, not re-typed: its owner already names 'field label, symbols'.  The pass's two pixel figures (rule 20's 13 px base, rule 88's 12 px caret) are not #283 sizes and are declared as debt, beside .disc-name's 13 px",
    css: [
      {
        selector:
          ".workbench .a-sym, .workbench .ny-glyph, .workbench .disc-glyph, .workbench .status-glyph, .workbench .sw-glyph, .workbench .sugg-glyph, .workbench .wb-glyph",
        size: "var(--fs-field-label)",
      },
    ],
    tsx: [],
  },
];

export const TYPE_DEBT: readonly TypeDebt[] = [
  {
    owner: "later round — legacy @layer components rules (pre-workbench)",
    css: [
      { selector: ".eyebrow", size: "11px" },
      { selector: ".btn-primary", size: "15px" },
      { selector: ".chip", size: "11px" },
      { selector: ".check-row.on .check-box::after", size: "11px" },
      { selector: ".check-row .check-desc", size: "10px" },
      { selector: ".field-label-row", size: "10px" },
      { selector: ".status-bar", size: "11px" },
      { selector: ".device-table", size: "13px" },
      { selector: ".device-table th", size: "10px" },
      { selector: ".empty-state", size: "12px" },
      { selector: ".empty-state .big", size: "18px" },
      { selector: ".generate-btn", size: "15px" },
    ],
    tsx: [],
  },
  {
    owner: "C — cards, reference chips, audit body (#225/#261)",
    css: [
      { selector: ".audit-head .num", size: "11px" },
      { selector: ".audit-head .title", size: "15px" },
      { selector: ".audit-head .result", size: "12px" },
      { selector: ".audit-head .cite", size: "10px" },
      { selector: ".audit-body .citation", size: "10px" },
      { selector: ".audit-body table", size: "13px" },
      { selector: ".audit-body table th", size: "10px" },
      { selector: ".check-list-item .ck", size: "11px" },
      { selector: ".check-list-item .check-list-src", size: "10px" },
      { selector: ".workbench .dl-card .fmt", size: "10.5px" },
      { selector: ".workbench .dl-card .desc", size: "10.5px" },
      { selector: ".workbench .dl-btn", size: "13px" }, // #289 F6: rule 132 ghost (was 12.5)
      { selector: ".workbench .ref-group-label", size: "9.5px" },
      { selector: ".workbench .ref-group-label .ix", size: "11px" },
      { selector: ".workbench .refchip .chip-sum .gl", size: "13px" },
      { selector: ".workbench .refchip .chip-sum .label", size: "13px" },
      { selector: ".workbench .refchip .chip-sum .detail", size: "12.5px" },
      // #288 rule 88 — the disclosure row's name.  Ruled at 13px, which
      // is not one of #283's nine role sizes; declared here with its
      // owner rather than snapped to a role it does not belong to.
      { selector: ".workbench .disc-name", size: "13px" },
      // #289 Phase 2 — the two mono micro controls rules 133 and 134
      // size at 9.5 px.  DEBT, not an exception: 9.5 is not one of
      // #283's nine ruled sizes, and it already sits on .dl-card .fmt
      // and .ref-group-label in this same row.  Declared with its owner
      // rather than snapped to a role it does not belong to.
      // (#289 fidelity F5: the strip glyph's own 12.5 px row is deleted —
      // the F1 symbol block's --fs-field-label carries it.)
      // Rule 117 — S4's placeholder sentence, at rule 8's body value.
      { selector: ".workbench .results-placeholder .rp-line", size: "var(--fs-body-value)" },
      { selector: ".workbench .a-lk", size: "9.5px" },
      { selector: ".workbench .act-btn", size: "9.5px" },
      // #289 fidelity F1 — Part 2's own pixel figures where the audit
      // measured no declared size (16 px inherited from the root):
      // rule 20's base on the workbench itself, and rule 88's caret.
      // Neither is one of #283's nine, so both are debt with an owner,
      // exactly as .disc-name's rule-88 13 px is above.
      { selector: ".workbench", size: "13px" },
      { selector: ".workbench .disc-caret", size: "12px" },
      // #289 fidelity F2 — surfaces that rode a LABEL role that was never
      // theirs, now stating their own Part 2 figures: the download card
      // title (rule 85 → role 3, 12.5), NEEDS YOU's count (rule 73, 11),
      // the item body (rule 9, the body-value token), the citation (rule
      // 11, 9.5) and the disclosure count (rule 88, 11).  Every size is
      // already in the sheet.
      { selector: ".workbench .dl-card h3", size: "12.5px" },
      { selector: ".workbench .ny-count", size: "11px" },
      { selector: ".workbench .ny-body", size: "var(--fs-body-value)" },
      { selector: ".workbench .ny-cite", size: "9.5px" },
      { selector: ".workbench .disc-count", size: "11px" },
      // #289 fidelity F5 — the verdict strip at Part 2's figures: the
      // word at rule 51's 11 px, the pill at rule 52's 9.5.  Both sizes
      // are already in the sheet; neither is one of #283's nine.  They
      // replace the workbench round's 13 / 11 rows below.
      { selector: ".workbench .status-bar", size: "11px" },
      { selector: ".workbench .status-bar .pill", size: "9.5px" },
      // #289 fidelity F6 — rule 133's ledger action states its own 9.5 px
      // (audit rows 51, 55, 57); .tr-step's 10 had stood in for it.
      { selector: ".workbench .needs-you .act", size: "9.5px" },
      { selector: ".workbench .dl-all .act", size: "9.5px" },
      // #289 fidelity F7 — S7's panel at Part 2's pixel figures: rule
      // 95.4's status row (10.5 — it read the undeclared --fs-provenance
      // and rendered the inherited size, audit row 161), rule 94's
      // DISCARD ghost (rule 132's 13), and rule 95.15's 380 rows (11.5)
      // and deferred phrase (9.5).  Each size is already in the sheet.
      { selector: ".workbench .a-panel-status", size: "10.5px" },
      { selector: ".workbench .a-panel-foot .a-discard", size: "13px" },
      {
        selector:
          ".workbench .a-panel-row .a-was, .workbench .a-panel-row .a-arrow, .workbench .a-panel-row .a-now",
        size: "11.5px",
      },
      { selector: ".workbench .a-panel-row .a-deferred", size: "9.5px" },
      // #289 fidelity follow-up — rule 165: at 380 "the pill drops to a
      // second line at 8.5 px".  8.5 is already in the sheet (.jr-tag).
      { selector: ".workbench .status-bar .pill", size: "8.5px" },
    ],
    tsx: [],
  },
  {
    owner: "later round — workbench",
    css: [
      { selector: ".workbench .chip", size: "12px" },
      { selector: ".workbench .field-label-row", size: "12px" },
      { selector: ".workbench .empty-state", size: "13px" },
      { selector: ".workbench .site-jump", size: "10.5px" },
      { selector: ".workbench .tr-signpost", size: "10px" },
      { selector: ".workbench .zone-tag", size: "10px" },
      // #288 clause 5: deleted with the results heading it dressed
      // (§8.28).  93 -> 92.  10px stays everywhere else.
      // #288 clause 4: the pricing quote became a rule-87 disclosure row
      // (Part 1 §8.11), so its bespoke head retired and these four rows
      // are DELETED rather than moved — the row's own treatment carries
      // the type now.  26px leaves the sheet with them; 9px, 10px and
      // 13px all remain elsewhere.
      { selector: ".workbench .device-table .jr-tag", size: "8.5px" },
      { selector: ".workbench .stale-ribbon", size: "var(--fs-body-value)" },
      { selector: ".workbench .wb-glyph", size: "13px" },
      { selector: ".workbench .wb-verb", size: "10px" },
      { selector: ".workbench .wb-object", size: "12.5px" },
      { selector: ".workbench .wb-lock", size: "9.5px" },
    ],
    tsx: [],
  },
  {
    owner: "later round — jurisdiction bar, breadcrumb, hero meta",
    css: [
      { selector: ".workbench .jbar-cell .k, .workbench .jctl-field .k", size: "12px" },
      { selector: ".workbench .jbar select, .workbench .jctl select", size: "13px" },
      { selector: ".workbench .jbar-auth", size: "12px" },
      { selector: ".workbench .jbar-auth .term", size: "11px" },
      { selector: ".workbench .classpick button", size: "12px" },
      { selector: ".workbench .mapchip", size: "11px" },
      // #288 · §8.31: deleted with the jurisdiction context bar.  92 -> 91.
      // 11px stays everywhere else in the sheet.
      { selector: ".workbench .chain", size: "11.5px" },
      { selector: ".workbench .chain .sep", size: "12px" },
      { selector: ".workbench .chain-note", size: "9px" },
      // #288 clause 2: the sub-line and the case-ID line now carry
      // .tr-prov (the provenance role rules 81 and 82 name), so their
      // two rows are DELETED rather than re-declared; the geometry row
      // takes rule 82's 11px.
      { selector: ".workbench .hero-cell .k", size: "10px" },
      { selector: ".workbench .hero-meta .row", size: "11px" },
    ],
    tsx: [],
  },
  {
    owner: "A — the corrections block (#254/#255)",
    css: [
      { selector: ".workbench .jbar-suggest", size: "10.5px" },
      { selector: ".workbench .jbar-suggest .sugg-row", size: "10.5px" },
      { selector: ".workbench .jbar-suggest button.confirm, .workbench .jbar-suggest button.ghost", size: "9.5px" }, // #289 F6: rule 133 (was 10)
      { selector: ".workbench .jbar-suggest .honesty", size: "10.5px" },
      // #288 clause 1: the block moved into NEEDS YOU, so these three
      // re-scoped .jbar-suggest → .needs-you (same values).  The other
      // SEVEN rows here are DELETED, not moved: the ledger's glyph,
      // result, evidence, record glyph and record sentence now ride the
      // .tr-* roles, and the picker's two 10px overrides went with the
      // ledger they were scoped to.
      { selector: ".workbench .needs-you .site-correction-reasons legend", size: "11.5px" },
      { selector: ".workbench .needs-you .reason-chip", size: "10px" },
      { selector: ".workbench .needs-you .site-correction-note", size: "12px" },
      { selector: ".workbench .sys-event .sys-glyph", size: "13px" },
    ],
    tsx: [],
  },
  {
    owner: "later round — setup strip / rail",
    css: [
      { selector: ".workbench .progress-rail .rail-entry", size: "10px" },
      { selector: ".workbench .setup-panel .step-pending-summary", size: "10px" },
      { selector: ".workbench .setup-strip .sv .k", size: "9px" },
      { selector: ".workbench .setup-strip .sv .val", size: "13px" },
      { selector: ".workbench .setup-strip .sv-editor .k", size: "9px" },
      { selector: ".workbench .setup-strip .sv-editor input, .workbench .setup-strip .sv-editor select", size: "13px" },
      { selector: ".workbench .setup-strip .strip-edit-all", size: "12px" },
    ],
    tsx: [],
  },
  {
    owner: "not on /sandbox — landing, legal and app-shell pages",
    css: [],
    tsx: [
      { file: "app/app/page.tsx", cls: "text-[10px]", count: 5 },
      { file: "app/app/page.tsx", cls: "text-[11px]", count: 2 },
      { file: "app/app/page.tsx", cls: "text-[13px]", count: 1 },
      { file: "app/app/page.tsx", cls: "text-[16px]", count: 1 },
      { file: "app/app/page.tsx", cls: "text-[28px]", count: 1 },
      { file: "app/onboarding/page.tsx", cls: "text-[10px]", count: 1 },
      { file: "app/onboarding/page.tsx", cls: "text-[28px]", count: 1 },
      { file: "app/privacy/page.tsx", cls: "text-[11px]", count: 1 },
      { file: "app/privacy/page.tsx", cls: "text-[15px]", count: 1 },
      { file: "app/privacy/page.tsx", cls: "text-[36px]", count: 1 },
      { file: "app/terms/page.tsx", cls: "text-[11px]", count: 1 },
      { file: "app/terms/page.tsx", cls: "text-[15px]", count: 1 },
      { file: "app/terms/page.tsx", cls: "text-[36px]", count: 1 },
      { file: "components/AppFooter.tsx", cls: "text-[10px]", count: 1 },
      // #289 fidelity F4: the v0.4 tag and the TA / sheet middle cell left
      // the nav (rules 22–23 — the citation joined the right slot's one
      // string), and the wordmark took rule 22's 14.5 px (was 16).
      { file: "components/AppNav.tsx", cls: "text-[10px]", count: 4 },
      { file: "components/AppNav.tsx", cls: "text-[14.5px]", count: 1 },
      { file: "components/AppSheetMeta.tsx", cls: "text-[10px]", count: 1 },
      { file: "components/FinalCTA.tsx", cls: "text-[11px]", count: 2 },
      { file: "components/FinalCTA.tsx", cls: "text-[17px]", count: 1 },
      { file: "components/FinalCTA.tsx", cls: "text-[40px]", count: 1 },
      { file: "components/FinalCTA.tsx", cls: "text-[56px]", count: 1 },
      { file: "components/Footer.tsx", cls: "text-[11px]", count: 1 },
      { file: "components/Hero.tsx", cls: "text-[11px]", count: 1 },
      { file: "components/Hero.tsx", cls: "text-[13px]", count: 1 },
      { file: "components/Hero.tsx", cls: "text-[18px]", count: 1 },
      { file: "components/Hero.tsx", cls: "text-[40px]", count: 1 },
      { file: "components/Hero.tsx", cls: "text-[56px]", count: 1 },
      { file: "components/MathSection.tsx", cls: "text-[10px]", count: 6 },
      { file: "components/MathSection.tsx", cls: "text-[11px]", count: 4 },
      { file: "components/MathSection.tsx", cls: "text-[13px]", count: 1 },
      { file: "components/MathSection.tsx", cls: "text-[16px]", count: 1 },
      { file: "components/MathSection.tsx", cls: "text-[17px]", count: 1 },
      { file: "components/MathSection.tsx", cls: "text-[28px]", count: 1 },
      { file: "components/MathSection.tsx", cls: "text-[36px]", count: 1 },
      { file: "components/MathSection.tsx", cls: "text-[9px]", count: 1 },
      { file: "components/Nav.tsx", cls: "text-[11px]", count: 1 },
      { file: "components/Nav.tsx", cls: "text-[13px]", count: 1 },
      { file: "components/Nav.tsx", cls: "text-[22px]", count: 1 },
      { file: "components/Nav.tsx", cls: "text-sm", count: 4 },
      { file: "components/PlanRow.tsx", cls: "text-[10px]", count: 1 },
      { file: "components/PlanRow.tsx", cls: "text-[13px]", count: 4 },
      { file: "components/PlanRow.tsx", cls: "text-[18px]", count: 1 },
      { file: "components/PlanSheet.tsx", cls: "text-[10px]", count: 4 },
      { file: "components/PlanSheet.tsx", cls: "text-[11px]", count: 1 },
      { file: "components/PlanSheet.tsx", cls: "text-[9px]", count: 4 },
      { file: "components/ScenarioCard.tsx", cls: "text-[10px]", count: 2 },
      { file: "components/ScenarioCard.tsx", cls: "text-[12px]", count: 1 },
    ],
  },
  {
    owner: "later round — sandbox components",
    css: [],
    tsx: [
      { file: "components/AuditTrail.tsx", cls: "text-[12px]", count: 6 },
      { file: "components/DebugSnapshotButton.tsx", cls: "text-[10px]", count: 2 },
      { file: "components/DeviceBreakdown.tsx", cls: "text-[11px]", count: 1 },
      { file: "components/DeviceBreakdown.tsx", cls: "text-[12px]", count: 4 },
      { file: "components/DimStrip.tsx", cls: "text-[11px]", count: 1 },
      // #289 Phase 2: FlaggerForm's 10px site was the >1500 ft pilot-car
      // note, which moved to the WHERE band with the work-zone length it
      // is about (FLOW.md §5a move 3).  Row DELETED.
      { file: "components/GeneratorFormPrimitives.tsx", cls: "text-[10px]", count: 1 }, // #289 F6: cta-reason took .tr-prov
      // #289 fidelity F4: the "02 · GENERATOR" eyebrow and its one
      // text-[11px] are removed (ruled Q2).
      { file: "components/GeneratorShell.tsx", cls: "text-[12px]", count: 1 },
      // #289 Phase 2 — the setup panel's section components are deleted
      // (§8.16-§8.19) and ALL 22 of the sidebar's utility uses go with
      // them: the last one was the project-details disclosure's toggle,
      // and the hand-check of 2026-09-22 took that disclosure off the
      // WHERE band too (its two surviving fields are WHAT-grid cells
      // now).  The file leaves the Tailwind census entirely.  Two uses
      // MOVED rather than died, and are declared here in their new
      // files, at the sizes they already had.
      { file: "components/bands/WhereBand.tsx", cls: "text-[10px]", count: 1 },
      { file: "components/LaneClosureForm.tsx", cls: "text-[10px]", count: 3 },
      { file: "components/MobileOp2LaneForm.tsx", cls: "text-[10px]", count: 2 },
      { file: "components/MobileOpMultilaneForm.tsx", cls: "text-[10px]", count: 3 },
      { file: "components/NearIntersectionForm.tsx", cls: "text-[11px]", count: 2 },
      { file: "components/NearIntersectionForm.tsx", cls: "text-[12px]", count: 2 },
      // #289 fidelity F4 (X8): the "MHT PACKAGE" heading — OutputCards' last
      // text-[10px] — is removed.
      // #288 clause 3: 3 -> 2.  The "↓ All (.zip)" control stopped
      // carrying its own Tailwind size — it now takes rule 130's .pri or
      // rule 133's .act, whose sizes live in the sheet.
      { file: "components/OutputCards.tsx", cls: "text-[12px]", count: 2 },
      { file: "components/PlanSaveButton.tsx", cls: "text-[10px]", count: 1 },
      { file: "components/PlanSaveButton.tsx", cls: "text-[12px]", count: 3 },
      { file: "components/PlanSaveButton.tsx", cls: "text-[13px]", count: 3 },
      { file: "components/QuotePanel.tsx", cls: "text-[10px]", count: 11 },
      { file: "components/QuotePanel.tsx", cls: "text-[11px]", count: 2 },
      { file: "components/QuotePanel.tsx", cls: "text-[12px]", count: 4 },
      { file: "components/QuotePanel.tsx", cls: "text-[13px]", count: 7 },
      { file: "components/QuotePanel.tsx", cls: "text-[16px]", count: 1 },
      { file: "components/QuotePanel.tsx", cls: "text-[28px]", count: 1 },
      { file: "components/ScheduleField.tsx", cls: "text-[11px]", count: 2 },
      { file: "components/SheetMeta.tsx", cls: "text-[10px]", count: 1 },
      { file: "components/TieredReference.tsx", cls: "text-[11px]", count: 3 },
      { file: "components/TieredReference.tsx", cls: "text-[12px]", count: 4 },
      { file: "components/TieredReference.tsx", cls: "text-[13px]", count: 1 },
      { file: "components/WorkBeyondShoulderForm.tsx", cls: "text-[10px]", count: 2 },
    ],
  },
  {
    owner: "later round — jurisdiction section (Tailwind literals beside the .jbar rules)",
    css: [],
    tsx: [
      { file: "components/JurisdictionSection.tsx", cls: "text-[10px]", count: 9 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[11px]", count: 7 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[12px]", count: 25 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[13px]", count: 2 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[15px]", count: 1 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[8px]", count: 1 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[9px]", count: 6 }, // #215: +1, the boundary labels (the axis ticks' own size)
    ],
  },
  {
    owner: "later round — the picker modal (#166 sizing)",
    css: [],
    tsx: [
      { file: "components/LocationPickerModal.tsx", cls: "text-[10px]", count: 41 }, // #209: +1, the numeric editor's range alert; #290: -7, the retired work-zone panel (typed length + direction of travel); #290 hand-check: +1, the refused-corridor note; #301 piece 2: -1, the extent panel's "Total" label
      { file: "components/LocationPickerModal.tsx", cls: "text-[11px]", count: 8 }, // #234: +1, the restored-intersection line
      { file: "components/LocationPickerModal.tsx", cls: "text-[12px]", count: 7 }, // #290: +1, the pre-side ruling's sentence on the map (the "drop a pin" overlay's own treatment); #301 piece 2: -2, the per-zone length rows (label + value) — the band's rows are the one speaker
      { file: "components/LocationPickerModal.tsx", cls: "text-[13px]", count: 4 }, // #290: -2, the retired work-zone panel's two inputs
      { file: "components/LocationPickerModal.tsx", cls: "text-[17px]", count: 1 },
      { file: "components/LocationPickerModal.tsx", cls: "text-[9px]", count: 3 },
    ],
  },
];

/** The census figures the arc README quotes — derived from the sources
 *  by the test and asserted equal to these, so the report cannot drift
 *  from the code. `.tr-*` role blocks are counted in cssDeclarations. */
export const CENSUS_PINS = {
  // #289 Phase 2 (s2-arc34) — the band stack.
  //
  // CSS: 91 -> 103 declarations — 101 with the column's controls, plus
  // the verdict strip's text glyph and rule 117's S4 placeholder
  // sentence, both from the 2026-09-22 hand-check.  Ten arrive with the column's controls —
  // eight in the new exception (four of #283's tokens, read rather than
  // re-typed) and two in the debt row's 9.5 px mono micro register.
  //
  // Sizes: 21 -> 24.  Three token NAMES are new to the census
  // (--fs-field-label, --fs-body-value, --fs-primary-xl); --fs-primary
  // was already carried by #288's primary.  No new pixel value enters
  // the sheet, which is the point of #283 having declared the nine
  // ahead of their surfaces.
  //
  // Tailwind: 105 -> 99 sites, 318 -> 296 uses, 36 files unchanged.  The
  // setup panel's section components are deleted (§8.16-§8.19), taking
  // ALL 22 of GeneratorSidebar's utility uses and FlaggerForm's one;
  // two of them MOVED rather than died and are declared in their new
  // files (bands/HandoffNotes.tsx, bands/WhereBand.tsx).  One file
  // leaves the census and two enter it, so the count holds at 36.
  // #253 on top of C's fold: the lockup's 24px declaration left (−1), the
  // strip's glyph 11px arrived (+1, a size already in the sheet) → 102
  // declarations, 19 sizes; C's Tailwind figures unchanged.
  //
  // #273 retires the DetectedVsApplied debt row outright: the block's two
  // value spans dropped `text-[11px]` for one declared register, so two
  // uses, their site and the file leave the Tailwind census (−2 uses,
  // −1 site, −1 file) and the register's single declaration arrives on the
  // CSS side (+1 → 103).  Sizes stay 19: 11px was already in the sheet.
  // Net: two anonymous utilities become one named EXCEPTION (ruled
  // 2026-09-11), and this block carries no declared debt.
  //
  // s2-arc30: the ledger adds ONE declaration — the verdict glyph's
  // cell (.dva-glyph, 11px, into the control-glyph exception) — while
  // the value register keeps its single declaration and changes size
  // (11 → 14) rather than count.  103 → 104.  Sizes stay 19 again: 14px
  // was already in the sheet as sans body copy, and 11px remains on
  // .eyebrow, .chip, .ns-glyph and the rest.
  //
  // s2-arc30 ruling 2026-09-14: the value register is GONE.  The applied
  // value takes `tr-field` (12px, the label's role), so `.dva-val` no
  // longer declares a size and the "detected-vs-applied value register"
  // exception is deleted outright — one fewer entry outside the role
  // table.  104 → 103.  Sizes stay 19: 14px is still sans body copy.
  //
  // #283 (Direction A Phase 0, GO 2026-09-16): role 5 arrives with two
  // declarations — `.workbench .tr-question` and its ≤519px container
  // variant — so 103 → 105.  Both read a `:root` token, so the values the
  // census records are `var(--fs-step-question)` and
  // `var(--fs-step-question-520)`, not pixel strings: 19 → 21 sizes.  The
  // other eight ruled sizes are `:root` custom properties, which the
  // parser excludes by design — that is how they are declared before any
  // surface uses them without the declaration going stale.  Tailwind
  // figures are unchanged: this commit adds no class to any component.
  // #288 Phase 1 (s2-arc33, 2026-09-21): the next-steps strip is DROPPED
  // (Part 1 8.29), and its whole CSS run goes with it — including the one
  // declaration outside the role table, `.workbench .ns-glyph` at 11px,
  // whose debt row above is deleted rather than left to rot.  105 -> 104.
  // Sizes stay 21: 11px remains on .eyebrow, .chip and the rest, so no
  // size leaves the sheet.  NEEDS YOU (this arc's new block) adds NO
  // declaration: its count rides .tr-step and its glyph .tr-field, whose
  // owner token --fs-field-label already names "field label, symbols".
  // #288 rule 88 (2026-09-21): the disclosure row's name declares Inter
  // 500 13px -- one declaration, 104 -> 105.  Sizes stay 21: 13px was
  // already in the sheet at twelve sites, so no size joins the census.
  // #288 Phase 1 clause 1 (2026-09-21): the corrections block MOVED into
  // NEEDS YOU, and the #249 ledger it was dressed as retired with it.
  // Three declarations re-scoped (.jbar-suggest -> .needs-you) and SEVEN
  // deleted -- the ledger's glyph / result / evidence, the record's
  // glyph and sentence, and the picker's two 10px overrides -- because
  // those five now ride the .tr-* roles and the two overrode a scope
  // that no longer exists.  105 -> 98.  Sizes stay 21: 11px and 10.5px
  // both remain elsewhere in the sheet, so no size left the census.
  // #289 hand-check, 2026-09-23, correction 3: the move rows take rule
  // 68's form, so the ledger's VALUE declares the body-value register
  // the fact line already declares — one declaration, 103 -> 104, and no
  // new size (the token was already in the sheet).
  // Correction 1: the second group's chip label — one declaration, and
  // a register already in the sheet.  104 -> 105.
  // #289 S7: the panel's status row — one declaration, at a register the
  // sheet already carries.  105 -> 106.
  // #289 fidelity F1: three declarations where the audit measured none —
  // rule 20's workbench base, rule 88's caret, rules 17–18's symbol
  // treatment.  106 -> 109.  No new size: 13px, 12px and the token are
  // each already in the sheet.
  // #289 fidelity F2: four declarations where surfaces rode a label role
  // that was not theirs (.ny-count, .ny-body, .ny-cite, .disc-count), and
  // six resized in place to Part 2's figures (the card title / format /
  // caption, the ribbon, two suggestion lines).  109 -> 113.  Sizes stay
  // 25: every value the pass writes is already in the sheet.
  // #289 fidelity F5: 113 -> 112 — the strip glyph's own 12.5 px goes
  // (the symbol block carries it); the word and pill re-size to rules
  // 51-52's 11 / 9.5, both already in the sheet.  Sizes stay 25.
  // #289 fidelity F6: two out (FIND's 13.5 override — rule 130's 15.5
  // now reaches it; the generate frame's 380 step-down — rule 131 keeps
  // XL at 380), two in (rule 133's 9.5 on .needs-you .act and .dl-all
  // .act).  112 stays; sizes stay 25.
  // #289 fidelity F7: S7's panel — the status row re-sized in place
  // (10.5), five in: was / → / now at 12.5 and at 380's 11.5, APPLY's
  // 13.5, DISCARD's 13, the deferred phrase's 9.5 at 380.  112 -> 117.
  // #289 fidelity follow-up: rule 165's 380 pill at 8.5.  117 -> 118.
  // After the S4 prod run (Ryan, 2026-09-24): FIND's label back to rule
  // 8's 13.5 token.  118 -> 119; sizes unchanged (the token is in use).
  cssDeclarations: 119,
  // 21 -> 22 at clause 3 (rule 130's var(--fs-primary), new to the
  // sheet), then 22 -> 21 at clause 4: the retired pricing head took
  // 26px with it, and 26px had exactly one site.  The other three sizes
  // it dropped (9, 10, 13) all remain elsewhere.
  // #289 S7: 24 -> 25.  `var(--fs-provenance)` is new to the CENSUS,
  // not to the sheet — the token has been on every provenance line since
  // #283 declared it, and the parser counts token NAMES that appear in a
  // counted declaration.  The panel's status row is the first one
  // outside the role table to read it, because it reserves a height and
  // a shared class would have put that reserve on every provenance line.
  // #289 fidelity F7: 25 -> 24.  That token was never DECLARED — it is
  // not one of #283's nine — so the row rendered the inherited size (the
  // audit's row 161).  The row states rule 95.4's 10.5 px, and the
  // undeclared name leaves the sheet.
  cssSizes: 24,
  // Correction 3 again: the "Applied from picker" BOX is deleted (its
  // sentences are now provenance lines under the WHAT cells they
  // describe), and its one text-[12px] goes with it — one use, one site
  // and one file leave the Tailwind census.
  // #289 fidelity F4: three sites leave — the H1's text-[28px] (sr-only
  // now, no size), the eyebrow's text-[11px], the MHT PACKAGE heading's
  // text-[10px] — and the nav's wordmark row changes class (16 → 14.5),
  // which is one site out and one in.  98 -> 95.
  // #289 fidelity F6: the draft notice's callout (text-[10px] heading,
  // text-[13px] paragraph) becomes one .tr-prov line — two sites leave
  // GeneratorShell.  95 -> 93.
  // #301 piece 2: the modal's per-zone length rows go (the band's rows
  // are the one speaker) — the modal's text-[15px] Total value was its
  // only site of that size in the file.  93 -> 92.
  tsxSites: 92,
  // 320 -> 319 at clause 3 (the zip gave up its own text-[12px] for
  // .pri/.act), then 319 -> 318 at clause 5 (the intro paragraph, and
  // its one text-[14px], dropped under §8.30).
  // #289 fidelity F2: five uses leave for the provenance role (the card
  // spec line's text-[10px], the suggestion's "(OSM tier)" text-[10px],
  // ScheduleField's three faint text-[11px] notes).  No site or file
  // leaves: each file keeps other uses of the same class.  295 -> 290.
  // #289 fidelity F4: the three sites above (3 uses) and two of AppNav's
  // text-[10px] (v0.4, the TA / sheet cell) leave.  290 -> 285.
  // #289 fidelity F6: the draft notice's two and the cta-reason's one
  // (it reads .tr-prov now).  285 -> 282.
  // #215: the hours bar's boundary labels take the axis ticks' text-[9px]
  // (one site already in the census, one more use).  282 -> 283.
  // #209: the picker numeric editor's refusal note ("1–4") takes the file's own
  // text-[10px].  283 -> 284.
  // #234: the picker's restored-intersection line takes the panel's own
  // text-[11px].  284 -> 285.
  tsxUses: 274, // #290: -8 net (the work-zone panel out, the pre-side sentence in); hand-check +1 (the refused-corridor note); #301 piece 2: -4 (the extent rows' Total label and value, a zone's label and value)
  tsxFiles: 35,
} as const;
