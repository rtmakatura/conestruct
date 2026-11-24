# #555 walk

Run 2026-11-24 against a local dev server of this worktree (`npx next dev -p 3555` in `conestruct/site`, final code), headless Chromium, read-only: nothing saved, nothing downloaded, no sign-in. The backend it called is the deployed one (the site's own API routes); its answers are real except where marked **browser edit**.

- Scripts: `script/shots-hours.mjs` (the states below), `script/shots-labels.mjs` (two more records' labels), `script/summary.mjs` (the checks), `script/lib.mjs`. They are copies of `validation-artifacts-extra/spacing-round-before/script/` (untracked, main checkout, not committed) adapted to the local server; the originals are untouched. The "before" shots named in the table below are in that same untracked folder. They are named only so the two sets can be laid side by side; no measure or claim in this file rests on them.
- Raw measures: `measures-1440.json`, `measures-1198.json`, `measures-390.json`, `measures-labels.json`. One line per reading: `measures-summary.txt`.
- Setup for every state: open `/sandbox`, pin `1550 E Colfax Ave, Denver`, answer Shoulder, Next, the first side, Confirm. The page set Denver and "arterial" itself. Then the dates and times below, "See Denver's work hours", and each view.

## The states and their crops

Each is in both views ("A weekday" = `-day`, "The whole week" = `-week`) at 1440x900, 1198x930 and 390x844: `crops/<name>-<view>-<width>.png`.

The nine `555-*-1198.png` crops are byte-identical to their `-1440` twins (checked with `cmp`). Each crop is the window alone, and the window is one fixed size (560 x 600) at any width that fits it, so the same state gives the same pixels at 1198 and 1440. The 1198 run is still its own reading: `measures-1198.json` was measured in a separate browser at 1198x930.

| Crop name | Dates, hours | What it shows |
|---|---|---|
| `555-night` | Mon Dec 7 to Sun Dec 13 2026, 8 pm to 5 am | The night shift. Weekday view: one white bar from 8 pm to 5 am inside Denver's night window, which is one band labelled "8 pm" and "5 am"; verdict "Your hours fit on weekdays." Week: one unbroken bar in each of Mon to Fri, inside one night band; Sat and Sun (no record) carry the same span as a hollow dashed bar, as #531 left it. The matching before shot is `535-night-week`. |
| `555-night-week-bottom` | the same, week view | Close crop of the bottom of the columns, where the old scale left only `▾` marks. The matching before shot is `535-night-week-bottom-marks`. |
| `555-day` | Mon Dec 7 to Fri Dec 11, 9 am to 3 pm | The day shift. One white bar inside the 8:30 am to 3:30 pm band in both views; Sat and Sun greyed (outside the dates). The matching before shot is `534-week-note-fits`. |
| `555-outside` | Mon Dec 7 to Fri Dec 11, 7 am to 5 pm | The inside/outside split. White from 8:30 am to 3:30 pm, `--dim` orange for the backend's two outside spans (7 to 8:30 am, 3:30 to 5 pm); verdict "Your hours go outside what Denver allows on weekdays." and the fix button. The matching before shot is `534-week-note-outside`. |
| `555-early-start` | Mon Dec 7 to Fri Dec 11, 4 am to 2 pm | The 6 am edge (rulings.md S2). The backend's one outside span is 5 am to 8:30 am. Drawn in two pieces on the same day: 6 to 8:30 am orange at the start of the scale, then white to 2 pm; at the end of the scale 4 to 5 am white (inside the night window) and 5 to 6 am orange. |
| `535-no-closures-week` (1440, 390) | Dec 7 to Dec 13, 9 am to 3 pm | **Browser edit**, as in the before set: the weekend's answer edited to a no-closures day. Striped Sat and Sun on the new scale, the midnight line across them. The key entry is item 2a (#556), not this item. |
| `535-class-unset-day`, `535-class-unset-week` (1440, 390) | Dec 7 to Dec 13, 9 am to 2 pm | **Browser edit**, as in the before set: `street_class` removed from the hours request. No bands; your hours still draw solid. That is item 2b (#556), unchanged here. |
| `555-labels-lakewood-day`, `555-labels-centennial-day` (1440, 390) | Dec 7 to Dec 11, 9 am to 3 pm | Lakewood and Centennial picked by hand in the jurisdiction list. Lakewood's night window crosses 6 am: it runs from 6 pm to the last tick, and its last hour (6 to 7 am) is the short band at the start. The labels after S11. |

## Measures (30 readings: 4 states x 2 views x 3 sizes, plus the 3 browser-edit views x 2 sizes)

All 30 pass every check `script/summary.mjs` ran on them ("30 readings (28 with the 44 px measure); failed checks: none"); the 44 px check ran on 28 (see below).

- **The scale.** Ticks read "6 am", "noon", "6 pm", "midnight", "6 am" in both views at all three sizes (their places, 0, 25, 50, 75 and 100% of the scale, are pinned by the test). No tick overlaps the next; every tick and end label is inside the window's body; the body has no sideways scroll (scrollWidth = clientWidth in all 30).
- **Midnight.** The tick is `rgb(200, 209, 221)` (`--ink-on-dark`) at weight 600; the other four are `rgb(147, 160, 176)` (`--ink-faint`) at 400; all 12.5 px. One dashed line in the weekday track (1 px wide, 26 px tall, `1px dashed rgb(147, 160, 176)`) and one in each of the seven columns (1 px tall, the column's inner width).
- **8 pm to 5 am.** Weekday view: one bar starting 58.3% along the scale, 37.5% long (8 pm is 14/24, 9 hours is 9/24). Week: one bar per day, 58.3% down, 37.2% tall (the column's 1 px border takes the rest). Bands: 8:30 am to 3:30 pm and one night band at 58.3% + 37.5%.
- **9 am to 3 pm.** One bar at 12.5% + 25.0%.
- **7 am to 5 pm.** Yours at 4.2% + 41.7%; outside pieces at 4.2% + 6.3% and 39.6% + 6.3%. Computed colours: yours `rgb(234, 240, 247)` (`--ink`), outside `rgb(255, 138, 46)` (`--dim`), bands `rgb(29, 44, 60)` (`--pri-off`). The rules that set them (`.whd-yours`, `.whd-yours.is-out`, `.whd-band`, `.whd-yours.is-unchecked`, `.whd-closed`, `.whd-day.is-dim`, `.whd-day.is-none`) are not in the diff.
- **No arrows.** 0 `.whd-clip` elements in all 30 readings.
- **Sizes.** The window is 560 x 600 at 1440 and 1198 and 358 x 600 at 390, as before. The ruler's track is 28 px tall (494 px wide at 1440 and 1198, 292 px at 390). Each day's column is 240 px tall (62.56 px wide at 1440 and 1198, 33.7 px at 390; the tick column took 16 px more, S7). The week's tick column: "midnight" is 53.14 px wide in a 60 px column.
- **Rows and columns (#469, #490).** The diff touches only `.whd-*` rules, which apply inside the window (a fixed overlay over the page), so no page row or column can move. As a spot check the WHAT section measured the same height before the window opened and after it closed: 1061.5 px at 1440 and 1198, 1917.25 px at 390. The columns script (`scripts/verify-columns-end-together.mjs`) was not run for this item.
- **Inter only.** Every text node in the window computes to the Inter face in all 30 readings.
- **axe.** Run on `[data-testid=hours-dialog]` in all 30 readings: 0 violations.
- **44 px.** Controls under 44 px on either side inside the window: 0 in all 28 readings that measured it (Close, the two view buttons, the fix button). The two no-closures readings were not measured for it (`measures-summary.txt` prints "not measured" for them); that view has the same controls as the other week views.
- **End labels (S11).** Gaps between neighbouring labels, measured: Lakewood 26.76, 79.01 and 26.31 px at 1440; 9.93, 24.31 and 5.27 px at 390. Centennial 93.98, 46.9 and 161.75 px at 1440; 35.08, 17.44 and 77.6 px at 390. Before S11, on this scale, Lakewood's were -4.86 and -9.83 px at 390 (overlapping). Denver's nearest pair ("3:30 pm" and "8 pm") isn't moved by S11.

## Not changed by this item, seen in the walk

- At 390 the week note under the chart is still cut when the dates aren't the whole week (body 342 px, content 357 px, the same numbers as the before set). That is item 2c (#556).
- With no street class the hours still draw solid (item 2b, #556), and the key has no "No closures" entry (item 2a, #556).

## Follow-ups

- https://github.com/rtmakatura/conestruct/issues/559: Loveland's "4:30 pm" and "5:30 pm" labels are an hour apart and overlap on the weekday ruler (about 13 px at 390 after this item, about 30 px on the live ruler; computed, not walked, since Loveland isn't in the jurisdiction list).

- https://github.com/rtmakatura/conestruct/issues/560: three lows from the review: the midnight line shows through the hollow "no record" bar on Sat and Sun; Lakewood's "3:30 pm" and "6 pm" are 5.27 px apart at 390; three untested cases in `placed()`.

## For Ryan's hand check

Open the six `555-night-*` and `555-day-*` crops at 390 and 1440 first, then `555-early-start-day-1440.png` for the 6 am edge call (S2): a 4 am start is drawn at the end of its own day's scale, not on the day before.
