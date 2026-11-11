# #488 outcome: "Edit on map" says why the side is asked again

Rulings and the Rule 5 prediction: `rulings.md` (this folder). Built on `issue-489-move-walk-pick` at `173f30b`.

## The change

`conestruct/site/components/bands/WhereBand.tsx` (+16 lines): with the Edit panel closed, a scenario write that clears the answered side while it moves the pin or changes the confirmed road marks the side re-asked, so the side question shows #485 E2's line, "Your edit changed the road or the work start, so this is asked again." (`EDIT_REASKED`, `WhereQuestions.tsx:73`, unchanged: one producer, its render condition unchanged). The line goes when the side is answered again or the Edit panel opens (the existing rules). The cause is read from the scenario, not the door, so the reason is always true (G1).

## Rule 5: prediction against the diff

- Predicted: `WhereBand.tsx` only, about 20 lines, a ref and one effect. Actual: `WhereBand.tsx` +16 lines, a ref and one effect. Matches.
- Predicted new test file `WhereBand.edit-on-map-line.test.tsx`. Actual: as predicted, 4 tests.
- Byte-identical as predicted: `WhereQuestions.tsx`, `BandAerial.tsx`, `GeneratorSidebar.tsx`, CSS, `type-exceptions.ts`, every wire field and request, the API routes, the backend, device counts. The walk read the same band height and aerial frame at 1440 before and after (below).

## Tests

- **Red** (the new file on the unfixed `WhereBand.tsx`): `Tests 2 failed | 2 passed (4)`. Both fails are the line: "AssertionError: expected  to have a length of 1 but got +0" (the count of `edit-reasked-note` nodes) for the moved pin and the changed road. The two negatives (a Save that changes nothing; a move while the side is unanswered) passed, as they should on today's code.
- **Green:** the new file `4 passed (4)`. The affected files (every `WhereBand.*.test.tsx`, the `GeneratorShell` cross-street-tap, picker-close-landing, picker-reapply and where-confirm-card tests, `GeneratorSidebar.manual-pin-move`): `Test Files 16 passed (16)`, `Tests 143 passed (143)`.
- `tsc --noEmit` clean; `next lint` on the two changed files: no warnings or errors.
- Found while writing the test: after a Save, the last geometry read on the wire can be a load-ahead read (#456 M12, one per side answer, each carrying that answer), not the scenario. So the test checks that a read for the moved pin with no side was made, not that it was the last one. This is existing behaviour and was not changed.

## The local walk (Overpass stubbed)

`next dev` on :3488 (`MODAL_RENDER_URL=http://127.0.0.1:8488`) against `scripts/verify-generate-cls-stub.py` on :8488 with ux-group3-where's and ux-site-map's recorded Overpass answers; `/api/road-bearing` stubbed from the Colfax fixture; real Mapbox images from the local token. Chromium, DPR 1. The script is adapted from #485's `script/walk.mjs`. Steps: A the questions answered → B "Edit on map" (the aerial's corner) → another address → Save & Close → C the side answered again → D "Edit on map" → Save & Close with nothing changed. The same walk was run on the unfixed `WhereBand.tsx` (base `173f30b`) for the before numbers.

| Size | Step | Band h, base | Band h, fixed | Right column h, base / fixed | Line |
| --- | --- | --- | --- | --- | --- |
| 1440x900 | A answered | 793.3 | 793.3 | 655 / 655 | none |
| 1440x900 | B Edit on map, moved | 793.3 | 793.3 | 655 / 655 | base none; fixed the one line |
| 1440x900 | C answered again | 793.3 | 793.3 | 655 / 655 | none |
| 1440x900 | D Edit on map, unchanged | 793.3 | 793.3 | 655 / 655 | none, side kept |
| 390x844 | A answered | 932.5 | 932.5 | 519 / 519 | none |
| 390x844 | B Edit on map, moved | 843.3 | 896.8 | 519 / 572.5 | base none; fixed the one line |
| 390x844 | C answered again | 932.5 | 932.5 | 519 / 519 | none |
| 390x844 | D Edit on map, unchanged | 932.5 | 932.5 | 519 / 519 | none, side kept |

- **1440 (two columns, #469):** the band is 793.3 px and the aerial frame the same box in the band (411 x 655 at left 297, dy 97.5) in all four steps, before and after. The line takes room inside the fixed column, so nothing moves. In every step the kind stays answered ("What kind of work is it: Shoulder work").
- **390 (one column):** #469 sets no height in one column (#485 E8, repair cycle 1), so the band follows its content. The line adds 53.5 px to the right column at step B (896.8 vs 843.3). The rest of the step-B drop (A 932.5 → B 843.3 on the base too) is the aerial's key ("Work zone" / "Faded…"), which draws only while the side is answered. That is existing behaviour and is the same before and after. The strip (328 x 150, `position: sticky`) is the same box in every step.
- **Page errors:** 0 at both sizes, before and after.

Crops (`crops/`): `1440x900-02-B-edit-on-map-moved.png` and `390x844-02-B-edit-on-map-moved.png` (the re-asked side with its line after "Edit on map"), `1440x900-04-D-edit-on-map-unchanged.png` (nothing changed: the side kept, no line). The rest are in `validation-artifacts-extra/move-walk-side-line/` in the main checkout (untracked).

## Lane check

`python scripts/cosmetic_lane_check.py` against the branch base (`origin/main`, which takes in the whole mission chain): "OUT OF LANE: 1 of 41 paths fall outside" (`scripts/verify-columns-end-together.mjs`, from #489 on the base, not this item). With `--files` on this item's three paths: "IN LANE: all 3 paths are frontend look-only". The path check can't see that this changes when a line shows (a behaviour change, Rule 5), so the item runs under the full gates.
