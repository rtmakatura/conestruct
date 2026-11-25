# #568 trace: `1437 Bannock St, Denver` pins, the lookup lists no roads

Recorded 2026-11-24.

## 1. Where the search puts the pin

Mapbox geocoding v5, the query `lib/geocode.ts` sends (`limit=1`, the Colorado box), plus `routing=true` to see the routable point. Full answer: `mapbox-answer.json`.

| Field | Value |
| --- | --- |
| `place_name` | 1437 Bannock Street, Denver, Colorado 80202, United States |
| `place_type` / `relevance` | address / 1 |
| `properties.accuracy` | rooftop |
| `center` (the pin) | 39.739247, -104.99097 |
| `routable_points.points[0]` | 39.739412, -104.991322 |

The window showed "Pin at 39.7392, -104.9910" (#566's production check).

## 2. What is near that point

Overpass (overpass-api.de), every `highway` way within 150 m of 39.7392, -104.9910, distance from the pin (39.739247, -104.99097) to each way's nearest segment (equirectangular, the route's own projection). The ways the lookup reads are in bold.

| Distance from the pin (m) | Way | `highway` | Name |
| --- | --- | --- | --- |
| 53.3 | 790590867 | pedestrian | Bannock Central Plaza |
| **57.8** | 130911277 | tertiary | **Cherokee Street** |
| 60.5 | 1475416531 | pedestrian | Bannock Street |
| **84.1** | 628677817 | primary | **West Colfax Avenue** |
| **87.3** | 130911269 | secondary | **West 14th Avenue** |
| 96.2 | 1392204224 | cycleway | Bannock Street |

Nearer than these there are only steps, footways and parking aisles (13 to 49 m from 39.7392, -104.9910). From the routable point, Cherokee Street is 27.7 m.

## 3. What the lookup asked

`app/api/road-bearing/route.ts` before this change: ways of twelve motor classes within `SEARCH_RADIUS_M` = 50 m, kept when within `SNAP_MAX_DISTANCE_M` = 30 m. No such way is within 50 m, so it answered `scan_status: "ok"` with 0 roads, as production did 6 of 6 times.

## 4. The answer after the change

The route on the recorded Overpass answers (`conestruct/site/app/api/road-bearing/__fixtures__/bannock-1437-568.json`: the roads query at 100 m and the same-name query, both in the file), from `route.bannock-address.test.ts`:

- `{lat, lng, reach: "address"}`: `nearest_only: true`; Cherokee Street (57.8 m), West Colfax Avenue, West 14th Avenue, in that order.
- `{lat, lng}` (a tapped pin at the same point): 0 roads, no flag, the 50 m query, as before.

## 5. Red proof

The two changed test files on the old code (`git archive` of `fa28f0a`, the new tests and fixture copied in): 20 failed, 31 passed of 51. On the new code: 51 passed. The affected set (`app/api/road-bearing`, `components/LocationPickerModal*`, `lib/road-detection`): 32 files, 439 passed. Three assertions in `LocationPickerModal.coords-bar.test.tsx` pinned the lookup's request body for an address pin and now carry `reach: "address"`.
