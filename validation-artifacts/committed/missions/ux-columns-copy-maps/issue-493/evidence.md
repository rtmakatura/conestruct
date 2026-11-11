# #493 evidence: the intersection map reuses the WHERE tap's cross street

Branch `issue-493-cross-street-reuse` on `origin/mission-494-prod-check` (`f9126089`; first built on `issue-491-failure-copy` `cf5ddffd`, an ancestor, and rebased in mission retap-and-cap). Rulings: `rulings.md`. Plan and prediction: `checkpoint.md` (written before the diff; amended before the repair-1 diff).

## What changed

1. **The tap keeps the line it already fetched (R145-1).** `deriveCrossStreet` copies the `/api/road-bearing` candidate's `geometry` onto the cross-street candidate. `intersectionRecord` writes it as `meta.intersection.geometry` when it has 2 to `GEOMETRY_MAX_NODES` (300) points. With no line, a one-point line, or a longer own-way line (the stitch didn't trim it), the record is byte-identical to before (same keys, same order). The picker's Save and the band's tap share `intersectionRecord`.
2. **Wire (three hops).** `IntersectionRecord.geometry` (`lib/scenarios/types.ts`) → the proxy sends the scenario whole (`fetchNeedsYouMap`, pinned by a test) → `IntersectionPin.geometry` (`src/api/schemas.py`).
3. **Never a refusal (R145-4, repair 1).** The field rides `meta` into every route, so the backend never refuses a plan for it: a before-validator drops (None, log line `[schemas] meta.intersection.geometry dropped (...)`) a line that isn't 2 to 300 finite, in-range `[lat, lng]` pairs. Tested: 301 points, an out-of-range point, a triple, a string and a coordinate past float range (`10**400`, repair 2) each give a 200 on `/render/needs-you-map` via the lookup (`x-map-cross-source: lookup`), and `/render/audit`, `/render/markdown` and `/render/xlsx` answer 200 with the audit equal to the same plan with no line.
4. **The backend draws from it (Rule 3, R145-2).** `site_detection.tapped_cross_street`: pure, no read. The record stands at the question's crossing when the tapped point and the line both lie within `CROSS_STREET_RADIUS_M` (30 m, #484's) of the crossing node, the line isn't parallel to the road (#484's 25°), and its name isn't the road's. Then the route draws it; otherwise #484's `cross_street_geometry` lookup runs, unchanged. At an offset crossing (two cross streets within 30 m) the tapped one is drawn (test).
5. **Which path ran is said (Rule 10, R145-3).** `x-map-cross-source: tap | lookup` on every intersection full image that sought a cross street, plus a log line. None on the soft image or the other questions. The proxy relays it beside `x-map-frame`; the card reads nothing new.
6. **Build inputs.** The new frontend test reads `tests/fixtures/needs-you/`, so it joins `SITE_INPUTS` in `conestruct/site/vercel-ignore.sh` (`full-run-failures.txt`).

## Time saved

The saving is **one Overpass read per crossing's first intersection full image** (then memoized 600 s per container), whenever a tap record stands at the crossing. It is bounded by that read's 8 s budget (`SUBJECT_BUDGET_S`).

- **Stubbed call count** (payload-level tests, same pin, 800x400, 846x423 and 390x292): `around:` reads 1 on the lookup path, 0 on the tap path.
- **Live, one sample:** one read of #484's committed query (`issue-484/overpass-fixture/365beea785c9dba7.query.txt`; the code builds the identical query, checked) through the route's own `_overpass_request_with_fallback`: **2,649 ms**, 2026-11-10T14:08:10, 11 elements, pick Franklin Street (3 ways). Output: `live-timing.txt`; script: `script/live_time.py`. One read at one time of day from this machine, not from Modal; Overpass varies.
- **Prod context, not re-measured:** the #486 prod check timed the whole first intersection image (subject read, this cross-street read, overlays and Mapbox): **1061 / 1468 / 504 ms** at 1440 / 1198 / 390 (`ux-token-map-load-edit/prod-check/outcome.md:70-72`, § 4 table, the rerun). The first run read 3865 ms at 1198 and 1470 at 390 (`outcome.md:15`); that first run collided with the permanent check and hit the site's 30-a-minute limit (429s), and was rerun one at a time (`outcome.md:97-98`, § 6). The cross-street read alone was not timed on prod, and the 2,649 ms sample is larger than every rerun whole-image time there, so it can't be read as what prod saves per image; a prod walk after the ship would show it.

## The picture on E Colfax: tap vs #484's lookup (same pin, stubbed)

Pin on East Colfax Avenue about 60 m west of Franklin Street, crossing node 7402343541; lookup answered by #484's committed fixture, tap by the record the real producer writes (`tests/fixtures/needs-you/colfax-franklin-tap.json`: Franklin Street, 20 points, from `/api/road-bearing` → `deriveCrossStreet` → `intersectionRecord` on the recorded ux-group3-where ways). Every row is held by `test_493_the_tap_picture_matches_484s_lookup_on_e_colfax`, parametrized over the three sizes.

