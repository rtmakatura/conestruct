# #347 outcome

## Root cause (investigated 2026-10-18, live Mapbox v5)
- Mapbox v5 finds an intersection only from the bare street pair. `Colfax & Williams` → East Colfax Ave and North Williams St, Denver. `Colfax & Williams, Denver` → "Denver Street, Schuyler, Nebraska" (41.452042, -97.064631): the trailing city is read as a street name.
- v5 has no intersection place type. A true corner comes back `place_type: ["address"]` with `properties.accuracy: "intersection"`; the old `lib/geocode.ts` dropped `properties` and took `features[0]` (`limit=1`).
- A Colorado bbox alone does not fix it: `Colfax & Williams, Denver` inside a CO box → Denver Botanic Gardens, 0.64 mi off; `Colfax and Williams, Denver, CO` → Williams Ct, 9.39 mi off.
- Mapbox v6 forward returns the same answers (`feature_type: "street"`), so upgrading is not the fix.

## Rule 5 prediction (stated before the diff)
- **Changes:** only queries `parseCrossStreets` reads as a street pair. They now make one or two Mapbox calls (city, then `types=address&limit=5` with bbox/proximity) and return `placeType: "intersection"`, `"place"` (the area, coarse) or a 404. `/api/geocode` accepts an optional `jurisdiction_key`; the picker sends the form's.
- **Byte-identical:** every other query's Mapbox request (`…/{q}.json?access_token=…&limit=1`, asserted in `lib/geocode.test.ts`) and its response. The picker's precise/coarse/error handling is unchanged; `"intersection"` was already in `PRECISE_PLACE_TYPES`.
- **New file:** `conestruct/site/lib/jurisdiction-areas.json` (31 TIGER place extents).

## Live results (2026-10-18, `LIVE_GEOCODE=1 npx vitest run lib/geocode.live.test.ts`)
Distance is from the Colfax & Williams corner (39.739964, -104.966006).

| Input | Jurisdiction selected | Result | placeType | Distance | Case |
|---|---|---|---|---|---|
| `Colfax & Williams, Denver` | none | 39.739964, -104.966006 | intersection | 0.00 mi | issue input 1 (was Nebraska) |
| `Colfax and Williams` | none | 39.739964, -104.966006 | intersection | 0.00 mi | issue input 2 |
| `E Colfax Ave and N Williams St` | none | 39.739964, -104.966006 | intersection | 0.00 mi | issue input 3 |
| `E Colfax Ave & N Race St, Denver` | none | 39.739962, -104.963485 | intersection | 0.13 mi | issue input 4 (Colfax & Race, the right corner) |
| `Colfax & Williams` | none | 39.739964, -104.966006 | intersection | 0.00 mi | no city, no jurisdiction |
| `Colfax & Williams` | denver | 39.739964, -104.966006 | intersection | 0.00 mi | no city, Denver selected |
| `Colfax & Main` | none | 42.437325, -85.641768 | intersection | 1021.10 mi | no city, no jurisdiction: Plainwell, MI (flagged corner, accepted per ruling) |
| `Colfax & Main` | denver | 39.764245, -104.854753 | place | 6.14 mi | no city, Denver selected: no corner in Denver ⇒ "Area located" |
| `Colfax & Main` | cdot | 42.437325, -85.641768 | intersection | 1021.10 mi | CDOT has no TIGER area ⇒ treated as none |
| `Colfax & Main, Aurora` | none | 39.688880, -104.687806 | place | 15.20 mi | city in two states: Aurora, CO box; no corner ⇒ "Area located" |
| `Colfax & Main, Aurora, IL` | none | 41.758194, -88.315002 | place | 881.23 mi | Illinois named ⇒ Mapbox's Aurora, IL; no corner ⇒ "Area located" |
| `Colfax & Kipling, Lakewood` | none | 39.740123, -105.109456 | intersection | 7.62 mi | Lakewood, CO box (Mapbox alone ranks Lakewood, NJ first); W Colfax & Kipling |
| `1437 Bannock St, Denver, CO` | none | 39.739247, -104.990970 | address | 1.33 mi | plain street address, unchanged path |

## Tests
- `lib/geocode.test.ts` (stubbed Mapbox): the four issue inputs' shapes, no-city with and without a jurisdiction, a no-area jurisdiction, the plain address's exact unchanged URL, Aurora and Aurora, IL.
- `app/api/geocode/route.test.ts`: `jurisdiction_key` forwarded; non-string ⇒ null.
- `components/LocationPickerModal.state-contract.test.tsx` (mounted): the search body carries the jurisdiction; an intersection answer places the pin and detects there; a 404 places no pin and shows "No match for that address"; an area answer shows "Area located".
- `tests/test_jurisdiction_areas.py`: the committed areas equal a fresh build from `data/boundaries/`.
- Red proof: against the pre-fix `lib/geocode.ts` and picker, the new site tests fail 19 of 35.
