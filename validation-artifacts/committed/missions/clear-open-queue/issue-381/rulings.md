# #381 rulings: the crew sheet lists every row a jurisdiction rule adds

Issue: https://github.com/rtmakatura/conestruct/issues/381. Branch `issue-381-crew-sheet-delta-rows`, stacked on `issue-385-scenario-defaults-comment` (`486a364`). Mission tracking issue #387.

## Source
- `data/jurisdictions/thornton.json:53`, source "Thornton Construction & TC Permit handout", stipulation 6, status verified: "CONSTRUCTION AHEAD and MEN WORKING signs required for each direction of travel affected (stipulation #6)." Effect `add_device` `advance_warning_signs`, no trigger, so it fires on every Thornton plan.

## R1 (R145 self-ruled): the equipment list comes from the XLSX's rows
This is the issue's proposed solution. `build_narrative_context` (`src/narrative/crew_narrative.py`) reads `aggregate_device_rows_with_deltas`, the walk the device XLSX, the quote and page 1 apply.
- A delta-only row (`display_override` set) is listed under the XLSX's "Device type" name. That name now has one producer, `delta_row_name` (`src/rules/jurisdiction.py`), which the device XLSX, the quote XLSX and the crew sheet all call. For Thornton the name is "Advance Warning Signs (jurisdiction-required)". The XLSX and quote strings are byte-identical to before.
- A topped-up placed row adds the rule's `jurisdiction_added` to that device type's count. The crew sheet's total for the type then equals the sum of the XLSX rows of that type. No plan built so far tops up a count (`predict.json`): Thornton's night drum rule is already met by the layout. `test_a_topped_up_count_matches_the_xlsx` covers it with a 500-drum rule.
- #379's flagger arrow board stays as it was: same line, same step-6 paragraph, same takedown step.

## R2 (R145 self-ruled): what the crew is told about a device with no placement
The rule gives no position, and the drawing doesn't place the signs. Giving a station would be an unsourced number (Rule 12). The crew sheet quotes the rule with its cite, says it isn't placed, and leaves the position to the Traffic Control Supervisor (Rule 10), as #379 R4 did for the arrow board. No distance is stated, so this isn't the "safety distance with no source" park item.
- Setup, at the end of step 6 (the advance warning signs step, every kind):
  > Advance Warning Signs (jurisdiction-required). Thornton Construction & TC Permit handout, stipulation 6: "CONSTRUCTION AHEAD and MEN WORKING signs required for each direction of travel affected (stipulation #6)." Not placed on the drawing: the rule gives no position. The Traffic Control Supervisor sets the position per the permit.
- Takedown: "Also remove the Advance Warning Signs (jurisdiction-required)." is added to the step that removes the advance warning signs (step 4 on a flagger plan, step 1 on the others).

## R3 (R145 self-ruled): the other two callers the issue names
- `src/api/replication_snapshot.py` now passes the fired deltas to section 5 (the device XLSX) and section 6 (the crew sheet), so both match `/render/xlsx` and `/render/markdown`.
- `src/api/app.py`: nothing to pass. It builds `ScenarioParams(jurisdiction="CDOT")` and takes no `jurisdiction_key`, so no jurisdiction rule fires there.

## R4 (R145 self-ruled, R154 fold): the snapshot's device list gets the pilot car
Section 5 also left out the `pilot_car` that `/render/xlsx` passes (#373). The fix is one argument in a file this branch already touches, needs no ruling, and was added to the churn prediction before the measurement. Folded in.

## R5 (R145 self-ruled): the sign-set count is filed, not fixed
Every surface prints the Thornton row as 1 EACH, but the rule asks for two signs for each affected direction. The effect has no `qty`, and `_iter_fired_count_adds` defaults it to 1. The crew sheet now matches the XLSX's count, as the issue asks. Fixing the count needs a ruling on how "each direction of travel affected" maps to each plan kind, so it's filed: #388.

## Rule 5 churn (predicted before the diff, measured after)
Prediction, from the base tree's own row walk (`churn.py <base> predict`, `predict.json`, 342 bodies: shoulder, flagger and near-intersection (Broadway) × no jurisdiction and the 14 jurisdictions × street class none/local/collector/arterial × day/night):
- `/render/markdown` (and `/render/crew-pdf`, which renders the same Markdown) changes only where a fired rule adds a row with no mode note or tops up a placed row. That's Thornton only: all 24 Thornton bodies (8 per kind).
- `/render/replication-snapshot` changes on the 60 bodies with any fired count rule (Denver; Englewood, Greeley, Lakewood on their classes; Thornton). Sections 5 and 6 now carry the deltas.
- Amended before measurement for R4: two flagger bodies with `pilotCar: true` were added (no jurisdiction; Thornton). Predicted: the snapshot changes on both, and the Markdown changes on the Thornton one. Total 344 bodies: Markdown changes on 25, the snapshot on 62.
- Byte-identical: every other body. The device XLSX, quote XLSX, page 1, breakdown and audit don't change, by construction: `delta_row_name` returns the string those surfaces printed before. The churn run doesn't render them; the existing suite's cross-surface tests pin those strings.

Measured (`churn.py`, base `486a364` vs the branch, `churn.json`, dates and GIT_SHA masked): 344 bodies, 282 identical, 62 changed. Markdown changed on 25 bodies and the snapshot on 62. Both sets equal the prediction exactly. Every body answered 200. Matches the prediction.

## Evidence
- `tests/test_crew_sheet_rule_rows.py`: 15 tests through `/render/markdown`, `/render/crew-pdf`, `/render/xlsx`, `/render/replication-snapshot` and the rendered crew sheet. On base `486a364`, 11 fail. The 4 that pass there are guards: the 3 no-rule plans, and the Thornton shoulder snapshot's crew section (base left the row out of both).
- Full suite on the branch: 3569 passed, 2 skipped. The base count, 3554 passed, 2 skipped, is the one base `486a364`'s own commit message records; 3554 + 15 new = 3569. A rerun of the full suite on the base tree was stopped by the system for low memory and not repeated.
- `churn.py`, `predict.json`, `churn.json`.
