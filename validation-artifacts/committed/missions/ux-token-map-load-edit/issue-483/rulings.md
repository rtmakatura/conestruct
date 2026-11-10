# #483 rulings

Source: `docs/prompts/cc-prompt-ux-map-load-crossing-edit.md` (ruled by Ryan 2026-11-09 on the design canvas https://claude.ai/artifact/3HRk7jYsXQoUhxBeEzzVti, Loading option B: `project/LoadB1.dc.html`, `project/LoadB2.dc.html`). This item builds ruling 1 and ruling 4's first bullet, under ruling 5. Rulings 2 and 3 are #484 and #485.

## Ryan, 2026-11-09, word for word

> 1. **Each question's map loads soft, then sharpens.**
>    - First, a small, fast image of the **same frame** as the final map shows, scaled to the full box, blurred (about 14 px) and slightly desaturated, with the label "Loading the map of this spot" (Inter 12.5) in the corner.
>    - When the full image arrives, it replaces the soft one in place, with a short fade (about 200 ms; instant under reduced motion). The frame, the zoom and the box size never change.
>    - Both images come from the same backend frame, so they always match (Rule 3).
>    - The key under the map appears with the full image, in reserved space.
>    - Record the extra Mapbox cost per plan against the free 50,000 a month.
>    - This replaces #477's WHERE-aerial stand-in for the NEEDS YOU maps.
>    - For the Generate wait, use the soft image of the first question's frame if the frame is known before the scan finishes. If it isn't, keep #477's stand-in for that moment only, and record which.

> 4. **Update the permanent checks:**
>    - A NEEDS YOU map's box doesn't change size from soft to sharp.
>    - The WHERE band's height and the aerial's frame stay the same across edit, back to questions, and every CONFIRM state.

(Ruling 4's second bullet is #485's.)

> 5. Group 1's rules: 44 px targets, only the ruled sizes, no new hex beyond the existing overlay `#3fd3a8`, unslop copy, and every new string listed with its source.

## The canvas, as read (Artifact read, version 1794290881-f314)

- `LoadB1` (soft): the image `blur(14px) saturate(0.7)`, `transform: scale(1.08)`, under a `rgba(16,28,41,0.25)` scrim; the label at left 16 / bottom 16, 32 px tall, 0 12 padding, 12.5 px, on `#101c29`. No work line, no zoom, no street-level link. The key row reads "The key appears with the map".
- `LoadB2` (sharp): the image as drawn, the work line, "See it at street level ↗", the key "The work" and "Imagery may be a few years old".

## R145 self-ruled

**R145-1. The soft image is the full image's frame at @1x with nothing drawn on it.** Same centre, same zoom, same CSS size, no `@2x`, no overlays (the work line and the subject arrive with the full image, as `LoadB1` shows none). "Small" is a quarter of the full image's pixels and no overlay to draw; it is the same extent by construction (no zoom arithmetic), and Mapbox's own logo and attribution sit where the full image's do, so they sharpen in place instead of being scaled up 2-4x into a smear. CHOSEN over a 1/4-size image at zoom −2: that would put the attribution text across most of a small image's width, scaled up four times under the blur.

**R145-2. One backend frame, computed once per request, said in a header.** `/render/needs-you-map` takes `soft: true` and runs the same path as the full image (the same `_laid_out`, `scan_frames`, `subject_geometry`, `fit_view`); only the URL builder differs. Both answers carry `x-map-frame: lat,lng,zoom`, the frame the backend framed. The card relays it onto the image (`data-frame`) and computes nothing (Rule 3). The tests and the walk compare the two.

**R145-3. The full image is asked for when the soft one has answered, not at the same time.** Modal runs one request per container (no `@modal.concurrent` in `modal_app.py`), so two at once would start a second container and do two Overpass reads that could disagree. In sequence, the full request reuses the subject memo (`site_detection._SUBJECT_MEMO`, 600 s) on a warm container, so one Overpass read per question and the same frame. Both are asked in one chain inside the hook (`useNeedsYouMap(req, softFirst)`): one 300 ms debounce, then the soft request, then the full one the moment it answers, with no re-render in between (a first build used two hook calls and the full request waited for a React render; `full-run-failures.txt`). A soft image that fails or is refused still lets the full one be asked for. Stated cost: the sharp image lands later than today by the soft image's own Mapbox time (no Overpass read, no overlays).

**R145-4. Before the soft image arrives, the frame is its own ground with the label.** No picture is shown that isn't this frame (the WHERE aerial at another frame is what #483 removes), and the label says what is happening, so absence renders as absence (Rule 10). The label shows from the moment the question opens until the full image lands.

**R145-5. The soft image is not scaled 1.08.** The canvas scales it to hide the blur's soft edge; the ruling's words are "the frame, the zoom and the box size never change", so the ruling wins and the soft image fills the box exactly (`object-fit` as the full one's `width/height: 100%`). The blur's edge fades to the frame's own ground (`--ws-surface-rgb`).

**R145-6. Colours and sizes are tokens already in use, no new hex.** For the canvas' `#101c29` ground and `rgba(16,28,41,…)` scrim (16 28 41) the build uses the panel ground the map's own chips already use, `rgb(var(--ws-surface-rgb))`, which is `15 26 38`: close to the canvas' colour, not the same, chosen so no new hex is added (ruling 5); the label's text is `.tr-note` (Inter 12.5, `--fs-field-label`, ruling 5's sizes) in `--ink`, the map chip's. The label sits at `var(--space-block)` (16) from the left and bottom, 32 px tall, 0 12 px padding, as the canvas and the existing `.nyq-map-label` chip. Numbers CHOSEN from the canvas (not safety): blur 14 px (ruled "about 14"), `saturate(0.7)` ("slightly desaturated"), scrim 0.25, fade 200 ms (ruled "about 200").

**R145-7. Below 480 px the label sits under the map.** The phone fix round (2026-11-06, `ux-site-map/rulings.md`) puts only the zoom on the map below 480 px and the map's label in a held space under it. The loading label takes that held label slot, so nothing under the map moves when the subject's label replaces it.

**R145-8. "The key appears with the map" is the canvas' note, not a UI string.** The ruling lists one new string, the label. The key row is kept in its reserved space (`visibility: hidden`, the existing `data-hidden` rule) until the full image lands, then shows as before.

**R145-9. The zoom buttons and the street-level link come with the full image**, as today (they were never on the stand-in) and as `LoadB1` shows none. A zoom step keeps the full picture on screen while the next is drawn (P16, unchanged); no soft image is asked for a zoom step or a resize once a full picture has shown.

**R145-10. The fade.** The full image fades in over the soft one, 200 ms, under `prefers-reduced-motion: no-preference` only (instant otherwise). It plays when the full image first mounts; a zoom step changes the same element's `src`, so it doesn't replay.

**R145-11. The Generate wait keeps #477's stand-in (recorded).** The first question's frame is not known before the scan finishes: which questions exist comes from the scan's own answer (`lib/needs-you-items.ts`, a scanned flag), and the frame is framed on that flag's subject (`subject_geometry`, a separate Overpass read made by the map request). So per ruling 1's last bullet, the outline's map block (`ResultsOutline`, `.ro-map`, `OutlineAerial`) keeps #477's WHERE-aerial stand-in for the Generate wait only. The NEEDS YOU map itself no longer shows it (R145-4).

**R145-12. The Mapbox cost record is a record, not a spend change.** One more Static Images request per question the first time its map shows (not per zoom step, not per resize). The account settings, the rate limit (`needs-you-map`, 30 a minute per IP) and the plan are unchanged. Numbers in `checkpoint.md` § 3.

**R145-13. The permanent check.** `scripts/verify-generate-cls.mjs` gains the soft→sharp box check: from the press, every `.nyq-map-frame`'s box is recorded at its first soft paint and its first sharp paint, and the run FAILS when they differ (0 px tolerance after rounding) or when the two images' `data-frame` differ. It waits up to 30 s for the sharp image after the settle; a map that fails says so (the check prints SKIPPED with the reason, never PASS).
