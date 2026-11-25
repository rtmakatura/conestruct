# #561 walk

Run 2026-11-25 against a local dev server of this worktree (`npx next dev -p 3561` in `conestruct/site`), headless Chromium, read-only: nothing saved, nothing downloaded, no sign-in. The backend it called is the deployed one (the site's own API routes). Its answers are real except the one **browser edit** below. Every measure here is from the final code.

- Scripts: `script/walk-561.mjs` (the walk), `script/summary.mjs` (the checks) and `script/key-widths.mjs` (the key's entry widths at 1440, in `key-widths-1440.txt`). The walk is built on #556's round-2 walk and uses the same helpers (`../missions/ux-spacing-round/issue-555/script/lib.mjs`).
- Raw measures: `measures-<set|unset>-<size>.json`. One block per reading, and the checks: `measures-summary.txt` (309 checks, 0 failed).
- Setup for every state: open `/sandbox`, pin `1550 E Colfax Ave, Denver`, answer Shoulder, Next, the first side, Confirm. The page set Denver itself. Then the dates and times, "See Denver's work hours", and the view.
- Sizes: 390x844, 390x600, 390x480 and 1440x900. 390x480 is there because it is the one size where the weekday view runs long.
- **Browser edit for "unset":** as in #556's round 2, the road lookup's answer (`/api/road-bearing`) had every `highway_class` rewritten to `road`, a class the page has no street-class guess for. The page then set no street class and the real backend answered `missing: street_class`, weekdays `allowed: null`, weekends no record (`backendAnswer` in each `measures-unset-*.json`).
- Three earlier runs, made while the change was being built, are in `validation-artifacts-extra/issue-561/round-1/`, `round-2/` and `round-3/` (untracked, main checkout, not committed). `rulings.md` S1, S3 and S5 cite two measures from them as the reason for a choice; no check in this file rests on them.

## States

| State | Dates, hours | Street class set | Street class unset |
|---|---|---|---|
| `night` | Mon Dec 7 to Sun Dec 13, 8:30 pm to 5:30 am | Weekdays checked (solid, with an outside piece); Sat and Sun have no record, so their bars are hollow in the whole week | Every bar hollow in both views |
| `weekdays` | Mon Dec 7 to Fri Dec 11, 9 am to 3 pm | No hollow bar in either view | Every bar hollow in both views |

## The key

In all 32 readings (2 states x 2 views x 2 classes x 4 sizes) the key has "Not checked" exactly when a hollow bar is drawn, and never otherwise.

| Class | State, view | Hollow bars | Key |
|---|---|---|---|
| set | `night`, weekday | 0 | Allowed, Your hours, Outside what's allowed |
| set | `night`, whole week | 2 (Sat, Sun) | Allowed, Your hours, Not checked, Outside what's allowed, No record |
| set | `weekdays`, weekday | 0 | Allowed, Your hours, Outside what's allowed |
| set | `weekdays`, whole week | 0 | Allowed, Your hours, Outside what's allowed, No record |
| unset | `night`, weekday | 1 | Allowed, Your hours, Not checked, Outside what's allowed |
| unset | `night`, whole week | 7 | Allowed, Your hours, Not checked, Outside what's allowed, No record |
| unset | `weekdays`, weekday | 1 | Allowed, Your hours, Not checked, Outside what's allowed |
| unset | `weekdays`, whole week | 5 | Allowed, Your hours, Not checked, Outside what's allowed, No record |

- The swatch is 14 x 6 px with a `1px dashed rgb(147, 160, 176)` rule, the same rule the hollow bars report, on the window's `rgb(16, 28, 41)` ground (6.47:1).
- The key is one line at 1440 in every reading, five entries included, and two lines at 390, as before.
- The body is as tall as in #556's round-2 walk in all 12 readings the two walks share (`night`, both views, both classes, at 390x844, 390x600 and 1440): for example 316 px at 390x600 with no class, 310 with one, 364 and 390 at 1440. So the entry took no room from the chart.
- One font (Inter), three sizes (12.5, 13.5, 19 px), axe 0 violations and no control under 44 px, in every reading.

## More below

The body is flagged, and the fade drawn, in exactly the readings where more than 1 px of it is under its bottom edge. Scrolled to the end, the flag and the fade are gone and the scroll height hasn't moved. Scrolled back, the reading is the same as at rest.

| Size | Class | View | Body / content | At rest | At the end |
|---|---|---|---|---|---|
| 390x844 | set | both | fits | no fade | doesn't scroll |
| 390x844 | unset | whole week, `night` | 388 / 408 | fade above the note; note whole, over 8.13 px of the chart | no fade; note clear of the chart |
| 390x600 | set | whole week | 310 / 357 | fade; note whole, over 35.56 px | no fade; clear |
| 390x600 | unset | whole week, `night` | 316 / 408 | fade; note whole, over 80.13 px | no fade; clear |
| 390x600 | unset | whole week, `weekdays` | 336 / 408 | fade; note whole, over 60.56 px | no fade; clear |
| 390x480 | set | weekday, `night` | 190 / 226 | fade at the body's bottom edge (drawn from the foot, ending 0 px from the edge) | no fade |
| 390x480 | set and unset | whole week | 190 to 216 / 357 to 408 | fade; note whole | no fade; clear |
| 1440x900 | set and unset | both | fits | no fade | doesn't scroll |

- The fade is 16 px tall, `linear-gradient(rgba(0, 0, 0, 0), rgb(16, 28, 41))`, `pointer-events: none`, and ends on the note's top edge (whole week) or the body's bottom edge (weekday view).
- The week note is whole and on top in every reading, at rest and at the end, as in #556.
- The weekday view ran long in one reading only (390x480, a class set, hours outside with the fix button). With no class it fits there.

## Crops

`crops/<state>-<view>[-end]-<size>.png`, each the window alone, 30 in all. The ones to look at:

| Crop | What it shows |
|---|---|
| `561-class-unset-night-week-390x600.png` | The worst case from #561: every bar hollow, "Not checked" in the key beside "Your hours", the chart fading into the note. |
| `561-class-unset-night-week-end-390x600.png` | The same, scrolled to the end: no fade, the "6 am" tick and "No record" caption above the note. |
| `561-class-set-night-week-1440.png` | A class set: Sat and Sun hollow, the five-entry key on one line. |
| `561-class-set-weekdays-week-390.png` | No hollow bar, so no "Not checked". |
| `561-class-unset-night-day-390.png` | The weekday view with no class: one hollow bar, the entry in the key. |
| `561-class-set-night-day-390x480.png`, `…-day-end-390x480.png` | The weekday view running long: the fade at the body's edge, then gone at the end. |

## What guards this

No unit test measures layout. The tests pin the key entry and the flag in the mounted window, and the CSS by pattern (the swatch, the five-entry gap, the fade and where it is drawn from). That the key stays on one line at 1440, that the fade sits on the right edge and that the note stays whole are shown only by this walk. A change to these rules needs the walk run again.
