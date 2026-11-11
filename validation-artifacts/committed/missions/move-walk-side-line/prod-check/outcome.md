# #488 production check on a5a4569

- `/healthz` sha: `a5a456954cf09ff3c7788023bf3a7a13444bd407` (= origin/main `a5a4569`), read 2026-11-10 before the walks.
- Live `https://www.conestruct.com/sandbox`, live road data, headless Chromium, DPR 1, the gate header on the site's own requests only (`scripts/gate.cjs`). E Colfax: the pin by address search (1550 / 1600 E Colfax Ave, the East Colfax row ticked), the same corridor as 39.73997,-104.96632.
- Script: `script/walk-488-prod.mjs`, adapted from `issue-489/script/walk-485-move-prod.mjs` (#489's own-road wait kept). Steps: A0 the side question (no line) → A both questions answered (Shoulder work, the side) → B "Edit on map" on the aerial's corner (`button.a-aerial-edit`, not the Edit panel) → the other address → Save & Close → C the side answered again → D "Edit on map" → Save & Close with nothing changed.
- Runs: 1440 twice (run 1 stopped at D, below), 390 once. One walk at a time.

## Results (run 2)

| Size | Step | Line nodes | Side ticked | Kind kept | Band h | Aerial frame in band (left, dy, w x h) | Right column h | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1440x900 | A0 side question | 0 | no | yes | 793.3 | 297, 97.5, 411 x 655 | 655 | - |
| 1440x900 | A answered | 0 | yes | yes | 793.3 | 297, 97.5, 411 x 655 | 655 | PASS |
| 1440x900 | B Edit on map, moved | 1, the exact line | no | yes | 793.3 | 297, 97.5, 411 x 655 | 655 | PASS |
| 1440x900 | C answered again | 0 | yes | yes | 793.3 | 297, 97.5, 411 x 655 | 655 | PASS |
| 1440x900 | D Edit on map, unchanged | 0 | yes | yes | 793.3 | 297, 97.5, 411 x 655 | 655 | PASS |
| 390x844 | A0 side question | 0 | no | yes | 843.3 | 31, -, 328 x 150 sticky | 519 | - |
| 390x844 | A answered | 0 | yes | yes | 909.8 | 31, 93.8, 328 x 150 sticky | 519 | PASS |
| 390x844 | B Edit on map, moved | 1, the exact line | no | yes | 896.8 | 31, 93.8, 328 x 150 sticky | 572.5 | PASS |
| 390x844 | C answered again | 0 | yes | yes | 909.8 | 31, 93.8, 328 x 150 sticky | 519 | PASS |
| 390x844 | D Edit on map, unchanged | 0 | yes | yes | 909.8 | 31, 93.8, 328 x 150 sticky | 519 | PASS |

- The line, read from the page at B: "Your edit changed the road or the work start, so this is asked again." Its box with margins is 37.5 px at both sizes.
- **1440:** the band (793.3) and the aerial frame (411 x 655 at left 297, dy 97.5) are the same before the move (A) and after it (B), and in every step. Matches the local walk.
- **390:** one column, no fixed height (#485 E8), so the band follows its content: the line adds 53.5 px to the right column at B (572.5 vs 519), as in the local walk. The A → B band drop is the aerial's key, which draws only while the side is answered (existing, as the local outcome says). The strip is the same 328 x 150 sticky box in every step.
- D: the corner door reopened the picker with Save & Close enabled and the road kept; Save & Close with nothing changed left the side ticked and showed no line.

Crops (`crops/`): `1440x900-03-B-edit-on-map-moved.png`, `390x844-03-B-edit-on-map-moved.png` (the side re-asked with the line, the kind kept), `1440x900-05-D-edit-on-map-unchanged.png`. The rest, and run 1's, are in `validation-artifacts-extra/move-walk-side-line/prod-check/` in the main checkout (untracked).

## Run 1 at 1440 (stopped at D, reported, not claimed)

Run 1's B Save went through with no road ticked: the summary read "1,000 ft (default)" with no road, and the side question showed four options (East / South / West / North side). With the line under four options the band was 837 (A 793.3) and the aerial frame 411 x 698.8 (A 655). The line itself showed once, the side was unticked and the kind kept. At D the corner door reopened the picker with no road ticked ("PICK A ROAD TO CONTINUE", 4 roads found) and Save & Close disabled, so the walk timed out waiting for it. Two console errors "Failed to load resource: 400" (the run did not yet record which URL). Run 2 recorded failing loads: none at either size.

Not shown by this check: whether the four-option, no-road side question alone (without the line) already overflows the 1440 column; run 1 has no A0 read for that state. The ticked-road case, the one #488's expectation names, keeps the band unchanged.

## axe, 44 px, console, token

- axe (band, every step; whole page at D): 0 violations at both sizes, both runs.
- 44 px (band, every step): 7 at 1440, 5 at 390, the same in every step. The 5 at both sizes are the map attribution: the Mapbox logo (88 x 23), "© Maxar", "© Mapbox", "© OpenStreetMap", "Improve this map" (14 px tall). The 2 more at 1440 are the aerial's own zoom buttons `+` / `−` (`.a-aerial-zbtn`, 32 x 32), which are not shown at 390. (#505: this check counts Mapbox's marks; another check does not.)
- Console errors: run 2, 0 at both sizes; run 1 at 1440, 2 (above). Page errors: 0 in every run.
- Token scan: the gate token's value is in none of the files in this folder or in `validation-artifacts-extra/move-walk-side-line/prod-check/` (scanned before commit).
