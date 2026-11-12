# #526 plan (written before the diff)

Baseline (targeted, quiet): pytest `tests/test_schedule_hours_eval.py tests/test_jurisdiction_rules.py` 43 passed; vitest (9 files touched or nearby) 94 passed.

1. **The problem.** `ScheduleField.tsx:261-262` and `:307-310` map every `hours_eval.status === "unknown"` to "set dates to check". The backend answers `unknown` for dates with no times (`src/rules/jurisdiction.py` `evaluate_hours`, at e331b15 `:305-310`: `if sched.start_time is None or sched.end_time is None:` returns `"status": "unknown"` with `NO_SCHEDULE_NOTE`; round 2 corrected this cite from `:302-307`) and for a class-scoped window with no street class (`evaluate_hours`, at e331b15: the window loop sets the flag at `:336-337`, `if applies == UNKNOWN:` / `indeterminate = True`, and the verdict reads it at `:398-399`, `elif indeterminate:` / `status = "unknown"`; round 2 corrected this cite, which had said `:341-344`). The Work dates cell grows with the windows line and again with the inline list (`bands/WhatBand.tsx:766-799`). The guesses box sits on `--vd-flag-ground` (`globals.css` `.w-box`). `hours_eval` checks only the first work date's day kind (at e331b15 `:313-314`: `day_kind = "weekday" if sched.work_date.weekday() < 5 else "weekend"`).
2. **Rulings.** Item 1 rulings 1-5 (rulings.md, verbatim); R145 S1-S9 (rulings.md).
3. **The change.** Backend: `evaluate_hours_days` and a `hours_days` key on the jurisdiction block (additive). Frontend: the guesses box look 3c with "<k> of <n> checked"; the Work dates cell's result line (two lines reserved, the states of ruling 2 and S2); a row under the grid with the link; a new `WorkHoursDialog` (weekday ruler, whole week, fix button + Undo, legend, source); the inline windows list and its block removed; #490's what phase gets the five states and a 0 px Work dates row check.
4. **Rule 5 churn prediction.**
   - Changes: `src/rules/jurisdiction.py` (+~170: the new function, one block key); `tests/test_hours_days_526.py` (new); `conestruct/site/lib/jurisdiction.ts` (+~40 types); `components/ScheduleField.tsx` (windowsSummary, ScheduleWindows, ScheduleWindowsBlock and rowVerdict replaced by `workDatesLine`, ~-250/+120); new `components/WorkHoursDialog.tsx` (~+350); `components/bands/WhatBand.tsx` (box head, the dates cell, the row under the grid, the dialog, ~+90/-45); `components/GeneratorSidebar.tsx` (props, ~10); `lib/scenarios/why-lines.ts` (datesHint, hoursFrame, seeAllHours replaced by the new copy, ~+60/-15); `app/globals.css` (box look, result line, row, dialog, ~+250/-40; the `.sched-windows` rules removed); `scripts/verify-columns-end-together.mjs` (the five states, the row check, ~+60).
   - Tests that change with the copy: `ScheduleField.windows-block.test.tsx` (deleted with the block), `WhatBand.step2-layout.test.tsx` (windowsSummary → workDatesLine), `GeneratorShell.class-stability.test.tsx`, `GeneratorShell.declined-jurisdiction.test.tsx`, `GeneratorShell.wait-cues.test.tsx`, `WhatBand.guesses-first.test.tsx`, `why-lines.test.ts` (new strings). New: `WorkHoursDialog.test.tsx`, a red-proof test for the class-unset cause.
   - Byte-identical: `hours_eval` and every other key of the jurisdiction block; the audit JSON/PDF, the tier ledger and the exposure figure; the payload the page sends (the fix writes the same `schedule` fields a listbox writes); every device count; WHERE and the rest of the page.
5. **The proof.** pytest for the new function (Denver weekday, weekend, overnight, class unset, Englewood nested, no windows, a 3-week range); vitest for the line's states, the dialog's a11y (focus in, trap, Esc, focus back), the fix and Undo (byte-identical schedule), and a test red on the old code for the class-unset cause. Evidence per the prompt at 1440, 1198x930 and 390 (item-1 parts), #490's what phase with the five states, axe and 44 px, committed here.

