# #403 rulings: a negative work-zone length says what is wrong

Branch `issue-403-negative-length`, stacked on `issue-401-download-package` (27f69c2). Line numbers below are on 27f69c2 unless a line says otherwise.

## Plan (written before the diff)

1. **Problem.** `validateWorkZone()` returns one message for "not a number" and "≤ 0" (`conestruct/site/lib/scenarios/validation.ts:175-180`):
   `if (!Number.isFinite(wz) || wz <= 0) {` / `message: "Work zone length is required.",`. `commitWorkLen` parses the draft with `parseInt` and writes `-5` as it is (`conestruct/site/components/bands/WhereBand.tsx:595-596`: `const n = parseInt(wzDraft, 10);` / `const next = Number.isFinite(n) ? n : 0;`). The field then shows `-5` (`WhereBand.tsx:836`: `value={wzDraft ?? (scenario.workLen || "")}`), its marker reads "◌ not set" (`WhereBand.tsx:797-798`: `scenario.workLen <= 0` / `? { glyph: "◌", word: "not set", tone: "pending" }`) and the error under it and the Generate blocker (`lib/scenarios/rail.ts:288`) both read "Work zone length is required."
2. **Rulings.** None from Ryan on #403. The bound is the backend's: `workLen: float = Field(gt=0.0, le=WORK_LEN_MAX_FT)` (`src/api/schemas.py:592`, and the same at :733, :788, :808, :825, :844, :980). Rule 3: the frontend mirrors it and says so. Rule 10: the message names what is wrong.
3. **Change.** `validateWorkZone` splits the branch: a non-finite value or 0 keeps "Work zone length is required."; a negative value gets "Work zone length must be more than 0 ft." (mirror of `gt=0.0`, commented). The 20,000 ft cap message is untouched. The marker and the provenance line keep "◌ not set" / "not set · ..." for 0 only (calls 1 and 2).
4. **Churn prediction (Rule 5).** `lib/scenarios/validation.ts` ~+8/-3; `components/bands/WhereBand.tsx` ~+10/-4; `lib/scenarios/validation.test.ts` ~+15; `lib/scenarios/rail.test.ts` ~+15; new `components/bands/WhereBand.work-length.test.tsx` ~+110. Byte-identical: the cap message, the empty-field message, `ManualFallback.tsx`, `GeneratorShell.tsx`, `rail.ts` (they read the validator's message), every backend file.
5. **Proof.** Unit tests on the validator; a rail test for the blocker on a negative length; a mounted GeneratorShell test that types `-5` (and `0`, and clears) into the WHERE field and reads the field's alert, its marker and the Generate band's blocker (Rule 11). Red proof on 27f69c2 via `git archive`. Before and after shots at 1440 and 390. Everything in this folder.

## Calls

1. **R145 self-ruled: a typed `0` keeps "Work zone length is required.", not "must be more than 0 ft".** The issue's acceptance asks for `0` to read "must be more than 0 ft". The scenario can't tell a typed 0 from a cleared field: `commitWorkLen` writes 0 for both (`WhereBand.tsx:596`, an empty draft parses to NaN and becomes 0), and the field shows a 0 as empty (`WhereBand.tsx:836`, `scenario.workLen || ""`). After a typed 0 is committed the box is empty, so "required" describes what is on screen, and "must be more than 0 ft" beside an empty box would be the issue's own complaint in reverse. The existing test already names 0 as the cleared-field value (`lib/scenarios/validation.test.ts:34`, `it("rejects the cleared-field coercion (0) as required", ...`). Telling the two apart needs a separate "empty" state in the scenario (wire, `workLenIsDefault`, the ledger), which is outside a copy fix. So: negative → "must be more than 0 ft"; 0, NaN, empty → "required". Acceptance line 1 is met for `-5` but not for a typed `0`. The box silently turning a typed 0 into an empty field is a Rule 10 question of its own, filed as #428 (https://github.com/rtmakatura/conestruct/issues/428).
2. **R145 self-ruled: the marker for a negative length is the word "yours" with no glyph.** The issue says "Keep '◌ not set' only for an empty field." A negative length is the operator's, so the marker's word is "yours", but the "✓" glyph would approve a value the form refuses. It takes `{ glyph: null, word: "yours", tone: "plain" }` (the shape FieldCell already renders for "default": `FieldCell.tsx:126`, a null glyph is the word alone). The provenance line reads "your answer · the extent the plan is built for", as for any committed length. The error line under the field says what is wrong. "yours" with no glyph is a new marker form: `conestruct/site/DESIGN-SPACING.md` § "One glyph vocabulary, panel-wide" (:132 on 27f69c2) doesn't record it yet; the mission report lists it for Ryan, and DESIGN-SPACING.md is not edited on this branch. The corridor-extent note under the field stays "set the work-zone length to compute" for any length of 0 or less (`WhereBand.tsx:811-812`); it is an instruction that still holds for a negative length, so it is left as it is.
3. **Filed, not folded: the same message prints twice (P2).** The issue's Problem notes the field error and the Generate blocker carry one message (caps under the field, sentence case under Generate). That is the rail's design for every field (`lib/scenarios/rail.ts:58`, the blocker is "an existing string, never a paraphrase"), and the issue's Action and Acceptance keep both ("in both places"). Changing it touches every field's error and the Generate band, outside this branch's files, so it fails the R154 fold test. Filed as #427 (https://github.com/rtmakatura/conestruct/issues/427).

## Stated behaviour change (Rule 5)

- A negative work-zone length (for example `-5`) reads "Work zone length must be more than 0 ft." under the field (in the field line's caps) and under Generate (was "Work zone length is required." in both). Generate stays disabled, as before.
- Its marker reads "yours" with no glyph (was "◌ not set"), and its provenance line reads "your answer · the extent the plan is built for" (was "not set · the extent the plan is built for").
- The manual-entry panel (`conestruct/site/components/bands/ManualFallback.tsx`, unchanged file) reads the same validator (`:46`, `const wzValidation = validateWorkZone(scenario);`) and prints its message (`:104` on 27f69c2, `<FieldErrorLine>{wzValidation.message}</FieldErrorLine>`), so a negative length typed there now reads "must be more than 0 ft" too (was "required").
- Unchanged: an empty field and a typed 0 still read "Work zone length is required." and "◌ not set". A NaN length still reads "required" with the marker "✓ yours" (the marker checks `=== 0`, then `< 0`, then `workLenIsDefault`, and NaN falls through to "✓ yours"; on 27f69c2 the `<= 0` check was false for NaN too, so the same), unchanged; the field can't produce NaN, since `commitWorkLen` (`WhereBand.tsx:596`) and ManualFallback (`:97`) coerce it to 0. Also unchanged: the 20,000 ft cap message, and every positive length's marker and line.

## Measurements (shots/text-before.json, shots/text-after.json)

Local `next dev` of this worktree on port 3403 (before: 27f69c2's frontend; after: the fix, hot-reloaded), Chromium DPR 2, Colfax shoulder plan, `-5` typed and tabbed out, the same flow both runs (script/shoot.mjs). The road-bearing call is stubbed with the Colfax candidate; other API calls went to the `.env.local` backend.

| | before | after |
|---|---|---|
| field value | `-5` | `-5` |
| marker | `◌ not set` | `yours` |
| provenance line | `not set · the extent the plan is built for` | `your answer · the extent the plan is built for` |
| field error (rendered caps) | `⚠ WORK ZONE LENGTH IS REQUIRED.` | `⚠ WORK ZONE LENGTH MUST BE MORE THAN 0 FT.` |
| Generate blocker (`cta-reason`) | `Work zone length is required.` | `Work zone length must be more than 0 ft.` |
| work-length cell box, 1440 | 846 x 92 | 846 x 92 |
| work-length cell box, 390 | 328 x 142 | 328 x 142 |
| Generate frame box, 1440 | 880 x 153.5 | 880 x 153.5 |
| Generate frame box, 390 | 362 x 169.25 | 362 x 169.25 |

No box changes size at either width: the longer message still fits one line. The box figures come from the DOM (`getBoundingClientRect`), not the images. The 390 Generate shots are clipped at the bottom: the clip asked for 185.25 CSS px of height (169.25 + 16 padding), 370.5 image px at DPR 2, and the images are 756 x 354 px, because the clip runs past the viewport's bottom edge. The blocker line is inside the image in both. Every shot taken is kept; there were no failed attempts.

## Churn (predicted -> actual)

- `conestruct/site/lib/scenarios/validation.ts` ~+8/-3 -> +12/-1 (the split, plus a comment on each branch; the old line was edited, not removed)
- `conestruct/site/components/bands/WhereBand.tsx` ~+10/-4 -> +9/-6
- `conestruct/site/lib/scenarios/validation.test.ts` ~+15 -> +21
- `conestruct/site/lib/scenarios/rail.test.ts` ~+15 -> +19
- `conestruct/site/components/bands/WhereBand.work-length.test.tsx` (new) ~+110 -> +149 (over: the shell's mocks and fetch stub, copied from `untouched-provenance.test.tsx`, weren't counted)
- Byte-identical, as predicted: `ManualFallback.tsx`, `GeneratorShell.tsx`, `rail.ts`, every backend file.

## Test repair (a Rule 5 miss)

The first full run after the fix had `tsc` fail on the new test file (duplicate imports from the copied setup). No churn prediction was written before that edit, a Rule 5 miss recorded here. The edit removed 6 lines (the duplicate import block and a blank line), inside the +149 above. The same full run had one unrelated failure, `GeneratorShell.a11y-announce.test.tsx`, saved in full-run-fails.txt before any re-run; it passed when re-run together with the new test file in one vitest call, when run alone (`npx vitest run components/GeneratorShell.a11y-announce.test.tsx`: 1 file passed, 8 tests passed), and in the next full run.
