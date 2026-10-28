# #428 rulings: a typed 0 stays in the work-zone length box

Branch `issue-428-typed-zero-length`, stacked on `issue-425-declined-jurisdiction` (1a0f7d1). Line numbers below are on 1a0f7d1 unless a line says otherwise.

## Plan (written before the diff)

1. **Problem.** The scenario holds the same value for a typed 0 and an emptied box. `commitWorkLen` parses the draft and writes 0 for both, with the operator's record either way (`conestruct/site/components/bands/WhereBand.tsx:595-596`, `const n = parseInt(wzDraft, 10);` / `const next = Number.isFinite(n) ? n : 0;`, then `setWorkLen`, which calls `markOperatorSet`, `lib/scenarios/what-writes.ts:134-135`). The box shows a 0 as empty (`WhereBand.tsx:839`, `value={wzDraft ?? (scenario.workLen || "")}`), the marker reads "◌ not set" (`:797-798`) and the validator reads 0 as the cleared field, "Work zone length is required." (`lib/scenarios/validation.ts:175-181`). The manual-entry panel does the same per keystroke (`components/bands/ManualFallback.tsx:92`, `value={scenario.workLen || ""}`, and `:95-97`), so a 0 typed there vanishes as it is typed.
2. **Rulings.** None from Ryan on #428. The bound is the backend's: `workLen: float = Field(gt=0.0, le=WORK_LEN_MAX_FT)` (`src/api/schemas.py:592`); the frontend validator is its mirror (Rule 3). Rule 10: the box shows what the operator typed, and absence renders as absence. #397: a committed length carries the operator's `workLen` record (`what-writes.ts:131-133`). #429 (parked) holds the refused-length marker; this branch doesn't change it (call 2).
3. **Change.** An emptied box is "no length": it writes 0 and drops the `workLen` record (new `clearWorkLen` in `what-writes.ts`, through the existing `withoutOperatorSet`). A typed number, 0 included, is the operator's and keeps `setWorkLen`. One predicate, `workLenIsEmpty(s)` (`workLen === 0` and no `workLen` record), in `validation.ts`, read by the validator, the field's display, its marker and provenance line, and the manual panel. The validator: empty or NaN → "Work zone length is required."; any other length of 0 or less → "Work zone length must be more than 0 ft." (the #403 mirror, widened from `< 0` to `<= 0`). The box shows a committed 0 as `0`. A typed 0's marker and provenance line take the refused-length branch #403 gave a negative length (call 2).
4. **Churn prediction (Rule 5).** `lib/scenarios/validation.ts` ~+15/-6; `lib/scenarios/what-writes.ts` ~+9; `components/bands/WhereBand.tsx` ~+18/-10; `components/bands/ManualFallback.tsx` ~+10/-5; `lib/scenarios/validation.test.ts` ~+20/-2; `components/bands/WhereBand.work-length.test.tsx` ~+40/-8 (the #403 "typed 0 shows an empty box" test flips: the stated change); new `components/bands/ManualFallback.work-length.test.tsx` ~+70. Byte-identical: `rail.ts` and `GeneratorShell.tsx` (they read the validator's message), `guesses.ts`, `index.ts` (`workLenIsDefault` is unchanged: a 0 is never the 1,000 ft start), the gated kinds' forms (`LaneClosureForm.tsx`, `WorkBeyondShoulderForm.tsx`, `MobileOp2LaneForm.tsx`, `MobileOpMultilaneForm.tsx`; unreachable while those kinds are gated, Rule 8, `lib/scenarios/index.ts:94-97`), every backend file, every wire payload of a plan with a positive length.
5. **Proof.** Unit tests on the validator and the predicate. A mounted GeneratorShell test (Rule 11) types `0` into the WHERE field and reads the box's value, its alert, its marker, its provenance line and the Generate blocker; then clears the box and reads "required" / "◌ not set"; then types 0 and a real length. A mounted ManualFallback test types 0 and reads the box and the alert. Red proof on 1a0f7d1 via `git archive`. Before/after shots at 1440 and 390 with measured boxes. Everything in this folder.

## Calls

1. **R145 self-ruled: the operator's `workLen` record tells a typed 0 from an emptied box.** The record already means "the operator committed this length" (#397, `what-writes.ts:131-133`). An emptied box isn't a length, so it writes 0 and drops the record (`clearWorkLen`, through `withoutOperatorSet`, `guesses.ts:438-445`). A typed 0 keeps it (`setWorkLen`). Rejected: a new "empty" field in the scenario (a wire and saved-plan change for a display fix), and a WhereBand-only draft flag (the Generate blocker reads the scenario through `rail.ts`, so it couldn't see the flag). This is the issue's own proposal (`isOperatorSet(scenario, "workLen")`). Nothing reaches the backend: `workLenIsDefault` (`lib/scenarios/index.ts:403-405`) needs 1,000 ft, so a 0 never relays `guesses.work_length`, and the backend refuses 0 either way.
2. **R145 self-ruled, not parked: a typed 0's marker is the refused-length marker #403 gave a negative length.** The marker branch widens from `scenario.workLen < 0` to `<= 0` after the empty check. The form itself isn't changed (plain `yours`, no glyph, `{ glyph: null, word: "yours", tone: "plain" }`), and the negative and over-cap markers aren't changed either. #429's own Action asks that "every refused length gets the same marker", so putting the typed 0 in with the negative length follows that issue's direction and leaves its question open: whatever #429 rules for the form now covers negative, typed 0 and over the cap. The other option, "◌ not set" beside a box showing `0`, would be a marker that disagrees with the box (Rule 10). Scope note posted on #429: https://github.com/rtmakatura/conestruct/issues/429#issuecomment-6477801702
3. **R145 self-ruled: the manual-entry panel follows the same rule; the gated kinds' forms are left alone and differ.** ManualFallback writes on every keystroke, and on the base it showed a 0 as empty while it was being typed (`ManualFallback.tsx:92`). It now uses the same predicate and the same two writes. The four gated kinds' forms (`LaneClosureForm.tsx:124-125`, `WorkBeyondShoulderForm.tsx`, `MobileOp2LaneForm.tsx`, `MobileOpMultilaneForm.tsx`) already show a 0 as `0` (`value={scenario.workLen}`), write `+e.target.value || 0` without the record, and can't be reached while those kinds are gated (Rule 8, `lib/scenarios/index.ts:94-97`). The stated difference: an emptied box there would read as a typed 0 ("more than 0 ft") while showing `0`. Leave it for the enablement arc.
4. **R145 self-ruled: `workLenIsEmpty` lives in `validation.ts`, and it inlines the record check.** `guesses.ts` imports `auto-apply.ts` (`guesses.ts:38`), which imports `validation.ts` (`auto-apply.ts:18`), so if `validation.ts` imported `isOperatorSet` from `guesses.ts` it would close an import cycle. The predicate reads `s.meta.operatorSet?.includes("workLen")`, the same expression `isOperatorSet` uses (`guesses.ts:423-425`), with a comment saying why.
5. **R145 self-ruled: an unparsable draft counts as an emptied box.** `parseInt` gives NaN only when there's no leading number. A `type="number"` input reports `""` for anything it can't parse, so in practice this is the emptied box. On the base, NaN was written as 0 with the record. Now it's 0 without the record.
6. **Filed, not folded: the box drops a typed decimal** (`parseInt`, `WhereBand.tsx:595`, `ManualFallback.tsx:95`). `512.5` becomes `512` with "✓ yours", and the backend takes a float. It needs a ruling (keep the decimal or round it and say so), so it fails the R154 fold test. Filed as #432 (https://github.com/rtmakatura/conestruct/issues/432). After this branch, a typed `0.5` shows `0` with "more than 0 ft" (on the base it went empty and read "required").

## Stated behaviour change (Rule 5)

- A typed 0 in the WHERE band's "Work zone length (ft)" stays in the box as `0` (was emptied). The field's error reads "⚠ WORK ZONE LENGTH MUST BE MORE THAN 0 FT." and the Generate blocker reads "Work zone length must be more than 0 ft." (both were "Work zone length is required."). The marker reads `yours` with no glyph (was "◌ not set") and the provenance line reads "your answer · the extent the plan is built for" (was "not set · the extent the plan is built for"). Generate stays disabled.
- The manual-entry panel: a typed 0 stays as `0` and reads "must be more than 0 ft" (was emptied as it was typed, then "required").
- An emptied box now drops the operator's `workLen` record (on the base it set it). The display is unchanged: empty, "◌ not set", "required", in both doors. The record isn't on the wire for a length of 0 (call 1).
- A saved plan from before this branch whose box was emptied holds 0 with the record. It now opens as a typed 0 (`0`, "more than 0 ft"), not as an empty box. That's the R110 Q8 assumption #397's marker makes about a record.
- Unchanged: `-5` (box, marker, both lines), the 20,000 ft cap message and marker, every positive length, `rail.ts`, `GeneratorShell.tsx`, the backend.

## Measurements (shots/text-before.json, shots/text-after.json)

Local `next dev`, Chromium DPR 2, Colfax shoulder plan, `0` typed and tabbed out, the same flow both runs (script/shoot.mjs, adapted from #403's). Before: a `git archive` of 1a0f7d1 on port 3428. After: this worktree on port 3429. The road-bearing call is stubbed with the Colfax candidate; other API calls went to the `.env.local` backend.

| | before | after |
|---|---|---|
| field value | `` (empty) | `0` |
| marker | `◌ not set` | `yours` |
| provenance line | `not set · the extent the plan is built for` | `your answer · the extent the plan is built for` |
| field error (rendered caps) | `⚠ WORK ZONE LENGTH IS REQUIRED.` | `⚠ WORK ZONE LENGTH MUST BE MORE THAN 0 FT.` |
| Generate blocker (`cta-reason`) | `Work zone length is required.` | `Work zone length must be more than 0 ft.` |
| work-length cell box, 1440 | 846 x 92 | 846 x 92 |
| work-length cell box, 390 | 328 x 142 | 328 x 142 |
| Generate frame box, 1440 | 880 x 153.5 | 880 x 153.5 |
| Generate frame box, 390 | 362 x 169.25 | 362 x 169.25 |

No box changes size. The box figures come from the DOM (`getBoundingClientRect`). The 390 Generate shots are clipped at the bottom, as #403's were: 756 x 354 image px where 370.5 px of height was asked for (the clip runs past the viewport). The blocker line is inside the image in both. Every shot taken is kept; there were no failed attempts. Both dev servers were stopped after the shots, with their node processes killed by PID. The copied `.env.local` files were deleted.

## Churn (predicted -> actual)

- `conestruct/site/lib/scenarios/validation.ts` ~+15/-6 -> +17/-7
- `conestruct/site/lib/scenarios/what-writes.ts` ~+9 -> +7
- `conestruct/site/components/bands/WhereBand.tsx` ~+18/-10 -> +16/-7
- `conestruct/site/components/bands/ManualFallback.tsx` ~+10/-5 -> +6/-4
- `conestruct/site/lib/scenarios/validation.test.ts` ~+20/-2 -> +23/-1
- `conestruct/site/components/bands/WhereBand.work-length.test.tsx` ~+40/-8 -> +34/-1 (git aligns the flipped typed-0 test with the new lines, so most of it counts as kept, not removed)
- `conestruct/site/components/bands/ManualFallback.work-length.test.tsx` (new) ~+70 -> +53
- Byte-identical, as predicted: `rail.ts`, `GeneratorShell.tsx`, `guesses.ts`, `index.ts`, the four gated kinds' forms, every backend file.
