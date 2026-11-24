# Mission ux-spacing-round (#555, #556, #557): production check: PASS (main ab73b3b)

Run 2026-11-24 20:16:35 to 20:21:31 UTC (`results.json` `ranAt`, `finishedAt`), after the ship of main `ab73b3b`. https://www.conestruct.com/sandbox, the real backend, live Mapbox and the live geocoder. Headless Chromium, DPR 1, signed out, at 1440x900, 1198x930 and 390x844, one size after another. Nothing was saved to an account, nothing was downloaded, no one signed in. The map window's "Save and close" was pressed once per size; it puts the pin in the page's own state. The gate token was read from `conestruct/site/.env.local` inside the script, sent by `scripts/gate.cjs` to the site's own host only, and never printed or written.

Script: `script/walk-558-prod.mjs` (steps and selectors from the three item walks; the sha gate, console, request and token code from `validation-artifacts/committed/issue-554-weak-match-notice/prod-check/script/walk-554-prod.mjs`). Numbers: `results.json`; as text: `measures-summary.txt` (made by `script/summary.mjs`). Log: `run.log`. Token scan: `token-scan.json` (made by `script/scan-token.mjs`).

Two trial runs at 390 went to a scratch folder first and are not evidence. The first found two faults in the script (a tick comparison that did not allow for the no-break space in "6 am", and a step order that left the What section closed). The committed run is one run of the corrected script at all three sizes.

## Which readings use a browser-side edit

