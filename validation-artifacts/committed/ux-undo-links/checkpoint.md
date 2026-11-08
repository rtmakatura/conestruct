# #457 checkpoint: the plan and the Rule 5 churn prediction

Written before the diff, on `issue-457-undo-links` at base `2cd6d72` (`origin/issue-453-prod-check`, which carries #453's production-check evidence so it ships with this fix). No park-list item: no money, legal, safety distance, gated scenario, device count, spacing or sign placement, nothing outside the repo. Rulings and self-rulings: `rulings.md`.

## Baseline (before any change)

vitest `2929 passed | 1 skipped` (270 files passed, 1 skipped). No Python is touched, so no pytest.

## The plan

1. **Problem.** Six Undo controls on the tool page (`rulings.md`, table U-a to U-f) are bordered boxes in mono 9.5 caps (`QuestionSteps.tsx:224-233`, `NeedsYouConditions.tsx:147-157`, `NeedsYou.tsx:188-199`) or a box in Inter 12 (`NearIntersectionForm.tsx:531-537`); the cross street's (`WhereQuestions.tsx:487`) is a link with 4 px padding in a row with 12 px right padding. After Move at 390x664 focus stays on Cancel, off screen (#446).
2. **Rulings.** Ryan's rulings 1-5 (2026-11-05, Option A), quoted in `rulings.md`; U1-U9 self-ruled there.
3. **Change.** One class `.workbench .undo-link` (13.5/600 `--act` through the Edit/Details font rule, no border, no box, 44 px tall, 8 px side padding, hover `--act-bright`, ring inside). Each of the six places uses it and nothing else; QuestionSteps' `undoClass` prop goes. Rows: answered rows `min-height: 48px`; the cross row and the near-intersection note get 16 px right padding. The near-intersection label reads "Undo", described by its note. Move focuses the bar's big-map button.
4. **Churn prediction** (below).
5. **Proof.** A red test first (`components/undo-link.test.tsx`: the CSS contract and every place rendered as `button.undo-link` reading "Undo"; the Move focus in `GeneratorShell.cross-street-tap.test.tsx`), then the fix, then the affected vitest files (lane permitting), then a local walk at 1440 and 390 (and 390x664 for focus): before/after crops of each place reached, one keyboard-focus crop, axe, the 44 px measure. All under this folder.

## Rule 5 churn prediction

**Changes, on purpose:**

| What | Where | Why |
|---|---|---|
| Six Undo controls take `undo-link` and drop `act` / `act-btn` / `tr-step` / `nyq-undo` / `wq-undo` / `wq-link` / the Tailwind box | `QuestionSteps.tsx`, `NeedsYouConditions.tsx`, `NeedsYou.tsx`, `WhereQuestions.tsx`, `NearIntersectionForm.tsx` | rulings 1, 3 |
| `undoClass` prop removed from QuestionSteps and its two callers | `QuestionSteps.tsx`, `NeedsYouQuestion.tsx`, `WhereQuestions.tsx` | U1 |
| New CSS: `.undo-link` (+ `:hover`, `:focus-visible`, `:disabled`; `flex: none` so rule 167's stretch at 480 and under doesn't widen it, U5); `.nyq-row.nyq-answered { min-height: 48px }`; `.wq-cross-row` right padding 16 | `app/globals.css` | rulings 1, 2; U4-U7 |
| `.undo-link` added to the `.a-setuprow-edit, .disc-word` font rule's selector list | `app/globals.css` | U1 |
| Removed CSS: `.workbench .needs-you .act.nyq-undo` and `.workbench .wq .act-btn.wq-undo` (min-height only; their class is gone) | `app/globals.css` | U1 |
| Census: that font rule's selector string gains `.workbench .undo-link`; `NearIntersectionForm.tsx` `text-[12px]` count 2 → 1. `cssDeclarations` stays 198 (no font-size declaration added or removed) | `lib/design/type-exceptions.ts` | ruling 5 |
| Hit-target class list gains `undo-link` | `components/GeneratorShell.hit-targets.test.tsx` | ruling 2 |
| The near-intersection label "Undo: restore detected lane data" → "Undo": its three `getByRole`/`queryByRole` name queries change to `"Undo"` | `components/GeneratorForms.confirm-undo.test.tsx` (3 lines) | ruling 1, U3 |
| Move focuses `band-aerial-big-map` (one statement) | `WhereQuestions.tsx` | U8 |
| New tests | `components/undo-link.test.tsx` (new), one focus assertion in `GeneratorShell.cross-street-tap.test.tsx` | Rule 11 |
| Evidence | `validation-artifacts/committed/ux-undo-links/` | — |

**Tests that look for the old mono "UNDO":** none found. `getByRole("button", { name: "Undo" })` and `getByTestId("step-undo-*")` / `cross-undo` keep matching (the DOM text was always "Undo"; the caps were CSS). No test asserts `nyq-undo`, `wq-undo` or `.act` on an Undo. Prediction: zero existing assertions move other than the three near-intersection name queries.

**Stays byte-identical:** every Undo handler and what it writes (the scenario, `meta.acknowledged`, staged corrections, the cross-street snapshot); every request payload; the backend, the PDF and every wire field; every other row action (Move, Cancel, Try again, Edit, Details, Assert, Acknowledge, Withdraw, Apply); the census sizes (no new size, no new hex). Vitest count: baseline + the new tests only.

**Expected lane:** IN LANE (only `components/`, `app/globals.css`, `lib/design/` and evidence); checked with `scripts/cosmetic_lane_check.py` once built.

## Actual (after the build, 2026-11-07)

17 files under `conestruct/site`, `+224 / -40` (`git diff --stat`, the new test file included), plus this folder.

**As predicted:** the six Undo controls on `undo-link` alone; `undoClass` gone from QuestionSteps and both callers; the `.nyq-undo` / `.wq-undo` rules removed; answered rows 48 px; the cross row and the near-intersection box 16 px on the right; the near-intersection label "Undo" (its three name queries changed); Move focuses the big-map button; `undo-link` in the hit-target list; `NearIntersectionForm.tsx` `text-[12px]` 2 → 1; `cssDeclarations` stays 198; the new test file and the one focus assertion. No existing assertion matched the old mono "UNDO".

**Amended after the before walk, before the after build (U1, U2):** the shared font rule is `.wq-link`'s (Move, and the WHERE summary row's Edit and Details, as the before walk showed them beside Undo on this page), not `.a-setuprow-edit, .disc-word`. So `.undo-link` joined `.workbench .wq-link`'s selector list and that census row's selector changed instead, and the link is underlined. Same files, same count of census rows.

**Misses (three pins not in the prediction; `evidence/affected-run-failures.md`):**

| Pin | File | Change |
|---|---|---|
| R138: the near-intersection confirm and its undo carry `tap-44` | `components/tap-targets.test.ts` | now one `tap-44` (the confirm) and one `undo-link` |
| `tsxUses` total | `lib/design/type-exceptions.ts` `CENSUS_PINS` | 134 → 133 (the per-file row was predicted, its total wasn't) |
| #252: no new selector names the lock class | `components/WriteLock.test.tsx` | unchanged; the disabled rule was rewritten `.workbench .undo-link:disabled` (U7) so the pin holds |

**Byte-identical, as predicted:** every Undo handler and what it writes, every payload, the backend, the PDF, every other row action, the census sizes. Vitest: the affected files `122 passed (122)`, `1006 passed (1006)`.
