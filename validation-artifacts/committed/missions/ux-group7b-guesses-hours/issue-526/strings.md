# #526 new user-facing strings

Ruling 5: "List every new string with its source." `<j>` in the Work dates line and the row under the grid is the picked jurisdiction's short name: the picker's label (`JURISDICTION_OPTIONS`) without its parenthetical, falling back to the block's name for a key not in the picker (`why-lines.ts` `shortName`, R145 S21a). The work-hours window's title keeps the block's name. `<a>`/`<b>` are hours from the backend's `hours_days` (fix pairs, allowed spans) or the page's own start and end, written by `clock()` ("8:30 am", "noon", "midnight", the board's own clock words; since round 3, S26, a non-breaking space joins the number and am/pm). Dates are the backend's `job.kind_dates`, written by `dateList()` ("Nov 7 and 8", "Nov 30, Dec 1 and 2"). Every string below is minted in `conestruct/site/lib/scenarios/why-lines.ts` unless another file is named.

## The guesses box (ruling 1)

| String | Where | Source |
|---|---|---|
| `<k> of <n> checked` | box heading row, right (`WhatBand.tsx`) | Ruling 1: "'<k> of <n> checked' on its right in `--ink-mute`" |

## The Work dates result line (ruling 2, R145 S2, S4)

