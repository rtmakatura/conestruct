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
export const ROLE_CLASSES = ["tr-section", "tr-step", "tr-field", "tr-prov"] as const;

export const TYPE_EXCEPTIONS: readonly TypeException[] = [
  {
    name: "detected-vs-applied value register",
    sizes: ["11px"],
    reason:
      "the block's two value columns (#273) — a VALUE register, not a label. Ruled 2026-09-11: this goes in the exception set rather than becoming a fifth `tr-*` role, because #226's four roles are a LABEL vocabulary and widening that table would weaken what the four roles mean. One declared register for both columns, so ink is the only axis between detected and applied. Retires this file's former `components/DetectedVsApplied.tsx text-[11px] ×2` debt row",
    css: [{ selector: ".workbench .dva .dva-val", size: "11px" }],
    tsx: [],
  },
  {
    name: "hero numerals",
    sizes: ["76px", "60px"],
    reason:
      "the results hero's big figures (76 at desk, 60 in the ≤480 query) — display numerals, not a label register",
    css: [
      { selector: ".workbench .hero-cell .num", size: "76px" },
      { selector: ".workbench .hero-cell .num", size: "60px" },
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
    sizes: ["9px"],
    reason:
      "single-glyph controls (the strip's edit pencil, the citation ✓) — a glyph cell, not text",
    css: [
      { selector: ".audit-body .citation .check", size: "9px" },
      { selector: ".workbench .setup-strip .sv .edit-ic", size: "9px" },
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
      { selector: ".workbench .price-head .k", size: "10px" },
      { selector: ".workbench .price-head .fyi", size: "9px" },
      { selector: ".workbench .price-head .total", size: "26px" },
      { selector: ".workbench .price-head .total.unset", size: "13px" },
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
      { selector: ".workbench .hero-cell .k", size: "10px" },
      { selector: ".workbench .hero-cell .sub", size: "12px" },
      { selector: ".workbench .hero-meta .caseid", size: "12px" },
      { selector: ".workbench .hero-meta .row", size: "11.5px" },
    ],
    tsx: [],
  },
  {
    owner:
      "B — the next-steps strip (#253): the glyph cell's 11px is the one size CHOSEN per spec 17 (a glyph, not text; the label, index, name and count ride .tr-section / .tr-step / .tr-field)",
    css: [{ selector: ".workbench .ns-glyph", size: "11px" }],
    tsx: [],
  },
  {
    owner: "A — the corrections block (#254/#255)",
    css: [
      { selector: ".workbench .jbar-suggest", size: "10.5px" },
      { selector: ".workbench .jbar-suggest .sugg-row", size: "11.5px" },
      { selector: ".workbench .jbar-suggest button.confirm, .workbench .jbar-suggest button.ghost", size: "10px" },
      { selector: ".workbench .jbar-suggest .honesty", size: "9.5px" },
      { selector: ".workbench .jbar-suggest .site-correction-reasons legend", size: "11.5px" },
      { selector: ".workbench .jbar-suggest .reason-chip", size: "10px" },
      { selector: ".workbench .jbar-suggest .site-correction-note", size: "12px" },
      { selector: ".workbench .jbar-suggest .sc-grid .sc-glyph", size: "12px" },
      { selector: ".workbench .jbar-suggest .sc-grid .sc-result", size: "11px" },
      { selector: ".workbench .jbar-suggest .sc-grid .sc-evidence", size: "10.5px" },
      { selector: ".workbench .jbar-suggest .sc-grid .sc-record .sys-glyph", size: "12px" },
      { selector: ".workbench .jbar-suggest .sc-grid .sc-disclosure", size: "12px" },
      { selector: ".workbench .jbar-suggest .sc-picker .site-correction-reasons legend", size: "10px" },
      { selector: ".workbench .jbar-suggest .sc-picker .reason-chip", size: "10px" },
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
      { file: "components/OutputCards.tsx", cls: "text-[12px]", count: 3 },
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
  cssDeclarations: 103,
  cssSizes: 19,
  tsxSites: 106,
  tsxUses: 320,
  tsxFiles: 36,
} as const;
