# s2-arc26 — bucket C: the download cards (#261), the audit-row grid (#225), zone 3's heading and ledger (#235-C)

Branch `batch-c-cards` off `main 224feb9` (= origin/main; prod healthz == `a88caad`
at the start — `224feb9` is the DESIGN-PRINCIPLES docs commit above the prod tip).
GO: Ryan's ruling of 2026-09-09 against 📋 checkpoint C — every recommendation
adopted, plus cross-bucket rulings 2 and 3. **Frontend-only: no file under `src/` or
`tests/`; containment, the expectation JSON, the citation counter (19) and every
payload sender are untouched.**

## The rulings recorded (GO.md, verbatim)

- Bucket C — *(1) Fourth card: `.dls { grid-template-columns: repeat(4,1fr) }` at 1440,
  `1fr` ≤980; `.dl-actions` row `margin-top:auto; display:flex; gap:8px`, crew PDF + .md
  side by side → every card one 40 px row, tops/bottoms equal ±1. Audit card
  `{title:"Audit trail", spec:"EVERY CHECK CITED", format:"PDF", qtyLbl:"checks", qty:
  ledger.checked}`; `RenderKind` + `"audit-pdf"`; `RENDER_LABELS["audit-pdf"] = "audit
  PDF"` — the band object relocates **byte-identical**; tier link + handler removed. (2)
  Ledger line deleted with both refresh strings; chips stay; #187 cue = one `tr-prov`
  "◌ previous answer — refreshing…" in a reserved-height slot. (3) #235 re-scope comment
  as drafted — Ryan posts it. (4) Header stays "MHT PACKAGE · 4 FILES" until B's commit
  7 (ruling 2).*
- *#225: `.check-list { max-width:none }`, `.check-list-item { grid-template-columns:
  24px minmax(0,1fr) 200px }` (200 CHOSEN from 29 ch; browser leg corrects to measured
  `scrollWidth` — record the measured value), `.check-list-src { justify-self:end;
  text-align:right }`; ≤480 src wraps under the label. Serves the plan-flags dropdown
  AND section 03 (both use the class; no TSX).*
- *#261 502 case: qty "not generated", every button disabled; loading → reserved-height
  empty qty line. `h4` → `h3`. `:2865` `#fff` → `--ink-bright` (from D's slice).*
- **Ruling 2** — *Chip 3 vs the OutputCards caption. C keeps "MHT PACKAGE · 4 FILES"
  (true today, from `BUNDLE_PART_KINDS`). B's #253 commit 7 changes the caption to "MHT
  PACKAGE" (numeral dropped) in the same commit chip 3 lands — one voice, in shipping
  order. Declared in both READMEs.* → The caption is `MHT PACKAGE · ${BUNDLE_PART_KINDS.length}
  FILES` on this branch, measured "MHT PACKAGE · 4 FILES" (C1). The audit PDF is not
  in the zip (`render-proxy.ts:394-398`), so the numeral stays true.
