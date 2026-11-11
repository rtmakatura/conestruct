# #516 production check (mission ux-group7-what-section, #518)

Run 2026-11-11 against `https://www.conestruct.com/sandbox`.

- `/healthz` sha: `197c608c6149f0e3275a91fd3a6c6dc1253ed272` (equals `origin/main` at the time of the run).
- Script: `script/walk-516-prod.mjs`, copied from `../../ux-group8-map-window/prod-check/script/walk-507-prod.mjs` and cut to #516's reproduction. The gate token goes in the `x-conestruct-gate` header on the site's own requests only (`scripts/gate.cjs` `newGatedContext`); it is never in a request body or in any file here.
- Steps (each size, fresh browser): Pick on map at 39.73997, -104.96632, tick East Colfax Avenue, Save and close; Shoulder work, answer the side (first option); Edit on map, `/api/road-bearing` forced to 504 in the browser, pin moved to 39.7501, -104.9601; forced click on the disabled Save; pick North–south, Save and close; read the side question; pick the first side answer.

## Result: PASS at all three sizes

| | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| corridor-geometry requests | 16 | 14 | 16 |
| statuses | all 200 | all 200 | all 200 |
| `work.travel` with `confirmedRoad: null` | 0 | 0 | 0 |
| 400 `pin_model_input` | 0 | 0 | 0 |
| reads with `work.heading` after the direction save | 4 (N, S, N, S) | 2 (N, S) | 4 (N, S, N, S) |
| side question: East / West with "You said the road runs north–south" | yes | yes | yes |
| #488 re-ask line ("Your edit changed the road or the work start, so this is asked again.") | yes | yes | yes |
| #506: Save disabled with no answer, "Pick a road, or a direction if the lookup failed." | yes | yes | yes |
| #506: forced click on the disabled Save | dialog stayed open, nothing saved | same | same |
| Save after North–south | enabled | enabled | enabled |
| axe (window, band, page) | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| 44 px: controls checked, under | 20, 2 (Latitude 385x43, Longitude 385x43) | 17, 2 (Latitude 284x43, Longitude 284x43) | 17, 0 |
| 44 px excepted (Mapbox, #505) | © Mapbox, © OpenStreetMap, Improve this map, © Maxar, Mapbox homepage | Toggle attribution 24x24, Mapbox homepage | Mapbox homepage |
| console errors | 2, both the forced 504s | 2, both the forced 504s | 2, both the forced 504s |
| page errors | 0 | 0 | 0 |

The Latitude/Longitude boxes at 43 px are the known pre-existing D3 item, not new.

## The request bodies around the edit (1440; 390 is the same, 1198 has one fewer N/S pair after the direction save)

Compact meta per request (road, `roadAxis`, `work`, pin). Full bodies: `logs/geometry-bodies-<width>.json`.

```
#8  [shoulder + side]       road East Colfax Avenue (600545936)  roadAxis null         work {"side":"right","travel":"with_geometry"}  39.73997,-104.96632  200
#9  [edit, pin moved, 504]  road East Colfax Avenue (600545936)  roadAxis null         work {"side":"right","travel":"with_geometry"}  39.73997,-104.96632  200
#10 [edit, pin moved, 504]  road null                            roadAxis null         work null                                       39.7501,-104.9601    200
#11 [direction saved]       road null                            roadAxis north_south  work null                                       39.7501,-104.9601    200
#12 [direction saved]       road null                            roadAxis north_south  work {"side":"right","heading":"N"}             39.7501,-104.9601    200
#13 [direction saved]       road null                            roadAxis north_south  work {"side":"right","heading":"S"}             39.7501,-104.9601    200
#14-#16                     same as #11-#13                                                                                                            200
```

Every request that carries `work.travel` also carries the Colfax road at the Colfax pin. The first request after the direction save (#11) has `work: null`, and the load-ahead for the new direction follows with `work.heading` N and S.

## Before (production `eb7cfb9`)

`../../ux-group8-map-window/prod-check/logs/run2-1440-edit506.log`, `run3-1198x930.log` and `run3-390x844.log` each show one `400 /api/render/corridor-geometry` `pin_model_input` with `{"road":null,"roadAxis":"north_south","work":{"side":"right","travel":"with_geometry"}}`, and a third console error for it. On `197c608` that request is gone at all three sizes and the console holds only the two forced 504s.

## Files

- `logs/run-1440x900.log`, `logs/run-1198x930.log`, `logs/run-390x844.log`: the walk's output.
- `logs/geometry-bodies-1440.json`, `-1198.json`, `-390.json`: every corridor-geometry request (step, status, meta, full body, side options answered).
- `crops/e516-1440-direction-picked.png`, `crops/e516-1440-after-save.png`, `crops/e516-1198-after-save.png`, `crops/e516-390-after-save.png`.
- Other crops (moved, not deleted): `validation-artifacts-extra/ux-group7-what-section/prod-check/` in the main checkout.
- Token scan of this folder before the commit: 0 occurrences.
