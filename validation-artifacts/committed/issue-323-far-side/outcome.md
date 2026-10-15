# Rule 5 outcome: TA-23's far side (the left-turn bay), wired

The prediction is `prediction.md`, committed in `a117536` before any backend code.

## Predicted and found

| Predicted | Outcome |
|---|---|
| `turnBayStorageFt`, above 0 and at most 20,000 ft, no default, passed to `turn_bay_storage_ft` | Done. Pinned: 0, -50 and 20,001 get a 422; an absent field parses to None |
| Without storage, a left far-side plan gets a 400 with `turn_bay_storage_missing` and a message naming the field | Done on every route (pinned: pdf, audit, markdown). `CrossStreetStationError` carries its code; `render_api` sends `detail.error = exc.code`. `LEFT_LANE_FAR_SIDE_MESSAGE` is deleted |
| Taper end = max(work zone + buffer, curb + storage + 100) | On Broadway (40 mph, 300 ft): taper end 5,167.5 = curb 4,767.5 + 300 + 100. Opening 100 ft (pinned) |
| Bay cones from curb + storage to the curb; nothing in the opening | Pinned: the bay's cones end exactly at both ends, and no cone or drum stands in the opening |
| R3-7L pair at the taper end: island and far curb | Pinned: both at the taper end, at the closed lane's center and at -4.0 ft |
| Arrow board, pointing right, at the work zone's upstream end | Pinned: exactly one arrow board, at station 2,000, `RIGHT_ARROW` |
| Advance series W4-2L / W20-5L from the taper | Pinned: W4-2L at A, W20-5L at B, no R codes |
| R3-7L in `sign_codes` | "LEFT LANE MUST TURN LEFT"; device summary: R3-7L × 2 |
| TA-23 on the plan sheet and in the audit | Pinned: page 1 text "TA-23"; audit `summary.ta` = "TA-23" (every other far side keeps TA-22) |
| Plan NOTES line, "entered by operator" | Pinned: "LEFT-TURN BAY STORAGE 300 FT, ENTERED BY OPERATOR (MUTCD TA-23 NOTE 5); NOT CHECKED BY THIS TOOL." Page 1 containment is 0/0/0 (pinned), left and right (`page1/`) |
| Audit `turn_bay` block, `provenance: "entered by operator"`; the `left_turn_bay` item replaces `left_lane_mirrored` | Pinned. The block's sentence prints in the audit PDF (`audit_blocks._approaches_blocks`) and the panel (`AuditTrail.approachesItem`, vitest-pinned) |
| Crew sheet: the bay, its entered length and the R3-7L pair | Pinned: "reopens as a left-turn bay (MUTCD TA-23)", "300 ft, entered by the operator", "place LEFT LANE MUST TURN LEFT (R3-7L) twice", and the arrow board at the work zone. The sign schedule has an R3-7L row |
| Byte-identical everywhere else | `parity323f.py`: 107 scenarios × 9 routes = 963 responses (`p323f-before.json` at `a117536`, `p323f-after.json`). Only `ni-left-far-nostorage` (400 → 400, new code and message) and `ni-left-far-300` (400 → 200 on all 9) differ. A right far-side plan and a left near-side plan carrying the field equal the same plans without it |
| Test flips | `test_the_far_side_is_refused_and_names_the_fix` becomes `test_the_far_side_without_a_bay_length_is_refused_and_names_the_field` |

## Not predicted

- **No frontend code-to-pointer mapping.** The prediction planned `matchRefusalCode` → a pointer, with the rail routing the refusal to Cross street. Without a pointer, the banner shows the backend's whole message, "Enter the left-turn bay storage length under Cross street. …", with the pill NEEDS INPUT (`StatusBar.tsx`). That names the field better than a pointer would. Not built.
- **#327 still covers it in the browser.** Until #327 lands, the left-side mirror arms its `work_side` pointer on every left plan, so the banner shows that pointer over this message. #327 is next, on a branch stacked on this one.
- **A blank line in the crew markdown.** The first run of the R3-7L sentence's `{% endif %}` swallowed a newline (the template trims blocks), so every near-intersection plan's markdown lost a blank line. Caught by parity; fixed with the template's `{% endif +%}`. The table above is the run after the fix.
- **Page 1 draws the far side's approach off-page.** That's true of every far-side plan, right ones included: the schematic's frame is the midblock taper. So R3-7L lists first under "ADVANCE WARNING SIGNS (off-page upstream of taper)", at 2,582 ft from that frame's taper start, as the right plan lists W4-2R at 2,662 ft. This is existing behavior, unchanged here.

## Suites

- **pytest:** 2,895 passed, 2 skipped, 1 failed. The failure was `test_audit_endpoint.py::test_audit_completes_with_check_unavailable_when_overpass_stalls`, a timing test, and the parity harness was running at the same time. Run alone, `tests/test_audit_endpoint.py` passes all 157. That run predates the `{% endif +%}` fix, so the crew-touching tests were rerun after it: 9 passed.
- **New tests:** `tests/test_left_turn_bay_ta23.py`, 15 tests.
- **mypy:** `src`, 0 issues (49 files).
- **ruff:** format and check clean.
- **vitest:** 2,305 passed (2,303 + 2 new).
- **tsc:** clean.
