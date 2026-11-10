# cc-prompt: UX follow-ups (tap feedback on the WHERE aerial, and a site map inside NEEDS YOU questions)

Ruled 2026-11-05 by Ryan on the "Tool page: tap feedback and aerial help" design canvas: https://claude.ai/artifact/UnXwW9LvUDmFLDwraGXqKA
- Part 1 is **Option B** (`TapA1`, `TapA2`, `TapA3`, `TapB`). `Main` shows today.
- Part 2 is **Option A** (`SeeA`). `SeeB` and `SeeB390` were not chosen.

Build the parts as two branches, one issue each, and ship Part 1 first. Part 1 builds on #440 (`QuestionSteps.tsx`, `WhereQuestions.tsx`, the armed aerial). Part 2 builds on #437/#438 (the NEEDS YOU card).

Platform UI arc, mission rules: investigate first, then commit `rulings.md` (the "Rulings" sections verbatim, dated) and `checkpoint.md`. Stop only for the park list and record every other call. File the issues yourself (R146). Do a local walk with Overpass stubbed, and commit crops for Ryan's hand check before the ship go.

## Why

Ryan tried #440 on prod on 2026-11-05. The crosshair and both map buttons are good. But when he taps the intersection on the band's aerial, nothing seems to happen: the lookup runs and the result shows only in the CONFIRM card below. If he's scrolled up or on a small screen, he can't see the card, so he gets no sign anything worked.

Separately, the NEEDS YOU questions ask him to confirm things by eye, such as sidewalks, bike lanes and an intersection, without showing him the site.

## Part 1 rulings: the tap answers on the map, then the card comes into view (quote verbatim)

1. **The instant you tap:** a ring (`--act-bright`) appears at the tap point, and the aerial's bar changes to "Finding the street name…" with a spinner icon. Both appear right away, before the lookup answers (P1). The bar is a live region.
2. **Street found:** the outline and bar turn to the ready look (`--pass` outline, `--vd-ready-ground` bar). The bar reads "✓ Near <street name>". The box and name label on the crossing stay as #440 drew them.
3. **Then the page scrolls** smoothly so the CONFIRM card's ✓ row and its "Next question" button sit just below the aerial. If both are already in view, it doesn't scroll. With `prefers-reduced-motion`, it jumps instead of animating. Focus moves to the ✓ row's heading so keyboard and screen-reader users land there too.
4. **Lookup failed:** the outline and bar turn to the warn look (`--warn` outline, `--vd-flag-ground` bar). The bar reads "The street lookup didn't answer. Tap again, or try once more." with a "Try again" button in the bar, and a dashed ring is left at the tap point. The page doesn't scroll. "No street there" uses the same look with #440's X8 copy.
5. **Move** re-arms the bar to #440's "Tap the intersection nearest the work", and **Undo** clears the ring and box. Neither one scrolls.
6. Every value traces to what #440 already reads, and no new wire field is added. Follow group 1's rules: 44 px targets, only the ruled sizes, no new hex. List every new string with its source.

## Part 2 rulings: a map of the site inside each NEEDS YOU question (quote verbatim)

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

## Out of scope

Undo buttons (being mocked now; a separate prompt follows), group 5's reference sections, the picker modal (group 8), and #117 (drawing the cross street on the PDF).

## Investigate first

1. Part 1: where #440's lookup states live, and how the card and aerial share them. Make sure the scroll can't fight the WHERE band's own layout (P1).
2. Part 2: the NEEDS YOU questions and the location and geometry each one carries. Check whether `static_aerial.py` can take a frame and overlays per question, and what each image costs (Mapbox Static Images calls per plan). Record the cost.
3. The Rule 5 churn prediction and P1–P22 for the changed surfaces.

## Evidence

Run locally with Overpass stubbed, at 1440 and 390.
- Part 1: tap, finding, found (before and after the scroll), failed, Move and Undo, plus one run with reduced motion.
- Part 2: each NEEDS YOU question with its map, one question with no geometry (no line, no guess), a failed image, and the street-level link's URL.
- Both parts: axe and the 44 px targets. Commit crops for Ryan's hand check.
