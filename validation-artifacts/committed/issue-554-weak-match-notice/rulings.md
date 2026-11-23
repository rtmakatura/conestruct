# #554: a weak geocoder match gets a notice and no pin (with #553)

Branch `issue-554-weak-match-notice` on `origin/issue-548-prod-check` (`94a7d95`). The plan and the Rule 5 prediction are in `checkpoint.md`.

## Ryan's ruling

Ryan, 2026-11-23, in the `/start 554` message, verbatim:

> Ruling: first record what the geocoder returns for "39 N, 44.4" and "105° W, 39.7401" (match type and relevance). Then any geocoder result that is not a street address or intersection match, or falls below a relevance threshold you record, shows the floating "weak match" notice like the town one ("Closest match: <place>. Check the pin before you go on.") and nothing moves. Fold #553 in as a small second item.

## Step 1: what the geocoder returns

`probe/probe.mjs` makes the two requests `geocodePlain` makes (Mapbox v5 places, `limit=1`: inside the Colorado box, then anywhere) and keeps the match fields. Run 2026-11-23; all 50 answers are in `probe/mapbox-answers.json`. The answer inside the box:

| Typed | Type / accuracy | Relevance | Place | Center (lat, lng) |
|---|---|---|---|---|
| `39 N, 44.4` | address / interpolated | 1 | 39 North Main Street, Holly, Colorado 81047 | 38.053441, -102.122704 |
| `105° W, 39.7401` | address / street | 1 | W Boulevard, Walsh, Kansas 81090 | 37.294763, -102.041892 |

The centers are the pins #554 reports (38.0534, -102.1227 and 37.2948, -102.0419).

**Both are street-address matches at relevance 1.** Neither test in the ruling (not a street address; relevance under a threshold) marks them. Mapbox drops `44.4`, `105°` and `39.7401` from the text and still scores the rest a full match. So the ruling's two tests are built as written, and a third is added so that the ruling's own two texts get the notice (call 3). **Flagged for Ryan at the top of the report.**

Other answers the calls below rest on:

| Typed | Type / accuracy | Relevance | Place |
|---|---|---|---|
| `39 N, 104 W` | address / interpolated | 1 | 39 North Main Street, Holly |
| `39 N` | address / interpolated | 1 | 39 North Main Street, Holly |
| `105 W` | address / point | 1 | 105 West Goff Avenue, Granada |
| `39.7401° N` | address / street | 0.99 | North Josephine Street, Denver |
| `E 470 N` | address / rooftop | 0.994259 | 470 East 134th Avenue, Northglenn |
| `E Colfax Ave, Denver` | address / street | 0.805556 | East Colfax Avenue, Aurora |
| `123 Main St, Lakewood` | address / street | 0.796296 | Main St, Lakewood |
| `200 Colfax, Denver` | address / rooftop | 0.459259 | 200 Colfax Street, Oak Creek |
| `1437 Banock St, Denver` | address / rooftop | 0.988175 | 1437 Bannock Street, Denver |
| `1437 Bannock, Denver, CO 80202` | address / rooftop | 0.946667 | 1437 Bannock Street, Denver |
| `1437 Bannock St Apt 4, Denver` | address / rooftop | 1 | 1437 Bannock Street, Denver |
| `E-470` | address / street | 1 | North Valdai Street, Aurora (matched as "E-470 Frontage Road") |
| `Hwy 36` | address / street | 1 | US Route 36, Idalia (matched as "Highway 36") |
| `Coors Field` | address / street | 0.65 | Coors Street, Arvada |
| `Lafayette, CO` | place | 1 | Lafayette, Colorado |
| `Union Station, Denver` | neighborhood | 1 | Union Station, Denver |
| `80203` | postcode | 1 | Denver, Colorado 80203 |

No answer in the run had the type `poi`.

## Calls

