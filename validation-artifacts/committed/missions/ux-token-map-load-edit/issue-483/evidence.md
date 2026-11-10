# #483 evidence

Branch `issue-483-map-soft-sharp`, stacked on `issue-479-needs-you-details-float` (`0c9e38d`). Rulings: `rulings.md` (ruling 1, ruling 4's first bullet and ruling 5, verbatim; R145-1 to R145-13). Plan and Rule 5 prediction: `checkpoint.md`. Canvas read with the Artifact tool (`project/LoadB1.dc.html`, `project/LoadB2.dc.html`, version 1794290881-f314).

## The change

1. **Backend, one frame for both images (Rule 3).** `question_image_url(..., soft=True)` builds the same frame's image at the same CSS size, @1x, with no overlays (R145-1); both modes return the frame. `/render/needs-you-map` takes `soft` (a strict boolean) and answers `x-map-frame: lat,lng,zoom` on both. The full image's URL is unchanged for every request without `soft` (`test_483_the_full_image_is_unchanged_by_the_soft_one`, and every #447 test unchanged).
2. **Proxy.** The route passes `soft: true` on and refuses any non-boolean `soft`; the proxy relays `x-map-frame`.
3. **The card.** `useNeedsYouMap(req, softFirst)` asks the soft image, then the full one the moment it answers, in one chain (one debounce, one Overpass read on a warm container, R145-3). The frame shows its own ground and "Loading the map of this spot", then the soft image (blur 14 px, saturate 0.7, a 0.25 scrim of the panel ground), then the full image fades in over it once decoded (200 ms; none under reduced motion). The key is hidden in its reserved space until the full image. No soft image for a zoom step, a resize after a full picture, or a picture already drawn this session. The #477 WHERE-aerial stand-in is gone from the card.
4. **The Generate wait (R145-11, recorded).** The first question's frame is not known before the scan finishes (the questions come from the scan's answer; the frame comes from the map's own subject read), so the outline keeps #477's stand-in for that moment only. `ResultsOutline` is unchanged but for its comment.
5. **The permanent check.** `scripts/verify-generate-cls.mjs` records each NEEDS YOU map frame's box at its first soft paint and its first decoded sharp paint, with both images' `data-frame`, and FAILS on any difference (0 px); a map that never showed both prints SKIPPED with the reason.

## Prediction vs actual (Rule 5)

| File | Predicted | Actual |
|---|---|---|
| `src/rendering/static_aerial.py` | +30 −5 | +28 −4 |
| `src/api/render_api.py` | +10 −3 | +11 −4 |
| `tests/test_needs_you_map.py` | +70 | +73 |
| `conestruct/site/app/api/needs-you-map/route.ts` | +6 −1 | +5 −1 |
| `conestruct/site/lib/render-proxy.ts` | +3 −2 | +3 −2 |
| `conestruct/site/lib/render-proxy.needs-you-map.test.ts` | +3 | +3 |
| `conestruct/site/lib/needs-you-map.ts` | +12 −3 | **+67 −20** (miss: the hook became one soft-then-full chain, R145-3, after the two-call build failed 9 tests) |
| `conestruct/site/components/NeedsYouMap.tsx` | +50 −20 | +75 −29 |
| `conestruct/site/components/NeedsYouMap.test.tsx` | +80 −25 | +128 −36 |
| `conestruct/site/app/globals.css` | +45 −6 | +54 −7 |
| `conestruct/site/components/ResultsOutline.tsx` | +3 −3 (comment) | +4 −3 (comment) |
| `scripts/verify-generate-cls.mjs` | +45 | +57 −1 |
| `conestruct/site/lib/design/motion.test.ts` | **not predicted** | +6 (miss: the motion allow-list names every keyframe; the new fade had to join it) |
| `conestruct/site/app/api/needs-you-map/route.test.ts` | **not in the table** (the proof bullet named the test, the table didn't name the file) | new, 63 lines |

Byte-identical as stated: the full image's URL and query, `x-map-subject`, `x-map-point`, the scan, the audit, the PDF and XLSX, the band aerial, `/render/corridor-map`, every device count, the Generate outline. No new font size (the label is `.tr-note`, Inter 12.5) and no new hex.

## Tests

- Red proofs (`red-proof.txt`): pytest 4 failed / 26 passed on the base code; vitest 12 failed / 22 passed.
- The first full vitest run after the change failed 9 tests in 3 files, all real (`full-run-failures.txt`): the card's second request waited for a React render and leaked past the tests' 400 ms settle. Fixed by the one-chain hook; each file then passed alone.
- Baseline on `0c9e38d`: pytest `3908 passed, 3 skipped`; vitest `3001 passed | 1 skipped`.
- Final: pytest `3913 passed, 3 skipped` (+5: the new soft tests, one parametrized twice); vitest `3008 passed | 1 skipped (3009)` (the diff-verifier's full run); tsc clean; mypy `Success: no issues found in 49 source files`; ruff check and format clean.

## The local walk (Overpass stubbed; `next dev` on :3483 against `verify-generate-cls-stub.py` on :8483; real Mapbox images from the local token)

| Run | 1440x900 | 1198x930 | 390x844 | File |
|---|---|---|---|---|
| The permanent check, recorded fixture (3 questions) | CLS 0, outline PASS, soft→sharp PASS 846x423 | CLS 0, PASS, PASS 846x423 | CLS 0, PASS, PASS 360x270 | `walk/verify-generate-cls-recorded.txt` |
| The same, `REDUCED=1` | CLS 0, soft→sharp PASS, no animation | same | same | `walk/verify-generate-cls-reduced.txt` |
| Each question soft then sharp (`script/walk.mjs`, the full image held 2.5 s) | 3 questions: box and figure SAME, frame SAME, axe 0/0, under 44 px 0/0 | same | same | `walk/walk.txt`, `crops/walk.json` |

The walk is the permanent check's setup and Generate, then per question: the frame's phase, box, figure box, label text and size (12.5px), the soft image's computed filter (`blur(14px) saturate(0.7)`), the key's hidden state, both `data-frame`s, axe on the results and the 44 px measure on NEEDS YOU, at soft and at sharp. Frames: sidewalks `39.739914,-104.968447,18.00`, bike lane `39.739842,-104.968454,18.00`, intersection `39.739969,-104.968354,18.00`, each identical soft and sharp.

Not walked: a failed soft image on the live site (vitest covers it: the full one is still asked for), and the cross-street line (#484).

## Crops for Ryan's hand check (`crops/`)

`<size>-q<n>-soft.png` and `<size>-q<n>-sharp.png` for q1 sidewalks, q2 bike lane, q3 intersection at 1440x900, 1198x930 and 390x844 (18 crops): the card with the soft image and the label, then the same card sharp with the key. At 390 the label sits in the held slot under the map (R145-7). The phone crops are element screenshots, so the sticky site header covers the card's top line; the map and the label are clear of it.

## The Mapbox cost record

`checkpoint.md` § 3: one more Static Images request per question the first time its map shows. Typical plan 8 → 10 images (the free 50,000 covers about 5,000 plans a month, was about 6,000); worst case 56 → 66 (about 750, was about 900). Past the free tier it adds 0.2 cents per typical plan. No account setting, rate limit or price changed.

The rate limit: the soft images also count against the unchanged 30 requests a minute per IP. Typical plan 2 → 4 map requests. Worst case for one pass (5 questions, 5 zoom steps each) 25 → 30, exactly the limit, so one more request inside that minute now gets a 429 where before there was room for 5. Re-viewing every question after Apply in the same minute (50) was already over it before. A 429 on a soft image skips to the full one; on a full image it shows the failure line (`checkpoint.md` § 3).

## Repair cycle 1

The sharp image gained `onError`: an image that arrives but won't decode takes the failed-fetch path (the ruled line, no soft image, the key hidden, no zoom or link). A mounted test, red on the code before it (`red-proof.txt`). The churn amendment was written into `checkpoint.md` before the diff. Actual against it: `NeedsYouMap.tsx` +5 −1 (predicted +6 −1), `NeedsYouMap.test.tsx` +14 (predicted +15), `lib/needs-you-map.ts` −1 (predicted −1). The table above shows the final counts, repair included.

## New user-facing strings

| String | Where | Source |
|---|---|---|
| "Loading the map of this spot" | `NeedsYouMap.tsx` `MAP_LOADING` | ruling 1, verbatim |

No string changed. The soft image's `alt` is empty (decorative; the frame is `aria-busy` and the label says it is loading).
