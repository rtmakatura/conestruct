# #429 (round 4): every refused work-zone length reads a plain "yours", over the cap too

Mission `walkthrough-round-4` (tracking #433). Branch `issue-429-refused-length-marker`, stacked on `issue-402-side-sentence` (2490b73).

## The ruling

Ryan, 2026-10-29, ruling 1 (`validation-artifacts/committed/missions/walkthrough-round-3/ryan-rulings.md:5`):

> #429 yes (plain "yours", over-cap too).

The same file, `:6-7`: "A refused length (negative, typed 0, over the 20,000 ft cap) carries a glyphless "yours". The over-cap case drops its "✓ yours" for the same marker." and "DESIGN-SPACING.md § One glyph vocabulary records the glyphless "yours" for a refused value."

## Plan (written before the diff)

1. **Problem.** The WHERE band's work-zone length marker picks plain "yours" only for `scenario.workLen <= 0` (`conestruct/site/components/bands/WhereBand.tsx:815` on 2490b73, #403 and #428), so a length over the cap (`MAX_WORK_LEN_FT = 20000`, `lib/scenarios/validation.ts:19`), which the form refuses ("Work zone can't exceed 20,000 ft ...", `validation.ts:202-209`), falls through to `{ glyph: "✓", word: "yours", tone: "ok" }` (`WhereBand.tsx:822`) and reads "✓ yours". The glyph vocabulary (`conestruct/site/DESIGN-SPACING.md` § One glyph vocabulary, `:132-163`) records plain "default" (#411) but not plain "yours".
2. **Ruling.** Ryan's ruling 1, quoted above.
3. **Change.** One predicate, `workLenIsRefused(s)` in `validation.ts`, beside `workLenIsEmpty`: the operator's number that `validateWorkZone` rejects (finite, not an empty box, not ok). It derives from the validator, so the bounds stay in one place. The WHERE marker reads it in place of `workLen <= 0`. DESIGN-SPACING.md gets a #429 paragraph after #411's.
4. **Rule 5 churn prediction.** Stated behaviour change: a length over 20,000 ft in the WHERE band's "Work zone length (ft)" reads the marker "yours", no glyph, plain tone (was "✓ yours", ok tone). Unchanged: negative and typed-0 markers (already plain "yours"), the emptied box ("◌ not set"), the default ("default"), every valid length ("✓ yours", 20,000 included), every error message, the provenance line ("your answer · ..."), the corridor-extent note, the manual panel (it has no marker; see call 2), the backend, every payload. Files: `validation.ts` ~+12; `WhereBand.tsx` ~+5/-4; `DESIGN-SPACING.md` ~+10; `validation.test.ts` ~+20; `WhereBand.work-length.test.tsx` ~+20/-3; `ManualFallback.work-length.test.tsx` ~+15 (a control). The cell's box should not change size: the marker gets shorter by the glyph only.
5. **Proof.** A unit test on the predicate (-5, typed 0, emptied 0, 500, the 1,000 ft default, 20,000, 20,001, 99,999). The mounted GeneratorShell test (Rule 11) types 99999 and reads the marker, the box's value and the cap message, then 20000 and reads "✓ yours". A mounted ManualFallback control types 99999 and reads the cap message and no ✓ in the panel. Red proof on 2490b73 via `git archive`. Before/after shots at 1440 and 390 of the cell with 99999 typed, script in `script/shoot.mjs`. Everything in this folder.

## Calls

1. **R145 self-ruled: "refused" is derived from `validateWorkZone`, not a second set of bounds.** `workLenIsRefused(s) = Number.isFinite(s.workLen) && !workLenIsEmpty(s) && !validateWorkZone(s).ok`. The validator already holds the two bounds the form refuses (gt 0, le 20,000, mirrors of `src/api/schemas.py`, Rule 3), and both doors read it. If a bound moves, the marker moves with it. NaN is excluded: the validator says "required" for it, and an unparsable draft is an emptied box (#428 call 5).
2. **R145 self-ruled: the manual-entry panel gets no marker.** "Both doors" in the item prompt: `ManualFallback.tsx` draws no provenance marker for its "Work zone (ft)" box (`:85-104` on 2490b73), only the box and the validator's error line. So there is no ✓ to drop there; adding a marker would be new UI the ruling didn't ask for. The panel already reads the same source (`validateWorkZone`, `ManualFallback.tsx:46`). A mounted control test pins that an over-cap length there reads the cap message and carries no ✓.
3. **R145 self-ruled: 20,000 ft itself is not refused.** The validator's check is `wz > MAX_WORK_LEN_FT` (`validation.ts:202`), matching the backend's `le=`. So 20,000 keeps "✓ yours", and the test pins that edge.
4. **R145 self-ruled: the corridor-extent note is untouched.** `WhereBand.tsx:831` (`scenario.workLen <= 0 ? "set the work-zone length to compute" : ...`) is about whether lengths can be computed, not about the marker; the ruling is about the marker. Out of scope.
5. **Out of scope:** decimals (#432, the next item).
6. **R145 self-ruled, after the independent review: the vocabulary entry is the work-zone length's only.** The first draft of the DESIGN-SPACING.md paragraph read as panel-wide ("A value the operator entered that the form refuses reads the plain word "yours""), but a refused row whose marker comes from `markerOf` (lanes, for one) draws no marker at all: `markerOf` returns null on error (`lib/scenarios/provenance-marker.ts:65`), and the WHAT band drops the lanes marker (`WhatBand.tsx:528-529`, `:604`). The paragraph now names the work-zone length and says so. It also says "the field's error line and the Generate blocker say why", since the error line shows only after the box is touched (`WhereBand.tsx:824`, `wzTouched && !wz.ok`). Doc only; no code or test changed.

## Measurements (shots/text-before.json, shots/text-after.json)

Local `next dev`, Chromium DPR 2, Colfax shoulder plan, `99999` typed in "Work zone length (ft)" and tabbed out, the same flow both runs (`script/shoot.mjs`, adapted from #428's). Before: a `git archive` of 2490b73 on port 3430. After: this worktree on port 3431. The road-bearing call is stubbed with the Colfax candidate; other API calls went to the `.env.local` backend. The dev servers ran with a throwaway local `GATE_BYPASS_TOKEN`.

| | before | after |
|---|---|---|
| field value | `99999` | `99999` |
| marker | `✓ yours` (`.a-mark.is-ok`, ✓ in `.sym-pass` rgb(79, 215, 135)) | `yours` (`.a-mark.is-plain`, no glyph) |
| marker word colour | rgb(147, 160, 176) | rgb(147, 160, 176) |
| marker box, 1440 / 390 | 48.64 x 32 / 48.64 x 44 | 33.61 x 32 / 33.61 x 44 |
| provenance line | `your answer · the extent the plan is built for` | same |
| field error | `⚠ Work zone can't exceed 20,000 ft (about 3.8 miles) on a single plan. Split a longer project into multiple plans.` | same |
| work-length cell box, 1440 | 846 x 107 | 846 x 107 |
| work-length cell box, 390 | 328 x 172 | 328 x 172 |

The marker loses its glyph and 15.03 px of width; the cell doesn't change size. The word keeps its ink, so its contrast is unchanged. Every shot taken is kept; there were no failed attempts. Both dev servers were stopped after the shots, their node processes killed by PID; the copied `.env.local` files and the base archive were deleted.

## Churn (predicted -> actual)

- `lib/scenarios/validation.ts` ~+12 -> +11
- `components/bands/WhereBand.tsx` ~+5/-4 -> +4/-3
- `DESIGN-SPACING.md` ~+10 -> +11 (narrowed after the independent review, call 6)
- `lib/scenarios/validation.test.ts` ~+20 -> +22
- `components/bands/WhereBand.work-length.test.tsx` ~+20/-3 -> +16/-0 (the new test sits beside the cap test, which is unchanged)
- `components/bands/ManualFallback.work-length.test.tsx` ~+15 -> +16

No file outside the prediction.
