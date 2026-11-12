# #525 trace: Colfax and Pennsylvania (39.7401, -104.9811)

OSM read 2026-11-11 from overpass-api.de with the route's own two queries (recorded in `conestruct/site/app/api/road-bearing/__fixtures__/colfax-pennsylvania-525.json`). OSM data (c) OpenStreetMap contributors, ODbL.

## The ways within 50 m of the pin

| Way | Name | highway | oneway | Drawn | Nearest to the pin (rounded pin) |
|---|---|---|---|---|---|
| 1548629055 | Pennsylvania Street | residential | no | S→N, 39.7400552 → 39.7402955 | 1.69 m, bearing 358.7 |
| 596451653 | Pennsylvania Street | residential | no | S→N, between Colfax's carriageways (39.7399955 → 39.7400552) | 5.23 m |
| 130886457 | Pennsylvania Street | residential | no | S→N, 39.7397053 → 39.7399955 | 11.72 m |
| 596451645 | Pennsylvania Street | residential | no | S→N, south of 39.7397053 | 43.95 m (outside the 30 m snap) |
| **812978772** | Pennsylvania Street | residential | no | **N→S**, 39.7416764 → 39.7402955 | **21.78 m, bearing 180.1** |
| 1547338992, 1548629056 | East Colfax Avenue | primary | yes | E→W (north carriageway, westbound) | 4.99 m, 5.23 m |
| 628643780, 628643782, 130886458 | East Colfax Avenue | primary | yes | W→E (south carriageway, eastbound) | 11.64 m, 11.72 m, 38.33 m |

Shared nodes: Pennsylvania meets Colfax's south carriageway at (39.7399955, -104.9811167) and its north carriageway at (39.7400552, -104.9811184); both are also tagged `highway=traffic_signals` (nodes 176086233 and 14073675873). Way 812978772's south end (39.7402955, -104.9811094) is way 1548629055's north end: the two connect.

## Why two rows, and why one reads 26 m

`dedupCandidates` (`conestruct/site/lib/road-detection/dedup.ts`) keeps the nearest way per (name, class, bearing octant). Every Pennsylvania piece is drawn south to north (octant N) except 812978772, drawn north to south (octant S). So the street came out as two entries: 1548629055 (octant N) and 812978772 (octant S). `groupCarriageways` (#507) only pairs one-way ways, so it left both.

812978772 doesn't reach the corner: it stops one block-piece short, at the node where 1548629055 takes over. Its nearest point to the pin is that south end, 21.8 m north of the rounded pin. Ryan saw 3 m and 26 m. The coordinates on screen are rounded to 4 places; at (39.74006, -104.98108), which rounds to the same 39.7401, -104.9811, the two pieces measure 3.30 m and 26.34 m, so the readings fit a pin a few metres south-east of the rounded point. That pin is reconstructed, not recorded.

With this change the route returns one Pennsylvania entry: way 1548629055, at 1.69 m (the rounded pin), "at East Colfax Avenue".

## "Traffic both ways" for Pennsylvania (Rule 12)

Every Pennsylvania way in reach carries `oneway=no`, `lanes=2`, `highway=residential`, `bicycle=designated` (ways 130886457, 596451645, 596451653, 812978772, 1548629055; full tags in the fixture). The list's words come from the backend's reading (`/render/road-travel`, `corridor.travel_reading`, #512), which reads `oneway=no` as two-way. So "Traffic both ways" is what OSM says for Pennsylvania at this corner. It matches the tags; nobody checked it on the ground.

## Where the work's direction from the corner is decided today

The plan doesn't take a direction from the road list. Under `pinModel="work_start"` the pin is the upstream end for the closed lane's traffic (ruling 9; `src/rules/corridor.py` `opposing_work_start`). The side choice on the page (`WorkPlacement.side` + `travel`, with or against the relayed centerline's vertex order; `src/api/schemas.py` `WorkPlacement`) sets which way that traffic runs, and the work runs from the pin that way for `workLen`. Near side or far side of a marked intersection is the backend's, computed from `meta.intersection` along the road (`src/api/schemas.py`, `alongStationFt` comment and `NearIntersectionScenario._check_station_producer`; `src/api/render_api.py` calls `nearest_intersection` with the marked cross street). Folding 812978772 into 1548629055 doesn't change this: the lead way's centerline is stitched through the corner from the same-name pool, as before. Its `geometry` on the wire is byte-identical (churn check in plan.md).

## Adjacent

#501 / #502 (name-key collisions and abbreviations) are untouched: the merge compares names exactly, as `dedup.ts` and `group.ts` do.

Note (after the gates): the distances in this table use a flat frame of 111,320 m per degree. The route measures with haversine and gives 21.75 m for 812978772 and 4.98 m for Colfax (plan.md replay). Both round to the 22 m and 5 m shown on screen.
