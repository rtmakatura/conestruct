# Rule 5 prediction: `issue-285-cross-street` (#285)

Committed before any change to `src/` or `conestruct/site`. Stacked on `issue-295-stale-ink` (`4d5d61d`).

## Rulings

Ryan, 2026-10-14:

> #285: do it before #284. Measure 400, 800 and 1700 m first and pick the smallest radius that finds the
> cross street in your test set (R145 self-rule with the numbers). The reversal of #290's "only from a
> bucket" wording is approved.

## The radius (R145 self-ruled): 1700 m

`probe285.py`, `run1/`: 17 test pins, each asked twice at each radius through the backend's own Overpass
helper.

| pin | 400 m | 800 m | 1700 m |
|---|---|---|---|
| N Broadway SB, Denver | E/W 11th Ave, 20 m | same | same |
| Lafayette St, Denver | E 17th Ave, 47 m | same | same |
| E Bayaud Ave, Denver | S Colorado Blvd / S Leetsdale Dr, 6 m | same | same |
| E Colfax Ave, Denver | N York St, 19 m | same | same |
| Federal Blvd, Denver | W 9th Ave, 91 m | same | same |
| S Wadsworth Blvd at W Alameda, Lakewood | W Alameda Ave, 24 m | same | same |
| S Wadsworth Blvd, Lakewood | W Vassar Ave, 12 m | same | same |
| Lookout Mountain Rd (fixture anchor) | **none** | Bonvue Dr, 594 m | same |
| US 40 near Cheyenne Wells | County Road 44.5, 381 m | same | same |
| CO 71 / County Road C, Ordway | CO 71, 0 m | same | same |
| US 40 west of Craig | County Road 15, 693 m | same | same |
| CO 119 Boulder Canyon | none | none | none |
| US 285 south of Fairplay | Black Bucktail St, 1017 m | same | same |
| US 24 near Hartsel | CO 9, 81 m | same | same |
| US 287 north of Lamar | **none** | **none** | County Road 7, 925 m |
| CO 9 north of Breckenridge | Tiger Rd, 391 m | same | same |

(US 40 / CR 53 west of Craig was a stray snap in the first pass and isn't in the set.)

- **Why 1700 m:** it's the smallest radius that names the cross street on every pin where any radius does.
  US 287 north of Lamar needs it.
- **Cost:** none measurable. Answers ran 0.5 to 2.3 s at every radius, and the largest payload was 35 KB
  (E Colfax at 1700 m).
- **Boulder Canyon** has no cross street at any radius, so it keeps the road-name fallback (Rule 10).

## What gets built (R145 self-ruled inside the issue's scope)

### Backend: `src/rules/nearest_intersection.py` + `POST /render/nearest-intersection`

The endpoint is a read: no lock, no write, no memo, no scan (suggest-never-set).

1. **The query.** One Overpass call through `_overpass_request_with_fallback`. It looks for the confirmed
   road's ways within `FETCH_RADIUS_M = 1700` (CHOSEN, Rule 12, cites this table) that carry its `name`, or
   its `ref` when it has no name. It returns the nodes those ways share with any other vehicular way that
   has a name or ref.
   - The vehicular class list is CHOSEN: the classes the picker offers.
   - The budget is 12 s (CHOSEN); the measured worst case was 2.3 s.
2. **The pick.**
   - Candidates must lie on the relayed centerline: projection within `LATERAL_TOLERANCE_M = 30` (CHOSEN).
   - The nearest wins, by distance along the centerline from the pin (`WorkCorridor`'s own projection).
   - A node's name skips any way that carries the road's own key value. A concurrency like "US 24;CO 9"
     counts as the road itself, so it isn't named as the cross street.
   - Of the remaining names, the highest class wins, then the alphabetically first.
3. **The words** come from the backend (Rule 3): `"{ft:,} ft {dir} of {name}"`.
   - `dir` is the 8-point compass bearing from the intersection to the pin.
   - `ft` is the along-road offset, rounded to 10 ft.
   - Under `AT_THRESHOLD_FT = 50` (CHOSEN) the text reads `"at {name}"`.
4. **#234 agreement.** On a near_intersection plan with a marked cross pin (`meta.intersection`), the answer
   is that cross pin, named by its own `name`, with no Overpass call. The tag and the marker can't disagree.
5. **The response:** `status` is one of:
   - `found` (`text`, `cross_street`, `offset_ft`, `direction`, `source`, `provenance_text`);
   - `none` (asked, nothing within reach);
   - `unavailable` (Overpass refused);
   - `not_applicable` (no road name/ref, no centerline, or not a work-start pin).

   Only `found` carries words.
6. **Wire-only `meta.roadName` / `meta.roadRef`** are added to `ScenarioMeta` (max 200).

### Frontend

1. **The relay.** `withRelayedCenterline` relays `roadName` / `roadRef` from `confirmedRoad.candidate`
   under the same staleness rule as `centerline`.
2. **The route.** `app/api/render/nearest-intersection/route.ts` is modelled on the corridor-geometry route.
3. **The hook.** `lib/cross-street-tag.ts`: `crossStreetRequestFor(scenario)` (located, work-start, road
   confirmed at this pin, not stale) and `useCrossStreetTag()`, keyed only on the fields the answer
   depends on. It's asked once in `GeneratorSidebar` and handed through `BandStack` (R131's one-answer
   pattern).
4. **"Work starts" row** (`move-ledger.ts`): prints the backend's `text` when found, else the ruled interim
   (road name).
5. **WHERE fact line** (`whereValue`): the clause after the road is the backend's `text`. Otherwise it's the
   existing near_intersection "at {cross}", else nothing.
6. **WHERE provenance:** adds the backend's `provenance_text` when found.
7. **#290's acceptance line** (`rulings.md:47`) gets a dated reversal note, as Ryan approved.

## Predicted

- **Python tests** (`tests/test_nearest_intersection.py`, replaying `tests/fixtures/nearest_intersection/`):
  - Broadway names East or West 11th Avenue at about 70 ft.
  - US 287 names County Road 7.
  - US 24 names CO 9, never "US 24;CO 9".
  - Boulder Canyon returns `none`.
  - A refused Overpass returns `unavailable` with no text.
  - A missing centerline returns `not_applicable`.
  - A marked cross pin answers without Overpass.
  - The text uses "at" under 50 ft.
- **Endpoint test:** the route answers each status. The query string carries `around:1700`.
- **Frontend tests:**
  - the relay carries `roadName` / `roadRef` only while fresh;
  - the start row and the fact line print the tag when found and the interim otherwise;
  - the hook's key ignores fields the answer doesn't depend on.
- **Suites:** pytest and vitest green. No PDF / XLSX / audit snapshot moves, because no deliverable reads
  the new fields.
- **Prod check after ship:** the WHERE band on N Broadway SB (39.73370, -104.98753) shows "… ft … of East
  11th Avenue" (or West) in the "Work starts" row and the fact line.
