# #483 checkpoint (no stop: nothing here is on the park list)

Branch `issue-483-map-soft-sharp`, worktree `.claude/worktrees/issue-483`, base `issue-479-needs-you-details-float` `0c9e38d` (mission ux-token-map-load-edit, tracking #486).

## 1. The plan (5 bullets)

1. **Problem.** `conestruct/site/components/NeedsYouMap.tsx:91-100` shows `OutlineAerial(shownAerialFor(lat, lng))`, the WHERE aerial at the band's frame, until the question's own map lands; the question's frame is a different one (`src/rendering/static_aerial.py:382` `question_image_url`, framed on the subject), so the picture jumps when the map arrives (P1). The key (`NeedsYouMap.tsx:165-181`) shows "The work" before any line is drawn.
2. **Rulings.** Ruling 1, ruling 4's first bullet and ruling 5 of `docs/prompts/cc-prompt-ux-map-load-crossing-edit.md`, verbatim in `rulings.md`; R145-1 to R145-13 there.
3. **Change.** Backend: `question_image_url(..., soft=True)` builds the same frame's @1x image with no overlays and both modes return the frame; `/render/needs-you-map` takes `soft` and answers `x-map-frame`. Proxy: the route accepts `soft: true`, the proxy relays `x-map-frame`. Card: ask soft first, then full with no debounce; the frame shows its ground and the label, then the soft image (blurred, desaturated, scrim), then the full one fades in over it (200 ms, none under reduced motion); the key stays hidden in its reserved space until the full image; the #477 stand-in leaves the card (the Generate outline keeps it, R145-11). The permanent check gains the soft→sharp box and frame check.
4. **Rule 5 churn prediction** (§ 2).
5. **Proof.** pytest (new: the soft image's URL is the full one's frame with no overlays and no @2x; `x-map-frame` equal soft and full, on the subject frame and the pin picture; the full URL byte-identical to before); vitest (new: label then soft then sharp, key hidden until sharp, the full asked only after the soft answered, a failed soft still gets the full, no stand-in, no soft on a zoom step; the proxy relays `x-map-frame`; the route refuses a non-boolean `soft`); red proofs for the new tests in `red-proof.txt`; tsc, mypy, ruff; the local walk with Overpass stubbed at 1440, 1198x930, 390 (each question soft then sharp, frame and box unchanged, axe 0, no target under 44 px), crops in `crops/`, summary in `evidence.md`.

## 2. Rule 5 churn prediction

**Changes (stated):**

| File | Change | Lines (about) |
|---|---|---|
| `src/rendering/static_aerial.py` | `question_image_url` takes `soft`, returns the frame too (5-tuple) | +30 −5 |
| `src/api/render_api.py` | `NeedsYouMapRequest.soft`, `x-map-frame` header, the unpack | +10 −3 |
| `tests/test_needs_you_map.py` | soft tests (frame equal, no overlays, no @2x, pin picture, full URL unchanged) | +70 |
| `conestruct/site/app/api/needs-you-map/route.ts` | `soft` accepted only as `true`, passed on | +6 −1 |
| `conestruct/site/lib/render-proxy.ts` | `soft?` in the options type; `x-map-frame` relayed | +3 −2 |
| `conestruct/site/lib/render-proxy.needs-you-map.test.ts` | `x-map-frame` relayed | +3 |
| `conestruct/site/lib/needs-you-map.ts` | `soft?` in the request, `frame` in the answer, the delay argument | +12 −3 |
| `conestruct/site/components/NeedsYouMap.tsx` | soft then sharp, the label, the key hidden until sharp, the stand-in gone | +50 −20 |
| `conestruct/site/components/NeedsYouMap.test.tsx` | the stand-in tests become soft/sharp tests | +80 −25 |
| `conestruct/site/app/globals.css` | soft image, scrim, label, fade (+ reduced motion), phone label slot; `.nyq-map-standin` removed | +45 −6 |
| `conestruct/site/components/ResultsOutline.tsx` | the comment on #477 answer 4 (the card no longer shows the stand-in) | +3 −3 |
| `scripts/verify-generate-cls.mjs` | the soft→sharp box and frame check | +45 |
| evidence (`issue-483/`) | rulings, checkpoint, red proof, walk script, crops, evidence.md | new |

**Amendment, repair cycle 1 (before its diff):**

| File | Change | Lines (about) |
|---|---|---|
| `conestruct/site/components/NeedsYouMap.tsx` | the sharp image's `onError` takes the failed-fetch path (Rule 10) | +6 −1 |
| `conestruct/site/components/NeedsYouMap.test.tsx` | a mounted test: a sharp image that fails to decode shows the ruled line, no soft image, the key hidden | +15 |
| `conestruct/site/lib/needs-you-map.ts` | one stray blank line removed | −1 |
| `validation-artifacts/.../issue-483/` (rulings R145-6, checkpoint § 3, evidence, red-proof) | the token wording, the rate-limit record, the repair's red proof | text only |

Stated behaviour change (f): a full image that arrives but fails to decode reads as a failed map ("The map didn't load…"), not an invisible image under a visible key and controls.

Stated behaviour changes: (a) a NEEDS YOU map now asks two images the first time it shows (one more Mapbox request per question); (b) the sharp image lands later by the soft image's Mapbox time; (c) while loading, the card shows the frame's ground, then the blurred same-frame image, with "Loading the map of this spot", instead of the dimmed WHERE aerial; (d) the key is hidden (space held) until the full image; (e) the API answers a new header `x-map-frame`.

**Byte-identical (stated):** the full image's Mapbox URL and query for every request without `soft` (existing tests unchanged); `x-map-subject`, `x-map-point`; the scan, the audit, the PDF, the XLSX, the band aerial, `/render/corridor-map`; every device count; the Generate outline (`ResultsOutline`'s `.ro-map` and `OutlineAerial`, R145-11); the zoom steps; the failed-map line; NeedsYouQuestion's explanation states. No new font size, no new hex (type census and ink-literal tests stay green).

