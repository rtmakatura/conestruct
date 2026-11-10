# cc-prompt: UX: question maps load in place, the crossing is a line, and editing and questions take turns

Ruled by Ryan on 2026-11-09 on the design canvas "Tool page: map loading, crossing mark, edit vs questions" (https://claude.ai/artifact/3HRk7jYsXQoUhxBeEzzVti):
- **Loading:** Option B (`LoadB1.dc.html`, `LoadB2.dc.html`).
- **Crossing:** Option B (`XB.dc.html`).
- **Editing:** Option A (`EA.dc.html`).

These build on #447 (the NEEDS YOU maps), #470/#477 (the Generate wait), and #439/#440/#469 (the WHERE band).

Platform UI arc, mission rules: investigate first, then commit `rulings.md` and `checkpoint.md`. Stop only for the park list or any change to a device count. File the issues yourself (R146). Do a local walk with Overpass stubbed, and commit crops for Ryan's hand check. Send the gate header only to the site's own origins, and never print it.

## Why (Ryan, 2026-11-09)

- While a NEEDS YOU map loads, the stand-in is the WHERE aerial at a different frame, so the picture visibly changes when the real map lands.
- The intersection question's dashed circle ("Crossing on the map") looks janky.
- After Confirm, if he goes back to edit (road, start, length) and the questions reopen, the edit rows and the CONFIRM card show at once. The map gets pushed down and the band turns into a tall, broken layout.

## Rulings (quote verbatim into rulings.md)

1. **Each question's map loads soft, then sharpens.**
   - First, a small, fast image of the **same frame** as the final map shows, scaled to the full box, blurred (about 14 px) and slightly desaturated, with the label "Loading the map of this spot" (Inter 12.5) in the corner.
   - When the full image arrives, it replaces the soft one in place, with a short fade (about 200 ms; instant under reduced motion). The frame, the zoom and the box size never change.
   - Both images come from the same backend frame, so they always match (Rule 3).
   - The key under the map appears with the full image, in reserved space.
   - Record the extra Mapbox cost per plan against the free 50,000 a month.
   - This replaces #477's WHERE-aerial stand-in for the NEEDS YOU maps.
   - For the Generate wait, use the soft image of the first question's frame if the frame is known before the scan finishes. If it isn't, keep #477's stand-in for that moment only, and record which.
2. **The crossing is drawn as a line.**
   - On the intersection question's map, the cross street is a dashed `#3fd3a8` line along its centreline across the frame, the same style as the sidewalk and bike-lane lines.
   - A name tag ("<Street name>", Inter 12.5/600 on `--da-ground`, 1 px `#3fd3a8` border) sits beside the line, clear of the work line and the map controls.
   - The key reads "The cross street the map knows about".
   - The dashed circle is removed.
   - The geometry comes from the backend (Rule 3). If there's no cross-street geometry, draw no line and guess nothing (Rule 10, #448's wording).
3. **Editing and questions take turns in the WHERE band.**
   - When the person opens an edit (Edit, Change, Move, the length field) after the CONFIRM questions have shown, the right column becomes one Edit panel: road, work start, work-zone length, each with its own action. The CONFIRM card collapses to one row: "Questions wait while you edit · N of M answered".
   - The panel ends with "Cancel" and "Done, back to the questions". Cancel undoes the edit, and P15 applies.
   - Back on the questions, any answer the edit invalidated is cleared and re-asked with one line saying why, per #440 ruling 2's rule. Every other answer stays.
   - The map stays in the left column at the band's fixed height, never pushed down. The band's height never changes (#469).
   - Opening the questions while the Edit panel is open isn't possible: the collapsed row isn't a control.
   - On a phone, the same turn-taking happens under the pinned strip (#456).
4. **Update the permanent checks:**
   - A NEEDS YOU map's box doesn't change size from soft to sharp.
   - The WHERE band's height and the aerial's frame stay the same across edit, back to questions, and every CONFIRM state.
5. Group 1's rules: 44 px targets, only the ruled sizes, no new hex beyond the existing overlay `#3fd3a8`, unslop copy, and every new string listed with its source.

## Out of scope

The picker modal (group 8) and the spacing round.

## Evidence

Capture at 1440, 1198x930 and 390:
- each NEEDS YOU question soft, then sharp (frame and box unchanged)
- the intersection question with the cross-street line, and with no geometry
- Confirm, then Edit (panel and collapsed row), then Cancel; and Edit, then change the length, then Done, then the re-asked answer

Run axe and the 44 px measure, and commit the crops.
