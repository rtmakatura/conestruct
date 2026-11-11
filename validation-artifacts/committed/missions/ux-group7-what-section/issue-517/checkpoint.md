# #517 checkpoint: the What section, guesses first

Mission `ux-group7-what-section` (tracking #518). Branch `issue-517-what-section`, stacked on `issue-507-prod-check` at `7a77005`.
Ruling: `docs/prompts/cc-prompt-ux-group7-what-section.md` (Ryan, 2026-11-11, boards `B` and `D`). No park-list item was hit before code, so this checkpoint records the traces and the plan; R145 self-rulings are in `rulings.md`.

## Baseline (before any change)
`npx vitest run` on `components/WhatBand.*.test.tsx`, `components/bands/PlanDetails.test.tsx`, `components/bands/untouched-provenance.test.tsx`, `components/GeneratorForms.a11y.test.tsx`: 111 passed (111).

## Traces
- **The section today:** `conestruct/site/components/bands/WhatBand.tsx` (two columns, "The road" / "The job"), rows beyond the first three in `components/bands/PlanDetails.tsx`, the row shell in `components/bands/FieldCell.tsx`, the markers in `lib/scenarios/provenance-marker.ts`.
- **Where each guess is made (ruling 2):** `lib/scenarios/guesses.ts`. Every guess carries a record in `scenario.guesses`, the raw fact the backend re-derives and refuses when stale (R110 Q1):
  - Road type: `roadTypeGuessFor` (guesses.ts:335). Basis: the confirmed road's map tag (`highway_class`) plus whether the area around the pin is built up (`isUrban`). Record `guesses.road_type`.
  - Street class: `reconcileStreetClass` (guesses.ts:101). Basis: the road's map tag through the backend class table (`src/rules/street_class.py`, mirrored in `suggestStreetClass`). Record `guesses.street_class`.
  - Jurisdiction: `applyJurisdictionGuess` (guesses.ts:392). Basis: the backend boundary lookup at the pin (`JurisdictionSuggestion`, lib/jurisdiction.ts:233). Record `guesses.jurisdiction_key` (the pin it ran at).
  - Speed (R126): `speedGuessFor` (guesses.ts:160). Basis: the road has no readable posted speed, so the estimate for its map tag is used. Record `guesses.speed`.
- **How "changed or confirmed" is stored today (ruling 3):** an operator pick drops the guess record (`setStreetClassByOperator`, `setJurisdictionByOperator`, `setSpeed`) or adds `meta.operatorSet` (`setRoadType`, what-writes.ts:104, only when the value changes). Nothing records "checked" as its own fact, and the record is part of the wire.
- **Carriageway vs group 8 (ruling 4):** the map window (`components/bands/WhereQuestions.tsx:64` `loneSideLine`, `LocationPickerModal` road list) READS the carriageway verdict (the backend's `/render/road-travel` reading on the candidate, else the scenario's relayed `carriageway` facts) for its words. It never writes `carriageway.confirmed`. The only writer of the answer is the WHAT section's Carriageway field (`PlanDetails.tsx:404-425`). `carriagewayVerdict` reads that answer first, so the map window's side line and the field already speak from one fact.
- **A listbox on the page (ruling 6):** none. No `role="listbox"` or `role="option"` in `components/`, `app/` or `lib/`.
- **A date picker (ruling 7):** none. The section uses `<input type="date">` (WhatBand.tsx:806-831).
- **Windows data (ruling 7):** `windowsSummary` (components/ScheduleField.tsx:189) words the backend's `hours_eval` verdict; `ScheduleWindows` is #227's table of the backend's windows. Both stay the producers.
- **Type scale:** 19 px (`--fs-step-question-520`), 15 px and 12.5 px (`--fs-field-label`) are already declared (app/globals.css:36-41), so no new size is needed.
- **Tokens for the guesses box:** `--vd-flag-ground` and `--vd-flag-line` (app/globals.css:964-965) already exist; `--pri-off` (952) for the selected option.

## Plan
1. Problem: WhatBand.tsx:563-905 gives every field one weight, mono jargon markers, a mashed footer line, native selects and a native date input.
2. Rulings: the prompt's nine (verbatim in rulings.md), plus the R145 self-rulings there.
3. Change: rebuild the section in board `B`'s order (guesses box, About the work, Measured from the map, File details), a plain source line with a why tip per field, one shared listbox, one date-range picker with the hours result under it.
4. Rule 5 churn: see rulings.md § Churn prediction.
5. Proof: red-proved vitest for the box, the Checked state, the listbox and the picker; tsc; crops at 1440, 1198x930 and 390; axe and the 44 px measure; the string table.
