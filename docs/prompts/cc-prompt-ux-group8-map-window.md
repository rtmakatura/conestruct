# cc-prompt: UX group 8: the map window, one road per street, and a road-lookup fallback that asks the direction

Ryan ruled this on 2026-11-10, on the "Tool page: the map window" design canvas (https://claude.ai/artifact/TbdFDMmjqJpsUkqsT5wpFL).
- Boards: `W1` (the map window), `W2` (the side question), `F1` (the window when the lookup fails), `F2` (the sides after the fallback).
- `Main` shows today.
- This folds in #506 (the window saved with no road ticked) and the one-option side question seen on 2026-11-06.

This is one large mission item. Follow the mission rules in CLAUDE.md: two gate rounds at most, gates one at a time, targeted tests locally, and stop only for the park list or any change to a device count. File the issue yourself (R146). Do a local walk with Overpass stubbed, and commit the crops for Ryan's hand check.

## Why

- The map window still uses the old look: small faint all-caps labels, a text overlay on the map, and jargon errors ("Detection service unavailable").
- The road list shows one street as two roads ("East Colfax Avenue, eastbound" and "…, westbound"). Picking the wrong one gets the plan declined, or leaves a side question with one answer.
- When the lookup fails, the side question offers four compass sides, which can be wrong for a diagonal road.
- In #506, a save went through with no road ticked.

## Rulings (quote verbatim into rulings.md)

1. **The window's look follows group 1's rules (`W1`).**
   - The heading is "Where is the work?" (19/600), with the line "Search an address or tap the map where the work starts, then pick the road."
   - The address field and Search are 44 px.
   - The map has only zoom on it: no text overlay and no layer toggle unless you trace one as needed, and record it.
   - The right panel holds "Which road is the work on?" as a radio list, then "Where the work starts" with its line and "Tap the map to move it".
   - The footer has Cancel and "Save and close".
   - Inter throughout. No mono, no caps labels.
2. **One entry per street.**
   - When a street is mapped as two one-way carriageways (or two OSM ways with one name and opposite directions), the list shows it once, e.g. "East Colfax Avenue · Traffic both ways · 9 m from your pin".
   - Trace how the road list is built today and where the direction is stored. Choosing the side on the page (ruling 3) sets the carriageway.
   - Rule 3 applies: the backend decides the grouping and the carriageway, not the frontend. Record the grouping rule and every case it covers (dual carriageway, a true one-way, a divided road).
3. **The side question carries the direction (`W2`).**
   - For a street with traffic both ways, both sides show, each with its traffic: "North side · Next to westbound traffic" and "South side · Next to eastbound traffic". The question reads "Which side of <street> is the work on?"
   - For a true one-way street, the one side is picked for you. A line says why, e.g. "<Street> is one-way here, so the work is on the <side> side, next to its traffic." Nothing is left to tick.
   - Rule 12 applies to every name and direction.
4. **When the road lookup fails (`F1`):**
   - The panel shows a plain message: "We couldn't look up the roads here." / "The road data service didn't answer. Try again, or tell us which way the road runs and carry on." It has a real "Try again" that re-runs the lookup (closes #498 if that's the same thing; record it).
   - Then "Which way does the road run?" with four choices, each with a small line icon: "East–west", "North–south", "Northeast–southwest", "Northwest–southeast". Under them: "Look at the map: which way do the lanes run past your pin?"
   - "Detection service unavailable" and every other jargon error in the window get plain words. List each one.
5. **The sides after the fallback (`F2`):**
   - The side question offers only the picked direction's two sides, named for that direction, with the traffic beside each, e.g. "Northwest side · Next to traffic heading southwest" and "Southeast side".
   - It also gets the line "You said the road runs <direction>, so these are its two sides."
   - Trace today's side naming on a diagonal road. If a detected diagonal road is named misleadingly today (e.g. "north side" on a road heading northeast), fix it the same way, and record it.
6. **Save only with an answer (#506).** "Save and close" is enabled only when a road is picked, or a direction is picked in the fallback. Otherwise it's disabled, with the line "Pick a road, or a direction if the lookup failed." Trace #506's path, and add a test that fails on it.
7. **The rest stays.** Move, Edit on map, #446's tap feedback, #485's take-turns editing, #469's band height and #490's column rule all stay as they are. Add the window's states to the permanent checks: band and columns, 44 px (with Mapbox's marks excepted, per #505), and axe.
8. Every new string is listed with its source. No new hex. Unslop.

## Out of scope

Group 7 (the What section) and the spacing round.

## Evidence

Capture at 1440, 1198x930 and 390:
- the window with a two-way street (one entry), a one-way street, and a divided road
- the side question for each
- the lookup failing: the message, Try again, then each of the four directions, and the side question after a diagonal
- Save disabled with nothing picked
- the #506 path

Run axe and the 44 px measure, and commit the crops.
