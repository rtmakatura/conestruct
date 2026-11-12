# #526 walk: the guesses box, the Work dates line, the work-hours window

Walked 2026-11-11 on `issue-526-guesses-hours` (uncommitted work on `e331b158`). Item 1 parts only; the map window and the duplicate road are item 2.

**Setup.** Local site (`next dev` on :3000, the worktree's site, started by #517's `walk-script/launch-site.cjs` with `MODAL_RENDER_URL` pointed at the stub) and the stub backend (`scripts/verify-generate-cls-stub.py` on :8000, Overpass replayed, never live: the two committed fixture dirs plus a copy of #517's recorded backend fixture). Secrets and the gate token were read raw from the main checkout's `conestruct/site/.env.local` and never printed. Chromium via Playwright, headless, DPR 1. Pin: 1550 E Colfax Ave, Denver (the recorded road; `/api/road-bearing` stubbed from the Colfax fixture, as the columns check does). Sizes 1440x900, 1198x930 and 390x844. Both servers and every browser were stopped after the walk (process trees killed; no listener on :3000 or :8000, no Playwright browser left).

The crop walk is `scripts/verify-columns-end-together.mjs` with its `what` phase swapped for a crop walk (kept uncommitted at `validation-artifacts-extra/ux-group7b-guesses-hours/issue-526/walk526.mjs`). Its console log (every crop's text) is `.../issue-526/walk-run2.log`.

## The columns check (#490, `what` phase, extended by this item)

`columns-check.txt` (final run, RESULT PASS). The five ruled Work dates states and their row height:

```
Work dates row (#526), 1440x900: no-dates 106, no-times 106, fits 106, outside 106, no-data 106 px; diff 0 px PASS
Work dates row (#526), 1198x930: no-dates 106, no-times 106, fits 106, outside 106, no-data 106 px; diff 0 px PASS
Work dates row (#526), 390x844: no-dates 173.5, no-times 173.5, fits 173.5, outside 173.5, no-data 173.5 px; diff 0 px PASS
Work-hours window (#526), 1440x900: size 560x600, day vs week 0 px, Esc closes true, focus back true PASS
Work-hours window (#526), 1198x930: size 560x600, day vs week 0 px, Esc closes true, focus back true PASS
Work-hours window (#526), 390x844: size 358x600, day vs week 0 px, Esc closes true, focus back true PASS
WHAT section (#517): 14 states x 3 size/zoom runs, 42 readings: two-column grids, where each column's content ends (#520), max 0 px; controls under 44 px in 0 readings; axe violations in 0 readings
```

The lines read in each state (all three sizes):

| State | Line |
|---|---|
| no dates | Optional. We check your dates and times against Denver's work hours. |
| dates, no times | Add a start and end time to finish the check. |
| fits (9 to 15, Mon Nov 16 to Fri Nov 20 2026, collector) | ✓ Fits Denver's work hours on every day. |
| outside (7 to 17) | Starts before 8:30 am and ends after 3:30 pm on weekdays. (orange mark) |
| no data (Jurisdiction CDOT) | We don't have CDOT's work hours yet, so we can't check your dates. |

axe (on `[data-testid=band-what]`, which holds the dialog when it is open): 0 violations in all 42 readings, the dialog's two views included. 44 px: 0 shown controls under 44 px in all 42 readings (the dialog's Close, switch, fix button, Undo and the "See Denver's work hours" link included).

## Crops (`crops/w526-<state>-<width>.png`, 24 states x 3 sizes = 72)

| State | What it shows |
|---|---|
| box-0, box-1, box-3 | The guesses box (3c): the warn strip, "Check these 3 guesses" with "0 of 3 checked", "1 of 3 checked" (street class picked), "3 of 3 checked" (jurisdiction and road type confirmed). The pin offers 3 guesses, so 0, 1 and 3 were all reachable. |
| dates-none, hours-row | The no-dates line; the row under the grid: "Denver limits when you can close a lane." and "See Denver's work hours". |
| dates-no-times, dates-fits, dates-outside | The line's states as above. |
| dialog-fits-day / -week | Fits: ✓ verdict, the 8:30 am to 3:30 pm band with the hours inside it; the week with Sat and Sun greyed (not in the job). |
| dialog-outside-day / -week | Outside: the hours in `--dim` past both ends of the band, "Change my hours to 8:30 am to 3:30 pm". |
| dialog-fixed-day, hours-row-fixed, dates-fixed | After the fix: "Hours changed to 8:30 am to 3:30 pm." with Undo in the window and in the row; the line reads fits. Focus is back on the link (its ring shows in hours-row-fixed). |
| dates-undone | After Undo: back to 7 am to 5 pm, the outside line. |
| dates-weekend, dialog-weekend-day / -week | Mon Nov 16 to Sun Nov 22, 9 to 15: "Weekends: none on record. Your dates include Nov 21 and 22."; the whole week, none greyed. |
| dates-night, dialog-night-day / -week | 8 pm to 5 am: fits (Denver's 8 pm to 5 am window); the ruler clips at 9 pm with arrows at both ends (S6). |
| dates-no-data, hours-row-no-data | CDOT: the no-data line; the row says "We don't have CDOT's work hours yet." with no link. |

Not crop-able here: a weekend with no closures. Denver has no weekend rule, and no fixture road in the replayed set sits in a jurisdiction that bans weekends, so the "<dates> are a weekend: no closures." line and the striped days are proved by tests only (`ScheduleField.hours-line-526.test.ts`, `WorkHoursDialog.test.tsx`), not by a crop.

## What didn't pass first time (fixed in this item)

1. **The check walked a declined plan.** The first run read "Not checked: the plan was declined." in every state: the recorded road's carriageway question ("The map couldn't tell. Pick one.") was never answered, so the audit declined (local `/api/render/audit` 400). #517's columns crops show the same line, so the old phase never saw a live verdict. The phase now answers it (One-way) before the dates states.
2. **axe `scrollable-region-focusable` on the dialog's body** (all sizes, day view; the week view at 390). The body scrolls inside the fixed size; it now takes focus (`tabIndex=0`, `role="region"`, named by the view).
3. **The weekday ruler's clipped labels.** The 8 pm to midnight window, clipped at the ruler's 9 pm end, printed "8 pm" and "midnight" on top of each other at the edge ("8 pmmidni"). A clipped end now takes no label.
4. **The week's day names at 390.** "Mon 16Tue 17..." ran together and Sun 22 was cut off. The name and the date are now two lines.

## Seen, not changed (for review)

- **(Fixed in round 2, finding 2.) Weekends "none on record" drew as a full Allowed band** in the whole-week view, while the weekday view's line says "Weekends: none on record." (S8: absence, not a permission). The backend reports those days as allowed 0 to 24, and the week grid draws what it is given. Whether such a day should draw blank (or striped differently) is a design call; not changed here.
- **(Fixed in round 2, finding 7.) The clip arrows were `--dim` (orange) even when the hours fit** (night work, 8 pm to 5 am: ✓ verdict, orange arrows at both ends). They mark a clipped end, not a problem, but share the "outside" colour.
- **The demo fixture had drifted** (`components/__fixtures__/jurisdiction-demo.json`): a full regen against this branch also changes `applied_deltas` and `permit` in most records. Only the new `hours_days` key was added; the drift is worth its own regen.

## Repair round 2 (findings 1-8)

Same setup as above (local site and stub backend, Overpass replayed, headless Chromium, DPR 1). Both servers and every browser were stopped after the round: process trees killed, nothing listening on :3000 or :8000, no Playwright browser left.

### The line's capacity, N (finding 1)

Measured in the page (`validation-artifacts-extra/.../issue-526/measure526.mjs`, the columns script with a measuring `what` phase). On the confirmed Colfax plan, the Work dates line's text node was set to growing prefixes of four probes, each cut at a word end. The probes were the line's own sentences with the records' longest name, "E-470 Public Highway Authority" (the no-record, outside-with-tail, no-dates and partial lines), plus one all-capitals worst case. The line was counted by its height over the 17.5 px line height (Inter 12.5 px).

| Width | Line | 2 lines hold (characters) | 3 lines hold |
|---|---|---|---|
| 390x844 | 328 px | 100, 102, 105, 103 (all-capitals 59) | 149-156 |
| 1440x900, 1198x930, 1024x768 | 263 px | 76, 82, 80, 78 (all-capitals 49) | 117, 126, 122, 111 (all-capitals 74) |

**N = 95**: the smallest realistic 2-line capacity at 390 (100), less a 5 % margin. `components/ScheduleField.line-length-526.test.ts` enumerates every outside combination over both day kinds: 8 x 8 kinds (inside; starting early; running late; both, with 12:30 pm; a second "both"; misses; no closures; no record) x 3 date sets (1, 2 and many no-closure dates). It also covers every other state. All use the longest name, and all stay within 95 characters.

**Found while measuring.** In the two-column grid the line is narrower than at 390, so a long-name line takes three lines there. The first injected columns run showed it: worst-closures, worst-no-record and worst-partial grew the row by 17.5 px at 1440 and 1198. Fixed (rulings.md S20): the Work dates control column is a size container. Below 320 px of line three lines are reserved (four below 215 px); at 390 it stays two, as ruled. The row is now 123.5 px in every state at 1440 and 1198 (it was 106), and 173.5 px at 390 (unchanged). **Flagged for Ryan:** this adds a third reserved line at the two-column widths.

### The columns check (`columns-check.txt`, RESULT PASS)

```
Work dates row (#526), 1440x900: no-dates 123.5, no-times 123.5, fits 123.5, outside 123.5, worst-two-kinds 123.5, worst-closures 123.5, worst-no-record 123.5, worst-partial 123.5, no-data 123.5 px; diff 0 px PASS
Work dates row (#526), 1198x930: (the same nine states) 123.5 px each; diff 0 px PASS
Work dates row (#526), 390x844: (the same nine states) 173.5 px each; diff 0 px PASS
Hours row reserve (#526 round 2), 1440x900 and 1198x930: before 100, fixed 100, undone 100 px; diff 0 px PASS
Hours row reserve (#526 round 2), 390x844: before 117.5, fixed 117.5, undone 117.5 px; diff 0 px PASS
Work-hours window (#526): 560x600 (358x600 at 390), day vs week 0 px, Esc closes, focus back: PASS at all three sizes
WHAT section (#517): 20 states x 3 size/zoom runs, 60 readings: max 0 px; controls under 44 px in 0 readings; axe violations in 0 readings
```

The worst cases are injected into the device-breakdown and audit answers (`page.route`; the block's name and its `hours_days`; layout content only). No recorded road produces them. The lines they read:

| State | Line |
|---|---|
| worst-two-kinds | Starts before 12:30 pm and ends after 12:30 pm on weekdays. Weekends too. |
| worst-closures | Starts before 12:30 pm and ends after 12:30 pm on weekdays. Weekends: no closures. |
| worst-no-record | We don't have E-470 Public Highway Authority's hours for these days, so we can't check them. |
| worst-partial | Fits E-470 Public Highway Authority's weekday hours. We don't have its weekend hours. |

### Crops (round 2)

All 24 earlier states were re-taken on the round-2 code (they replace the earlier files in `crops/`; the earlier ones are kept in `validation-artifacts-extra/.../issue-526/crops-run2/`). Five states are new, at the three sizes: `dates-worst-two-kinds`, `dates-worst-closures`, `dates-worst-no-record`, `dates-worst-partial` and `dialog-undone-day`. That makes 87 files.

What changed in the crops:

- **dates-weekend and dates-night** (Mon Nov 16 to Sun Nov 22): now "Fits Denver's weekday hours. We don't have its weekend hours." with no check mark. Denver's weekends have no window on record; round 1 said "Fits … on every day" with a ✓, a Rule 10 miss.
- **The whole-week views** (fits, outside, weekend, night): Sat and Sun, where in the job, are empty dashed columns labelled "No record" with no Allowed band. "No record" joins the key. In the Mon-Fri jobs those days are also greyed (not in the job).
- **dialog-night-day**: the clip arrows are --ink-faint, since the night hours fit.
- **dialog-undone-day**: after Undo the window is back on 7 am to 5 pm, the outside verdict and the fix button.

A no-record weekend is shown by dialog-weekend-week; a no-closure weekend still has no real road and is proved by tests only.

### Finding 3: Street class or Jurisdiction changed while the window is closed

Every input change refires the device-breakdown fetch. In `GeneratorShell.tsx` the wire scenario is debounced (`useDebouncedScenario(wireScenario, FETCH_DEBOUNCE_MS)`), and the breakdown answer carries the jurisdiction block. GeneratorShell's stale-while-revalidate block (the comment beginning "#152 D — stale-while-revalidate keyed by jurisdiction_key") holds the same key's last block while the refetch is in flight. It sets `jurisdictionRevalidating`, which the sidebar passes as `hoursVerifying`; a changed key has no block to hold. The window keeps no copy: it renders from the live `jurisdictionBlock` each time it opens. While a refetch is in flight its verdict reads "Checking your dates against <j>'s work hours." `WorkHoursDialog.test.tsx` ("inputs changed while the window is closed") rerenders with a new street class and jurisdiction while closed, opens the window, and reads the new title, sub-line and verdict. It also reads the checking line while `hoursVerifying` is set.

### Seen, not changed (round 2)

- (Fixed in the rework, S22.) On a no-record day in the whole week, the "No record" label sat at the column's top on the dialog's ground. Hours before about 6:30 am, and the top clip arrow, are under it on those days. The arrow still shows on days with a record.
- The weekend rules that the records state only in prose (Parker, Englewood, Centennial, E-470, Littleton, Thornton; Greeley's and Westminster's "all" days) are follow-up #530. Absence stays the rendering until then.

## Round-2 rework (S20 withdrawn, S21, S22)

Same setup. Both servers and every browser were stopped afterwards: nothing listening on :3000 or :8000, no Playwright browser left.

**S20 is withdrawn** (it reversed ruling 2). Two lines are reserved at every width again, and every line is written to fit the narrowest measure. The round-2 section above records S20's 3-line reserve and its 123.5 px desktop row; both are superseded here.

### The line's capacity at the narrowest width (S21c)

Measured with `measure526.mjs` (extra folder) at 1440x900, 1198x930, 1024x768 and 390x844. The narrowest line is 263 px, at 1440, 1198 and 1024 (390's is 328 px). Four probes in the line's own words used the picker's longest short name, "Centennial". Each was cut at a word end and tried with no mark and with the --dim mark.

| Width | Plain: 2 lines hold | Marked: 2 lines hold |
|---|---|---|
| 263 px (1440, 1198, 1024) | 82, 81, 83, 82 | 72, 75, 75, 73 |
| 328 px (390) | 96, 104, 102, 103 | 96, 99, 92, 97 |

**N = 77 plain, 68 marked** (5 % off the 263 px minimums). The same run rendered all 117 exact candidate lines at every width: every state with every short name, the merged and longest-clock outside lines, and the no-closure date forms. Maximum: 2 lines; none took a third. The longest ruled verbatim line is "We don't have Centennial's work hours yet, so we can't check your dates." (73, plain). It fits.

### The columns check (`columns-check.txt`, RESULT PASS)

```
Work dates row (#526), 1440x900: no-dates 106, no-times 106, fits 106, outside 106, worst-two-kinds 106, worst-closures 106, worst-no-record 106, worst-partial 106, worst-no-data 106, no-data 106 px; diff 0 px PASS
Work dates row (#526), 1198x930: the same ten states, 106 px each; diff 0 px PASS
Work dates row (#526), 390x844: the same ten states, 173.5 px each; diff 0 px PASS
Hours row reserve, 1440x900 and 1198x930: before 100, fixed 100, undone 100 px; diff 0 px PASS
Hours row reserve, 390x844: before 117.5, fixed 117.5, undone 117.5 px; diff 0 px PASS
Work-hours window: 560x600 (358x600 at 390), day vs week 0 px, Esc closes, focus back: PASS at all three sizes
WHAT section (#517): 21 states x 3 size/zoom runs, 63 readings: max 0 px; controls under 44 px in 0 readings; axe violations in 0 readings
```

The desktop row is back to the two-line height (106 px, as in round 1). The worst cases run on Centennial (the jurisdiction picked, then the block's `hours_days` injected):

| State | Line |
|---|---|
| worst-two-kinds | Outside the allowed hours on weekdays and weekends. |
| worst-closures | Outside the allowed hours on weekdays; no closures on weekends. |
| worst-no-record | We don't have Centennial's hours for these days, so we can't check them. |
| worst-partial | Fits Centennial's weekday hours. We don't have its weekend hours. |
| worst-no-data | We don't have Centennial's work hours yet, so we can't check your dates. |

### Crops (rework)

Only crops that differ from the committed ones were replaced; the replaced files moved to `validation-artifacts-extra/.../issue-526/committed-superseded-rework/`. That is 51 files: the Work dates states (the 1440 and 1198 cells are shorter again, and the worst lines are reworded), the four whole-week views ("No record" is now a caption under the column), and a few box and row crops that differ by rendering only. One state is new: `dates-worst-no-data`, at 3 sizes. 90 files in all.

At 390 the whole week's Sat and Sun read "No / record" under the column. The column's hours line and the top clip arrow are fully visible (dialog-night-week shows the ▴ on Sat and Sun).

## Round 3 (#531, #532)

Walked 2026-11-12 on `issue-526-guesses-hours` (uncommitted, now on `df74d38`), same setup as above (stub backend on :8000, Overpass replayed, the worktree's site on :3000), sizes 1440x900, 1198x930 and 390x844, zoom 1. The walk script (`validation-artifacts-extra/.../issue-526/walk526.mjs`) gained two things: a measured caption check in every whole-week view, and a no-closures state. Log: `.../issue-526/walk-r3-final.log`. RESULT PASS. Both servers were stopped afterwards (no listener on :3000 or :8000; no orphan `next dev`).

### The "No record" caption (S23), measured

In each whole-week view the walk reads every `hours-week-no-record` caption: is it inside its own box (`scrollWidth <= clientWidth`), inside the dialog, and overlapping no other caption.

| View | 1440 | 1198 | 390 |
|---|---|---|---|
| fits, outside, weekend, night (Denver, weekends no record) | 1 caption "No record", 134 px, PASS | 1, 134 px, PASS | 1, 76 px, PASS |
| closures (every day has a record) | 0 captions, PASS | 0, PASS | 0, PASS |

At 390 the caption reads "No record" on one line under Sat and Sun (`w526-dialog-weekend-week-390.png`); the round-2 "recordrecorc" collision and the clip at the dialog edge are gone. The hours line on those days is the hollow dashed bar (S24).

### No closures, on screen (#531 acceptance)

The state injects, into the breakdown's answer, weekdays inside and a weekend with no closures (`allowed: []`). It runs under Centennial (the jurisdiction the worst cases left picked), so the injection replaces Centennial's real spans: the weekday band shows only 8:30 am to 3:30 pm (its real collector record also has 7 pm to 5 am), and Centennial's record has no weekend rule at all. The crops prove the rendering, not Centennial's hours, for Mon Nov 16 to Sun Nov 22 at 9 am to 3 pm. The job's counts match the dates on screen: five weekdays, plus Sat 21 and Sun 22. The line reads "Nov 21 and 22 are a weekend: no closures." at all three sizes (`w526-dates-closures-*.png`). The window shows the striped weekend columns, with your hours in the outside colour (`w526-dialog-closures-week-*.png`). A first run had reused the worst cases' long-job counts, so it read "36 weekend days in your dates". That contradicted the dates on screen, so the injection was fixed and the walk re-run. Only the second run's crops are committed.

### Times (S26)

"Starts before 8:30 am and ends after 3:30 pm on weekdays." keeps "3:30 pm" on one line at 1198 (`w526-dates-outside-1198.png`); round 2 broke it there.

### Crops (round 3)

99 files. 9 are new: `dates-closures`, `dialog-closures-day` and `dialog-closures-week`, at 3 sizes each. 26 changed and replace the committed ones: the whole-week views (the caption row and hollow bars), the day views and Work dates lines whose times now keep their non-breaking space, and the outside and undone dates crops. The replaced files moved to `validation-artifacts-extra/.../issue-526/committed-superseded-r3/`. 64 are byte-identical.
