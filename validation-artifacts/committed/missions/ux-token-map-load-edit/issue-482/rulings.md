# #482 rulings

## Ryan, 2026-11-10 (answers to questions 3 and 4 of `validation-artifacts/committed/missions/ux-wait-band-followups/report.md`), as relayed in the mission brief, word for word

> (a) remove the outline's "20 seconds" note (`conestruct/site/components/ResultsOutline.tsx:27`, "The road check stops after 20 seconds. If it does, the page will say so and offer a retry.") so only the strip's 14 s sentence speaks; (b) the reference group's 40 px gap (`conestruct/site/app/globals.css:10295`, `calc(var(--space-section) + var(--space-block))`) becomes 24 px, using one existing spacing token.

## R145 self-ruled

**R145-1. Past 14 s the outline's note is empty.** "Only the strip's 14 s sentence speaks" is read whole: past `ROAD_SLOW_MS` the NEEDS YOU outline's note shows nothing, not the cold-start sentence it showed from 2 s to 14 s (that sentence, "…can take a few extra seconds…", would be a second number-like claim next to the strip's "up to 30 seconds"). From 2 s to 14 s the cold-start note is unchanged; nothing was ruled on it. The note's line stays reserved (`min-height: 3em`), so the empty note grows or shrinks nothing. `ROAD_SLOW_NOTE` and the `.ro-note.is-slow` colour rule go with it (nothing else reads them).

**R145-2. Rule 10 and the retry stay covered without the note.** The note was a forecast ("the page will say so and offer a retry"). What it forecast is unchanged and is what the reader meets: when the road check does stop, the page's scan refusal container says so and carries **Retry scan** (`GeneratorShell.scan-refusal.test.tsx` pins it). While the call runs past 14 s, the strip's warn line ("This is taking longer than usual…", #477 answer 3) is the current, true signal that the wait is long. So no state renders as silence and nothing stale is presented as current: the note's removal drops a prediction, not a signal.

**R145-3. The settled reference group moves with its outline, to 24 under Downloads.** The 40 was CHOSEN in #477 only to put the outline where the settled group stands (39 px under Downloads, measured: the Downloads section's `mb-3` 12, the `.tier-cue` reserve 15, the group's 12). Setting only the outline to 24 would leave it 15 px above where the group lands, which breaks #470 ruling 2 (the answer swaps in without moving anything; the permanent check's 8 px top tolerance fails on the one-question fixture). Reversing that is a park item, so the gap is read as the group's gap on the page, outline and settled alike, and both become 24 (`--space-section`):
- outline: `.ro-refs` `margin-top: var(--space-section)`;
- settled: Downloads' own bottom margin is 0 inside `#downloads` (CSS, `.workbench #downloads > .dl-sec`), and the `.tier-cue` row is the gap itself: `min-height` and `line-height` `var(--space-section)`, `margin: 0`, so the "◌ previous answer, refreshing…" cue (#187, Rule 10) keeps a reserved line inside the 24 and still grows nothing when it appears; the group's own 12 top margin is dropped only where it follows that row (`.results-stack > :has(> .tier-cue) + .results-disc`). The group's 12 stays wherever it mounts without the results above it (the audit-error case), and its 24 bottom margin (#435) is untouched.

**R145-4. Measured, not assumed.** The stub walk (`scripts/verify-generate-cls.mjs`, one-question fixture, every top checked) is the proof of R145-3 at 1440, 1198 and 390.