| String | Source |
|---|---|
| `Optional. We check your dates and times against <j>'s work hours.` | Ruling 2, no dates (verbatim) |
| `Add a start and end time to finish the check.` | Ruling 2, dates no times (verbatim) |
| `Fits <j>'s work hours on every day.` (with ✓) | Ruling 2, fits (verbatim) |
| `We don't have <j>'s work hours yet, so we can't check your dates.` | Ruling 2, no data (verbatim) |
| `Pick a street class to finish the check.` | R145 S2 (the second cause of "set dates to check") |
| `Checking your dates against <j>'s work hours.` | R145 S2 (wait state) |
| `Not checked: the plan was declined.` | R145 S2 (wait state; #425's words) |
| `Check failed: the check didn't answer.` | R145 S2 (wait state; #425's words) |
| `Optional. Pick a jurisdiction to check your dates against its work hours.` | R145 S2 (no jurisdiction) |
| `Starts before <a> and ends after <b> on weekdays.` / `on weekends.` / `on every day.` | R145 S4, from ruling 2's "Starts before 9 am on weekdays."; "on every day" is round 2's S12 |
| `Starts before <a> on weekdays.` / `on weekends.` | R145 S4; ruling 2's example |
| `Runs past <b> on weekdays.` / `on weekends.` | R145 S4 |
| `Falls outside the allowed hours on weekdays.` / `on weekends.` | R145 S4 |
| `<dates> are a weekend: no closures.` | R145 S4; ruling 2's "Nov 7 and 8 are a weekend: no closures." |
| `<date> is a weekend day: no closures.` / `<dates> are weekdays: no closures.` / `<date> is a weekday: no closures.` | R145 S4 (the one-date and weekday forms of the same sentence) |
| `<n> weekend days in your dates: no closures.` / `<n> weekdays in your dates: no closures.` | Round 2, R145 S12 (the review's wording: three or more dates are counted) |
| ~~`Weekends too.` / `Weekdays too.`~~, ~~`Weekends: no closures.` (as a tail)~~ | Round 2, R145 S12: **removed** in the rework (S21b) |
| `Outside the allowed hours on weekdays and weekends.` | Rework, R145 S21b (the review's wording) |
| `Outside the allowed hours on weekdays; no closures on weekends.` (or swapped) | Rework, R145 S21b (the review's wording) |
| `No closures on weekdays or weekends.` | Rework, R145 S21b (CC's wording, the same pattern) |
| `Fits <j>'s weekday hours. We don't have its weekend hours.` (and swapped) | Round 2, R145 S10 (the review's wording; no check mark) |
| `We don't have <j>'s hours for these days, so we can't check them.` | Round 2, R145 S10 and S18 (the review's wording without "work", to fit N) |
| `We can't check your dates against <j>'s work hours yet.` | Round 2, R145 S15 (the review's wording: an older backend's answer) |
| `Goes outside <j>'s work hours.` | `ScheduleField.tsx` fallback when the backend says "outside" and no day-kind sentence applies (should not occur; Rule 10: never an empty line). CC's own wording, flagged for review. |

## The row under the grid (ruling 2; the record per Ryan's P15 ruling of 2026-11-12, which replaced S9)

| String | Source |
|---|---|
| `<j> limits when you can close a lane.` | Ruling 2 (verbatim) |
| `See <j>'s work hours` | Ruling 2 (verbatim) |
| `We don't have <j>'s work hours yet.` | Ruling 2: "With no data for the jurisdiction, the row says so and has no link." (ruling 2's no-data words, shortened to the row) |
| `Hours changed to <a> to <b>.` + `Undo` | Ryan's P15 ruling, 2026-11-12 (replaced S9; group U's Undo): stays until Undo or a pin move |

## The work-hours window (ruling 4, R145 S5-S8; board `Demo`)

| String | Where | Source |
|---|---|---|
| `<j>'s work hours` | title | Ruling 4 (verbatim) |
| `When you can close a lane on a <class> street.` / `an arterial street.` | line under the title | Ruling 4: "The line under it gives the street class" (board `Demo` wording) |
| `Street class not set, so the hours for it aren't known.` | line under the title | Ruling 4 + Rule 10 (no class, no class-scoped hours) |
| `Your hours: <start> to <end>.` | line under the title | Ruling 4 (verbatim) |
| `Close` | button (`WorkHoursDialog.tsx`) | Ruling 4: "Esc and Close close it" |
| `A weekday`, `The whole week` | switch; also the scroll region's name | Ruling 4 (verbatim) |
| `Show` | switch group's aria-label (`WorkHoursDialog.tsx`) | CC (screen-reader name for the switch) |
| `Your hours fit on weekdays.` (with ✓) | weekday verdict | Ruling 4: "A plain verdict sentence" (board `Demo`) |
| `Your hours go outside what <j> allows on weekdays.` | weekday verdict | Ruling 4: "A plain verdict sentence" (board `Demo`) |
| `Change my hours to <a> to <b>` | fix button | Ruling 4 (verbatim); the pair is R145 S3's backend fix window |
| `Set a start and end time on the page to see your hours here.` | weekday, no times | Ruling 4 + Rule 10 (no hours, no verdict) |
| `Pick a street class on the page to see its hours here.` | weekday, no class | R145 S2 (class-scoped windows) |
| `Weekends: none on record.` | weekend line | R145 S8 (verbatim); round 2: shown from the backend's `record: "none"`, never from 0..24 spans |
| `We don't have <j>'s weekday hours for this street class.` | weekday verdict, no record | Round 2, R145 S10 (the review's wording) |
| `No record` | whole-week column label and key entry (only when shown) | Round 2, R145 S10 (the review's wording) |
| `No hours on record.` | each no-record week day, screen readers only | Round 2, R145 S10 (the review's wording) |
| ` Outside: <a> to <b>.` | appended to an in-job week day's screen-reader text when your hours go outside there (spans from `outside`) | Round 3, R145 S25 (Rule 13) |
| `▴`, `▾` | week columns' clipped ends (decorative) | Round 2, R145 S14 (finding 7: the ruler's arrows, in the week) |
| `Weekends: no lane closures.` | weekend line | Ruling 4: "One line for weekends"; R145 S4's "no closures" |
| `Weekends: needs a street class.` | weekend line | R145 S2 |
| `Weekends: <a> to <b>.` (spans joined with "and") | weekend line | Ruling 4: "One line for weekends" |
| `Your dates include <dates>.` | weekend line, appended | Ruling 4 / R145 S4 (the job's weekend dates) |
| `No closures on holidays. We don't check your dates against holidays yet.` / `...on holidays and the day before...` | holiday line | R145 S7 (the data has the rule, no dates) |
| `Your dates run <start> to <end>, so the other days are greyed out.` | week note | Ruling 4: "A line under the grid says how the job's dates relate to the week"; R145 S5 |
| `Your dates run <start> to <end>, the whole week.` | week note | same |
| `Your dates run <start> to <end>. This is the first week; every week has the same hours.` | week note | R145 S5 (verbatim reasoning) |
| `Pick work dates on the page to see your days here.` | week note, no dates | Ruling 4 + Rule 10 |
| `Mon` ... `Sun` + day of month | week columns (`WorkHoursDialog.tsx`) | Ruling 4: "Days across" (board `Demo`) |
| `Allowed`, `Your hours`, `Outside what's allowed` | legend (`WorkHoursDialog.tsx`) | Ruling 4 (verbatim) |
| `Key` | legend aria-label (`WorkHoursDialog.tsx`) | CC (screen-reader name for the legend) |
| `Source: <doc> <section>, <Mon D, YYYY>` | foot | Ruling 4: "a 'Source: <rule name and date>' line from the backend" |
| `No closures.`, `Needs a street class.`, `Allowed <a> to <b>, ...` | each week day, screen readers only | Ruling 4 (the day's band in words; Rule 13 second channel) |
| `◂`, `▸` | ruler ends (decorative) | R145 S6 ("an arrow at the clipped end") |
| ruler ticks `6 am`, `9 am`, `noon`, `3 pm`, `6 pm` | ruler / week scale | Ruling 4's 5 am to 9 pm ruler; tick choice CHOSEN (board's) |

## Removed

"set dates to check", "◌ loading", "✓ fits your dates", "⚠ <n> h outside the permitted ... window", "<j>'s work hours: <verdict>" frame, "See all of <j>'s work hours", "Optional. We check them against <j>'s work hours.", and #227's inline windows table (ruling 2: "The inline windows list goes away").

## Checks

- No new hex in the diff: `git diff -U0 -- conestruct/site | grep -E "^\+.*#[0-9a-fA-F]{3,6}\b"` matches only issue references (#152, #188, #199, #398, #517, #526); no colour literal. Every colour in the new rules is a token.
- No `--vd-flag-ground` in the box rules: the `.workbench .w-box*` rules (globals.css) no longer use it; the removed line is `-  background: var(--vd-flag-ground);`. Its remaining uses are other surfaces (`.status-bar.caution`, `.map-window .mw-status`, `.dl-warn`, `.a-aerial-frame[data-bar="none"] .a-aerial-bar`).
- Unslop: no em dashes, no "seamless/robust/leverage"-class words in the new strings; sentences are plain and short.

## Round 2 checks

- Every Work dates line, every outside combination over both day kinds and every other state, with the records' longest name ("E-470 Public Highway Authority"), is at most N = 95 characters (`ScheduleField.line-length-526.test.ts`; N measured at 390, rulings.md S13).
- No new hex in round 2's diff; the new rules use `--rule`, `--ink-faint`, `--dim` only.

## Rework checks (S21)

- `<j>` in the Work dates line and in the row under the grid is the picker's short name (no parenthetical): "CDOT", not "CDOT (state highway)"; the window's title keeps the block's name.
- Every line is within N at the narrowest (263 px) line: 77 characters plain, 68 with the mark, for every jurisdiction in `JURISDICTION_OPTIONS` (`ScheduleField.line-length-526.test.ts`). The round-2 limit of 95 is withdrawn with S20.
- The whole week's `No record` is now a caption under the column (`aria-hidden`; screen readers keep `No hours on record.`).
- No new hex in the rework.
- Round 3 (S23): the whole week's `No record` is one caption per run of no-record days (Mon-Fri or Sat-Sun), spanning its columns, not one per day.
