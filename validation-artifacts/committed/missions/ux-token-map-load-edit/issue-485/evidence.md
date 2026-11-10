# #485 evidence

Branch `issue-485-edit-questions-turns` on `issue-484-crossing-line` (`17009e3`). Rulings and self-rulings E1-E10: `rulings.md`. Plan and Rule 5 prediction: `checkpoint.md`.

## Tests

- Baseline on `17009e3`: vitest `278 passed | 1 skipped` files, `3012 passed | 1 skipped (3013)` tests.
- Red proof (`red-proof.txt`): the new `WhereBand.edit-turns.test.tsx` on the base code, 7 failed / 7; the extended `WhereBand.one-height.test.tsx` with the five product files put back to `17009e3`, the two new tests failed and the seven #469 tests passed.
- First full run after the change: 18 failed (`full-run-failures.txt`, with what each was). All real, none flaky; the six files passed alone after the fix (115 tests).
- Cycle 0 final: vitest `3019 passed | 1 skipped (3020)` (3012 + 7 new + 2 new in the permanent check − 2 dropped address-field doors).
- Repair cycle 1 (reviewer, Rule 10: the cross street was re-asked with a false reason): `doneEdit` re-asks only the side. New mounted test (a crossing cleared in the picker inside the panel: unanswered after Done, no line), red on the cycle-0 code (`red-proof.txt`, last section). Final: vitest `279 passed | 1 skipped` files, `3020 passed | 1 skipped (3021)` tests. The walk was not re-run: the repair changes only the cross-street case, and the walk doesn't go through it (its side re-ask is unchanged). `tsc --noEmit` clean. No backend Python touched, so pytest, mypy and ruff are not owed and were not run.

## The permanent check (ruling 4, bullet 2)

`conestruct/site/components/bands/WhereBand.one-height.test.tsx`, #469's two layers, extended:
- mounted: side answered → Edit → Cancel → Edit → a length typed → Done; in every state the stack keeps `data-aerial` and `data-card="open"` (`data-edit` while the panel is open), the aerial frame and the road row are the same nodes, and the CONFIRM card is the waiting row while the panel is open;
- CSS: in the two-column block, `.wq-stack[data-aerial][data-edit] > .wq-side` is `height: var(--wq-band-h)` (exact, not a minimum), the panel `flex: 1 1 auto; min-height: 0`, the waiting row `flex: none` at `min-height: 48px`; nothing in the narrow block keys on `data-edit`.

The measured 0 px is the walk below.

## The local walk (Overpass stubbed)

`next dev` on :3485 (`MODAL_RENDER_URL=http://127.0.0.1:8485`) against `scripts/verify-generate-cls-stub.py` on :8485 with ux-group3-where's and ux-site-map's recorded Overpass answers; `/api/road-bearing` stubbed from the Colfax fixture; real Mapbox images from the local token. `script/walk.mjs`; output `walk/walk.txt` and `walk/<size>.json`. Steps: A the questions answered (Confirm on screen) → Edit → Cancel; B Edit → length 600 → Done; C Edit → Move → the picker, another address → Save & Close → Done; D the side answered → Confirm (WHAT opens) → WHERE reopened → Edit → Cancel.

- **1440x900 and 1198x930:** the band is 762.5 px in all 12 steps, the right column 648 px in every step with the card or the panel, and the aerial frame the same box in the band in all 12 (411 x 624.3 at dy 97.5; left 297 and 176). The panel is 584 px and the waiting row 48 px. The waiting row reads "◌ Questions wait while you edit · 2 of 2 answered", then "1 of 2" after the Move (the side cleared); it is not a control (nothing focusable in or on it). After B's Done nothing is re-asked: both answers stay, the length reads 600. After C's Done the side is re-asked with "Your edit changed the road or the work start, so this is asked again."; the kind stays. After D's Confirm, reopening WHERE and Edit open the panel the same way.
- **390x844:** the frame is the pinned 150 px strip (`position: sticky`) in every question and panel state, so the panel and the row take their turn under it (#456). After Confirm the closed card shows the full 250 px picture, and an Edit then pins the strip again (E8). In one column the band has no fixed height (#469 is two-column; E8, repair cycle 1), so its height follows its content. The committed walk (`walk/walk.txt`, `walk/390x844.json`) read:
  - 885 px with the card (A, B, D-side-answered) and 889.5 px with the panel and the waiting row (A, B, C-edit). The right column is 519 vs 523.5 px.
  - 800.3 px after the Move's Save (C-moved; the right column still 523.5) and 849.3 px after its Done (C-done; the right column 572.5 with the re-asked line). The pin moved, so the aerial is a new picture. The band is shorter because the key under the picture hadn't drawn yet when the step was read; the `08-C-done-side-reasked` crop shows the picture without its key.
  - 737.5 px when WHERE was reopened after Confirm and again after Cancel (the closed card, the full 250 px picture), and 903.3 px with the panel open after Confirm (the strip pinned).
  The strip itself (the frame, 328 x 150 at dy 93.8 in the band) never moved in any question or panel state.
- **axe:** 0 violations on the band in all 36 steps.
- **44 px:** the only targets under 44 px are the aerial's zoom buttons (+ and −, 32 x 32) at 1440 and 1198. They are on main already and recorded there for the later spacing round (handoff.md, #439 open item 3). The panel's own targets all measure 44 px or more: Change, Move, the length field, its marker (given 44 px in the panel), Cancel and Done.
- **Page errors:** 0 at every size.

Crops for Ryan's hand check, `crops/<size>-<step>.png` at all three sizes: `01-A-questions-confirm`, `02-A-edit-panel` (the panel and the waiting row), `03-A-cancelled`, `04-B-length-typed`, `05-B-done-nothing-reasked`, `08-C-done-side-reasked` (the re-asked side with its line). Steps 06, 07 and 09-12 are in `crops/extra/` (gitignored).

## Rule 5: prediction against the diff

- **Files:** as predicted. `WhereBand.tsx`, `WhereQuestions.tsx`, `BandStack.tsx`, `GeneratorSidebar.tsx`, `globals.css`, the new `WhereBand.edit-turns.test.tsx`, `WhereBand.one-height.test.tsx`, and the three predicted test rewrites (`GeneratorShell.where-confirm-card.test.tsx`, `untouched-provenance.test.tsx`, `GeneratorShell.cross-street-tap.test.tsx`). `type-exceptions.ts` untouched (no new size).
- **Not predicted, inside those files:** (1) the panel keeps the fold's `a-cols > a-col` row shape for the length cell. The first build left it out, and `WhereBand.work-length.test.tsx` and `GeneratorSidebar.corridor-bar.test.tsx` caught it, so neither test changed. (2) Cancel rides `.tr-help` instead of setting its own font-size, because the census caught that. (3) Inside the panel, the length marker's hit box is 44 px instead of rule 15's 32 px, from the walk's 44 px measure. (4) Inside the panel, the cell's top rule is dropped, because the row above draws one.
- **Byte-identical:** the band with Edit closed, the band before a pin, the old fold with no card (a stale road), the picker and what its Save clears, the wire, the scan, the audit, device counts, PDFs and the backend.

## Known limit (E5)

"Edit on map" on the aerial's corner is still the picker's direct door. A Save through it clears the side as it does today (#290 ruling 10), but no panel is open, so no "back on the questions" line shows. The ruling's list of openers (Edit, Change, Move, the length field) doesn't name it, so it isn't changed here. Filed as #488 (https://github.com/rtmakatura/conestruct/issues/488).