| Size | Lookup tag | Tap tag | Frame, point, name |
|---|---|---|---|
| 800x400 | 375,344 | 375,344 | same |
| 846x423 | 397,360 | 397,368 | same |
| 390x292 | 170,182 | 170,182 | same |

- The lookup's 846x423 tag (397,360) is #484's local walk's own place at 1440 ("It sits at 397,360 at 1440 and 1198", #484 evidence.md), so the test scenario reproduces #484's picture.
- At each size every dash #484's lookup draws lies on the tap's line (< 0.5 m), and the tap draws at least as many dashes: the same street stitched past the three ways #484 read. At 846x423 that longer line moves the tag 8 px lower (placed farthest from the work). Predicted in checkpoint.md (Rule 5).

## Wire size

The vitest size check (`cross-street-tap-record.test.ts`) measures the needs-you body as it goes upstream (proxy -> Modal) for the **default** near-intersection scenario with a 300-point confirmed road, the 300-point `centerline` the wire derives from it, and a 300-point cross-street line, at OSM's 7 decimals: 24,312 bytes. That is not the worst case; it is held exactly by the test (`size-measurement.txt`) so a change to it is seen. The worst cases are round 2's table below: **21,370 bytes** for the largest capped browser body (bundle / quote-breakdown) and **29,221 bytes** for the largest upstream row, both under 32,768. The frontend never writes more than 300 points, so repairs 1 and 2 leave every figure unchanged.

Round 2, every capped body (the cap is checked on the browser -> Next route body, `MAX_BODY_BYTES` in `app/api/render/*/route.ts`): a near-intersection scenario with a 300-point confirmed road, a 300-point cross-street line, long project/address/location text, all seven site flags, the backend's maximum 5 site overrides each with a 200-character note, and the quote settings at their bounds (`script/measure-bodies.ts`, output `size-measurement-bodies.txt`):

| Body | 5 acknowledged | 50 acknowledged (backend max) |
|---|---|---|
| bundle | 19,165 | 21,370 |
| quote-breakdown | 19,165 | 21,370 |
| audit | 18,957 | 21,162 |
| needs-you map | 19,026 | 21,231 |
| proxy -> Modal bundle part, with the derived 300-point centerline (no cap on that hop) | 27,016 | 29,221 |

Every body is under 32,768 bytes; the closest is the browser bundle body at 21,370 (11,398 left). No code change.

## Tests

- pytest, new in `tests/test_needs_you_map.py`: 17 cases in 7 test functions (1 + 3 + 1 + 4 + 1 + 5 + 2): zero `around:` reads with a tap record; the E Colfax match at three sizes; the offset crossing; the lookup runs and says so with no record, no line, a record at another crossing, a record whose line is the road; an unusable line (5 kinds, a coordinate past float range included, repair 2) is dropped and the lookup runs; a 301-point line or one past float range never refuses the audit or the plan; no source header on the soft image or other questions.
- vitest, new: `lib/road-detection/cross-street-tap-record.test.ts` (the real producer writes the committed backend fixture; no line, one point, or over 300 points keeps the old keys; the worst-case size); `lib/render-proxy.needs-you-map.test.ts` (the scenario's `meta.intersection.geometry` goes out as written; `x-map-cross-source` relayed).
- Red proofs: `red-proof-backend.txt` (cycle 0: 7 of 8 new tests failed on the base backend; the first on its zero-read assertion), `red-proof-frontend.txt`. The repair-1 never-refuse behaviour replaces cycle 0's own test that asserted a 422 at 301 points, which is its red state.
- Re-tap guard (R145-9): `lib/scenarios/cross-street-apply.test.ts` 6 -> 9 cases: the same street re-tapped with a different line, or with none, keeps the edited approaches, the overrides and the hold off, and the guard's memory carries no line; a different street with the same line still replaces. Red proof: `red-proof-retap.txt`. Run 2026-11-10 on base f912608: vitest `cross-street-apply`, `cross-street-mark.answer`, `cross-street-tap-record` 16 passed; `render-proxy.needs-you-map`, `cross-street-lookup`, `cross-street` 23 passed; pytest `tests/test_needs_you_map.py` 77 passed; ruff and mypy clean on the three changed Python files.
- Tap path names (R145-10, gate round 1): `tests/test_needs_you_map.py::test_493_a_tapped_line_at_a_bend_named_as_the_road_is_not_the_cross_street`, 3 cases: a tapped line 40° off the road named "E Colfax Ave" or "E. Colfax Ave." on "East Colfax Avenue" is not drawn (the lookup runs); "North Franklin Street" at the same bend is. Red proof: `red-proof-tap-street-key.txt` (2 of 3 failed on the plain `.lower()` check). Re-run: pytest `tests/test_needs_you_map.py` 80 passed; ruff, ruff format and mypy clean on the changed Python files.
- #487's edge cases are in the base (`7db92510`); this branch's tap path now uses #487's `_street_key`.
