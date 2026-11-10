# #484 evidence

Branch `issue-484-crossing-line`, stacked on `issue-483-map-soft-sharp` (`0fe778a`). Rulings: `rulings.md` (ruling 2 and ruling 5, verbatim; R145-1 to R145-12). Plan and Rule 5 prediction: `checkpoint.md`. Canvas read with the Artifact tool (`project/XB.dc.html`, version 1794290881-f314).

## The change

1. **Backend reads the cross street (Rule 3).** `site_detection.cross_street_geometry(node, bearing, road_name)`: one Overpass read of the vehicular ways within 30 m of the question's crossing (the road lookup's own `_build_road_at_query`, `out geom tags`). It drops the mainline (a segment within 25° of the plan's bearing, or the plan's road name), keeps the nearest remaining way, and adds the other ways with the same name. Memoized like the subject read (600 s); a refused read is not remembered.
2. **The image.** `question_image_url(..., lines=...)` draws the cross street's dashes in place of the ring. The crossing still frames the map, so the frame, `x-map-frame`, `x-map-point` and the soft image are unchanged. The soft image reads nothing more and draws nothing (#483 kept).
3. **The tag's place.** `static_aerial.cross_tag_box` walks the drawn line and picks the place 12 px beside it whose box is inside the frame (16 px in), clear of the work line (12 px), the zoom buttons, the street-level link and the attribution, and farthest from the work. The route sends `x-map-cross-street` (percent-encoded) and `x-map-cross-tag: left,top` only when the line was drawn, has a name and has a clear place.
4. **Proxy and card.** The proxy relays both headers. `readCrossStreet` reads them; a missing or malformed one means no tag (Rule 10). The tag (`.nyq-map-tag`: 30 px tall, Inter 12.5/600, `--da-ground`, 1 px `--lv-work`) shows once the full image has decoded and fades with it (none under reduced motion). The intersection has no chip. Its key reads "The cross street the map knows about".
5. **No geometry.** No line, no tag, no key line, and #448's sentence ("The scan found an intersection … but the map couldn't draw it. Check it at street level.").

## Prediction vs actual (Rule 5)

| File | Predicted | Actual |
|---|---|---|
| `src/rules/site_detection.py` | yes | +107 −0 |
| `src/rendering/static_aerial.py` | yes | +118 −1 |
| `src/api/render_api.py` | yes | +32 −3 |
| `tests/test_needs_you_map.py` | yes, rewrites the two ring tests | +248 −19 (the school ring test keeps the ring; the crossing ring test became the #484 line tests) |
| `conestruct/site/lib/render-proxy.ts` | yes | +8 −1 |
| `conestruct/site/lib/render-proxy.needs-you-map.test.ts` | yes | +5 |
| `conestruct/site/lib/needs-you-map.ts` | yes | +30 |
| `conestruct/site/lib/needs-you-items.ts` | yes | +7 −5 |
| `conestruct/site/components/NeedsYouMap.tsx` | yes | +16 −3 |
| `conestruct/site/components/NeedsYouMap.test.tsx` | yes | +83 −2 |
| `conestruct/site/app/globals.css` | yes | +19 |
| `conestruct/site/lib/needs-you-items.test.ts` | "possibly" | untouched |
| `conestruct/site/lib/design/motion.test.ts` | **not predicted** | +2 (the same miss as #483: the motion allow-list names every animation, and the tag's fade joined it) |
| `.gitignore` | **not predicted** | +4, `**/crops/extra/`, added on Ryan's instruction during the walk (2026-11-10: move crops, never delete them) |

The ring code stays: a school or interchange node still rings (`test_a_node_subject_is_a_ring_at_the_capped_zoom` now uses a school). Byte-identical: every other question's image, headers, chip and key; the crossing's frame, point and soft image; the scan, audit, PDF, XLSX and every device count.

## Tests

- Red proofs: backend `red-proof-backend.txt` (12 failed / 31 passed on `0fe778a`'s code with the new tests); frontend `red-proof-frontend.txt` (3 failed / 30 passed).
- Baseline: the first pytest run overlapped my first edits (1 failed / 2376 passed, `-x`), so it is not a clean baseline. #483's recorded final on the base is `3913 passed, 3 skipped`.
- First full vitest run: 1 failure, real, the motion allow-list (`full-run-failures.txt`). It passed alone after the fix.
- Final: pytest `3926 passed, 3 skipped`; vitest `3012 passed | 1 skipped (3013)`; tsc clean; mypy `Success: no issues found in 49 source files`; ruff check and format clean.

## The local walk (Overpass stubbed)

`next dev` on :3484 against `scripts/verify-generate-cls-stub.py` on :8484; real Mapbox images from the local token; `script/walk.mjs` (#483's walk plus the tag and key readout).

- **With the line** (`walk/walk-line.txt`, `crops/line/`): the stub had one more fixture folder, `overpass-fixture/`. Its single answer is **derived, not recorded**: the cross-street query at the crossing node 7402343541 (39.7399691, −104.968354), answered with the recorded `ux-group3-where/.../c74c32bdc5114bff.json` (the vehicular ways within 50 m of the Colfax and Franklin centre, about 21 m away). The pick finds Franklin Street (3 ways). Intersection question, all three sizes: a dashed line on Franklin, the tag "Franklin Street" in Inter 12.5px/600, ground rgb(16,28,41), border 1px rgb(63,211,168), inside the frame, clear of the zoom buttons and the link. It sits at 397,360 at 1440 and 1198 (the line's far end from the work) and at 155,159 at 390. No chip; key "The work · The cross street the map knows about · Imagery may be a few years old"; no tag on the soft image. axe 0, under 44 px 0, the soft and sharp box and frame the SAME, for all 9 question states.
- **No geometry** (`walk/walk-no-geometry.txt`, `crops/no-geometry/`): without that folder the cross-street read misses (a refused read). No line, no tag, key "The work · Imagery may be a few years old", #448's sentence. axe 0, under 44 px 0, SAME for all 9.
- **The permanent check** (`walk/verify-generate-cls.txt`, no-geometry backend): CLS 0 PASS, outline PASS and soft→sharp PASS at 1440x900, 1198x930 and 390x844.

Crops for Ryan's hand check: `crops/line/<size>-q3-{soft,sharp}.png` and `crops/no-geometry/<size>-q3-{soft,sharp}.png`. The q1 and q2 crops from the same runs are in `crops/extra/` (gitignored).

**Phone note (recorded, not a defect):** below 480 px the street-level link sits under the map, but the backend still keeps the tag clear of the link's box over the map, so at 390 the tag lands mid-frame and not at the line's end. The backend doesn't know the viewport, only the frame size.

## Cost

No extra Mapbox request. One extra Overpass read per intersection question's first full image (memoized; a zoom step reads nothing).

**Latency:** the cross-street read runs after the subject read, and each has its own 8 s budget (`SUBJECT_BUDGET_S`). In the worst case a first intersection full image waits up to about 8 s longer. After that the read is memoized for 600 s. The frontend and the proxy add no timeout of their own.

**Follow-up:** #487 (https://github.com/rtmakatura/conestruct/issues/487) covers two edge cases: a tag placed beside a way the URL budget left out, and the road-name match comparing raw strings, so a curving mainline is dropped only by the 25° test.

## Strings

- Added: "The cross street the map knows about" (key line; ruling 2, verbatim).
- The tag's text is OSM's `name` (else `ref`), data rather than copy.
- Removed: "Crossing on the map" (chip) and "Crossing the map knows about" (key).
