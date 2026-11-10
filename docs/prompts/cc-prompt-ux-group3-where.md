# cc-prompt: UX group 3 — the Where band: map first, then one question at a time

Ruled 2026-11-03 by Ryan: Option B on the "Tool page: Where" design canvas.
Design reference: https://claude.ai/artifact/8HvW7MLCofEDXD3Bvj5KDB (artboard `OptionB.dc.html`; `Main.dc.html` is today).
Builds on group 1 (#435, #436, live) and group 2 (#437): reuse group 2's one-question-at-a-time component and its radio rows; do not build a second one (P2, P11). If #437 has not shipped, stack on its tip.

Platform UI arc. Investigate first, commit `rulings.md` (the "Rulings" section verbatim, dated) and `checkpoint.md`, stop only for items on the park list; make every other call yourself and record it (missions-plan). File the issue yourself (R146).

## Why

Ryan's review (screenshots 5–7): the WHERE checklist sits above the map, but its first open item ("Which side is occupied?") is answered below the map, so a new user scrolls past the map to act; the checklist rows are uneven; the header carries a long mono provenance line; the map key wraps unevenly at some widths. He likes the aerial and how it highlights when ready; keep both.

## Rulings (quote verbatim into rulings.md)

1. **Order inside WHERE after a pin:** step header (mono "STEP 1 OF 4" + "WHERE" only) → "Where is the work?" (role 5) → the aerial → the done summary row → the question card → nothing else. The address field and "Edit on map" stay reachable: "Edit on map" sits on the aerial's top-right corner (44 px), the address field sits under the heading before a pin and folds into Edit after.
2. **The header's provenance line** (coordinates, OSM way, node, search radius, operator pick) moves behind one "Details" toggle on the done summary row (P19). Nothing in it is deleted.
3. **Done summary row:** one row, `✓`, the values joined with " · ": road (plain name, as #436), "starts <distance> <direction> of <cross street>", length ("1,000 ft", "(default)" only when it is). "Edit" re-opens today's three rows (Found the spot / Work starts / Extent) with their actions, in place. Only items that are done appear in the line; unset ones are not printed.
4. **The question card** is group 2's component with header mono "CONFIRM" (not "NEEDS YOU", which stays the results' word), "Question k of N", the segment bar. Questions, in order: (a) "Which side of the road is the work on?", (b) "What kind of work is it?". Answered questions collapse to a one-line record with Undo; the last button is today's "Confirm <kind>" action, labelled "Confirm and lay out the plan". Nothing about suggest-never-set changes: the kind starts unchosen and is chosen by the operator (Rule 8, #289).
5. **Side answers** are radio rows from the side options the wire offers today, in compass words with the traffic direction on line 2 ("North side" / "Next to westbound traffic"). **Trace at the checkpoint how many options the wire offers per road kind** (two-way, one-way, divided; #300). If only one option exists, the question still shows with that one row, already the only choice but not pre-selected (suggest-never-set). The one-sentence explanation under the question ("The signs and cones go on the side next to the traffic you're closing off.") ships only if it traces to how the layout uses the side; otherwise replace it with a sentence that does, or drop it, and record which.
6. **Kind answers** are radio rows, plain labels: "Shoulder work", "Lane closure with flaggers", "Lane closure near an intersection". The sheet references (TA-3/TA-5 · S-630-1, etc.) move behind "Details" on the card. The gated-kinds line becomes "4 more kinds are coming once each is checked against its standard sheet." with the count from the same source as today (Rule 12).
7. **Map key** moves onto the aerial: a small panel in the top-left corner, `--da-ground` at 92% opacity with a `--rule` border, one row per channel (16 px swatch + Inter 12.5 label). Labels: "Warning signs" (advance warning), "Taper", "Buffer", "Work zone", "After the work" (downstream). Same swatches and hexes as today (the two ruled overlay hexes included). Below 520 px the key moves under the aerial as a 2-column grid, never wrapping mid-row. The aerial's behaviour (highlight when ready, what draws before the side is confirmed) is unchanged.
8. Group 1's spacing and text rules apply throughout; no new size or hex. Copy follows the unslop rules; every new string is listed in the report with its source.

## Out of scope

The cross-street flow and the map picker (group 4), the WHAT band (group 7), the wait state (group 6). The aerial itself is not redrawn.

## Investigate first

1. Today's WHERE band: every state (pre-pin, pinned, side set, kind set, confirmed, revision) and which element shows in each.
2. Ruling 5's trace: side options per road kind, with file:line.
3. Every test pinning the strings, order or layout that change (Rule 5 churn prediction).
4. P1–P22 for the changed surfaces, with the FLOW.md step (1 Where) and user.

## Evidence

Local run with Overpass stubbed (as #436/#437), at 1440 and 390, Denver Colfax pin and one one-way pin: pre-pin, pinned, side answered, kind answered, Undo each, Confirm; the key on the aerial at 1440 and under it at 390; axe; no target under 44 px. Crops committed for Ryan's hand check before the ship go.
