# #488 rulings: "Edit on map" says why the side is asked again

Mission `move-walk-side-line` (#494), item #488. Branch `issue-488-edit-on-map-line`, built on `issue-489-move-walk-pick` at `173f30b`.

## Ryan's instruction for this item (mission brief, 2026-11-10)

Take #488's second option: keep "Edit on map" as the picker's direct door, and have the band show #485's line ("Your edit changed the road or the work start, so this is asked again.", #485 E2, from its one producer) when a picker Save from that door clears the side.

## The rulings it rests on, quoted

- **#440 ruling 2** (Ryan, 2026-11-04; `validation-artifacts/committed/ux-group4-cross-street/rulings.md:8`), the part that governs: "If the kind is changed after the side is answered and the side's options change, the side answer is cleared and re-asked with one line saying why ("The sides changed with the new kind of work."); if they don't change, it stays."
- **#440 X21** (same file, line 44): "When X20 clears the side, the side question shows Ruling 2's line, "The sides changed with the new kind of work.", as a plain note (no ⚠; nothing is wrong, it says why the question is back). The line goes when the side is answered again."
- **#485 ruling 3, third bullet** (Ryan, 2026-11-09; `missions/ux-token-map-load-edit/issue-485/rulings.md:10`): "Back on the questions, any answer the edit invalidated is cleared and re-asked with one line saying why, per #440 ruling 2's rule. Every other answer stays."
- **#485 E2** (R145 self-ruled, same file line 38): the line is "Your edit changed the road or the work start, so this is asked again.", for the re-asked side only, a plain note like X21, shown while the side is unanswered, gone once it is answered; X21's line wins when a kind change cleared the side.
- **#485 E5** (same file line 41): "Edit on map" was left as the picker's direct door with no line; filed as #488.
- **#290 ruling 10** (Ryan; `validation-artifacts/committed/issue-290-pin-work/rulings.md:153`): "Pre-change plans and fixtures open with side unset, marked needs-you; never silently re-read." Built as `withoutSide` / `withPin` (`conestruct/site/lib/scenarios/site-corrections.ts`: `withoutSide` at 201-205, whose doc comment cites ruling 10; `withPin` at 190-197): a moved pin or a different road clears the side, so it is asked again.

The plan matches #440 ruling 2: the answer the edit invalidated (the side) is cleared, as today, and re-asked with one line saying why; every other answer stays. Nothing here reverses a Ryan ruling.

## R145 self-ruled (CC, 2026-11-10)

- **G1, what shows the line: the cause, read from the scenario, not the door.** Outside the Edit panel, when one scenario write takes the side from answered to unanswered *and* in the same write the pin moved (`meta.lat` / `meta.lng`) or the confirmed road changed (`meta.confirmedRoad.candidate.way_id`), the band marks the side re-asked and the side question shows #485's line (`EDIT_REASKED`, `WhereQuestions.tsx:73`, the one producer; no second copy). Reading the cause makes the line true by construction (Rule 10): the only writes that do both go through `withPin` / `withoutSide`: the picker Save (`GeneratorSidebar.tsx:367-371`) and the no-map fallback's typed Latitude / Longitude (`components/bands/ManualFallback.tsx:63,74`, shown only without a Mapbox token; a typed move is a moved work start, so the line is true there too). So the line follows every picker Save outside the panel that clears the side: "Edit on map" on the aerial's corner (the ask), the same-labelled fallback button shown when there is no aerial (#439 W11, same handler `openMap`), and "Use the big map instead" (#440 ruling 4) when the side was already answered. All three are the same edit with the same true reason; scoping to one door would leave the other two with the same silent clear #488 describes. Stated as a deliberate behaviour change (Rule 5).
- **G2, what does not show it.** A Save that keeps the pin and the road (nothing changed) keeps the side and shows nothing. A move made while the side was unanswered shows nothing (nothing was cleared). The side's own Undo, a kind change (X20, which shows X21's line instead, unchanged), and the Edit panel's Cancel move neither the pin nor the road, so they show nothing. While the Edit panel is open the panel's Done keeps deciding (E1/E2 unchanged); this rule only runs with the panel closed.
- **G3, when the line goes.** As X21 and E2: when the side is answered again (the existing effect, `WhereBand.tsx:594-596`), and when the Edit panel opens (the existing reset; Done then re-derives from the panel's own before/after).
- **G4, layout.** The line is the same node E2 already renders under the side question in the CONFIRM card's right column. No new string, size, colour or element. The band height and the aerial frame are #469's fixed `--wq-band-h` in two columns; measured in the walk, not asserted.

## Rule 5: churn prediction (written before the diff)

- **Changes, deliberately:** `conestruct/site/components/bands/WhereBand.tsx` only, about 20 lines: a ref holding the last scenario and one effect implementing G1. After a picker Save outside the Edit panel that moves the pin or changes the road while the side was answered, the side question shows "Your edit changed the road or the work start, so this is asked again." Today it shows no line.
- **New test file:** `conestruct/site/components/bands/WhereBand.edit-on-map-line.test.tsx` (mounted flow through `GeneratorShell`, the picker stubbed as in `WhereBand.edit-turns.test.tsx`): moved pin and changed road through "Edit on map" show the line, side cleared, kind kept; a Save with nothing changed shows no line and keeps the side; answering the side again drops the line.
- **Byte-identical:** every wire field and request body (the side was already cleared by the existing Save; this adds only a rendered note), every API route, the backend, every device count, `WhereQuestions.tsx` (the string and its render condition are unchanged), the Edit panel's behaviour, X21's line, `BandAerial.tsx`, `GeneratorSidebar.tsx`, CSS, `type-exceptions.ts` budgets.
- **Evidence:** this folder (`rulings.md`, `outcome.md`, key crops).
