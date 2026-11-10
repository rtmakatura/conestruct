# #487 evidence

Branch `issue-487-cross-street-edges`, stacked on `issue-491-failure-copy` (`cf5ddffd`). Rulings: `rulings.md` (R145-1 to R145-8; R145-7 is the orchestrator's round-3 call accepting a known limit, filed as #502; R145-8 is the `TAG_CHAR_PX` comment, measured in `tag-widths.txt` (Inter 600 at 12.5 px, `@fontsource/inter@5.0.16`), with checking the measured width filed as #503). Plan and Rule 5 prediction, written before the diff: `checkpoint.md`.

## The change

1. **The tag walks only the drawn lines (R145-1).** `static_aerial.question_image_url` returns the lines it drew whole (a line is listed only when it put a dash in the URL) in place of `bool(dashes)`. `render_api.render_needs_you_map` hands that list to `cross_tag_box` in place of `cross.lines`.
2. **The worked road under any abbreviation (R145-2/3).** `site_detection._street_key` (lower-case, punctuation out, the `_STREET_WORDS` directional and street-type words spelled out; CHOSEN). `cross_street_from_elements` drops a way whose key equals the plan's road name's key, and groups the cross street's parts by key. The repo had no street-name normaliser to reuse (search in `rulings.md`). OSM way id matching was not used: the route has no way id for the worked road, and OSM splits ways at the crossing.

## Repair cycle 1

The reviewer found that the first key dropped every non-ASCII letter, so Cyrillic names collided on `""` and accented names collided too. The key now keeps Unicode letters, and an empty key never matches. New cases: "Улица Ленина"/"Проспект Мира" and "Calle José"/"Calle Josè" differ; three blank-road-name cases (`""`, `"   "`, `None`) group one Cyrillic part, not two. The first cut's regex collides on both pairs (`probe.txt`). E Colfax digest re-checked: `ab130c5a7e825e32`, unchanged.

## Repair cycle 2

The reviewer found that decomposed accents were stripped as punctuation. `_street_key` now applies NFKC before `casefold` (R145-5). New cases: decomposed José vs decomposed Josè differ; decomposed José equals precomposed José; full-width "１st Ave" equals "1st Ave". `probe.txt` records each pair under the first cut, the cycle-1 key and the current key. The picker's raw-name drop is filed as #501 (R145-6). E Colfax digest re-checked: `ab130c5a7e825e32`, unchanged.

## Red proof

`red-proof.txt` (refreshed in cycle 2): every #487 case on base `cf5ddffd` (`git archive cf5ddffd src tests`, the branch's test file copied in): 17 failed. The budget test fails because the tag sits beside a part the URL left out. The curve test fails with `x-map-cross-street: South%20Broadway`. The 15 key and blank-name cases fail because `_street_key` didn't exist on base. On the fix: 17 passed.

## #484's E Colfax output (R145-4)

`cross_street_from_elements` on #484's fixture (`ux-token-map-load-edit/issue-484/overpass-fixture/365beea785c9dba7.json`), at each of its 3 crossings of East Colfax Avenue, with the road name "East Colfax Avenue" and with none: the same digest on base and fix (`ab130c5a7e825e32`; picks Franklin Street, Park Avenue, Franklin Street). The URL loop is unchanged, so the URL bytes are too. Script kept outside the repo (session scratchpad, `colfax_identity.py`).

## Prediction vs actual (Rule 5)

| File | Predicted | Actual |
|---|---|---|
| `src/rendering/static_aerial.py` | `question_image_url` only | `question_image_url` only (annotation, docstring, `kept` list, `[]` in place of `False` in the pin and soft returns) |
| `src/api/render_api.py` | one line | one argument and one comment |
| `src/rules/site_detection.py` | `_STREET_WORDS`, `_street_key`, the two name comparisons | the same, plus `import re` and (cycle 2, as amended) `import unicodedata` |
| `tests/test_needs_you_map.py` | new tests only | new tests, `_tag_beside` helper and `import math`; no existing test changed |
| Frontend | none | none |

Callers checked: `question_image_url` is called by `render_api.py:2102` and `tests/test_needs_you_map.py` (2 calls that unpack `_drawn` and don't use it). `cross_street_from_elements` is called only by `cross_street_geometry`. `_street_key` is read only by `cross_street_from_elements` and the new tests.
