# #439 production check on 6231697 (2026-11-04)

SHIP VERIFIED: `/healthz` sha and the served frontend (the commit sha in the `/` page's chunks) are both `62316974338591f2ea465b0218e6d3aa077f61d3`, which is main HEAD.

Run: `script/walk-prod.mjs` is the local walk (`../evidence/script/walk.mjs`) pointed at https://www.conestruct.com/sandbox. It sends the gate token from `.env.local` (never printed) and uses no Playwright routes or stubs: live Mapbox geocoding in the picker, live `/api/road-bearing`, the live backend. Browser is Playwright Chromium at DPR 2, 1440x900 and 390x844, with axe-core injected from `conestruct/site/node_modules/axe-core`. Both pins were placed through the picker ("1600 E Colfax Ave, Denver"). Raw record: `walk.json`. Crops: `1440-*.png` and `390-*.png`. Sticky elements are unpinned for each crop only. Measurements are taken before that, on the page as served.

**Live road detection was down for the whole run.** All 12 `/api/road-bearing` answers (each pin, both widths, the picker's two "Re-detect roads" retries included) were `200 {"scan_status":"unavailable","candidates":[]}`. Three direct POSTs to the endpoint gave the same answer. The two Overpass mirrors the route uses failed from this machine too: overpass-api.de timed out at 25 s and overpass.openstreetmap.fr returned 403. The failure is upstream and has nothing to do with #439. No road could be picked, so the script saved each pin without a road (`NOROAD=1`) and walked what production shows for a road-less pin. Pin A (meant to be Franklin St, two-way) and pin B (meant to be E Colfax Ave, one-way) are therefore the same no-road pin. The road-specific rows are listed under "Not done".

| Check | 1440 | 390 |
|---|---|---|
| `/healthz` sha = served frontend = `6231697` | PASS | PASS |
| Pre-pin: "STEP 1 OF 4 WHERE", "Where is the work?", helper, then the address field + "Pick on map" under the heading | PASS | PASS |
| Ruling 1 order after a pin: header, question, aerial, summary row, CONFIRM card, nothing else (top in px) | PASS (160 / 213 / 257 / 573 / 635) | PASS (173 / 226 / 266 / 532 / 594) |
| "Edit on map" on the aerial's top-right corner, at least 44 px | PASS (108.5 x 44, 9 px in from the top and right) | PASS (108.5 x 44, same inset) |
| Ruling 7: key on the aerial, top-left (1440); below the aerial as a 2-column grid (390) | PASS (absolute, inside the frame, 8 px inset, `rgba(16,28,41,0.92)`, 1 px rule border) | PASS (static grid 156 px + 156 px, under the frame) |
| Side options on the no-road pin (W2 heading form): 4 rows, "East side / Traffic heads north", "South side / Traffic heads east", "West side / Traffic heads south", "North side / Traffic heads west"; still 4 with Shoulder work chosen | PASS | PASS |
| Question 1 of 2 (side): CONFIRM header, nothing pre-selected (both pins), the W3 sentence, Next disabled until a choice | PASS | PASS |
| Side chosen, then Next question: Question 2 of 2 (kind) with the three plain labels, none chosen, and "4 more kinds are coming once each is checked against its standard sheet." | PASS | PASS |
| Kind Details shows the sheet refs ("Shoulder work: TA-3/TA-5 · S-630-1; Lane closure with flaggers: TA-10 · S-630-1; Lane closure near an intersection: Cases 18/19 · S-630-1") | PASS | PASS |
| Kind chosen: the button reads "Confirm and lay out the plan" and is enabled | PASS | PASS |
| W7: kind opened first through its "Next:" row and chosen while the side is open: no `where-confirm`, the button reads "Next question" | PASS (0 `where-confirm`) | PASS (0) |
| Undo kind from its record: kind question reopens, nothing chosen | PASS | PASS |
| Undo side from its record: side question reopens, nothing chosen | PASS | PASS |
| Summary row (ruling 3, only finished items): "✓ 1,000 ft (default)", then Edit and Details. No road or cross street is printed because neither was found. | PASS | PASS |
| Details toggles the provenance line ("pin at 39.73978, -104.96825"; with no road there is no OSM way or node) | PASS | PASS |
| Edit opens the fold: address field, Found the spot / Work starts / Extent, work-zone length field | PASS | PASS |
| `/api/render/audit` requests before Confirm | PASS (0) | PASS (0) |
| Confirm moves the band to WHAT | PASS (`band-what` open, WHERE closed) | PASS |
| axe with WHERE open (pinned, kind question open, Edit fold open) | PASS (0 violations) | PASS (0 violations) |
| Targets under 44 px inside the WHERE band, from #439 | PASS (0) | PASS (0) |

Result: 20 PASS, 0 FAIL at both widths.

**Pre-existing on main, not #439.** At 1440 only, six targets inside the WHERE band are under 44 px. They're the same six the local walk found: the aerial zoom "+" and "−" (32 x 32), the Edit fold's ledger CHANGE / MOVE / CHANGE (66.2 x 32, 52.1 x 32, 66.2 x 32) and the length field's "default" toggle `info-toggle-worklen` (47 x 32). At 390 there are none.

**Earlier attempts.** Run 1's wait for the road list matched the dialog's own subtitle ("pick the road") before the search had answered, so the script now waits for the road's button. Run 2 stopped because no road arrived (scan unavailable). Run 3 is the one recorded here.

**Not done:** the road-specific rows: side options per road kind (2 on two-way Franklin St, 1 on one-way E Colfax Ave), the summary's road and "starts at East Colfax Avenue", and the Details line's OSM way. Live road detection answered "unavailable" for the whole run, so they need a re-run once Overpass answers. Also not done: the full five-row key (it draws only after Confirm, which closes WHERE), W11 (no aerial), and a divided-road pin.
