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
  {
    name: "page h1",
    sizes: ["28px"],
    reason:
      "the generator page's one h1 (GeneratorShell.tsx)",
    css: [],
    tsx: [
      { file: "components/GeneratorShell.tsx", cls: "text-[28px]", count: 1 },
    ],
  },
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
      { selector: ".workbench .dl-card h3", size: "14px" },
    ],
    tsx: [
      { file: "app/onboarding/page.tsx", cls: "text-[14px]", count: 1 },
      { file: "components/GeneratorShell.tsx", cls: "text-[14px]", count: 1 },
      { file: "components/GeneratorSidebar.tsx", cls: "text-[14px]", count: 1 },
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
      { selector: ".workbench .dl-card .fmt", size: "9.5px" },
      { selector: ".workbench .dl-card .desc", size: "11.5px" },
      { selector: ".workbench .dl-btn", size: "12.5px" },
      { selector: ".workbench .ref-group-label", size: "9.5px" },
      { selector: ".workbench .ref-group-label .ix", size: "11px" },
      { selector: ".workbench .refchip .chip-sum .gl", size: "13px" },
      { selector: ".workbench .refchip .chip-sum .label", size: "13px" },
      { selector: ".workbench .refchip .chip-sum .detail", size: "12.5px" },
      // #288 rule 88 — the disclosure row's name.  Ruled at 13px, which
      // is not one of #283's nine role sizes; declared here with its
      // owner rather than snapped to a role it does not belong to.
      { selector: ".workbench .disc-name", size: "13px" },
    ],
    tsx: [],
  },
  {
    owner: "later round — workbench",
    css: [
      { selector: ".workbench .chip", size: "12px" },
      { selector: ".workbench .field-label-row", size: "12px" },
      { selector: ".workbench .status-bar", size: "13px" },
      { selector: ".workbench .status-bar .pill, .workbench .status-bar .pill.pass", size: "11px" },
      { selector: ".workbench .empty-state", size: "13px" },
      { selector: ".workbench .site-jump", size: "10.5px" },
      { selector: ".workbench .tr-signpost", size: "10px" },
      { selector: ".workbench .zone-tag", size: "10px" },
      { selector: ".workbench .zone-note", size: "10px" },
      // #288 clause 4: the pricing quote became a rule-87 disclosure row
      // (Part 1 §8.11), so its bespoke head retired and these four rows
      // are DELETED rather than moved — the row's own treatment carries
      // the type now.  26px leaves the sheet with them; 9px, 10px and
      // 13px all remain elsewhere.
      { selector: ".workbench .device-table .jr-tag", size: "8.5px" },
      { selector: ".workbench .stale-ribbon", size: "12.5px" },
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
      { selector: ".workbench .jbar-readonly .jbar-slot-hint .term", size: "11px" },
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
      { selector: ".workbench .jbar-suggest .sugg-row", size: "11.5px" },
      { selector: ".workbench .jbar-suggest button.confirm, .workbench .jbar-suggest button.ghost", size: "10px" },
      { selector: ".workbench .jbar-suggest .honesty", size: "9.5px" },
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
      { file: "components/AppNav.tsx", cls: "text-[10px]", count: 6 },
      { file: "components/AppNav.tsx", cls: "text-[16px]", count: 1 },
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
      { file: "components/FlaggerForm.tsx", cls: "text-[10px]", count: 1 },
      { file: "components/GeneratorFormPrimitives.tsx", cls: "text-[10px]", count: 2 },
      { file: "components/GeneratorShell.tsx", cls: "text-[10px]", count: 1 },
      { file: "components/GeneratorShell.tsx", cls: "text-[11px]", count: 1 },
      { file: "components/GeneratorShell.tsx", cls: "text-[12px]", count: 1 },
      { file: "components/GeneratorShell.tsx", cls: "text-[13px]", count: 1 },
      { file: "components/GeneratorSidebar.tsx", cls: "text-[10px]", count: 10 },
      { file: "components/GeneratorSidebar.tsx", cls: "text-[11px]", count: 4 },
      { file: "components/GeneratorSidebar.tsx", cls: "text-[12px]", count: 3 },
      { file: "components/GeneratorSidebar.tsx", cls: "text-[13px]", count: 3 },
      { file: "components/GeneratorSidebar.tsx", cls: "text-[15px]", count: 1 },
      { file: "components/GeneratorSidebar.tsx", cls: "text-[9px]", count: 1 },
      { file: "components/LaneClosureForm.tsx", cls: "text-[10px]", count: 3 },
      { file: "components/MobileOp2LaneForm.tsx", cls: "text-[10px]", count: 2 },
      { file: "components/MobileOpMultilaneForm.tsx", cls: "text-[10px]", count: 3 },
      { file: "components/NearIntersectionForm.tsx", cls: "text-[11px]", count: 2 },
      { file: "components/NearIntersectionForm.tsx", cls: "text-[12px]", count: 2 },
      { file: "components/OutputCards.tsx", cls: "text-[10px]", count: 2 },
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
      { file: "components/ScheduleField.tsx", cls: "text-[11px]", count: 5 },
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
      { file: "components/JurisdictionSection.tsx", cls: "text-[10px]", count: 10 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[11px]", count: 7 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[12px]", count: 25 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[13px]", count: 2 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[15px]", count: 1 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[8px]", count: 1 },
      { file: "components/JurisdictionSection.tsx", cls: "text-[9px]", count: 5 },
    ],
  },
  {
    owner: "later round — the picker modal (#166 sizing)",
    css: [],
    tsx: [
      { file: "components/LocationPickerModal.tsx", cls: "text-[10px]", count: 47 },
      { file: "components/LocationPickerModal.tsx", cls: "text-[11px]", count: 7 },
      { file: "components/LocationPickerModal.tsx", cls: "text-[12px]", count: 8 },
      { file: "components/LocationPickerModal.tsx", cls: "text-[13px]", count: 6 },
      { file: "components/LocationPickerModal.tsx", cls: "text-[15px]", count: 1 },
      { file: "components/LocationPickerModal.tsx", cls: "text-[17px]", count: 1 },
      { file: "components/LocationPickerModal.tsx", cls: "text-[9px]", count: 3 },
    ],
  },
];

/** The census figures the arc README quotes — derived from the sources
 *  by the test and asserted equal to these, so the report cannot drift
 *  from the code. `.tr-*` role blocks are counted in cssDeclarations. */
export const CENSUS_PINS = {
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
  cssDeclarations: 93,
  // 21 -> 22 at clause 3 (rule 130's var(--fs-primary), new to the
  // sheet), then 22 -> 21 at clause 4: the retired pricing head took
  // 26px with it, and 26px had exactly one site.  The other three sizes
  // it dropped (9, 10, 13) all remain elsewhere.
  cssSizes: 21,
  tsxSites: 106,
  // 320 -> 319: the zip control gave up its own text-[12px] for .pri/.act.
  tsxUses: 319,
  tsxFiles: 36,
} as const;
