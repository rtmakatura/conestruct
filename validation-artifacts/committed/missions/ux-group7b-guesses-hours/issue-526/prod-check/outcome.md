# #526 production check: PASS (main 6b6a850)

Run 2026-11-12 after SHIP VERIFIED (healthz sha and the served frontend both `6b6a850`). https://www.conestruct.com, the real backend, no stubs, read-only: nothing was saved. The fix and Undo change only the page's own state. Headless Chromium, DPR 1, at 1440x900, 1198x930 and 390x844. The gate token was sent as a header only and never printed. Script: `script/walk-526-prod.mjs`. Results: `crops/prod-walk.json`. Crops: `crops/prod-*.png` (18).

Flow: the pin is 1550 E Colfax Ave, Denver (by search, the Colfax road row). Then Shoulder, the first side, and confirm. The guessed street class is Arterial. Dates are Mon Nov 16 to Sun Nov 22, 2026.

| Check | 1440 | 1198 | 390 |
|---|---|---|---|
| Work dates line, 9 am to 3 pm | "Fits Denver's weekday hours. We don't have its weekend hours." | same | same |
| Week view: "No record" captions (S23) | 1, 134 px, fits, inside, no overlap | 1, 134 px, same | 1, 76 px, same |
| Your hours on no-record days (S24) | 2 hollow bars, 0 in the inside ink | same | same |
| 7 am to 5 pm line | "Starts before 8:30 am and ends after 3:30 pm on weekdays.", non-breaking space present (S26) | same | same |
| Week screen-reader text naming outside days (S25) | 5 in-job days "Outside: …" | 5 | 5 |
| Fix offered | "Change my hours to 8:30 am to 3:30 pm" | same | same |
| Record after a hand edit to 9 am (P15) | "Hours changed to 8:30 am to 3:30 pm. Undo" stays | stays | stays |
| Undo | back to 7:00 AM to 5:00 PM, record gone | same | same |
| Esc returns focus to the link | `what-hours-all` | same | same |
| axe on the dialog | 0 violations | 0 | 0 |
| Console errors | 0 | 0 | 0 |
| Inter loaded | yes | yes | yes |

At 390 the week shows one "No record" under Sat and Sun, with the hollow dashed bars there (`crops/prod-dialog-week-390.png`).

Not checked in production: the no-closures state (Denver's record has no day without closures; the local walk covers it, `../walk.md` § Round 3).
