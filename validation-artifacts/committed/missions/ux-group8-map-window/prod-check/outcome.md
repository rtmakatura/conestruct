# #507 production check on eb7cfb9

- `/healthz` sha: `eb7cfb9bf8465c2a4c0b7c771e60c292b5fedcf3` (= origin/main `eb7cfb9`), read 2026-11-11 before the walks.
- Live `https://www.conestruct.com/sandbox`, live road data, live backend, headless Chromium, DPR 1, the gate header on the site's own requests only (`scripts/gate.cjs` `newGatedContext`). Inter loaded in every flow.
- Script: `script/walk-507-prod.mjs`, copied from the local walk (`validation-artifacts-extra/ux-group8-map-window/walk-run/walk507.mjs`) and changed for prod (header comment). The pins are typed coordinates: Colfax `39.73997,-104.96632`, Lincoln `39.7345,-104.9862`, Speer `39.7197,-104.97677`, failing point `39.7501,-104.9601`.
- **The lookup failure is forced in the browser:** while the F1 and #506 flows need it, `POST /api/road-bearing` answers 504 (Playwright route, page side). The page takes the same `!r.ok` path as a real Overpass outage (`LocationPickerModal.tsx:768`). Those forced 504s are the only 504s in the logs.
- Runs, one at a time: `logs/run1-1440.log` (all five flows), `logs/run2-1440-edit506.log` (the #506 flow again, with 4xx bodies logged), `logs/run3-1198x930.log`, `logs/run3-390x844.log`. Generate was not run. The token scan of this folder found 0 hits.

## Results

| Check | 1440x900 | 1198x930 | 390x844 | Result |
| --- | --- | --- | --- | --- |
| #512 Colfax rows | "East Colfax Avenue / Traffic both ways · 1 m", "Williams Street / Traffic both ways · 27 m" | same | same | PASS |
| #512 Lincoln row | "North Lincoln Street / One-way · 6 m" | same | same | PASS |
| #512 Speer row | "East Speer Boulevard / Divided road · 0 m" | same | same | PASS |
| W1 Save with none ticked | disabled, "Pick a road, or a direction if the lookup failed." | same | same | PASS |
| W2 side question carries the direction | Colfax: South side / Next to eastbound traffic, North side / Next to westbound traffic (twin). Lincoln: East / West, both "Next to northbound traffic". Speer: picked for you, "East Speer Boulevard is divided here, so the work is on the northeast side, next to the traffic on this side.", no Undo | same | same | PASS |
| F1 notice + Try again | "We couldn't look up the roads here." + Try again; Try again sends 1 new `/api/road-bearing` | same | same | PASS |
| #511 tiles: mark and ring | picked: `is-picked`, border and inset 1 px ring `rgb(52,169,232)`, the 14 px mark filled; unpicked: border `rgb(44,62,83)`, no ring, the mark hollow with a grey 2 px border. All four tiles read the same way | same | same | PASS |
| F2 sides after NE–SW | "You said the road runs northeast–southwest", Southeast / Northwest, each with its heading; wire `roadAxis: northeast_southwest`, `work.heading: SW` | same | same | PASS |
| #506 Save gate after Edit on map → failed lookup | disabled with the line; a forced click and Enter leave the window open (nothing saved) | same | same | PASS |
| #506 after a direction + Save | the side asked again with #488's line, the direction's two sides | same | same | PASS |
| #506 corridor-geometry 400 | one 400 `pin_model_input` (stale `work.travel` with no road) | same | same | **FOUND, filed #516** |
| Band (#469/#490) | 793, two columns, columns end together (0 px) | 793, the same | one column (912 / 912 / 1007 / 831 / 885) | PASS |
| axe | 0 in every window, band and whole-page reading | 0 | 0 | PASS |
| 44 px | 2 under: Latitude and Longitude 385x43 (D3, pre-existing, recorded in `walk.md`) | 2 under: 284x43 (D3) | 0 under | PASS (D3 unchanged) |
| Mapbox marks (#505, excepted) | © Mapbox, © OpenStreetMap, Improve this map, © Maxar, Mapbox homepage | Toggle attribution, Mapbox homepage | Mapbox homepage | excepted |
| Console / page errors | grouped, oneway, divided: 0 / 0. failed: only the 2 forced 504s. edit506: the 2 forced 504s + the #516 400 | same | same | PASS except #516 |

## Not a finding

- After typed coordinates the map stays at the state view (the crops show Colorado). That is the documented typed-pin behaviour: a typed move keeps the zoom (`LocationPickerModal.tsx:922-926`).

## Kept crops

`crops/`: at 1440 the grouped list ticked, Lincoln, Speer, the Colfax side question, F1 failed, F1 NE–SW picked, #506 Save disabled and #506 direction picked. At 1198 and 390, the grouped list ticked, F1 NE–SW picked and #506 Save disabled. The other crops were moved, not deleted, to `validation-artifacts-extra/ux-group8-map-window/prod-check/` in the main checkout.