- **Part A, unmodified production data.** No request or answer was touched; no route was installed in the browser until part A was done. All of #555, #557, and #556's week note are part A.
- **Part B, browser-side edits**, the same two as the item walks (`issue-556/script/shots-556.mjs`):
  1. **No-closures key (#556).** The real answer's weekend was rewritten in the browser to "no closures" (2 answers per size). Production data for this address has no such day.
  2. **No street class (#556).** `street_class` was taken out of the request the browser sent (2 requests per size). The real backend answered `allowed: null` for weekdays (`"missing":"street_class"`); the page drew that answer. The page's own street class stayed set, so the window's subtitle still says "on an arterial street".
- **Part A2, after part B.** The routes were removed and the hours set again (an unedited answer). Then Where was reopened to read the collapsed What row. At 390 the aerial's zoom shows only there, so its 390 reading is A2 as well.

## Shas (checked before any browser opened)

| What | Sha | Result |
|---|---|---|
| Backend `/healthz` | `ab73b3b1504bf83d167ba07a63bc34c5010f5224` | equals main |
| Site `/api/version` (first poll, HTTP 200) | `ab73b3b1504bf83d167ba07a63bc34c5010f5224` | equals main |
| Sha found inside the site's own served `/_next/` scripts, each size | `ab73b3b` | the ab73b3b build |

## #555: both views on a 6 am to 6 am day (part A)

Address 1550 E Colfax Ave, Denver; Shoulder; the jurisdiction came from the pin (not set by hand).

| Check | 1440x900 | 1198x930 | 390x844 | Result |
|---|---|---|---|---|
| Ticks, 8 pm to 5 am, weekday ruler | 6 am, noon, 6 pm, midnight, 6 am | same | same | PASS |
| Ticks, 8 pm to 5 am, week view | 6 am, noon, 6 pm, midnight, 6 am | same | same | PASS |
| Ticks, 9 am to 3 pm, weekday ruler | 6 am, noon, 6 pm, midnight, 6 am | same | same | PASS |
| Ticks, 9 am to 3 pm, week view | 6 am, noon, 6 pm, midnight, 6 am | same | same | PASS |
| 8 pm to 5 am, ruler: pieces of "your hours" | 1, starts 58.33%, 37.5% long (185.25 px of 494), midnight line at 370.5 px inside it | same | 1, 58.33% + 37.5% (109.5 px of 292), midnight at 219 px inside it | PASS |
| 8 pm to 5 am, week (Dec 7 to Dec 13): pieces per day | 1 on each of 7 days, 58.26% + 37.19% (89.25 px of 240), each across its midnight line | same | same | PASS |
| 9 am to 3 pm, ruler | 1 piece, 12.5% + 25% (123.5 px), not across midnight | same | 1 piece, 12.5% + 25% (73 px) | PASS |
| 9 am to 3 pm, week (Dec 7 to Dec 11) | 1 piece on each of Mon to Fri, 12.81% + 24.79% (59.5 px); Sat and Sun none | same | same | PASS |
| axe in the window, 6 readings (3 hours x 2 views) | 0 each | 0 each | 0 each | PASS |
| Controls under 44 px in the window, 6 readings | 0 | 0 | 0 | PASS |

- Window 560x600 at 1440 and 1198, 358x640 at 390. The body does not scroll in any part A reading (384/384 px; 382/382 at 390).
- In the 8 pm to 5 am week, Sat and Sun draw hollow and dashed with the "No record" key entry. That is unmodified data: Denver has no weekend record for this street. Mon to Fri are solid.
- The tick text carries a no-break space ("6 am"); the check reads it as a plain space.

## #556: the work-hours window (part A and part B)

| Check | Part | 1440x900 | 1198x930 | 390x844 | Result |
|---|---|---|---|---|---|
| Week note whole, Dec 7 to Dec 11, 9 am to 3 pm | A | 1 line, 319 to 335 px in a 383.88 px body | same | 2 lines, last line 338.56 to 354.56 px in a 381.56 px body | PASS |
| Week note whole, Dec 7 to Dec 11, 7 am to 5 pm | A | 1 line, 319 to 335 px | same | 2 lines, last line 338.56 to 354.56 px | PASS |
| No "No closures allowed" key entry and no striped day on unmodified data (6 readings) | A | none | none | none | PASS |
| Key entry "No closures allowed" with a striped swatch, week view | B, edit 1 | shown; entry 139.28 x 18.75 px, swatch 14 x 10 px, striped; 2 striped days (Sat, Sun) | same | same | PASS |
| No street class: notice first in the body, above the bars | B, edit 2 | both views; notice 4 to 23.56 px, first bar at 69.56 px (ruler), 96.31 px (week) | same | both views; notice 4 to 43.13 px (2 lines), first bar at 89.13 px (ruler), 115.88 px (week) | PASS |
| No street class: your hours hollow and dashed | B, edit 2 | ruler 1 of 1, week 7 of 7: no fill, 1 px dashed; 0 allowed bands | same | same | PASS |
| Week note whole with no street class | B, edit 2 | 350.56 to 366.56 px in a 410 px body | same | 2 lines, last line 389.13 to 405.13 px in a 407.69 px body | PASS |
| axe in the window, both edits, both views | B | 0 each | 0 each | 0 each | PASS |

- The note read "Your dates: Mon Dec 7 to Fri Dec 11. Sat and Sun aren't in them." 13.5 px. "Whole" means: every line's box is inside the window body's box, the body is inside the window, the window is inside the screen, and nothing overflows sideways. All true in every reading.
- At 390 with no street class the note's box ends at 407.69 px in a 407.69 px body: it fits with 0 px to spare below its box (the last line of text ends 2.56 px above the body's edge).
- The notice read "Pick a street class on the page and we'll check your hours against it."
- The backend's answer with no street class: `{"missing":"street_class","status":"unknown","kinds":{"weekday":{"allowed":null,...},"weekend":{"allowed":[[0,24]],"record":"none","status":"no_record"}}}`.

## #557: four page fixes and the clip arrows (part A; the What row and the 390 zoom are A2)

| Check | 1440x900 | 1198x930 | 390x844 | Result |
|---|---|---|---|---|
| Where row link | "Change", text-transform none, 58.66 x 44 px, Inter 13.5 px / 600 | same | "Change", none, 298 x 44 px, Inter 13.5 px / 600 | PASS |
| What row link (A2) | "Change", none, 58.66 x 44 px, Inter 13.5 px / 600 | same | "Change", none, 298 x 44 px | PASS |
| Aerial "+" | 44 x 44 px | 44 x 44 px | 44 x 44 px (A2) | PASS |
| Aerial "−" | 44 x 44 px | 44 x 44 px | 44 x 44 px (A2) | PASS |
| Aerial "Reset" (after one zoom in) | 51.61 x 44 px | 51.61 x 44 px | 51.61 x 44 px (A2) | PASS |
| Hours link's focus ring, top edge to the nearest text above the link | 56 px (text in the grid above; the row's sentence sits beside the link) | 56 px | 5.5 px to the row's own sentence (the link wraps under it); 38.25 px to the grid above | PASS |
| "Default" links (3) | 46.45 x 44 px each | same | same | PASS |
| Clip arrows, 8 pm to 5 am, week view and ruler | 0 arrow characters, 0 clip elements | same | same | PASS |

