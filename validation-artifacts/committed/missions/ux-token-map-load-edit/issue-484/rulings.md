# #484 rulings

Source: `docs/prompts/cc-prompt-ux-map-load-crossing-edit.md` (ruled by Ryan 2026-11-09 on the design canvas https://claude.ai/artifact/3HRk7jYsXQoUhxBeEzzVti, Crossing option B: `project/XB.dc.html`). This item builds ruling 2, under ruling 5. Ruling 1 is #483 (this branch's base, `0fe778a`); ruling 3 is #485.

## Ryan, 2026-11-09, word for word

> 2. **The crossing is drawn as a line.**
>    - On the intersection question's map, the cross street is a dashed `#3fd3a8` line along its centreline across the frame, the same style as the sidewalk and bike-lane lines.
>    - A name tag ("<Street name>", Inter 12.5/600 on `--da-ground`, 1 px `#3fd3a8` border) sits beside the line, clear of the work line and the map controls.
>    - The key reads "The cross street the map knows about".
>    - The dashed circle is removed.
>    - The geometry comes from the backend (Rule 3). If there's no cross-street geometry, draw no line and guess nothing (Rule 10, #448's wording).

> 5. Group 1's rules: 44 px targets, only the ruled sizes, no new hex beyond the existing overlay `#3fd3a8`, unslop copy, and every new string listed with its source.

## The canvas, as read (Artifact read, version 1794290881-f314, `project/XB.dc.html`)

- A 757 x 360 aerial of East Colfax Avenue at Franklin Street. The work: a solid `#ff8a2e` 5 px bar. The cross street: a full-height `border-left: 4px dashed #3fd3a8` at x = 300.
- The tag: `left: 312px; top: 16px; height: 30px; padding: 0 10px; background: #101c29; border: 1px solid #3fd3a8; font-size: 12.5px; font-weight: 600`, text "Franklin Street". So: 12 px right of the line, 16 px from the frame's top edge, at the end of the line away from the work.
- No "Crossing on the map" chip, no ring. "See it at street level ↗" bottom right.
- Key: "The work" (solid swatch) and "The cross street the map knows about" (dashed swatch).

## What exists today (base `0fe778a`)

- `src/api/render_api.py:2035` `render_needs_you_map`: for `adjacent_intersection` the subject is the nearest `highway=traffic_signals|crossing` node the scan counts (`site_detection.subject_geometry`, then `subject[:1]`).
- `src/rendering/static_aerial.py` `_dashes`: a one-point subject is drawn as a ring of 8 dashes (`RING_DASHES`), the "dashed circle".
- `conestruct/site/lib/needs-you-items.ts:275` `MAP_NOUN.adjacent_intersection = "Crossing"`: the chip "Crossing on the map" and the key "Crossing the map knows about".
- No backend read today returns a cross street's line. `nearest_intersection.py` (#285) names the cross street by shared node but returns node lists (`out body`), not geometry, and keys on the WHERE pin, not on the question's crossing.

## R145 self-ruled

**R145-1. The cross street is read on the backend from the crossing the question is framed on.** After `subject_geometry` picks the nearest crossing node, one more Overpass read asks the vehicular ways within `CROSS_STREET_RADIUS_M` of that node (the existing `_build_road_at_query`, `out geom tags`, the classes the road lookup already uses). Of those, the mainline is dropped: a way whose nearest segment runs within `CROSS_STREET_PARALLEL_DEG` of the plan's bearing (mod 180), or whose name is the plan's road name. The nearest remaining way is the cross street; every other way in the answer with the same name is drawn with it, so the line runs across the frame and not only to the corner (OSM splits a street at the intersection). The frontend computes nothing (Rule 3). Ruling 2's "from the scan's existing data": the scan's own answer has the crossing as a node with `out center`, no line; this read is the map's own, the same way #447 X1 added the subject read.

