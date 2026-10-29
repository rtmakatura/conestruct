# Ryan's rulings on the round-3 questions (2026-10-29)

Ryan answered the report's Questions 1-5 and #432 in the mission session after the ship (`372f710`). His words are quoted, and each line says what it means for the next round.

1. **#429, the marker for a refused length:** "#429 yes (plain "yours", over-cap too)."
   - A refused length (negative, typed 0, over the 20,000 ft cap) carries a glyphless "yours". The over-cap case drops its "✓ yours" for the same marker.
   - DESIGN-SPACING.md § One glyph vocabulary records the glyphless "yours" for a refused value.
2. **#402, the side sentence:** "#402 side sentence: "Save, then say which side is occupied." in the picker only."
   - This replaces the #290 sentence ("Say which side is occupied to lay out the work"), but only in the picker: the map overlay and the panel. Copy elsewhere stays as it is.
3. **#425, the verb:** "#425: "not checked" only when no check ran; a check that ran and failed reads "check failed" (no red)."
   - This overturns call 2 of the self-ruling in `425/rulings.md`.
   - A declined plan, where no check ran, keeps "◌ not checked" and "not checked: the plan was declined; ...".
   - A check that ran and failed (5xx, network) reads "check failed", not red. Today it reads "not checked: the check didn't answer; ...", `is-error`, rgb(255, 122, 122).
   - Next round: the failed-check line and its colour, plus every other "no answer" line in the band that stands for a failed check.
4. **#426, the screen-reader edge:** "#426 and #402 Enter: keep." The announcement stays as shipped.
5. **#402, Enter on a pinned plan:** "keep" (same line). Enter opens the picker on the saved pin with the text unsearched, as the "Pick on map" button does.
6. **#432, typed decimals:** "#432: refuse decimals with "Use whole feet" instead of truncating."
   - A typed decimal stays in the box, and the field refuses it with "Use whole feet". It no longer turns into `parseInt`'s whole number.

Next round: #402 (the side sentence), #429, #432, the #425 failed-check line, then #410 and #418, built on `walkthrough-round-3-prod-check`.
