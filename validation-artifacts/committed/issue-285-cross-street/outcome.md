# Rule 5 outcome: `issue-285-cross-street` (#285)

Prediction: `prediction.md` (committed `4e002ee`, before any change). Stacked on `issue-295-stale-ink`.

## Built as predicted

### Backend

- **`src/rules/nearest_intersection.py`:**
  - CHOSEN constants (Rule 12): `FETCH_RADIUS_M = 1700`, `QUERY_BUDGET_S = 12.0`, `LATERAL_TOLERANCE_M = 30.0`
    and `AT_THRESHOLD_FT = 50`. The vehicular class list is CHOSEN too, ranked to break a two-name tie.
  - `build_query` is the shared-node query. `from_overpass` is the pick, a pure function that the tests
    replay.
  - `from_marked_cross_pin` handles #234. `nearest_intersection` is the read itself.
- **`POST /render/nearest-intersection`** (`src/api/render_api.py`): a read with no lock, no memo and no scan.
  It answers `not_applicable` off a work-start pin.
- **`ScenarioMeta.roadName` / `roadRef`**: wire-only, max 200.

### Frontend

- **`withRelayedCenterline`** relays `roadName` / `roadRef` behind the pin key.
- **`fetchNearestIntersection`** (render-proxy) and **`app/api/render/nearest-intersection/route.ts`**. The
  route has a row in the middleware's route table, gated like every `/api` route.
- **`lib/cross-street-tag.ts`:** `crossStreetRequestFor`, `crossStreetKey` (pin, road and marked cross pin
  only), `crossStreetTag` (only `found` carries words) and `useCrossStreetTag`.
- **Wiring:** asked once in `GeneratorSidebar` and handed through `BandStack` to `deriveBands` (the fact
  line) and `WhereBand`, which feeds the "Work starts" row and the provenance.
- **`validation-artifacts/committed/issue-290-pin-work/rulings.md`:** a dated reversal note under the
  acceptance block. Ryan's quoted text is unchanged.

## Deviations from the prediction

1. **The direction is read along the road.** The first replay read Broadway as "SW of", because the pin sits
   11 m off the road. The compass now takes the bearing between the two points' feet on the centerline, so
   it reads "S of". The prediction said "the bearing from the intersection to the pin".
2. **Broadway's offset is 50 ft.** The prediction said "about 70 ft"; 70 ft is the straight-line distance
   (20 m). The tag measures along the road, from the pin's foot to the node's: 50 ft after rounding. That's
   the threshold value, so it still reads "50 ft S of", not "at".
3. **Lookout Mountain Road** (not predicted). Bonvue Drive, which the radius table counts as found at 800 m,
   meets the road 592 m off the stretch the picker relays (`tests/fixtures/centerline/lookout_mountain_road.json`).
   - On the product's centerline the answer is `none`, and the tag keeps the road name. That's correct:
     there is no along-road offset on the relayed stretch.
   - My longer recorded stitch reaches the junction 3.3 km along the switchbacks and reads
     "10,900 ft W of Bonvue Drive".
   - The test pins the product behaviour (`test_a_cross_street_off_the_relayed_centerline_is_not_named`).
   - So the radius finds a cross street the centerline's ±1 mi can't place. The 1700 m radius still decides
     reach; the relayed centerline decides placement.

## Corrections to the committed prediction (diff-verifier, cycle 1)

- **Pin count.** `prediction.md:15` and the prediction commit `4e002ee` say 17 test pins. The set is
  **16**: `run1/log.txt` has 16 pin lines and `rows.json` 96 rows (16 x 3 radii x 2 reps). The code
  comment now says 16.
- **Timings.** `prediction.md:41` and `:56` give the worst answer as 2.3 s. `run1/rows.json` gives
  **2.06 s** (min 0.51 s). The code comments now say 0.5 to 2.1 s and 2.06 s. The 35 KB payload stands.
- **What is traced and what is judgment.**
  - Traced:
    - `FETCH_RADIUS_M = 1700` traces to the radius table.
    - `LATERAL_TOLERANCE_M = 30` now traces to `lateral285.py` / `lateral285.txt`. Shared nodes on the
      road sit 0 m from its centerline, or 12-19 m on a divided road's far carriageway (US 287, and one
      Broadway node on the picker's own geometry). The nearest node not on the road is a US 287 node,
      59 m from the recorded stitch. (The code comment calls it "off the relayed stretch", which is
      looser than this.)
  - Untested judgment calls, labelled CHOSEN in the code:
    - `QUERY_BUDGET_S = 12`;
    - `AT_THRESHOLD_FT = 50`;
    - the vehicular class list and its rank;
    - the 10 ft rounding (`_round10`);
    - the alphabetical tie-break between two names at one node.

## Measured

**Python:**

- `tests/test_nearest_intersection.py`: 16 tests.
  - Broadway "50 ft S of East 11th Avenue" (node 3397108608).
  - US 24 "270 ft E of CO 9", never "US 24;CO 9".
  - US 287 "3,030 ft E of County Road 7".
  - Boulder Canyon `none`.
  - Lookout on the picker's centerline `none`.
  - The query asks `around:1700` by name, or by ref when the road has no name.
  - `not_applicable` without a centerline or a road key.
  - `unavailable` on a refusal.
  - The marked cross pin answers with no query, and reads "at" under 50 ft.
  - The endpoint answers each status.
- Full suite: 2813 passed, 2 skipped.

**Frontend:**

- `lib/cross-street-tag.test.ts`: 14 tests.
  - The relay is fresh-only.
  - The request is work-start and confirmed only.
  - A new speed or length doesn't change the key; a new pin or road does.
  - Only `found` carries words.
  - The row, the fact line (in place of the near_intersection "at" clause, never beside it) and the
    provenance print it.
- Full suite: 212 files, 2194 tests passed. `tsc` clean, `next build` clean.

**Browser** (`tag285.cjs`, `tag-local/`): a `next start` of the branch, proxying to this branch's backend
on localhost and real Overpass, at 1440 and 380.

| pin | backend answer | "Work starts" row | fact line | provenance |
|---|---|---|---|---|
| N Broadway SB | found, "50 ft S of East 11th Avenue" | same text | "North Broadway Southbound · 50 ft S of East 11th Avenue · 1,000 ft · shoulder work" | "… · cross street from OSM node 3397108608 · searched 1,700 m" |
| Lafayette St | found, "140 ft N of East 17th Avenue" | same text | "Lafayette Street Northbound · 140 ft N of East 17th Avenue · 1,000 ft · shoulder work" | "… · cross street from OSM node 176080675 · searched 1,700 m" |

All 12 checks passed. At 380 the row wraps beside MOVE (`tag-local/broadway-380-open.png`).

**Snapshots:** none moved. No deliverable reads `roadName` / `roadRef`.

The prod run after ship is the gate (`tag-prod-<sha>/`).