**R145-2. CHOSEN (Rule 12, not a safety distance): `CROSS_STREET_RADIUS_M = 30`.** The default radius of the backend's own road lookup (`detect_road_bearing(radius_m=30.0)`) and `nearest_intersection.LATERAL_TOLERANCE_M` (30 m, measured: shared nodes on a divided road sit 12-19 m off the centreline). A signal node on a stop bar sits inside it; the next block's street (typically 100 m and more) does not. This only picks what the map draws; no device, distance or audit value reads it.

**R145-3. CHOSEN: `CROSS_STREET_PARALLEL_DEG = 25`.** The picker's own `PARALLEL_TOLERANCE_DEG` (`lib/road-detection/cross-street.ts`), so the map and the picker agree on what is "the mainline or a frontage road, never the cross street". Stated on the backend as its own constant (the backend owns it here; the frontend's stays for the picker).

**R145-4. The ring is gone for this question; the crossing node only frames the map.** The frame (centre, zoom), the street-level point and `x-map-frame` are byte-identical to `0fe778a`'s, so #483's soft and sharp images still share one frame. The node is no longer drawn. `x-map-subject` reads `drawn` only when the cross street's line was drawn.

**R145-5. The soft image stays line-free and asks nothing more.** `soft: true` skips the cross-street read (it draws nothing), so the soft image is still the frame with no overlays, as #483 built it, and costs no Overpass read. The line and the tag arrive with the full image.

**R145-6. No geometry: no line, no tag, #448's sentence.** No crossing, Overpass refusing either read, or no non-mainline way within 30 m (a mid-block crosswalk) all draw no line, send no tag, and the question reads the existing no-line explanation ("The scan found an intersection … but the map couldn't draw it. Check it at street level."). Nothing is guessed (Rule 10). A failed cross-street read is not remembered.

**R145-7. A cross street with no name: the line, no tag.** OSM has the line but no `name` or `ref`; the tag would have nothing true to say, and a placeholder ("Unnamed street") would be a claim OSM doesn't make. The line and the key still say what the map knows (Rule 10: absence renders as absence). With a `ref` and no `name`, the ref is the name (as `nearest_intersection` names it).

**R145-8. The tag's place is the backend's.** The backend says where the tag goes (`x-map-cross-tag: left,top`, CSS px of the frame the image was drawn for) or sends no tag. It walks the drawn line inside the frame and keeps the place, 12 px to the right of the line (else to its left), whose box is inside the frame and clear of the work line, the zoom buttons, the street-level link and the Mapbox attribution, farthest from the work line (XB: the line's far end, 16 px in). The controls' boxes are MIRRORS of `globals.css` (`.nyq-map-zoom`, `.nyq-map-street`; commented as mirrors). The tag's width is estimated from the name (CHOSEN: 8 px a character plus 22 px of padding and border). 8 px is wider than Inter 12.5/600 sets any letter except W and M, so a name heavy in W or M can draw wider than the box checked. Measured in the walk: "Franklin Street" draws about 110 px wide and is estimated at 142 px. No clear place: the line without a tag (as R145-7). The name travels percent-encoded (`x-map-cross-street`), since an HTTP header can't carry every street name's characters.

**R145-9. The chip leaves this question.** XB has no "Crossing on the map" chip: the tag names the line on the map. `mapLabel` for `adjacent_intersection` is `null` and the card shows no chip for it; the phone's held slot under the map keeps its height (P1). The other four questions keep "<noun> on the map".

**R145-10. The key.** For this question the key's line reads "The cross street the map knows about" (ruling 2, verbatim), shown only when the line was drawn, as every other question's key line. Its swatch is the existing dashed `is-subject` swatch.

**R145-11. The tag appears with the full image.** It is rendered only once the full image has decoded, so it fades in with the picture and never sits on the soft one (#483).

**R145-12. Cost.** No extra Mapbox request (the line is part of the same full image). One extra Overpass read per intersection question's first full image, memoized as the subject read is (600 s), so a zoom step reads nothing again.
