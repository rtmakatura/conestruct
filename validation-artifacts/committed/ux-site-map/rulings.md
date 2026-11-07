# #447 rulings: a map of the site inside each NEEDS YOU question

## Part 2 rulings, verbatim (Ryan, 2026-11-05, Option A `SeeA`; `cc-prompt-ux-tap-and-site-map.md`)

1. **Every NEEDS YOU question gets an aerial** between its explanation and its choices, as in `SeeA`. It runs the card's full width at 16:8 or close to it, with zoom +/− (44 px).
2. **Each map is framed on that question's subject:** the sidewalk segment for sidewalks, the bike lane for bike lanes, the crossing for an intersection. Trace which questions exist and what location each one has on the wire, and record it. A question with no location shows the work zone.
3. **Overlays come from the wire and are drawn on the backend**, as the WHERE aerial is (`static_aerial.py`; Rule 3; #301 ruling 1).
   - The work is a solid `--dim` line.
   - The thing being asked about is a dashed `#3fd3a8` line (the overlay hex already allowed for map keys), labelled, e.g., "Sidewalk on the map".
   - If the wire has no geometry for it, no line is drawn and nothing is guessed (Rule 10). The question still asks.
4. **A key under the map** names each line: "The work" and "Sidewalk the map knows about" (worded per question). Trace whether the imagery's date is known: if it is, show it; if not, show "Imagery may be a few years old" only if that's a fair general statement, and record the call.
5. **"See it at street level ↗"** sits on the map's bottom-right and opens Google Street View in a new tab at the question's point, using the documented Maps URL (`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=<lat>,<lng>`). No API key or embed. Check that the link is allowed, and record it.
6. **On a phone (390)** the map runs edge to edge inside the card, and the key wraps.
7. **Loading:** the map reserves its height while the image loads (P1). A failed image shows one plain line in its place, "The map didn't load. Your answer still works without it.", and the question works as before.
8. Group 1's rules, as in Part 1.

Part 1's ruling 6, which ruling 8 points at: "Every value traces to what #440 already reads, and no new wire field is added. Follow group 1's rules: 44 px targets, only the ruled sizes, no new hex. List every new string with its source."

## Phone fix round, verbatim (Ryan, 2026-11-06, holding the ship)

"Hold the ship. One phone fix round for 447: below 480 px make the map taller (about 4:3), move the line label and "See it at street level" below the map, and keep only the zoom on it. For the intersection question draw one ring, on the nearest crossing only, at every width. Re-crop 390 and 1440, re-run the gates, then the result: line."

This narrows ruling 1's 16:8 and ruling 5's "on the map's bottom-right" to 480 px and up, and replaces X4's corner chip below 480 px. X3's ring stays, one per intersection question.

**X11 (R145 self-ruled). Below 480 px, the order under the map is the label, then the link, in a space held for both.** The label is known only once the backend answers, and the space keeps the key and the choices from moving (ruling 7, P1). With no line drawn the link moves up and the blank is at the bottom, not between the map and the link. "Nearest" is the scan's own: the distance from the pin, the same one the question's "74.8 ft from the work" states.

## R145 self-ruled

**X1. Where the subject's geometry comes from.** No question has a location or a line on the wire today (`checkpoint.md` § 1), so read literally, ruling 3's no-geometry clause would leave every map with no dashed line and ruling 2's frame could never apply. The scan can't carry it without moving what ruling 8 and the issue keep fixed: `out geom` on the scan set removes the one thing that separates scan elements from road elements (`split_folded_elements`), slows every Generate, and a new bucket field changes the audit record. So the map's own read fetches it: `POST /render/needs-you-map` asks Overpass for that one bucket's selectors with `out geom tags` and keeps what the scan's own `_categorize` and `_classified` count. The frontend still receives only a picture and two headers. No field is added to the audit or the scan. If that read doesn't answer, no line is drawn (Rule 10).

**X2. The dashed line is many short paths.** The Static Images API can't dash a path (`corridor-map.ts:59`, `static_aerial.py` docstring). The backend splits the line into dashes, each its own `path-` overlay, dropping the farthest features first if the URL would pass the cap. CHOSEN: 12 px on and 8 px off, at least 3 m and 2 m, since the polyline's 5-decimal precision is about 1 m.

**X3. A point subject gets a dashed ring.** A crossing or a school node has no line to dash. Its subject is drawn as a ring of 8 dashes, radius 14 px and at least 4 m, CHOSEN. The geometry is the wire's; only the shape around the point is drawn.

**X4. The label sits at the map's top-left, not on the line.** `SeeA` puts the chip beside the line. At 390 the map is about 180 px tall and already holds the zoom buttons and the street-level link, so a chip that follows the line would collide with them. A fixed corner is the same at every width, and the dashed swatch in the chip ties it to the line.

**X5. Words per question.** Label / key: "Sidewalk on the map" / "Sidewalk the map knows about" (ruling 3 and 4, verbatim); "Bike lane on the map" / "Bike lane the map knows about"; "Crossing on the map" / "Crossing the map knows about" (ruling 2's word for an intersection); "Interchange on the map" / "Interchange the map knows about"; "School on the map" / "School the map knows about". The same wording pattern; the nouns come from `FLAG_WORDS`' topics and ruling 2.

**X6. Imagery date.** Not known: Static Images returns no date and the Mapbox Satellite page gives none per image. "Imagery may be a few years old" is a fair general statement: "Imagery is not improved on a set schedule and is updated when and where it becomes available"; the newest changelog entry is "Apr 23, 2024", 2.5 years before this work (docs.mapbox.com/data/tilesets/reference/mapbox-satellite/, read 2026-11-06). Shown as ruled.

**X7. Street-level link: allowed.** "You don't need a Google API key to use Maps URLs." The form is `https://www.google.com/maps/@?api=1&map_action=pano&parameters`, with `viewpoint` as comma-separated latitude and longitude (developers.google.com/maps/documentation/urls/get-started, read 2026-11-06). The page states no usage terms beyond the 2,048-character limit. The panorama is the one Google finds closest, so it can differ slightly from the point. The point comes from the backend (Rule 3): the middle of the nearest feature, else the work's middle, else the pin.

**X8. Cost: inside the allowance, so not a park-list stop.** See `checkpoint.md` § 3. The image is asked for only for the question on screen.

**X9. No laid-out corridor.** A plan the band couldn't lay out (an older pin model, an unbuildable corridor) gets the pin picture, with no lines. A map with no pin answers 409 and the card shows ruling 7's line.

**X10. CHOSEN numbers.** `SUBJECT_MAX_ZOOM` 18 (the pin picture's 17 plus one: a single crossing has no span to fit); `SUBJECT_FRAME_FEATURES` 3 (the sidewalk "segment": the nearest three, not every footway in the box); `SUBJECT_MAX_FEATURES` 12; `SUBJECT_BUDGET_S` 8 s (about one mirror's 7 s cap plus the fall-through, so a slow Overpass costs the line and not the picture); subject memo 600 s (a zoom step doesn't ask Overpass again).
