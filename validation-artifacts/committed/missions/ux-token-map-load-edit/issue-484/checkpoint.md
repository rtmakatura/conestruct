# #484 checkpoint (no stop: nothing here is on the park list)

Branch `issue-484-crossing-line`, worktree `.claude/worktrees/issue-484`, base `issue-483-map-soft-sharp` `0fe778a`.

## The plan

1. **Problem.** The intersection question's map draws the nearest crossing node as a ring of dashes (`src/rendering/static_aerial.py` `_dashes`, `RING_DASHES`; `src/api/render_api.py:2081` keeps `subject[:1]`), with the chip "Crossing on the map" (`conestruct/site/lib/needs-you-items.ts:275`). Ryan finds it janky.
2. **Rulings.** Ruling 2 and ruling 5 of `docs/prompts/cc-prompt-ux-map-load-crossing-edit.md` (Ryan 2026-11-09, Crossing option B), quoted in `rulings.md`; R145-1 to R145-12 self-ruled there.
3. **Change.**
   - Backend: `site_detection.cross_street_geometry(node, bearing, road_name)` (one `out geom tags` read around the crossing, mainline dropped, same-named ways joined, memoized); `static_aerial.question_image_url(..., lines=...)` draws given lines in place of the subject (the frame still fits the subject); `static_aerial.cross_tag_box(...)` places the tag; the route sends `x-map-cross-street` (percent-encoded) and `x-map-cross-tag` when the line is drawn and named. Soft: no read, no line.
   - Proxy: relays the two headers.
   - Card: `needs-you-map.ts` reads them into `crossStreet: { name, left, top } | null` (malformed: null); `NeedsYouMap.tsx` renders the tag once the full image decodes; no chip when `label` is null. `needs-you-items.ts`: the intersection's `mapLabel` null, `mapKey` "The cross street the map knows about". CSS: `.nyq-map-tag`.
4. **Rule 5 churn prediction.**
   - Changes: the intersection question's full image URL (no ring; cross-street dashes when found) and its `x-map-subject` (now `drawn` only for a cross-street line); two new headers on that answer only; the key line and chip for that question; tests that asserted the ring (`test_a_node_subject_is_a_ring_at_the_capped_zoom`, `test_the_intersection_question_draws_one_ring_on_the_nearest_crossing`) and the "Crossing on the map" label test are rewritten to the line.
   - Byte-identical: every other question's image URL, headers, chip and key; the intersection question's frame, `x-map-frame`, `x-map-point` and soft image URL; the scan, the audit, device counts, PDFs; the other four `MAP_NOUN` values; the ring code path stays for nothing else (removed if it has no other caller).
   - Files (predicted): `src/rules/site_detection.py`, `src/rendering/static_aerial.py`, `src/api/render_api.py`, `tests/test_needs_you_map.py`, `conestruct/site/lib/render-proxy.ts`, `conestruct/site/lib/needs-you-map.ts`, `conestruct/site/lib/needs-you-items.ts`, `conestruct/site/components/NeedsYouMap.tsx`, `conestruct/site/app/globals.css`, `conestruct/site/components/NeedsYouMap.test.tsx`, `conestruct/site/lib/render-proxy.needs-you-map.test.ts`, possibly `conestruct/site/lib/needs-you-items.test.ts`; evidence under this folder.
5. **Proof.** Red proofs first (backend: the route draws a cross-street line and no ring, the tag headers, the mainline is dropped, no geometry draws nothing, soft reads nothing; frontend: the tag renders from the headers after decode, the key words, no chip). Then pytest, mypy, ruff, vitest, tsc. Local walk with Overpass stubbed at 1440, 1198x930 and 390: the intersection question with the line and with no geometry; axe 0; no target under 44 px; crops in `crops/`.

## Cost (ruling 1's ledger, for this item)

No extra Mapbox request. One extra Overpass read per intersection question's first full image (memoized 600 s).

Latency: the cross-street read runs after the subject read, and each has its own 8 s budget (`SUBJECT_BUDGET_S`). In the worst case a first intersection full image waits up to about 8 s longer. After that the read is memoized for 600 s. The frontend and the proxy add no timeout of their own.
