# Arc 16 — polish trio (#200 + #201 + #166), 2026-08-14

The final authored arc. Audit authority: `conestruct/site/DESIGN-SPACING.md`
(six steps: micro 4 / hairline 6 / tight 8 / row 12 / block 16 / section 24).
Branch `issue-200-polish-trio` cut from `8f2f7fa` (origin/main tip, gate-
verified equal to healthz at session start).

## Scope map (all three claims still-live at 8f2f7fa)

- **#200 named instance** — Road is the only Flagger section interleaving
  `Field` rows with bare `CheckRow`s (`FlaggerForm.tsx:96-301`): the run was
  entered at 24px+rule (`mb-3` + check-row `padding-top:12`) but exited at
  12px+rule (Field margins are bottom-only). The same seam exists in
  NearIntersectionForm's Cross-street section (:379→:388). FlaggerForm has
  zero off-scale declarations of its own; the asymmetry was structural.
  Only post-audit commit touching the file (`a14d84a`) moved no spacing.
- **#201** — strips pooled: DOM order was select (:199) → chips (:229) →
  `SuggestSlot` (:275) → `ClassSuggestSlot` (:285), no CSS reordering
  (`globals.css` `.jctl` block). Issue's ~:382/~:541 refs were drifted
  (near strip copy, not render sites). Pooling dated to `7eae8d5` (#152 C).
- **#166** — modal held **150** spacing decisions (issue estimated ~93),
  **38 off-scale**; `px-5` (20px, ×20) was its de-facto gutter vs the
  page's 24px. `2aacf30` (#165) never touched the file, per the doc's
  explicit carve-out. Post-audit commits moved no spacing lines.

## Audit totals (static inventory at 8f2f7fa; Tailwind classes are
deterministic px, globals.css read directly)

| surface | swept | on-scale | off-scale |
|---|---|---|---|
| Governed components (28 files) | 386 | 341 | 45 |
| globals.css (generator scope) | 125 | 74 | 36 (+11 exception-covered, 4 functional) |
| **Governed total** | **511** | **415** | **81** |
| LocationPickerModal (doc-deferred) | 150 | 112 | 38 |

Files swept: sandbox route → GeneratorShell and its full transitive
composition (AppNav, PlanSaveButton, AppSheetMeta, GeneratorSidebar,
SetupStrip, StatusBar, OutputCards, QuotePanel, PricingCard, ResultsHero,
AuditTrail, ReferenceChip, DeviceBreakdown, AppFooter, DebugSnapshotButton,
JurisdictionSection, GeneratorFormPrimitives, the seven scenario forms,
SiteConditionsField, ScheduleField, ZoneChannelSwatch, LocationPickerModal)
plus `app/globals.css`. No inline style margins/paddings exist in the tree;
the modal's one inline padding object is a Mapbox fitBounds camera option.

## Fixes landed (this branch)