1. **Read from the ruling: "nothing moves" is the pin, the camera and the form.** On a weak answer the window sets the notice and stops: no pin placed or moved, no fly, no road lookup, and the address text is not saved. A pin that was already there stays where it is. This holds at both geocode senders (the search form, and the open-time lookup of a saved address).
2. **R145 self-ruled: the town notice stays for a town or area.** The ruling says the new notice is "like the town one", so the town one still exists. An answer of an area type (`country`, `region`, `postcode`, `district`, `place`, `locality`, `neighborhood`) keeps "That search found a town or area. Tap the map on the road where the work starts." and the recentre (#513, #543; not reversed here). "Not a street address or intersection match" is applied to everything else that is not an address: a place of interest, an unknown or a missing type get the weak-match notice. Before, a place of interest pinned, and an unknown type was called a town. **Flagged for Ryan:** the other reading sends towns to the new notice too, with no recentre, which would take back #513.
3. **R145 self-ruled, added to the ruling's two tests: a typed number the answer doesn't hold marks it weak.** Every number in the typed text must appear in the answer's own text (`place_name`, `matching_place_name`, the street `text`, the house number `address`). `44.4` is not in "39 North Main Street, Holly, Colorado 81047"; `105` and `39.7401` are not in "W Boulevard, Walsh, Kansas 81090"; `104` is not in the Holly answer for `39 N, 104 W`. Without this the ruling's own two texts would still pin. Details, each CHOSEN (not safety):
   - A number is a run of digits, with a decimal part if it has one (`44.4` is one number; `14th` holds `14`).
   - A unit number is not checked: digits after `#`, `apt`, `apartment`, `unit`, `suite` or `ste` (`1437 Bannock St Apt 4, Denver` is a full match and pins, as before).
   - The four digits of a ZIP+4 are not checked.
   - `matching_place_name` counts, so `E-470` (answered as North Valdai Street, matched as "E-470 Frontage Road") and `Hwy 36` still pin. Round 4 of #548: "Real road names like E-470 must always search" holds.
4. **The relevance threshold: 0.9, CHOSEN (not safety).** Under 0.9 the answer is weak. From the recorded answers: right answers that pass `geocodePlain` below 1 score 0.927778 (`1 Main St, Longmont, CO 80501`, #384's probe), 0.946667 and 0.988175; wrong answers below 1 score 0.872889 and 0.862963 (#384's probe, `lib/geocode.test.ts`), 0.805556, 0.796296, 0.65, 0.459259 and lower. 0.9 lies between the two groups. `geocodePlain` (#384) already refuses an answer under 1 unless it is in a typed city and carries the typed house number, with "No match in Colorado for that address. Check the spelling."; that stands, and is why `39.7401° N` (0.99) and `E 470 N` (0.994259) get that line and no pin today. The threshold acts on what #384 lets through.
5. **R145 self-ruled: `<place>` is Mapbox's `place_name` with ", United States" dropped.** "Closest match: 39 North Main Street, Holly, Colorado 81047. Check the pin before you go on." If an answer has no `place_name`, the place is its coordinates to five places (Rule 10: the notice never names nothing).
6. **R145 self-ruled: the server decides, the window shows.** `lib/geocode.ts` has the relevance and the answer's text; `/api/geocode` adds `weak: true` and `placeName` to a weak answer only. The window does no matching of its own.
7. **Recorded: what still pins away from what was meant.** `39 N` (39 North Main Street, Holly) and `105 W` (105 West Goff Avenue, Granada) are full street-address matches that hold every typed number. They read as a house number and a street direction, and pin. The cross-street path is not touched: it accepts only an answer Mapbox flags as an intersection, or hands back the area (the town notice).

## #553, folded in

1. **CHOSEN (not safety): the parser reads at most 100 characters.** Longer text is an address. The longest form in the parser's list, with seconds to six places and brackets, is under 50 characters. This bounds the degrees-minutes pattern on a long digit run after a degree sign.
2. **R145 self-ruled: minutes and seconds need a digit after the point**, as decimal numbers do (#548 call 2). `39° 44.' N, 104° 58.' W` is an address. `.5'` is still read, as `.5` is for a decimal number.
3. The two missing parser cases are added: `N 39° 44', 104° 59' W` and `39° 44.4' N, 104° 58.9' W`.

## Churn: predicted against actual

Against the base `e3b5e69` (the code of `94a7d95`); predicted in `checkpoint.md` before the diff.

| File | Predicted | Actual |
|---|---|---|
| `conestruct/site/lib/geocode.ts` | +50 / -3 | +64 / -1 |
| `conestruct/site/lib/geocode.test.ts` | +70 / -1 | +167 / -2 |
| `conestruct/site/app/api/geocode/route.ts` | +6 / -1 | +2 / -0 |
| `conestruct/site/app/api/geocode/route.test.ts` | +12 / -0 | +22 / -0 |
| `conestruct/site/lib/geocode-precision.ts` | +8 / -0 | +7 / -0 |
| `conestruct/site/lib/geocode-precision.test.ts` | +8 / -1 | +14 / -1 |
| `conestruct/site/components/LocationPickerModal.tsx` | +22 / -4 | +16 / -2 |
| `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | +65 / -1 | +97 / -1 |
| `conestruct/site/lib/search-coords.ts` (#553) | +10 / -3 | +8 / -1 |
| `conestruct/site/lib/search-coords.test.ts` (#553) | +30 / -0 | +55 / -1 |
| this folder | new | new |

Rule 5 misses, recorded: `lib/geocode.test.ts` is 97 added lines over (eleven not-weak cases, six threshold rows and the type cases, each on a recorded shape, were not counted); the mounted tests 32 over (five tests, two of them at both texts); `lib/geocode.ts` 14 over (the comments on the three CHOSEN details); `lib/search-coords.test.ts` 25 over (six tests where two were counted). The same ten files as predicted, none added. Behaviour changes are (A), (B) and (C) in `checkpoint.md` and nothing else.

Existing tests changed, each stated:

- `lib/geocode.test.ts`: the Longmont fixture gains its recorded `place_name` (the typed ZIP `80501` is in the real answer; the bare fixture had no text to hold it). Its assertion is unchanged.
- The import lines of four test files.

## Tests

- Red proof: `red-proof.txt`. With the five source files put back to the base, 28 of the 410 tests in the five files fail (the weak-match tests, the notice helper, the route's two fields, #553's findings 1 and 2).
- After the change: the six files of the baseline, 427 passed (376 before, 51 new).
- `npx tsc --noEmit`: clean. `next lint` on the ten changed files: 0 errors, 1 warning, not from this change (`react-hooks/exhaustive-deps` on `restoreFallbackRef`, `LocationPickerModal.tsx`).
- `python scripts/cosmetic_lane_check.py`: OUT OF LANE (the API route, `lib/geocode.ts`, `lib/search-coords.ts` and their tests), so the diff-verifier runs.
- No local browser walk. The notice is the town notice's element and class (`mw-note mw-search-line`, #543) with other words; the mounted tests (Rule 11) drive the real window at both senders. The production check after the ship types both texts on the real site at three sizes.
- CI on `2929a5c`: Frontend tests passed; Python tests 1 failed, 3996 passed (`ci-failure-1.txt`). `scripts/production-env.txt` cites the line of `lib/geocode.ts` that reads `MAPBOX_TOKEN`, and this change moved it from 221 to 236. A Rule 5 miss: an eleventh file, +1 / -1, not predicted. The cite is corrected; `tests/test_vercel_env_check.py` on its own: 14 passed.