## 3. Mapbox Static Images per plan (the record, R145-12)

Price as read by #447's checkpoint (`validation-artifacts/committed/ux-site-map/checkpoint.md` § 3, mapbox.com/pricing read 2026-11-06): "Up to 50,000" requests a month free, then $1.00 per 1,000. Not re-read here; the ruling's own figure is the same 50,000.

Added by #483: one soft image per question the first time its map shows at step 0. Not per zoom step, and not on a resize once a full picture has shown (the held picture stays, P16). A question re-opened after Apply asks once more (its scenario changed), so its soft image is asked once more too.

| Case | Questions | Images per plan before (band + questions) | Added by #483 | After |
|---|---|---|---|---|
| Typical | 2 | 6 + 2 = 8 | 2 | 10 |
| Worst (every question, each zoom step, re-viewed after Apply) | 5 | 6 + 50 = 56 | 5 x 2 = 10 | 66 |

The free 50,000 covers about 5,000 typical plans a month (was about 6,000) and about 750 worst-case plans (was about 900). Past the free tier the addition is $1.00 per 1,000 images: 0.2 cents per typical plan, 1 cent per worst-case plan. **Nothing changes what Conestruct pays until the free tier is passed, and no account setting, rate limit or price changes**, so this is a record, not a park item. The Mapbox account's real monthly use isn't visible from the repo; Ryan reads it there.

**The rate limit (unchanged, recorded in repair cycle 1).** `/api/needs-you-map` allows 30 requests a minute per IP (`app/api/needs-you-map/route.ts`, `rateLimitOr429(req, "needs-you-map", 30)`), and the soft images count against it too. Typical plan: 2 map requests become 4. Worst case for one pass through the questions: 5 questions, each with its 5 zoom steps (−1 to +3), was 25 requests; with the 5 soft images it is 30, exactly the limit. So a user who runs through all of that inside one minute and then does one more thing (a resize, or one more zoom) now gets a 429 where before there were 5 requests to spare. Re-viewing every question after Apply in the same minute (50 requests before) already went over the limit before #483, so that case doesn't change. A 429 on a soft image only skips to the full one (vitest: "a soft image that fails still gets the full one"); a 429 on a full image shows the ruled failure line (Rule 10). The limit itself is not changed: changing it is a spend posture (#145), not this item's call.

## 4. The Generate wait (R145-11)

The first question's frame is not known before the scan finishes, so the outline keeps #477's stand-in for that moment only. Recorded in `rulings.md` R145-11 and `evidence.md`.
