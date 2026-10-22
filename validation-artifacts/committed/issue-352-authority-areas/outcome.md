# #352 outcome

## The extents (`data/boundaries/extents.json`, written by `scripts/build_boundaries.py`)

| key | authority | area | bbox [minLng, minLat, maxLng, maxLat] |
|---|---|---|---|
| cdot | state | Colorado (64 TIGER counties, STATEFP 08) | -109.060204, 36.992449, -102.041522, 41.003444 |
| el_paso | county | El Paso County (TIGER county) | -105.072529, 38.51944, -104.051568, 39.13004 |
| loveland | city | Loveland (TIGER incorporated place) | -105.15962, 40.34897, -104.962329, 40.465664 |
| e470 | toll_authority | none (no sourced polygon) | — |

The rebuild from the cached TIGER zips (`tl_2025_us_county.zip`, `tl_2025_08_place.zip`, retrieved 2026-07-21) rewrote every existing `data/boundaries/*.geojson` and `_meta.json` byte-identically. `git status` showed only the new `extents.json`, and the Glendale enclave gate passed. `jurisdiction-areas.json`: +32 lines, 0 removed.

## Live Mapbox run (2026-10-22, `LIVE_GEOCODE=1 npx vitest run lib/geocode.live.test.ts`)

Distances are from E Colfax Ave & N Williams St (the #347 reference corner).

| input | jurisdiction | result | type | mi | note |
|---|---|---|---|---|---|
| `Colfax & Williams, Denver` | none | 39.739964, -104.966006 | intersection | 0.00 | #347, unchanged (from a second run the same day; the first run's grep dropped this row) |
| `Colfax and Williams` | none | 39.739964, -104.966006 | intersection | 0.00 | #347, unchanged |
| `E Colfax Ave and N Williams St` | none | 39.739964, -104.966006 | intersection | 0.00 | #347, unchanged |
| `E Colfax Ave & N Race St, Denver` | none | 39.739962, -104.963485 | intersection | 0.13 | #347, unchanged |
| `Colfax & Williams` | none | 39.739964, -104.966006 | intersection | 0.00 | #347, unchanged |
| `Colfax & Williams` | denver | 39.739964, -104.966006 | intersection | 0.00 | #347, unchanged |
| `Colfax & Main` | none | HTTP 422 add a city | | | acceptance 2: still 422, no out-of-state pin |
| `Colfax & Main` | denver | 39.764245, -104.854753 | place | 6.14 | #347, unchanged |
| `Colfax & Main` | cdot | 39.738365, -104.323716 | intersection | 34.13 | **moved** (was 422): Strasburg, CO |
| `US 285 & CO 9` | cdot | 39.221229, -105.993766 | intersection | 65.49 | new: Fairplay, CO |
| `I-25 & US 50` | cdot | 38.338098, -104.619794 | intersection | 98.63 | new: Pueblo, CO |
| `Academy & Platte` | el_paso | 38.839656, -104.757338 | intersection | 63.20 | new: Colorado Springs, CO |
| `Eisenhower & Lincoln` | loveland | 40.407199, -105.073065 | intersection | 46.45 | new: Loveland, CO |
| `Colfax & Main` | e470 | HTTP 422 add a city | | | e470 unchanged (no polygon) |
| `Colfax & Main, Aurora` | none | 39.688880, -104.687806 | place | 15.20 | #347, unchanged |
| `Colfax & Main, Aurora, IL` | none | 41.758194, -88.315002 | place | 881.23 | #347, unchanged |
| `Colfax & Kipling, Lakewood` | none | 39.740123, -105.109456 | intersection | 7.62 | #347, unchanged |
| `1437 Bannock St, Denver, CO` | none | 39.739247, -104.990970 | address | 1.33 | plain address, unchanged |

Every #347 row gives the same result as #347's recorded table. The rows that moved are exactly the predicted ones, with `cdot` / `el_paso` / `loveland` selected.

The town names come from a Mapbox reverse lookup of each new pin (`types=address,place`, limit 1):

| pin | nearest address | place |
|---|---|---|
| -104.323716, 39.738365 | 1506 Main Street, Strasburg, Colorado 80136 | Strasburg |
| -105.993766, 39.221229 | 331 US Route 285, Fairplay, Colorado 80440 | Fairplay |
| -104.619794, 38.338098 | 2201 John F Kennedy Memorial Highway, Pueblo, Colorado 81008 | Pueblo |
| -104.757338, 38.839656 | 507 North Academy Boulevard, Colorado Springs, Colorado 80909 | Colorado Springs |
| -105.073065, 40.407199 | 300 East Eisenhower Boulevard, Loveland, Colorado 80537 | Loveland |

Acceptance 1: with CDOT selected, a corner in Colorado outside the 31 places lands on the corner (Fairplay, Pueblo). Acceptance 2: `Colfax & Main` with no jurisdiction and no city still answers 422.

## Red proof (new tests against `b74d3c6`'s code, via `git archive`)

- `lib/geocode.test.ts`: 3 failed, 24 passed. The failures are the three tests of new behavior: cdot lands a corner outside our places, the el_paso box, and the loveland box. The cdot-422 guards, e470, and the typed-city guard pass both before and after.
- `tests/test_jurisdiction_areas.py`: 1 failed (`test_authority_areas_follow_each_record_authority`), 3 passed.

## Rule 5 miss

`scripts/production-env.txt` wasn't in the prediction. Its `MAPBOX_TOKEN` cite pointed at `lib/geocode.ts:174`, and the new lines in `geocode.ts` pushed `process.env.MAPBOX_TOKEN` down to line 182. `tests/test_vercel_env_check.py` caught it, and the cite now reads `:182`. No behavior change. Predictor: any added line above a line cited by number moves that cite.

## Tests

- Backend baseline `3496 passed, 2 skipped`; after `3497 passed, 2 skipped` (+1 new, after the cite fix).
- Frontend baseline `2495 passed, 1 skipped`; after `2501 passed, 1 skipped` (+7 new, −1 replaced #347 pin).
