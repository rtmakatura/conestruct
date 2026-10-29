# #432 (round 4): a typed decimal stays in the work-zone length box and the field says "Use whole feet"

Mission `walkthrough-round-4` (tracking #433). Branch `issue-432-whole-feet`, stacked on `issue-429-refused-length-marker` (e536579).

## The ruling

Ryan, 2026-10-29, ruling 6 (`validation-artifacts/committed/missions/walkthrough-round-3/ryan-rulings.md:17`):

> #432: refuse decimals with "Use whole feet" instead of truncating.

The same file, `:18`: "A typed decimal stays in the box, and the field refuses it with "Use whole feet". It no longer turns into `parseInt`'s whole number."

## Plan (written before the diff)

1. **Problem.** Both doors parse the work-zone length box with `parseInt`: the WHERE band's `commitWorkLen` (`conestruct/site/components/bands/WhereBand.tsx:595` on e536579, `const n = parseInt(wzDraft, 10);`) and the manual-entry panel (`conestruct/site/components/bands/ManualFallback.tsx:96` on e536579, `const n = parseInt(e.target.value, 10);`). A typed `512.5` is written as 512 and shows "✓ yours"; `0.5` is written as 0 and reads "must be more than 0 ft". The validator (`validateWorkZone`, `lib/scenarios/validation.ts:181-211`) never sees the decimal.
2. **Ruling.** Ryan's ruling 6, quoted above.
3. **Change.** Both doors parse with `parseFloat`, so the typed number reaches the scenario whole. `validateWorkZone` gains a last check, after the bounds: a length that isn't a whole number is refused with "Use whole feet for the work zone length." `workLenIsRefused` derives from the validator (#429 call 1), so the WHERE marker turns plain "yours" with no edit to the marker. The Generate blocker reads the validator's message (GeneratorShell.tsx:1426, rail.ts:251), so it follows. DESIGN-SPACING.md's #429 paragraph adds the decimal to its list of refused lengths.
4. **Rule 5 churn prediction.** Stated behaviour change: a typed `512.5` in the WHERE band's "Work zone length (ft)" stays `512.5` in the box (was `512`), the field's error line reads "⚠ Use whole feet for the work zone length." and the Generate blocker "Use whole feet for the work zone length." (were none; Generate was enabled), the marker reads plain "yours" (was "✓ yours"); Generate is disabled. A typed `0.5` stays `0.5` and reads "Use whole feet ..." (was `0`, "must be more than 0 ft"). In the manual panel the same: the box keeps the decimal and the line reads "Use whole feet ...". `parseFloat` also reads an exponent (`1e3` -> 1000; `parseInt` read 1); recorded, not a goal. Unchanged: every whole length, negatives (bounds first: `-0.5` still reads "more than 0 ft", pinned by an existing test), the cap (a decimal over the cap reads the cap message), an emptied box ("required", "◌ not set"), the default, the provenance line, the four gated kinds' forms (they already write `+e.target.value`, Rule 8, untouched), the backend, every payload shape. Files: `validation.ts` ~+12/-3; `WhereBand.tsx` ~+4/-2; `ManualFallback.tsx` ~+3/-2; `DESIGN-SPACING.md` ~+3/-2; `validation.test.ts` ~+20; `WhereBand.work-length.test.tsx` ~+30; `ManualFallback.work-length.test.tsx` ~+25. The cell may grow by the error line's second line at 390 if the message wraps; measured, not assumed.
5. **Proof.** Unit tests: the validator on 512.5, 0.5, 20000.5, -0.5 and 512; `workLenIsRefused` true for 512.5. A mounted GeneratorShell test (Rule 11) types 512.5 in the WHERE band and reads the box, the field's alert, the Generate blocker and the marker, then 512 and reads "✓ yours" and no alert; also 0.5. A mounted ManualFallback test types 512.5 and reads the box and the line. Red proof on e536579 via `git archive`. Before/after shots at 1440 and 390 of the work-length cell and the Generate frame with 512.5 typed, `script/shoot.mjs`. Everything in this folder.

## Calls

1. **R145 self-ruled: the line reads "Use whole feet for the work zone length."** Ryan's words, "Use whole feet", lead it verbatim. The rest names the field, because the same message is the Generate blocker, read away from the box (the other two messages name the field too: "Work zone length is required.", "Work zone length must be more than 0 ft."). An imperative is already in the family: the cap message ends "Split a longer project into multiple plans." Lower case "work zone length" mid-sentence, unhyphenated, as the existing messages write it. Rendered upper case by `FieldErrorLine`, as every field error is.
2. **R145 self-ruled: a frontend product rule, recorded as such (Rule 3).** The backend takes a float on every kind (`workLen: float = Field(gt=0.0, le=WORK_LEN_MAX_FT)`, `src/api/schemas.py:592`, and `:733`, `:788`, `:808`, `:825`), so this check is not a mirror of a backend bound; it is Ryan's ruling 6, and the code comment says so. The backend is unchanged. The bounds checks above it stay mirrors.
3. **R145 self-ruled: the bounds come first.** `-0.5` keeps "must be more than 0 ft" (an existing #403 test pins it), and `20000.5` keeps the cap message: the bound is the bigger problem, and one message at a time. `0.5` is inside the bounds and reads "Use whole feet" (it was `0` and "more than 0 ft" after #428).
4. **R145 self-ruled: `parseFloat` in both doors.** It keeps the typed number whole so the one validator decides. An unparsable or empty draft is still NaN, so #428's emptied box is unchanged. Recorded side effect: an exponent now reads as its number (`1e3` -> 1000, where `parseInt` read 1); a whole result passes, as a typed 1000 does. Not a goal; no test pins it.
5. **R145 self-ruled: the marker needs no edit.** `workLenIsRefused` derives from `validateWorkZone` (#429 call 1), so a decimal takes #429's plain "yours" through it. Its doc comment and DESIGN-SPACING.md's #429 paragraph add the decimal to the list of refused lengths (+2/-2 in the doc, in the prediction).
6. **R145 self-ruled: the four gated kinds' forms are untouched (Rule 8).** `LaneClosureForm.tsx:125`, `MobileOp2LaneForm.tsx:106`, `MobileOpMultilaneForm.tsx:106` and `WorkBeyondShoulderForm.tsx:127` already write `+e.target.value || 0`, which keeps a decimal; they read the same validator if ever enabled, so they would refuse it too. Not reachable while gated.
7. **Recorded, not changed: the Generate blocker's precedence.** On this flow (Colfax shoulder plan) the base's plan with 512 came back declined, and the Generate line read "Generation declined. The PLAN DECLINED notice says why." With 512.5 the client's own message wins (`inputError` is checked before the audit's 400, `GeneratorShell.tsx:1426-1442`), as every work-zone message already does. The decline is the backend's answer about the plan, unrelated to the decimal; not this item.

## Measurements (shots/text-before.json, shots/text-after.json)

Local `next dev`, Chromium DPR 2, Colfax shoulder plan, `512.5` typed in "Work zone length (ft)" and tabbed out, the same flow both runs (`script/shoot.mjs`, adapted from #429's). Before: a `git archive` of e536579 on port 3432. After: this worktree on port 3433. The road-bearing call is stubbed with the Colfax candidate; other API calls went to the `.env.local` backend. The dev servers ran with a throwaway local `GATE_BYPASS_TOKEN`.

| | before | after |
|---|---|---|
| field value | `512` | `512.5` |
| marker | `✓ yours` (`.a-mark.is-ok`, ✓ rgb(79, 215, 135)) | `yours` (`.a-mark.is-plain`, no glyph) |
| marker word colour | rgb(147, 160, 176) | rgb(147, 160, 176) |
| marker box, 1440 / 390 | 48.64 x 32 / 48.64 x 44 | 33.61 x 32 / 33.61 x 44 |
| field error | none | `⚠ Use whole feet for the work zone length.` |
| work-length cell, 1440 / 390 | 846 x 65 / 328 x 115 | 846 x 92 / 328 x 142 (the error line, one line at both widths) |
| Generate blocker | "Generation declined. The PLAN DECLINED notice says why." (call 7) | "Use whole feet for the work zone length." |
| Generate frame, 1440 / 390 | 880 x 153.5 / 362 x 185 | 880 x 153.5 / 362 x 169.25 |
| provenance line | `your answer · the extent the plan is built for` | same |

## Churn (predicted -> actual)

- `lib/scenarios/validation.ts` ~+12/-3 -> +12/-1
- `components/bands/WhereBand.tsx` ~+4/-2 -> +3/-1
- `components/bands/ManualFallback.tsx` ~+3/-2 -> +2/-1
- `DESIGN-SPACING.md` ~+3/-2 -> +2/-2
- `lib/scenarios/validation.test.ts` ~+20 -> +27
- `components/bands/WhereBand.work-length.test.tsx` ~+30 -> +32
- `components/bands/ManualFallback.work-length.test.tsx` ~+25 -> +22
- No file outside the prediction. No backend change.