- **Ruling 3** — *D's seven `#fff` literals outside its ranges are swapped by their
  owners (… C :2865 …) — each owner cites `--ink-bright` from D, so D's commit 5 (the
  token) ships first among the four.* → **Hand-off pending D's slice:** `.workbench
  .dl-card h3` (renamed from `h4`, `globals.css`) still carries `color: #fff` with a
  comment naming the hand-off; `--ink-bright` does not exist on this branch and was
  not added (the orchestrator's instruction). The swap is the rebase commit's.

## What shipped (branch tip `e363d98`)

| commit | what |
|---|---|
| `3256e49` | **#225** — `.check-list { max-width: none }`, `.check-list-item { grid-template-columns: 24px minmax(0, 1fr) 200px }`, `.check-list-src { justify-self: end; text-align: right }`, ≤ 480 px the annotation takes column 2 under the label. `check-list-grid.test.ts`: static half pins the rules (4 of 5 CSS cases red on the old stylesheet), markup half proves StatusBar's rows and AuditTrail's `CheckRow` both emit the three-cell row. |
| `a5ba323` | **#261a** — every card ends in one `.dl-actions` row (`margin-top: auto; display: flex; gap: 8px`; `.dl-actions .dl-btn { margin-top: 0; flex: 1 1 0 }`; 44 px at ≤ 480); the crew card's PDF + .md side by side in it; a 400's message and the unsaved-edits note print above the row (P1, declared); `h4` → `h3` + selector. 5 new cases red on HEAD. |
| `7518d71` | **#261b** — the fourth card `{Audit trail · EVERY CHECK CITED · PDF · N checks}`; `RenderKind` + `"audit-pdf"`; `RENDER_LABELS["audit-pdf"] = "audit PDF"` (byte-identical to the string `TieredReference.tsx:158` passed to `beginRender`); `EXT` `"audit.pdf"` = `auditFilename`'s suffix; `auditChecked` from the shell (`assignTiers(...).ledger.checked` over the stamped audit + loaded jurisdiction block — TieredReference's own inputs); null → empty quantity line, button disabled; `.dls` `repeat(4, 1fr)` / `1fr` ≤ 980; TieredReference's handler, state, link and two imports removed. 10 cases red across three suites. |
| `f30782e` | **#261c** — no "…" / "—": `statFromBreakdown` → number or null (empty line, reserved height); `failed` = breakdown error → every card "not generated", every button disabled, saved anchors `aria-disabled`. 4 cases red, incl. the text-node walk over `.dl-card .desc` in nine states (no "—", "…", "done"). |
| `3a7673c` | **#235-C** — inner `<h2>` → `<div class="tr-section">`, informational `<p>` → `tr-prov`; the ledger `<p>` deleted with "◌ checking against the updated inputs…", "(refreshing…)" and the first-load "computing…"; `.tier-cue` slot (15 px, always in the flow) carries one `tr-prov` "◌ previous answer — refreshing…" while a refetch holds the previous answer; `ledgerLine` stays in `lib/tiering.ts`. 17 cases red across seven suites; `tiered-test-utils.expectChipLedger` reads the chips against the shared expectation. |
| `e363d98` | **#261, measured** — `.dl-actions .dl-btn:not(:only-child) { padding-left/right: 4px; gap: 4px }`: the browser leg caught the crew pair wrapping to 60 px at the 266 px card (tops 1557/1557/**1537**/1557). One rule + one pin; declared. |
| this | **evidence** — this README, `s2a26-lc.js`, `outLocal/`. |

## The live check (`s2a26-lc.js`, `outLocal/`) — ALL PASS 24/24

The dev server on this branch at **`e363d98`** (port 3003) proxying to the deployed
Modal backend; healthz gate **`a88caad9d6e2dfac20d5559eb2c4211d28203751` == expected,
PASS** (B1). Pin 39.74507, −104.96347 (the #225 reproduction: ~50 m off a classified
road → the OSM soft check), bearing 180, 1,000 ft. 1440×1000 and 380×800. No Denver
refusal in the recorded run (a first run on the dirty tree saw none either; the
retry-once branch is in the harness and was not exercised). `log.txt`, `results.json`,
per-leg JSON and PNGs are in `outLocal/`. Every figure below is from the run at
`e363d98`.

| leg | 1440×1000 | 380×800 |
|---|---|---|
| C1 four cards | 4 cards [Plan sheet, Device list, Crew instructions, Audit trail]; header "MHT PACKAGE · 4 FILES"; h3 ×4, h4 0; qty ["37 devices", "11 types", "11 steps", "13 checks"] | same |
| C2 one edge (P4) | first-button tops **[1537, 1537, 1537, 1537] spread 0**; bottoms **[1577 ×4] spread 0**; row bottoms spread 0; `.dl-actions` last child ×4; crew pair side by side (743..855 / 863..975 @ 1537); heights [40 ×5]; cards 266 px ×4 | stacked (each card below the previous); row bottom-anchored (card bottom − 16 = row bottom ± 1: 2370/2369, 2540/2539, 2710/2709, 2879/2878); crew pair side by side; **heights [44 ×5] ≥ 44** (P10); widths 332 ×4 |
| C2 buttons live | 5/5 enabled, one class `dl-btn` | same |
| C3 audit PDF through the card | download received **"plan.audit.pdf"** (9,301 bytes, `%PDF-1.4`); band objects in flight **["audit PDF"]** and nothing else; button live after | "plan.audit.pdf" (9,310 bytes); ["audit PDF"] |
| C4 one heading, no ledger (P5/P2) | headings inside the tiers 0; the zone's h2 ["Rules, permit & audit"] alone; section label `<DIV class="tr-section">` "Plan reference" (no jurisdiction key at this pin); ledger element false, ledger copy false, "checking against" false, "(refreshing…)" false; cue slot "" h 15 (min 15, lh 15); no audit link in the tier; chips Changed 1 · Needs attention 2 · Checked 13 · Pending 1 | same (Needs attention 2) |
| C5 axe | **heading-order 0**; full wcag set 0 (baseline 0) | **heading-order 0**; 2 nodes (baseline 4): `scrollable-region-focusable[.gap-8]`, `target-size[.strip-edit-all]` — both named; none new |
| C6 strip dropdown (P4/P6) | 4 rows: FIX INPUTS right 1253 (w 68), **OSM GROUND-TRUTH (SOFT CHECK) right 1253 (w 197, 2 label lines)**, CDOT S-630-1 right 1253 (w 82), MANUAL HANDLING right 1253 (w 102) — **one right edge, spread 0**; list 1066 px; tracks "24px 826px 200px" | 4 rows, every annotation under its label (srcTop > lblTop: 488/458, 686/521, 772/719, 858/805); tracks "24px 266px" |
| C6 longest annotation | "OSM GROUND-TRUTH (SOFT CHECK)" natural width **197 px** at 10 px mono (offscreen row, real style); the run was at the chosen 200 — **the gutter is pinned at the measured 197 by ruling** (rebase fold, below) | 197 |
| C6 section 03 | 4 lists, 13 rows; per list spread 0, right 1253 = list right ×4; max annotation scrollWidth 200 | 4 lists, 13 rows; under-label 13/13 |
| C7 contrast | tr-section #ffffff/#14202e **16.46** (10 px/500); tr-prov #93a0b0/#14202e **6.19** | same |
| C8 the #187 cue | an Edit Speed → 35: cues seen in flight **["◌ previous answer — refreshing…"]**, band "after an edit to speed"; after the settle the slot is "" at 15 px; never "(refreshing…)" / "checking against" | same |

**A finding, not a defect (Rule 12, recorded as instructed):** section 03 carries
annotations longer than #225's longest — five S-630-1 cites of 48–49 ch ("CDOT S-630-1
(July 2026) Sheet 2, General Note 8" and kin, ~330 px natural). They wrap to two lines
inside the 200 px gutter, right-aligned, right edge 1253 with the rest. The gutter was
**not** widened to them: at 330 px the message track would give up 130 px on every row
for five cites, and P6 says the content wraps inside its cell. If Ryan wants those cites
on one line, a ≥ 1200 px query widening the gutter is a one-rule follow-up.

**A second finding:** with `repeat(4, 1fr)` the card is 266 px at 1440 and each
shared-row button 112 px; the pair fits at the 4 px inset (107 px needed). Between
981 and ~1400 px the pair wraps to 60 px again (tops differ, bottoms hold). The
ruled breakpoints are 1440 and ≤ 980; an intermediate two-column step is not in the
plan and is left for a ruling.

## Rule-5 churn — actual vs predicted

| predicted (checkpoint C) | actual |
|---|---|
| `OutputCards.test:69,118` → `toHaveLength(4)`, 3 "Download PDF" | as predicted |
| `OutputCards.test:97,105-106` → empty qty / "not generated", disabled | as predicted (the one case became four: loading, failed, failed-saved anchors, the nine-state text-node walk) |
| `OutputCards.test:163-168,185` → `/api/plans/plan-1/audit-pdf`; signup links 4 | as predicted |
| `OutputCards.test:88` unchanged "MHT PACKAGE · 4 FILES" | unchanged |
| `WorkingBand.render.test:168-173` → click the 4th card; object "audit PDF" | as predicted |
| `AuditTrail.declined-stale.test:158-159,179,197-198` → disabled audit `.dl-btn` in zone 2; "previous answer — refreshing…" | **deviation in wording:** under the declined (400) plan no card renders at all (#258's gate — the empty state alone), so that case pins "no Audit PDF control anywhere"; the 5xx case pins the disabled fourth-card button with an empty count; the cue as predicted. The suite now mounts the real OutputCards. |
| `JurisdictionSection.density:40-48`, `JurisdictionSection.test:34`, `TieredReference.corrections:82,111`, `fixtures:67`, `scan-rows:122,135`, `site-scan:82,108` → chip numerals equal `ledger.*` | as predicted, through `tiered-test-utils.expectChipLedger` (a non-zero count must render its chip; every rendered numeral equals the pin; no ledger element or copy). Density gains two cases (roles / no heading; the cue slot). |
| `GeneratorShell.class-stability`, `lib/tiering.test`, `scan-refusal.test` untouched | 0 |
| pytest / snapshots / payload senders untouched | 0 — no file under `src/` or `tests/`; `lib/tiering.ts`, `lib/working-band.ts`, `WorkingBand.tsx`, `AuditTrail.tsx`, `StatusBar.tsx`, `PricingCard.tsx` untouched |

**Unpredicted churn (declared):**
1. **Eleven GeneratorShell suites + `test-fixtures.ts`** (`a11y-announce`, `a11y-focus`, `bundle-settings`, `handoff-provenance`, `kind-switch`, `near-intersection`, `picker-reapply`, `post-generate-scroll`, `saved-dirty`, `zone-staging`, `regenerate-mounted`): they mock zone 3 away and answered `/api/render/audit` with `{}` — a shape the wire never carries. The shell now derives the audit card's count from the settled audit (`assignTiers` reads `sections` and `pending_verification`), so those suites answer with `MIN_AUDIT` (`sections: {}`, `pending_verification` zeroed) — one branch each before the default. No assertion changed.
2. `e363d98` — the shared-row inset rule + its pin (found by measurement, above).
3. `.workbench .dl-card .desc .qty { display: block; min-height: 1.45em }` — the reserved-height quantity line (P1) the plan's "reserved-height empty qty line" implies; and the ≤ 480 `.dl-actions .dl-btn { min-height: 44px }` (P10) the plan's "44 px at 380" implies.
4. `check-list-grid.test.ts` carries a markup half (StatusBar + CheckRow) beside the CSS half — Rule 11, so the static pin cannot rot.
5. `mountTiered` gains an optional `extra` props argument (the cue case needs `revalidating`).
6. `GeneratorShell.tsx` imports `settledData` (from `./AuditTrail`) beside `assignTiers` — the plan said "one prop + `assignTiers` call"; the settled-audit accessor is the same one TieredReference uses.
7. `.dls` `repeat(4, 1fr)` landed in commit 3 with the fourth card rather than commit 2, so no commit ships a three-card grid with an empty column.
8. Stale comments naming "(refreshing…)" remain at `AuditTrail.tsx:144, 651`, `GeneratorShell.tsx:863`, `GeneratorShell.regenerate-mounted.test.tsx:10` — comments only, in files outside the edit or untouched by this arc; left for the rebase or a docs pass.

**For D's type census (rebase note):** `globals.css` — `.workbench .dl-card h4` **renamed** to `.workbench .dl-card h3` (14 px, unchanged size); `.workbench .tier-ledger` (11 px) and `.tier-ledger b` **removed**; **added** `.workbench .tier-cue` (no font-size; line-height 15 px), `.workbench .dl-card .desc .qty`, `.workbench .dl-actions`, `.workbench .dl-actions .dl-btn`, `.workbench .dl-actions .dl-btn:not(:only-child)`, the ≤ 480 `.dl-actions .dl-btn` min-height — none carries a font-size; `.check-list*` edits carry no font-size change. Components — `TieredReference.tsx` **removed** `text-[20px]` (the h2), `text-[10px]` (the informational p → `tr-prov`), `text-[11px]` (the deleted audit link); `OutputCards.tsx` adds and removes no `text-*` class (the two `text-[12px]` notes moved above the row, count unchanged).

## Contracts

- #198 honoured (no string of it touched). Rail #228 n/a. Suggest-never-set n/a.
- Rule 3: `assignTiers` is the ruled mapping with a Python mirror (`tier_ledger.py`); the shell calls it, it does not re-derive. No MUTCD math in the frontend.
- Rule 10: "not generated" + every button disabled under a breakdown failure; an audit that has not settled shows an empty line and a disabled button, never a placeholder.
- Rule 12: 4 ← `BUNDLE_PART_KINDS.length`; N checks ← `ledger.checked`; 200 px chosen, then measured (197 for the #225 annotation; the S-630-1 cites wrap — finding above); 4 px inset chosen from the 121-vs-112 measurement.
- Rule 13 unchanged; `tr-section` 16.46, `tr-prov` 6.19 measured on the surface.
- **Payload senders:** the audit-PDF POST body `{ scenario }` relocated byte-identical from `TieredReference.tsx:160-164` to `OutputCards.onPublicDownload` (`JSON.stringify({ scenario: mode.scenario })` — the same `wireScenario` object the tier sent). Senders after this arc: **`OutputCards` → `/api/render/audit-pdf`** (public) and **`app/api/plans/[id]/audit-pdf/route.ts` → `proxyRender(id, "audit-pdf")`** (saved rows, the card's anchor). No other body changed.
- **Band rules byte-identical:** `lib/working-band.ts` and `WorkingBand.tsx` untouched; `"audit PDF"` relocated verbatim (C3: the object observed in flight).
- Write-lock: the audit button keeps `data-write`; the saved anchors take `lockedAnchorProps(locked || failed)`.
- Spec 31 untouched. Expectation JSON, containment, citation counter 19 untouched. `getByText` direct text nodes honoured.
- Ruling 2 (caption) and ruling 3 (`#fff` hand-off) recorded above.

## Principles (DESIGN-PRINCIPLES.md)

| P | status | where |
|---|---|---|
| P1 | honoured | the `.tier-cue` slot is always in the flow at 15 px (`globals.css` `.workbench .tier-cue`; C4/C8 measured 15 before and after); `.desc .qty` keeps its height empty (`OutputCards.tsx` DlCard); the note prints above the action row so the edge never moves (`OutputCards.tsx` `note`, declared) |
| P2 | honoured | the ledger line deleted; the chips are the one voice (C4); the audit card and the ✓ chip read the same `ledger.checked` (13 = 13, C1/C4); the strip caption stays true under ruling 2 |
| P3 | n/a | |
| P4 | honoured, measured | first-button tops spread 0, bottoms spread 0, row bottoms spread 0 at 1440 (C2); `.check-list-src` right 1253 for every row of the dropdown and of every section-03 list (C6); at 380 the rows stack on one left (C2) |
| P5 | honoured for the heading; h3 off-role declared | one h2 per zone (C4/C5 heading-order 0); the inner label is `tr-section`; the card's `h3` and the audit `spec` line are text nodes off the four roles — declared to D (`globals.css` `.dl-card h3`, `OutputCards.tsx` `.desc` spec span) |
| P6 | honoured | `.check-list-item` message track `minmax(0, 1fr)` (`globals.css`); the 48-ch cites wrap inside the 200 px gutter (C6 finding) |
| P7 | n/a | |
| P8 | honoured | the first-load "computing…" went with the ledger — the band is the one working voice (C3/C8: the band object observed, nothing else spoke) |
| P9 | honoured | the cue is ◌ + words; "not generated" is a word; the disabled treatment is the one `.dl-btn:disabled` rule (`globals.css`) |
| P10 | honoured, measured | every `.dl-btn` 44 px at 380 (C2) |
| P11 | honoured | the audit PDF wears `.dl-btn` like every download (C2 one class); no new hex (the `#fff` is the renamed rule's own literal, D's hand-off) |
| P12 | hand-check | Ryan: four cards one edge, audit PDF from the card, no ledger line |
| P13 | honoured | chips stay `data-read` expanders; nothing new hidden |
| P14 | honoured | the empty quantity line keeps the slot; the audit card with no settled audit shows its title, spec and a disabled button |
| P15 | n/a | |
| P16 | honoured | no "…", no "—", no "done" in any `.dl-card .desc` text node (test, nine states); the cue names the previous answer |

## The #235 re-scope comment (for Ryan to post on #235)

> Re-scoping after s2-audit-1. Landed without a design round (bucket C, Refs #261/#225): surface C's heading hierarchy (one h2 per zone; "— jurisdiction rules" takes the `tr-section` role), the ledger line deleted with the "◌ checking…"/"(refreshing…)" copy (chips are the one voice; a `tr-prov` previous-answer cue keeps #187), audit rows' shared edges cited from F-S3-9, `.check-list-item` grid (#225), and the audit PDF as a `.dl-btn` card (#261). Remaining here for the design round: surface A (road-section table alignment, note ties), surface B (footnote relocation, #214 survives), surface D density (honesty defects → #257), and surface C's type census (F-S3-12, with #263). Nothing in this issue is demo-blocking.

## Rebase folds (2026-09-09, onto `b72e358` — D's census + `--ink-bright`, B's landing slice, A's block)

Rulings taken at the rebase, one commit on top:
- **Gutter = the measurement.** `.check-list-item` `200px` → **`197px`**, the scrollWidth of "OSM GROUND-TRUTH (SOFT CHECK)" at 10 px mono measured above (both viewports); `check-list-grid.test.ts` pins 197 with the measurement named. The harness's C6 check asserts against 197 for the prod run. The section-03 S-630-1 cites still wrap inside the gutter (P6); no widening.
- **The zip stays four files — no new issue.** "MHT PACKAGE · 4 FILES" is true (`BUNDLE_PART_KINDS`); the audit PDF is a standalone download.
- **The caption stays** until B's #253 commit 7 drops the numeral (ruling 2).
- **Ruling 3 done:** `.workbench .dl-card h3` `color: #fff` → `var(--ink-bright)`; C's row deleted from `CSS_OWNER_SWAPS` (`ink-literals.test.ts` red → green).
- **D's type census:** `type-exceptions.ts` — `.dl-card h4` row → `.dl-card h3`; the `.tier-ledger` 11 px row deleted; TieredReference's `text-[10px]` ×1 and `text-[20px]` ×1 rows deleted, `text-[11px]` 4 → 3; `CENSUS_PINS` 103 → 102 CSS declarations, 109 → 107 Tailwind sites, 325 → 322 uses (`type-census.test.ts` red by name → green).
- The two CSS-rule tests this arc wrote read `globals.css` CRLF-normalised (a Windows checkout must read like CI's).

## Running it

```
cd conestruct/site && npx next dev -p 3003          # this branch, .env.local → the Modal backend
cd validation-artifacts/committed/s2-arc26-cards-rows
node s2a26-lc.js outLocal <backend healthz sha> <frontend sha> http://localhost:3003
```
The prod run after the ship is Ryan's: the same command with `https://www.conestruct.com`
as the base and the shipped sha for both arguments.
