# #556 walk

Run 2026-11-24 against a local dev server of this worktree (`npx next dev -p 3556` in `conestruct/site`), headless Chromium, read-only: nothing saved, nothing downloaded, no sign-in. The backend it called is the deployed one (the site's own API routes); its answers are real except where marked **browser edit**. Both walks below were run on the final code, after gate round 2's changes (the sticky note, S12, and the one-day sentence).

- Scripts: `script/shots-556.mjs` (the first walk), `script/shots-556-worst.mjs` (round 2: the worst-case wordings and the real no-street-class state), `script/summary.mjs` (the checks). They use item 1's helpers (`../issue-555/script/lib.mjs`). The first walk uses the same two browser edits as the before set's `shots-page.mjs` in `validation-artifacts-extra/spacing-round-before/script/` (untracked, main checkout, not committed). The "before" shots named below are in that same untracked folder. They are named only so the two sets can be laid side by side; no measure or claim in this file rests on them.
- Raw measures: `measures-<size>.json` (first walk; sizes 1440, 1198, 390, 390x667, 390x600) and `measures-worst-<set|unset>-<size>.json` (round 2; sizes 390, 390x667, 390x600, 1440). One block per reading: `measures-summary.txt`.
- Setup for every state: open `/sandbox`, pin `1550 E Colfax Ave, Denver`, answer Shoulder, Next, the first side, Confirm. The page set Denver itself. Then the dates and times below, "See Denver's work hours", and the view.
- 16 more crops from the round-2 walk (the weekday views and the states with a class set that nothing below cites) are in `validation-artifacts-extra/ux-spacing-round/issue-556/` (untracked, main checkout, not committed). Nothing here rests on them.

## What guards the 390 fit

No unit test measures layout. The tests pin the CSS source by pattern (the 640 px height under 600 px wide, the sticky note rule, `overflow-y: auto`) and the note's place and class in the mounted window. Whether the note is whole on a real screen is shown only by this walk. A change to these rules needs the walk run again.

## The first walk: states and crops

`crops/<name>-<size>.png`, each the window alone, at 1440x900, 1198x930 and 390x844.

The eight `-1198.png` crops are byte-identical to their `-1440` twins (checked with `cmp`). The window is one fixed size (560 x 600) at any width over 600 px, so the same state gives the same pixels. The 1198 run is still its own reading: `measures-1198.json` was measured in a separate browser at 1198x930.

| Crop name | Dates, hours | What it shows |
|---|---|---|
| `534-week-note-fits` | Mon Dec 7 to Fri Dec 11 2026, 9 am to 3 pm, the whole week | The new note, whole: "Your dates: Mon Dec 7 to Fri Dec 11. Sat and Sun aren't in them." One line at 1440 and 1198, two lines at 390. Matches the before shot of the same name. |
| `534-week-note-outside` | the same dates, 7 am to 5 pm | The same note with hours outside what's allowed (orange pieces, as before). Matches the before shot of the same name. |
| `535-no-closures-week` | Dec 7 to Dec 13, 9 am to 3 pm, the whole week | **Browser edit**, as in the before set: the weekend's answer edited to a no-closures day (no jurisdiction on file has one). Sat and Sun are striped and the key's last entry is "No closures allowed" with a striped swatch. The note reads "Your dates: Mon Dec 7 to Sun Dec 13, the whole week." |
| `556-key-no-closures` | the same state | Close crop of the key and source line. |
| `535-class-unset-day`, `535-class-unset-week` | Dec 7 to Dec 13, 9 am to 2 pm | **Browser edit**, as in the before set: `street_class` removed from the hours request; the real backend answered `missing: street_class` (recorded in each `measures-*.json` as `classUnsetAnswer`). The notice is the first line; your hours are hollow and dashed; no band, no verdict, no fix button. These two match the before shots, and like them the subtitle still says "arterial", because the page itself still has the class. That is not the real state's subtitle: the round-2 walk below has it. |
| `556-note-multi-week` | Dec 7 to Dec 23, 9 am to 3 pm, the whole week | "Your dates: Mon Dec 7 to Wed Dec 23. This is the first week; every week has the same hours." Two lines at every size. |
| `556-note-one-day` | Dec 9, 8 am to 3 pm, the whole week | "Your date: Wed Dec 9. No work on the other days." One line at every size. |
| `534-week-note-fits-390x667` | as `534-week-note-fits`, on a 390x667 screen | The window is 635 px tall there (`100vh - 32px`); the view still fits and nothing scrolls. |
| `534-week-note-fits-390x600` | the same, on a 390x600 screen, at rest | A screen short enough that the body scrolls (body 310 px, view 357 px). The note is whole at the body's bottom edge (lines at 291 to 307 px), over the bottom of the chart: the columns are cut where the note starts. |
| `534-week-note-fits-end-390x600` | the same, scrolled to the end (scrollTop 47) | The note in the same place, now under the whole chart: the "6 am" tick and the "No record" caption show above it. |

## The round-2 walk: worst-case wordings, and the real no-street-class state

`script/shots-556-worst.mjs`, at 390x844, 390x667, 390x600 and 1440x900, once with the street class set (the page's own "arterial") and once with it really unset.

**Browser edit for "unset":** the road lookup's answer (`/api/road-bearing`) had every `highway_class` rewritten to `road`, a class the page has no street-class guess for. Nothing else was edited. The page then set no street class, so its own subtitle read "Street class not set, so the hours for it aren't known. …", its own hours request carried no `street_class` (recorded as `hoursRequestStreetClass: absent`), and the real backend answered `missing: street_class`, weekdays `allowed: null` with no outside spans, weekends no record (`backendAnswer`).

Three states each, both views:

| State | Dates, hours | Why it is a worst case |
|---|---|---|
| `night` | Mon Dec 7 to Sun Dec 13, 8:30 pm to 5:30 am | The longest hours in the subtitle. |
| `thu-fri` | Thu Dec 10 to Fri Dec 11, 8:30 pm to 5:30 am | The longest one-week note: "Your dates: Thu Dec 10 to Fri Dec 11. Mon to Wed, Sat and Sun aren't in them." |
| `multi-week` | Thu Dec 10 to Wed Dec 23, 9:30 am to 2:30 pm | The longest note of all: "Your dates: Thu Dec 10 to Wed Dec 23. This is the first week; every week has the same hours." (no crop) |

Crops kept here: `556-worst-class-unset-{night,thu-fri}-week-{390,390x600,1440}.png`, the same four phone states scrolled to the end as `…-week-end-{390,390x600}.png`, `556-worst-class-unset-night-day-390.png` (the weekday view with the real subtitle), and for a set class `556-worst-class-set-thu-fri-week-{390,390x600}.png` with `…-week-end-390x600.png`. 14 crops.

The whole-week view, 24 readings (the other 24 are the weekday view, which has no note):

| Size | Class | Subtitle | Body | View | The note at rest | Scrolled to the end |
|---|---|---|---|---|---|---|
| 390x844 | set | 2 lines | 382 | fits | 2 lines, 319 to 354.56, whole | doesn't scroll |
| 390x844 | unset | 3 lines | 388 | 408 | 2 lines, 350 to 385.56, whole, over the last 8.13 px of the chart's box | scrollTop 20: the same place, clear of the chart |
| 390x667 | set | 2 lines | 377 | fits | 2 lines, 319 to 354.56, whole | doesn't scroll |
| 390x667 | unset | 3 lines | 383 | 408 | 2 lines, 345 to 380.56, whole, over 13.13 px | scrollTop 25: clear of the chart |
| 390x600 | set | 2 lines | 310 | 357 | 2 lines, 271.44 to 307, whole, over 35.56 px | scrollTop 47: clear of the chart |
| 390x600 | unset | 3 lines | 316 | 408 | 2 lines, 278 to 313.56, whole, over 80.13 px | scrollTop 92: clear of the chart |
| 1440x900 | set | 2 lines | 364 | fits | 1 line (2 for more than a week), ends at 354.56 at most, whole | doesn't scroll |
| 1440x900 | unset | 2 lines | 390 | fits | 1 line (2 for more than a week), ends at 386.13 at most, whole | doesn't scroll |

Each row is the same for all three states at that size; px are from the body's top edge. "Whole" means every line of the note is inside the body's visible box and the note is the topmost thing painted at each line (`elementFromPoint`). `script/summary.mjs` printed "48 worst-case readings; failed checks: none".

- **What round 1 missed.** With no street class the real subtitle is three lines at 390, not two, so the body is 388 px, not 408 px, and the week view (408 px) runs 20 px long at 390x844. Round 1's 2.31 px fit was measured under the wrong subtitle. On the final code the note is whole at rest there anyway, because it stays at the body's bottom edge (rulings.md S12). At 390x844 it covers 8.13 px of the chart's box, all of it the empty part of the caption row under "No record".
- **With a street class**, the longest subtitle is two lines and the longest notes are two lines at 390, so the week view is 357 px in a 382 px body: 25 px to spare, and nothing scrolls at 390x844 or 390x667.
- The note is never more than two lines at 390 in any wording walked.
- In all 48: axe 0 violations, no control under 44 px, Inter only at 12.5, 13.5 or 19 px, no sideways scroll. In the 24 unset readings the notice is present, the subtitle starts "Street class not set", and every "your hours" bar is dashed.

## Measures of the first walk (34 readings)

Ten at each of 1440, 1198 and 390 (the weekday view and the whole week for the first four states, the whole week for the two note states), plus the two views of the fits state at 390x667 and at 390x600. `script/summary.mjs` printed "34 readings; failed checks: none".

- **c: the note's last line against the body's visible box.** The last line's top and bottom, in px from the body's top edge:

  | Size, state | Body | Content | Lines | Last line | Result |
  |---|---|---|---|---|---|
  | 390x844, fits | 382 | 382 | 2 | 338.56 to 354.56 | inside, no scroll |
  | 390x844, outside | 382 | 382 | 2 | 338.56 to 354.56 | inside, no scroll |
  | 390x844, no closures | 382 | 382 | 2 | 338.56 to 354.56 | inside, no scroll |
  | 390x844, class stripped from the request ("arterial" subtitle) | 408 | 408 | 2 | 389.13 to 405.13 | inside, no scroll |
  | 390x844, more than a week | 382 | 382 | 2 | 338.56 to 354.56 | inside, no scroll |
  | 390x844, one day | 382 | 382 | 1 | 319 to 335 | inside, no scroll |
  | 390x667, fits | 377 | 377 | 2 | 338.56 to 354.56 | inside, no scroll |
  | 390x600, fits, at rest | 310 | 357 | 2 | 291 to 307 | inside (the note stays at the bottom edge) |
  | 390x600, fits, scrolled to the end (scrollTop 47) | 310 | 357 | 2 | 291 to 307 | inside |
  | 1440 and 1198, every state | 384 (410 with the class stripped) | the same | 1 or 2 | at most 354.56 (366.56 with the class stripped) | inside, no scroll |

  "Content" is the body's `scrollHeight`; where it equals the body's height the body doesn't scroll. On the base the 390x844 body was 342 px against 357 px of content (`../issue-555/measures-390.json`). It is 382 px now because the window is 640 px tall at this width (rulings.md S10).
- **a: the key.** The entry "No closures allowed" is present in the whole-week view of the no-closures state at all three sizes, and absent from the other 31 readings, that state's weekday view among them. It shows exactly where days are striped (2 striped days in those three readings, 0 in the rest). Its swatch is 14 x 10 px, its 1 px `rgb(34, 50, 68)` border (`--rule-soft`) included, filled with `repeating-linear-gradient(135deg, rgb(16, 28, 41) 0px, rgb(16, 28, 41) 3px, rgb(29, 44, 60) 3px, rgb(29, 44, 60) 6px)`. The days' stripes are the same two colours at the same angle, 6 px wide (`--da-ground` and `--pri-off`). The key is one line at 1440 and 1198 and two lines at 390, with or without the entry.
- **b: no street class.** In both views at all three sizes: the notice "Pick a street class on the page and we'll check your hours against it." is the body's first element (13.5 px, `rgb(200, 209, 221)`, the other lines' ink). Every "your hours" bar (1 in the weekday view, 7 in the week) has a transparent fill and a `1px dashed rgb(147, 160, 176)` border (`--ink-faint`). No bar is `rgb(234, 240, 247)` (the inside ink) or `rgb(255, 138, 46)` (the outside ink). No bands. The dashed line against the window's ground (`rgb(16, 28, 41)`) measures 6.47 to 1. In the 28 readings with a street class there is no notice, and the inside and outside bars keep those two colours.
- **Sizes.** The window is 560 x 600 at 1440 and 1198; 358 x 640 at 390x844 (it was 358 x 600); 358 x 635 at 390x667; 358 x 568 at 390x600. The ruler's track is 28 px tall and each day's column 240 px in every reading that has one; the week's rows read `274px 32px` (the day row and the 32 px caption row), as before.
- **Rows and columns (#469, #490).** The diff touches only `.whd-*` rules, which apply inside the window (a fixed overlay over the page), so no page row or column can move. As a spot check the WHAT section measured the same height before the window opened and after it closed: 1061.5 px at 1440 and 1198, 1917.25 px at the three 390-wide sizes. The columns script (`scripts/verify-columns-end-together.mjs`) was not run for this item.
- **Inter only, group 1's sizes.** Every visible text node in the window computes to the Inter face, at 12.5, 13.5 or 19 px, in all 34 readings. The diff adds no font-size rule.
- **axe.** Run on `[data-testid=hours-dialog]` in all 34 readings: 0 violations.
- **44 px.** Controls under 44 px on either side inside the window: 0 in all 34 readings (Close, the two view buttons, the fix button where it shows). This item adds no control.
- **No sideways scroll.** `scrollWidth` equals `clientWidth` in all 34.

## Seen in the walk, not changed by this item

- The hollow dashed bar has no entry in the key, and a body that scrolls shows no "more below" sign beyond the chart being cut where the note starts (the 390x600 crops). Filed: https://github.com/rtmakatura/conestruct/issues/561.
- The midnight line shows through the hollow bar (#560, from item 1's review).

## For Ryan's hand check

Open `534-week-note-fits-390.png` and `534-week-note-outside-390.png` first (the note, whole, in a window 40 px taller at phone width: rulings.md S10). Then `556-worst-class-unset-thu-fri-week-390.png` (the real no-street-class state: the notice, the dashed outline, and the note held at the bottom edge, S12) with `556-worst-class-unset-thu-fri-week-390x600.png` for how that looks on a short screen. Then `535-no-closures-week-1440.png` with `556-key-no-closures-1440.png` for the key.