## Churn actual (after the diff, against §4's prediction)

`git diff --stat` (tracked), 2026-11-11:

| File | Predicted | Actual | Note |
|---|---|---|---|
| `src/rules/jurisdiction.py` | +~170 | +235 | The function, its helpers (`_subtract`, `_intersect`, `_allowed_spans`, `_wrapped_windows`, the week) and one block key. Larger than predicted; `hours_eval` untouched. |
| `tests/test_hours_days_526.py` (new) | new | +160 | |
| `conestruct/site/lib/jurisdiction.ts` | +~40 | +37 | |
| `components/ScheduleField.tsx` | ~-250/+120 | +65/-255 | `windowsSummary` kept its name (returns `{kind, text}`) instead of a new `workDatesLine`. |
| `components/WorkHoursDialog.tsx` (new) | ~+350 | +483 | Over: the week grid, the ruler's clipped ends, and two walk fixes (the body's focus, the ruler's clipped-end labels, the two-line day names). |
| `components/bands/WhatBand.tsx` | ~+90/-45 | 180 lines changed | |
| `components/GeneratorSidebar.tsx` | ~10 | 12 | |
| `components/BandStack.tsx` | not predicted | 8 | **Miss**: it relays WhatBand's props (`scheduleWindows` out, `hoursVerifying` in). |
| `lib/scenarios/why-lines.ts` | ~+60/-15 | 179 lines changed | Over: the window's words (title, verdicts, weekend, holiday, week note, source) live here too. |
| `app/globals.css` | ~+250/-40 | 359 lines changed | |
| `scripts/verify-columns-end-together.mjs` | ~+60 | 117 lines changed | Over: also the dialog step (size, Esc, focus back) and the carriageway answer (below). |
| `ScheduleField.windows-block.test.tsx` | deleted | -189 (deleted) | As predicted. |
| `WhatBand.step2-layout.test.tsx` | changes | 229 | |
| `GeneratorShell.class-stability.test.tsx` | changes | 93 | The window is read by opening the dialog. |
| `GeneratorShell.declined-jurisdiction.test.tsx` | changes | 6 | |
| `GeneratorShell.wait-cues.test.tsx` | changes | 15 | |
| `WhatBand.guesses-first.test.tsx` | changes | 43 | |
| `lib/scenarios/why-lines.test.ts` | changes | 138 | |
| `components/WorkHoursDialog.test.tsx` (new) | new | +257 | |
| `components/ScheduleField.hours-line-526.test.ts` (new) | "a red-proof test" | +81 | |
| `components/__fixtures__/what-section.ts` | not predicted | +114 | **Miss**: Denver `hours_days` fixtures in the backend's shapes, shared by four suites. |
| `components/__fixtures__/jurisdiction-demo.json` | not predicted | +906 (additions only) | **Miss**: the `hours_days` key added to each of the nine records, from `scripts/regen_jurisdiction_demo_fixtures.py`'s own context against this branch's backend. Additive only: a full regen also changes `applied_deltas` and `permit` in most records (the fixture had drifted from the backend before this branch), so those were left as they were; worth a follow-up regen on its own. |

Byte-identical as predicted: `hours_eval` and every other key of the jurisdiction block (the backend tests pass unchanged), the audit/PDF, tier ledger and exposure figure, the payload (the fix writes `schedule.start_time`/`end_time` only), device counts, WHERE.

Not predicted, outside the code: the columns check's `what` phase had walked a declined plan since #517 (the recorded road's carriageway question was never answered, so every hours line read "Not checked: the plan was declined."; #517's own crops show it). The phase now answers it (One-way) before the dates states.

## Round 2 churn prediction (written before the round-2 diff; Rule 5)

