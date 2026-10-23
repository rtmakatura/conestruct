# #379 rulings: a flagger plan's arrow board is caution mode only

Issue: https://github.com/rtmakatura/conestruct/issues/379. Branch `issue-379-flagger-arrow-board-caution`, built on the #371 evidence branch `issue-371-prod-check` (`48bf3aa`).

## Sources (quoted from `audit-lane/oracle-sources.md` L14, pages checked there)
- MUTCD 11th Ed. §6L.06 ¶18 (Standard), p. 833: "For shoulder work, for blocking the shoulder, for roadside work near the shoulder, or for temporarily closing one lane on a two-lane, two-way roadway, an arrow board shall be used only in the caution mode."
- §6L.06 ¶17 (Standard), p. 833: "An arrow board in the arrow or chevron mode shall be used only for stationary or moving lane closures on multi-lane roadways."
- S-630-1 Sheet 2 General Note 26 says the same as ¶18.
- As drawn: Fig 6P-10 (p. 879) and S-630-1 Case 17 draw no arrow board.
- Denver: `data/jurisdictions/denver.json` delta "Arrow board required if closing one or more lanes", source DOTI PT-116.1 (2022-04-01, status verified), trigger `closure: ["lane"]`.

## R1 (R145 self-ruled): Denver's trigger sets the count, ¶18 sets the mode
The issue asked the session to record how it reads Denver's record against ¶18. Denver's rule requires a board; it says nothing about mode. ¶18 is a Standard that limits the mode on a two-lane, two-way road with one lane closed. The two don't conflict: the plan keeps the one board Denver requires and states caution mode only on every surface. No ruling needed: this is the issue's proposed solution, and both sources are quoted above.

## R2 (R145 self-ruled): the rule covers every jurisdiction's board, not just Denver's
`englewood.json` (arterial, collector), `greeley.json` (arrow_board_type_c; arterial, collector) and `lakewood.json` (arterial) carry the same lane-closure arrow-board rule, so they put the same board on a flagger plan with that class. ¶18 binds them the same way. The fix keys on "an arrow-board delta on a flagger plan" (`_is_flagger_scenario`, the one flagger predicate), not on Denver.

## R3 (R145 self-ruled): one producer
The name and the note sentence come from `src/rules/jurisdiction.py` (`_caution_name`, `ARROW_BOARD_CAUTION_NOTE`). The name keeps the record's own device name and adds the mode: "Arrow Board (caution mode only)"; Greeley's "Arrow Board (Type C)" becomes "Arrow Board (Type C, caution mode only)". They are set on the shared delta row (`display_override` and the new `AggregatedDeviceRow.mode_note`). Page 1, the device XLSX, the quote XLSX, the breakdown (and the audit's `include_breakdown`) and the crew sheet all read that row. The audit's rule entry carries `device_label` "Arrow board (caution mode only)" and a new `mode_note` key, only on this case.

## R4 (R145 self-ruled): the crew sheet doesn't give the board a station
No source places an arrow board on a flagger closure: Fig 6P-10 and Case 17 draw none, and ¶19's "beginning of the merging taper" is a merging-taper rule (a flagger plan has a one-lane, two-way taper instead). Giving a station would be an unsourced number (Rule 12). The crew sheet lists the board, says caution mode with the cite, says the drawing doesn't place it and why, and leaves the position to the Traffic Control Supervisor (Rule 10: say so rather than invent a value). Setup: a paragraph at the end of step 6, so the board is in place before step 7 staffs the stations. Takedown: a new step 6, after the signs come down. **Flag for Ryan:** if a placement source turns up, the position can be added.

## R5 (R145 self-ruled): scope of the crew-sheet listing
The crew sheet adds only delta rows that carry a one-mode note (this board). Other delta-only rows, such as Thornton's "Advance Warning Signs" on every Thornton plan, are also missing from the crew sheet today, but adding them would change shoulder and near-intersection crew sheets, which this issue keeps unchanged. Filed as its own issue (link in the close comment).

## Rule 5 churn (predicted before the diff, measured after)
Predicted: only flagger plans whose jurisdiction rule adds an arrow board change (Denver; Englewood/Greeley/Lakewood on their classes), on page 1, device XLSX, quote XLSX, crew sheet (md and PDF), breakdown and the audit's breakdown. Byte-identical: every other plan.
Existing tests that pinned the old name on a flagger plan moved with it (3, not listed in the prediction above; recorded as a Rule-5 miss): `test_jurisdiction_rules.py::test_greeley_arterial_end_to_end_adds_arrow_board`, `s630/test_cross_surface_device_summary.py::test_greeley_arterial_flagger_delta_reaches_all_three_surfaces`, `s630/test_cross_surface_quote_delta.py::test_denver_flagger_arrow_board_prices_on_quote_workbook`. The full suite caught a first-cut bug through them: the Greeley row had lost "Type C". Fixed by `_caution_name`.
Measured (`churn.py`, `churn.json`, base `48bf3aa` vs the branch; XLSX timestamps masked): flagger Denver/Englewood/Greeley/Lakewood changed md, xlsx, quote, breakdown. Identical: flagger with no jurisdiction, Thornton, Parker; shoulder for all seven; near-intersection Denver (Broadway). `/render/audit` without `include_breakdown` is identical (the board is in the breakdown, not the plain audit). Matches the prediction.

## Evidence
- `tests/test_flagger_arrow_board_caution.py`: 13 tests through the real endpoints. Red on `48bf3aa`: the 10 new-behavior tests fail and the 3 unchanged-plan guards pass.
- `page1-device-summary-denver-flagger.png`, `page1-device-summary-greeley-flagger.png`: page 1's device summary; both names fit on one line.
