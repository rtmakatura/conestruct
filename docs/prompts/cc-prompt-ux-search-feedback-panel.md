<!-- Fixed pass: removed a duplicate ")" from the "Did you mean" line in the shipped prompt. -->
# cc-prompt: UX map window: search messages move into the right panel (nothing over the map)

Ryan ruled this on 2026-11-24, on the "Tool page: the map window" design canvas (https://claude.ai/artifact/TbdFDMmjqJpsUkqsT5wpFL), board `Town`, option **T1**. He doesn't want "That search found a town or area…" covering the map.

One small mission item. Follow the mission rules in CLAUDE.md: two gate rounds at most, gates one at a time, targeted tests locally, and stop only for the park list or any change to a device count. File the issue yourself (R146). Build on `issue-558-prod-check` so its evidence ships with this. Commit the crops for Ryan's hand check.

## Rulings (quote verbatim into rulings.md)

1. **Nothing floats over the map.** Every message that today shows in the search's floating list moves to the top of the right panel, under "Which road is the work on?":
   - the town notice (#543)
   - the weak-match "Closest match…" notice (#554)
   - the out-of-range line and the "Did you mean <lat>, <long>?" choice (#541)
   - "No match in Colorado…"
   - "Plans cover Colorado roads only."
   - any other line in that list (list each one you move)
2. **The look (T1).**
   - A box on `--pri-off`: one 13.5/600 line saying what happened, then one 13.5 `--ink-on-dark` line saying what to do next.
   - For a town, for example: "That search found a town, not a street." / "Tap the map on the road where the work starts. The roads near your tap show up here."
   - "Did you mean …" stays a real button inside the box, at least 44 px.
   - The road list (or "Tap the map to find the roads.") follows below it.
   - The box goes away when a pin is placed or a new search starts.
3. **Nothing moves.**
   - The map, the search row, the bar under the map and the footer move 0 px in every state.
   - The right panel's own content may shift down under the box; that's expected.
   - At 390, where the panel sits below the map, the box shows at the top of that section and the map still doesn't move.
   - Screen readers still hear the message (keep a live region).
4. Keep the wording of each message unless it's jargon, and list any change. Inter only, tokens only, no new hex, 44 px targets, axe clean. Unslop.

## Evidence

Capture at 1440, 1198x930 and 390: each moved message in its new place (town, weak match, out of range, "Did you mean", no match, outside Colorado). Run the 0 px size check across all of them, plus axe and the 44 px measure. Commit the crops.
