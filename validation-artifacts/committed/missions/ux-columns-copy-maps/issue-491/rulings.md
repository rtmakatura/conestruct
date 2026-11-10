# #491 rulings: plain-sentence failure copy

Mission `ux-columns-copy-maps` (tracking #494). Branch `issue-491-failure-copy`, stacked on `issue-490-columns-end-together` (f3ceb4b).

## Sources

- Ryan's brief, verbatim: "Plain-sentence failure copy (Inter, group 1 rules): the aerial failure ("The map didn't load. Edit on map shows the work zone." or truer wording you trace) and the side question's "the road's sides are unavailable…" (e.g. "We couldn't load this road's sides. Reopen the map to try again.")."
- Group 1 ruling 2 (`validation-artifacts/committed/ux-group1-spacing-text/rulings.md:7`): "**Mono is for short labels only.** ... Every full sentence moves to Inter: 13.5 px `--ink-on-dark` for the main helper line, 12.5 px `--ink-faint` for secondary lines and the footer. No new font sizes and no new hexes".
- Unslop rules (`docs/style.md`): "every sentence makes a real claim".

## The trace

Line numbers below are at the base, f3ceb4b (before this diff), unless marked otherwise. This diff adds three lines above `AERIAL_FAILED` in `BandAerial.tsx` and three above `SIDES_FAILED`'s use in `WhereQuestions.tsx`, so later lines there sit 3 lower after it.

### The aerial failure (`AERIAL_FAILED`)
- Shown on three states (`conestruct/site/components/bands/BandAerial.tsx:428-434`): the geometry read failed, the aerial was refused for a reason other than `corridor_unbuildable`, or the aerial read failed. In the last two, no picture of this pin is on screen, so "The map didn't load" is true from the operator's side.
- One exception, found in review and pre-existing (the old string was wrong the same way): with the cross-street question open, `pinFrame={crossOpen}` (`WhereBand.tsx:919`) forces `stage = "pin"` (`BandAerial.tsx:368`). The pin picture needs no geometry, so it can load while the geometry read is in `error`; the note is then `AERIAL_FAILED` (`:428`) drawn over the loaded `<img>` (`:605-610`). There the line says the map didn't load while it did. That is a logic fix, outside this copy-only item: filed as #500.
- "Edit on map" (`BandAerial.tsx:576-586`) calls `openMap` (`WhereBand.tsx:632-635`), which opens the picker (`GeneratorSidebar.tsx:584`).
- The picker opens centred on the pin: `initialCenter = initialHasPin ? [initial.lng, initial.lat] : DEFAULT_CENTER` (`LocationPickerModal.tsx:979-981`).
- The picker does NOT always show the work zone. It runs its own geometry read (`LocationPickerModal.tsx:522-524`) and draws only from that answer; before the side is confirmed it draws "the pin and one sentence, nothing else" (`LocationPickerModal.tsx:532-533`, `:1676`), and if its own read fails it draws no corridor. So Ryan's example "Edit on map shows the work zone" is false before the side is confirmed, and the old "shows the corridor" is false then too.
- What always holds: Edit on map opens the big map at the pin. "the big map" is the band's existing word for the picker (`AERIAL_BIG_MAP = "Use the big map instead"`, `BandAerial.tsx:93`).

### The side line (`side-control-note`)
- Shown when the band's geometry read is in `error` and no side options exist (`WhereQuestions.tsx:340-346`). The band's geometry is the sidebar's `useCorridorGeometry(geometryRequestFor(scenario))` (`GeneratorSidebar.tsx:208`), handed down as `shellGeometry` (`WhereBand.tsx:485-488`).
- That hook reads again only when its key, the scenario's JSON, changes: the effect's dependency list is `[key]` (`lib/corridor-geometry.ts:323`, `:353`). A failed answer is not cached (`geoCache.set` runs only on `r.ok`, `corridor-geometry.ts:300`), so any scenario change does read again.
- Reopening the map and closing it with Cancel (`GeneratorSidebar.tsx:607`, `onCancel={() => setPickerOpen(false)}`) changes nothing in the scenario, so the band does not read again. The picker's own read (`LocationPickerModal.tsx:522`) is a separate hook; its success lands in `geoCache` but the band's effect does not re-run on the same key.
- A picker save re-reads only when it changes the scenario's JSON (`GeneratorSidebar.tsx:367-389`): a moved pin always does (`withPin`), a same-pin re-save only if a written field differs. That is not something the line can promise.
- So "Reopen the map to retry" (today) and "Reopen the map to try again" (Ryan's example) both promise a retry that a reopen alone does not run. No control on the band retries the geometry read today.

## Calls

1. **R145 self-ruled: the aerial failure reads "The map didn't load. Edit on map opens the big map at your pin."** Ryan's brief asks for truer wording where the trace disagrees; the trace above shows "shows the work zone" fails before the side is confirmed and when the picker's own read fails, and "opens the big map at your pin" holds in every case (`LocationPickerModal.tsx:979-981`). It opens the same way as NeedsYouMap's `MAP_FAILED` ("The map didn't load. ...", `NeedsYouMap.tsx:28`), so the two failures read in one voice (P2).
2. **R145 self-ruled: the side line reads "We couldn't load this road's sides."** Ryan's first sentence, verbatim. His second sentence is dropped because the trace shows a reopen does not run the read again; a recovery line that doesn't recover is a stale promise (Rule 10: honest refusal beats silent substitution). The aerial failure line sits in the same band in the same state (both read the one geometry answer, `WhereBand.tsx:488`, `:914`) and still points to the big map. A real retry is a behaviour change, filed as a follow-up rather than folded (needs a new control, outside a copy fix).
3. **R145 self-ruled: the aerial's centre note moves from mono to Inter.** The note box is `a-aerial-note tr-prov` (`BandAerial.tsx:736`); `.tr-prov` is `var(--font-mono)` (`app/globals.css:2724-2725`). Group 1 ruling 2 moves every full sentence to Inter at 12.5 for secondary lines; the box takes `.tr-note` (Inter, `--fs-field-label` = 12.5, `globals.css:2746-2750`), an existing role, so no new size or hex. Every string the box shows is a full sentence (the wait, the refusal, the failure), so the whole box moves, not only the failure. The box is absolutely centred over the frame (`globals.css:6108-6118`), so the frame and #490's foot are untouched. Its colour stays `--ink` (the box's own rule comes later in the file at equal specificity).
4. **R145 self-ruled: the side line already renders in Inter** (`tr-note wq-line`, `WhereQuestions.tsx:342`); only its words change.
5. **R145 self-ruled: NeedsYouMap's `MAP_FAILED` stays.** "The map didn't load. Your answer still works without it." is already two plain sentences in Inter (`tr-help`, `NeedsYouMap.tsx:115`), and its second claim is a different, true one there (the NEEDS YOU answer doesn't need the map). Nothing in the group 1 rules or the unslop rules asks for a change.
6. **R145 self-ruled, follow-up filed: the aerial's other sentences in mono.** `a-aerial-held` (`BandAerial.tsx:652`) and the two `a-aerial-line` sentences (`:782`, `:785`, the kind-owed line and the approach words) are full sentences still in `.tr-prov`. The `a-aerial-line` sentences sit in flow under the frame, and the band's slot is sized for one `.tr-prov` line (`globals.css:10026`), so moving them changes line height and touches #490's foot; that fails the brief's "don't alter layout". Filed as #499.
7. **Follow-up filed: a real retry for the failed geometry read**, #498 (call 2).
8. **Follow-up filed: the failure note over a loaded pin picture during the cross-street question**, #500 (the trace's exception; bug, priority-medium, Rule 10).

## Lane

`python scripts/cosmetic_lane_check.py` (default, against origin/main) reads the whole stacked chain and says OUT OF LANE on #490's backend files; on this item's own paths (`--files`, the diff from f3ceb4b plus this folder) it says `IN LANE: all 7 paths are frontend look-only`. The full vitest ran as well.