**`0df259e` (Refs #200)** — junction rule
`.check-row + :not(.check-row) { margin-top: 12px }` (globals.css, base
layer) makes both run boundaries 24px+rule; heals Flagger Road and the NI
cross-street seam. Five unambiguous visible deviations onto their tokens:
generate footer `pt-5 pb-7`→`pt-6 pb-6` (section), scenario-picker
`pb-5`→`pb-4` (block, both render paths), quote-settings `mb-5`→`mb-4`
(block), delta-legend `gap-5`→`gap-4` (block), `.empty-state` 32px inset-y
and margin → 24px (section). Fixture `spacing-scale.test.tsx`: static CSS
guard paired with a mounted binding assertion (arc12 vacuous-guard lesson).

**`1091d05` (Refs #200)** — micro-delta batch (ruled in-arc at the GO), the
~40 governed 1–3px deviations, each citing its token; enumerated in the
commit body. The `.check-list` desc-indent calc and comment track the
check-row gap 10→8.

**`3a6943a` (Refs #201)** — each strip inside its subject's `.jctl-field`;
props/handlers/copy byte-identical. `.jctl .jbar-suggest` re-derived:
x-padding 14→0 (inherits the field's 14px inset — text alignment
unchanged), `margin-top: 12px` (row) from the control. Stated churn: the
dashed separator spans field content, not full section width. Fixture
`JurisdictionSection.placement.test.tsx` (shared-field + DOM-order + not-
pooled). Predicted DOM-order test churn did not fire — all 32 existing
jurisdiction/class-suggest tests pass unmodified.

**`35fe037` (Refs #166)** — all 38 modal values mapped by role (gutter
px-5→px-6 section; candidate cards py-2.5/px-3.5→py-2/px-3 tight×row —
the one new role, documented; mini-CTAs px-2.5→px-2 tight; 1–2px oddities
→ micro; `-mt-1` stays, negative at on-scale magnitude). DESIGN-SPACING.md
modal exception replaced with a modal section. Guard
`LocationPickerModal.spacing.test.ts`: full-file token scan, off-scale =
failure, non-vacuous floor of 100+ extracted tokens.

## Churn table (Rule 5 — every visibly-moving surface)

| surface | movement |
|---|---|
| Flagger Road seam (+ NI cross-street) | +12px above the field that follows an armed confirm row |
| generate footer | inset 20/28 → 24/24 |
| scenario picker | block bottom 20 → 16 |
| quote-settings grid | trailing gap 20 → 16 |
| jurisdiction delta legend | item gap 20 → 16 |
| "Generating…" empty state | inset-y/margin 32 → 24 |
| suggestion strips (the headline) | reposition: each under its subject control; dashed separator spans field content |
| picker modal | gutters 20 → 24 on every full-width strip; candidate cards −2px per side; micro nudges 2→4 |
| micro batch | 1–3px across pills/tables/strips per the commit body — no user-visible movement |

Chrome (nav/footer/sheet-meta/page frame) deliberately does not move —
parked below. Wire changes: none. Deploy: frontend-only via ship.ps1.

## Triage candidates (parked at the GO — the ten doc ambiguities,
recorded verbatim for post-sequence triage)

1. **Chip padding contradiction**: doc assigns chip padding-y to micro
   (4px); shipped base `.chip` is `8px 12px` and workbench override
   `9px 6px`. One of doc-role or shipped-base is wrong.
2. **App chrome uncovered**: AppNav, AppSheetMeta, AppFooter,
   PlanSaveButton have no role row; their gutters (px-5, gap-8, px-10,
   gap-5) are off-scale. Are they "the generator page"?
3. **Control insets uncovered**: no doc role for input padding
   (`.field-input` 10×12, selects) or button padding (generate CTA,
   dl-btn, confirm CTAs).
4. **`.ref-stack` gap 7px**: blocks-in-zone (block 16, Δ−9) or an
   undocumented chip-stack density (Δ−1)? Doc doesn't say.
5. **FieldGroup header→content = 16px** where "section header → content"
   prescribes row 12 (low confidence; the 16 doubles as content inset).
6. **Exception 3 scope**: titled `.jbar-slot-*`, body says "any `.jbar`
   padding"; `.jbar-main`/`.jbar-suggest` covered only under the broad
   reading, and `.jctl-*` mirrors several rules with no cover at all.
7. **Eyebrow 10px**: marketing `.eyebrow` gap replicated inline on the
   generator eyebrow — brand consistency vs scale, unadjudicated.
8. **Negative margins / 1px values** (`-mt-1`, `mt-px`, `.jr-tag` 1px)
   have no doc treatment (the modal section now covers negatives for the
   modal only).
9. **Page outer gutter ungoverned**: `<main>` `px-10 pt-8 pb-20`; the
   `max-md` variants are on-scale, suggesting desktop predates the doc.
10. **Dense tabular rows outside QuotePanel**: jurisdiction hours rows
    (`py-0.5`), `.audit-body table` (6×10), `.device-table` (10×14) use
    densities the doc only excepts for QuotePanel.

## claude/* branch dispositions (side task, ruled: delete — janitorial)

All three superseded; the #97 repoint (`ba0439e`) is the branches'
merge-base, already an ancestor of main — no distinct citation claim
exists on any of them.

- `origin/claude/epic-gates-044hei` (tip `6928534`): one-line uv.lock
  ruff `>=0.8`→`==0.15.11` — identical change on main via `69b42ee`
  (uv.lock:2604, matching pyproject.toml:34). **Superseded.**
- `origin/claude/youthful-keller-pvu25s` (tip `40e806d`): the same
  one-line uv.lock change. **Superseded by `69b42ee`.**
- `origin/claude/youthful-keller-flpryf` (tip `2b18522`): adds an
  892-line `sweep_analysis.py` cloud-sandbox harness (hardcodes
  `/home/user/conestruct`); function covered by the committed
  validation-artifacts dump/compare tooling and cross-surface tests.
  **Superseded in function, stale in form.**

Deletion rides post-ship janitorial per the GO; recorded here so the
dispositions survive the branches.

## Suites at the branch tip

- Frontend `npm test`: **631 passed (0 failed)** — 626 baseline + the 5
  new fixture tests. ESLint + tsc green on every commit (pre-commit hook).
- Live-check scope (post-ship, per GO): Playwright computed-style spot
  measurements (junction symmetry, strip adjacency, modal gutter 24px,
  the five normalizations), axe on generator + open modal (Arc 7
  zero-violation baseline), grayscale pass on the moved strips. No PDF
  leg — nothing governed there.