- The link's colour is rgb(52, 169, 232), letter spacing normal. Row heights: 58 px at 1440 and 1198, 140.63 px at 390.
- At 390 the zoom is not shown while the Where section is open on a fresh pin (frame 328 x 150); it shows once Where is reopened (frame 328 x 250).
- The hours link is "See Denver's work hours", 171.61 x 44 px, margin-top 8 px, ring 2 px solid with a 2 px offset, focused with the keyboard (Shift+Tab, Tab; `:focus-visible` true). Hours row 108 px at 1440 and 1198, 125.5 px at 390. Read with 7 am to 5 pm set and no record line showing; the fix button was not pressed.
- The 56 px at 1440 and 1198 counts only text straight above the link. The item walk's 20.75 px counted any text in the grid above, with a record line showing. That reading was not repeated here. The 390 reading (5.5 px) is the same measure and the same number as the item walk's.
- The "Default" word itself is 42.45 px wide; the link's box is 46.45 px.

## Result per size

| Check | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| Console errors | 0 | 0 | 0 |
| HTTP 429 | 0 | 0 | 0 |
| axe, Where section and What section | 0 and 0 | 0 and 0 | 0 and 0 |
| Token in the page (6 checks) | 0 hits | 0 hits | 0 hits |
| Verdict (24 named checks in `results.json` `verdict`) | PASS, 0 failed | PASS, 0 failed | PASS, 0 failed |

- Non-GET requests to the site, all POST: `/api/geocode` 1, `/api/road-bearing` 1, `/api/render/nearest-intersection` 1, `/api/jurisdiction/suggest` 1, `/api/render/corridor-geometry` 21, `/api/render/audit` 17 (4 of them in part B), `/api/corridor-map` 4 per size. Nothing else. No save, sign-in or download route.
- Controls under 44 px outside the window: Mapbox's logo and attribution links (the #505 exception) at every size, and the footer's Terms (35 x 32) and Privacy (49 x 32) links at 1440 and 1198 with Where reopened. None of them is in this mission's scope. The What section: 0.
- Failed requests (not console errors): `api.mapbox.com net::ERR_ABORTED` 30 / 45 / 10 and `www.conestruct.com net::ERR_ABORTED` 4 / 3 / 3. The cause was not looked into.
- The token in files (`token-scan.json`, the second scan, run after this file was written): the files in this folder and the extras folder, the PNG crops' bytes included; 0 hits for the token's value, 0 for the gate header's name.

## Not measured

- Screens shorter than 844 px (the sticky week note covering the chart at 390x600 and 390x667, #561).
- A shift that crosses 6 am (4 am to 2 pm), the multi-week and one-day notes, and Loveland's labels (#559).
- The hours link's ring with a record line showing; the aerial at 768 px; the columns check (#563).
- Contrast; widths other than the three; signed-in sessions; other browsers; DPR above 1.

## Evidence

- `script/walk-558-prod.mjs`, `script/summary.mjs`, `script/scan-token.mjs`, `run.log`, `results.json`, `measures-summary.txt`, `token-scan.json`.
- `crops/prod-{1440,1198,390}-night-20-5-{day,week}.png`: 8 pm to 5 am, ruler and week (part A).
- `crops/prod-390-day-9-15-week.png`, `crops/prod-390-day-7-17-week.png`: the week note at 390 (part A).
- `crops/prod-{1440,1198,390}-no-closures-week.png`, `crops/prod-{1440,1198,390}-556-key-no-closures.png`: the key entry (part B, edit 1).
- `crops/prod-{1440,1198,390}-class-unset-{day,week}.png`: no street class (part B, edit 2).
- `crops/prod-{1440,1198,390}-557-where-row-change.png`, `-557-what-row-change.png`, `-557-aerial-zoom-reset.png`, `-557-hours-link-ring.png`.
- 16 more crops (the other views, and the "Default" links) are in `validation-artifacts-extra/ux-spacing-round/prod-check/` in the main checkout (untracked).

Every browser the script started was closed. No dev server was started.
