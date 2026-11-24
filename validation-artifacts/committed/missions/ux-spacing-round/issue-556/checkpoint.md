# #556 checkpoint (written before the diff)

- **Problem.** Three defects in the work-hours window, all on the base `d46b0914`:
  - a. The key (`conestruct/site/components/WorkHoursDialog.tsx:294-317`) has no entry for the striped no-closures days (`:553`, `.whd-closed` at `conestruct/site/app/globals.css:6572`).
  - b. With no street class the backend sends `allowed: null`, and your hours still draw as the solid inside bar: the hollow class is given only on a no-record day (`WorkHoursDialog.tsx:423` on the ruler, `:564` in the week). The line shown is `SET_CLASS_TO_SEE` (`:371`; `conestruct/site/lib/scenarios/why-lines.ts:848`).
  - c. At 390x844 the week note (`why-lines.ts:880-889`, drawn at `WorkHoursDialog.tsx:620-622`) is two lines and the body is 15 px short (342 px against 357 px; the window's height is set at `globals.css:6306`).
  - The before shots are in `validation-artifacts-extra/spacing-round-before/` (untracked, main checkout, not committed; nothing here rests on them).
- **Rulings.** Ryan's item 2 (2026-11-24), word for word in `rulings.md`, plus R145 S1 to S11 there (S12 was added in gate round 2; see the amendment below). The main ones: the key entry shows exactly when stripes are drawn (S1); "not checked" is the backend's `allowed: null` and takes the hollow dashed bar no-record days already have (S3, S4); the notice replaces the old line (S5); the note's strings (S8, S9); the window is 640 px tall at 600 px wide and under so the two-line note fits (S10, CHOSEN).
- **The change.**
  - `WorkHoursDialog.tsx`: the key takes a second flag and gains the "No closures allowed" entry; your hours take `is-unchecked` when the day has a record and `allowed` is null, in both views; the notice shows at the top of both views.
  - `lib/scenarios/why-lines.ts`: `weekNote()` rewritten to the ruled wording; `SET_CLASS_TO_SEE` replaced by the notice's constant; one new constant for the key's label.
  - `app/globals.css` (`.whd-*` only): the striped key swatch; the window's height at 600 px wide and under; the comment on `.whd-yours.is-unchecked`.
- **Churn prediction (Rule 5).**
  - Code files changed: 5. `conestruct/site/components/WorkHoursDialog.tsx`, `conestruct/site/components/WorkHoursDialog.test.tsx`, `conestruct/site/lib/scenarios/why-lines.ts`, `conestruct/site/lib/scenarios/why-lines.test.ts`, `conestruct/site/app/globals.css`.
  - New files: this evidence folder only (`rulings.md`, `checkpoint.md`, `red-proof.md`, `red-output.txt`, `strings.md`, `walk.md`, `script/`, `crops/`, measures).
  - Tests that change: two existing assertions on the old week note (`WorkHoursDialog.test.tsx:164-166`, and the "S5: the week note" test at `why-lines.test.ts:293-305`) are rewritten to the new strings. A new `#556` describe is added to `WorkHoursDialog.test.tsx`. Every other test in both files stays as written and stays green. `lib/design/type-census.test.ts` stays green with no edit (no new font-size rule).
  - Behavior that changes, on purpose: the key gains one entry in a week with a no-closures day; with no street class your hours draw hollow and dashed in both views and the top line reads the ruled notice (new in the whole-week view); the week note's wording in every case with dates; the window is 40 px taller at 600 px wide and under.
  - Byte-identical: everything under `src/`, `data/`, `tests/`, `scripts/`; `lib/jurisdiction.ts` and every other file under `conestruct/site/lib/` but the two named; `WhatBand.tsx`, `ScheduleField.tsx`, the fixtures; the 6 am to 6 am scale, ticks, bands, labels and the midnight line (#555); the inside and outside bars and their colours; the no-record state (hollow bar, dashed column, caption, key entry); the stripes on the days; every screen-reader sentence; every string the window shows except the week note, the class notice and the new key label; the window's size above 600 px wide; the heights of the ruler's track (28 px), the week's columns (240 px) and its caption row (32 px); the clip marks and the "R145 S9" comment (#557's).
- **The proof.** Mounted tests (Rule 11) that fail on the base and pass on the fix: `render(<WorkHoursDialog … />)` with the backend's own fixture shapes for a no-closures weekend and for `missing: street_class`, in both views, and the note's text for each case (`red-proof.md`). Then a headless walk on a local dev server at 1440x900, 1198x930 and 390x844 with axe, the 44 px measure, and the note's last line measured against the body's visible box (`walk.md`, `crops/`).

## Churn note, amended in gate round 2 (2026-11-24)

Written in round 2 after its diff, not before it: the round-2 change was made first and this records it. The round-1 review found that the no-street-class fit at 390 was measured with the wrong subtitle, and that the one-day note read oddly. Round 2, same five files, about 25 lines:

- `globals.css`: one new rule, `.workbench .whd-note` (sticky at the body's bottom edge, on the window's ground). Rulings: S12.
- `WorkHoursDialog.tsx`: the note takes the `whd-note` class, with a comment.
- `WorkHoursDialog.test.tsx`: the existing "c:" test on the body also pins the class and the rule. No new test.
- `why-lines.ts` and `why-lines.test.ts`: the one-day note becomes "Your date: Wed Dec 9. No work on the other days."
- Behavior that changes, on purpose: when a week view is taller than the body, the note stays whole at the body's bottom edge and the chart scrolls behind it. When the view fits, nothing moves. The one-day note's second sentence.
- Byte-identical: everything the first prediction listed, and the round-1 changes other than the two above.

## After the diff: predicted against actual

- Code files changed: 5 predicted, 5 actual, both rounds together (`globals.css` +35/-1, `WorkHoursDialog.tsx` +43/-9, `WorkHoursDialog.test.tsx` +146/-1, `why-lines.ts` +27/-6, `why-lines.test.ts` +26/-3). Nothing under `src/`, `data/`, `tests/` or `scripts/` changed, and no other file under `conestruct/site/`.
- Tests: the two old week-note assertions rewritten and one `#556` describe added (9 tests), as predicted. One difference from the first prediction: `why-lines.test.ts` also gained one new test ("#556: the week note names the days that aren't in the dates"), which it didn't name. Round 2 added no test. The other 45 tests in `WorkHoursDialog.test.tsx` and the other 20 in `why-lines.test.ts` are untouched and pass. `type-census.test.ts` passes with no edit.
- Behavior: the four changes of the first prediction and the two of the amendment, and no other. The walk read the inside bar as `rgb(234, 240, 247)` and the outside bar as `rgb(255, 138, 46)` in the states with a street class, the same values #555's walk recorded.
- S11 needed no code: the body already scrolled. S12 (round 2) is the sticky note.
- One follow-up filed, not folded in: https://github.com/rtmakatura/conestruct/issues/561.