Repair round 2 findings 1-8 (the mission's review). Predicted, per finding:

1. **The outside line is one problem statement, at most N characters** (N = the measured two-line capacity at 390). `lib/scenarios/why-lines.ts` (~+40/-20: one composer for the line, the no-closures date forms, "on every day", the "too" tails); `components/ScheduleField.tsx` (~+10/-10: calls it); `src/rules/jurisdiction.py` (~+8: `job.kind_days`, the count of each day kind in the whole job, for "<n> weekend days"); `lib/jurisdiction.ts` (~+2); new `components/ScheduleField.line-length-526.test.ts` (~+120: every combination over both kinds and the longest name, against N); `scripts/verify-columns-end-together.mjs` (~+50: the worst cases through a `page.route` on the device-breakdown answer).
2. **A day kind with no window on record renders as absence.** `src/rules/jurisdiction.py` (~+20/-5: `record`, status `no_record`, hours_days status `partial`/`no_record`); `tests/test_hours_days_526.py` (~+40); `lib/jurisdiction.ts` (~+6); `lib/scenarios/why-lines.ts` (~+25/-10: the partial and no-record lines, the weekday no-record verdict, `weekendLine` from `record`, the `[[0,24]]` match deleted, "No record" words); `components/ScheduleField.tsx` (~+10); `components/WorkHoursDialog.tsx` (~+40/-10: no band for a no-record kind, the empty dashed week column, its label and legend entry, SR text); `app/globals.css` (~+20); tests in `WorkHoursDialog.test.tsx` and `ScheduleField.hours-line-526.test.ts` (~+60); `components/__fixtures__/what-section.ts` (~+15: `record`, `kind_days`); `components/__fixtures__/jurisdiction-demo.json` (the nine `hours_days` keys regenerated the same additive way, ~+40 lines for the new fields). rulings.md: the per-jurisdiction absence/permission reading. Possibly one follow-up issue (no data edit).
3. **The closed-window trace.** rulings.md and walk.md (words); `WorkHoursDialog.test.tsx` or a WhatBand test (~+40).
4. **plan.md's cite** (words only).
5. **The older-backend fallback.** `components/ScheduleField.tsx` (~+15/-8); `lib/scenarios/why-lines.ts` (~+3: the plain non-verdict line); tests (~+40).
6. **columns-check.txt as UTF-8** (evidence only).
7. **Clip arrows.** `components/WorkHoursDialog.tsx` (~+30/-10: the week view's clipped ends, the colour rule from the backend's outside spans); `app/globals.css` (~+15); tests (~+25).
8. **The hours row reserves the record line.** `app/globals.css` (~+5) and possibly `components/bands/WhatBand.tsx` (~+5: the record line always present, empty when no fix stands); `scripts/verify-columns-end-together.mjs` (~+20: the row's height before the fix, after, after Undo, 0 px).

Byte-identical as before: `hours_eval` and every other key of the jurisdiction block, the audit/PDF, tier ledger, exposure figure, payload, device counts, WHERE.

## Churn actual, round 2 (against the round 2 prediction)

| Finding | Predicted | Actual | Note |
|---|---|---|---|
| 1 | why-lines ~+40/-20, ScheduleField ~+10/-10, jurisdiction.py ~+8, jurisdiction.ts ~+2, new line-length test ~+120, columns check ~+50 | why-lines: the composer (`outsideLine`, `hoursProblem`, `noClosures`), ~+70/-30; ScheduleField ~+40/-15 (with finding 5); jurisdiction.py `kind_days` +6; new `ScheduleField.line-length-526.test.ts` +134; columns check +~85 (worst cases through both the breakdown and the audit answers) | **Not predicted:** `app/globals.css` (+~20, rulings S20). The line's reserve follows its own width because the two-column line (263 px) is narrower than 390's (328 px). The first injected run failed by 17.5 px at 1440 and 1198. |
| 2 | jurisdiction.py ~+20/-5, test ~+40, jurisdiction.ts ~+6, why-lines ~+25/-10, ScheduleField ~+10, WorkHoursDialog ~+40/-10, css ~+20, tests ~+60, fixtures ~+15, demo json ~+40 | jurisdiction.py +32/-3; test_hours_days_526.py +70; jurisdiction.ts +7; WorkHoursDialog ~+90/-20 (with finding 7); css ~+35; tests ~+90; what-section.ts +30; demo json +48 lines (the nine `hours_days` regenerated, additive only) | Roughly as predicted. WorkHoursDialog is over because finding 7 shares it. Follow-up #530 was filed; no data edit. |
| 3 | words + ~40 test | rulings S17, walk.md; WorkHoursDialog.test.tsx +~55 | As predicted. |
| 4 | words | plan.md §1: three cites corrected by subject (the predicted one and two more found while checking it: `:302-307` → `:305-310`, `:310-314` → `:313-314`) | Two more than predicted. |
| 5 | ScheduleField ~+15/-8, why-lines ~+3, tests ~+40 | ScheduleField +14/-7, why-lines +4, tests +40 | As predicted. |
| 6 | evidence only | columns-check.txt rewritten as UTF-8 (no BOM, decoded strictly, no mojibake) | |
| 7 | WorkHoursDialog ~+30/-10, css ~+15, tests ~+25 | inside WorkHoursDialog's ~+90 above; css +~25; tests +~35 | |
| 8 | css ~+5, WhatBand ~+5, columns check ~+20 | css +10; WhatBand +12/-8 (the slot wraps the record); columns check +~20 | As predicted. |

Also changed, not predicted: why-lines `noRecordDays` drops "work" to fit N (S18). The "No record" label was moved to the column's top after the 390 crop showed the hours line crossing it.

## Round 2 rework: churn prediction (written before the rework diff; Rule 5)

The review withdrew S20 (it reverses ruling 2's "room reserved for two lines in every state") and asked for the "No record" label to cover nothing.

- **S20 out, S21 in.** `app/globals.css` (~-20: the container query and the 3/4-line reserves removed). `lib/scenarios/why-lines.ts` (~+25/-15: a short-name helper `shortName`; `outsideLine` merges a second problem kind into one name-free sentence). `components/ScheduleField.tsx` and `components/bands/WhatBand.tsx` (~+5 each: the line and the row under the grid use the short name; the dialog title keeps the block's name). `components/GeneratorSidebar.tsx` (~2, if the picked option's name is passed). Tests: `ScheduleField.line-length-526.test.ts` (~+30/-30: every state with every short name from `JURISDICTION_OPTIONS`, N re-measured at the narrowest line); `lib/scenarios/why-lines.test.ts` (~+10/-10); `ScheduleField.hours-line-526.test.ts`, `WhatBand.step2-layout.test.tsx` and others only if a line's wording changes (~±10). `scripts/verify-columns-end-together.mjs` (~±5: the worst-case names).
- **The "No record" label.** `components/WorkHoursDialog.tsx` (~+5/-5: the label moves out of the column into the day's header) and `app/globals.css` (~+10/-20); `WorkHoursDialog.test.tsx` (~±5).
- **Evidence:** rulings.md (S20 withdrawn, S21), strings.md, walk.md, columns-check.txt, plan.md (this, plus the churn actual), the draft commit message, and re-taken crops for the changed states.

## Round 2 rework: churn actual (against the rework prediction)

| Item | Predicted | Actual |
|---|---|---|
| S20 out | globals.css ~-20 | globals.css -21 (the container query and the 3/4-line reserves); the cumulative globals.css diff went 426 → 406 lines |
| S21a short name | why-lines ~+10, ScheduleField ~+5, WhatBand ~+5, GeneratorSidebar ~2 | why-lines +14 (`shortName`); ScheduleField +4/-1 (the line's `j`); WhatBand +7/-4 (the row under the grid); GeneratorSidebar unchanged (the line derives the short name from the key) |
| S21b merged sentence | why-lines ~+15/-15 | why-lines +38/-33 (`outsideLine` rewritten) |
| S21c the test | line-length test ~±30 | rewritten, 134 → 152 lines (every key in `JURISDICTION_OPTIONS`, two N's) |
| Wording in tests | ~±10 | why-lines.test.ts +45/-20 (the merged lines, `shortName`); WhatBand.step2-layout.test.tsx ±1 (the no-data case picks `cdot`) |
| S22 the label | WorkHoursDialog ~±5, css ~+10/-20, test ~±5 | WorkHoursDialog +8/-2; css +12/-18 (the caption row, `grid-template-rows: 34px 240px auto`); WorkHoursDialog.test.tsx unchanged (the selector still holds) |
| The columns check | ~±5 | verify-columns-end-together.mjs +11 (the worst cases on Centennial, plus its no-data line; the row expects 10 states) |

No miss outside the prediction.
