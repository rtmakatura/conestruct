# #367 rulings — a lane closure's buffer stops citing Sheet 7 Case 11

Mission: clear-open-queue (tracking #387). Base: `issue-369-aerial-content-type` (`70213f74`).

## Finding
- `src/api/audit.py`, buffer section, the `supplement_speed` branch keys on CDOT + 65/75 mph only. A lane closure at 65/75 mph without the Case 26/27 step-down (no work-zone speed, or 65 → 55, 75 → 70) reached it and read "… (Sheet 7 Case 11: buffer VARIES per General Note 24)" in `lookup_text` and "CDOT S-630-1 Sheet 7 Case 11 (buffer VARIES per General Note 24)." in `source`.
- Case 11 is a shoulder case: S-630-1 (`validation-artifacts/s630-1-2026.pdf`), PDF p. 155 (Sheet 7) titles Case No. 11 "Shoulder Work - Freeway/Expressway". Sheet 14 (PDF p. 162) titles Cases 26/27 "Shoulder Work - Freeway/Expressway w/ 65 MPH Speed Limit" and "… w/ 75 MPH Speed Limit".
- Unreachable on the live API: `lane_closure_divided` is gated, and flagger and near-intersection cap at 55 mph. Proven at the producer level (Rule 11: the real generator and `build_audit_trail`).

## The distance doesn't change (not a park)
- The buffer value was and stays MUTCD Table 6B-2 at the posted speed. MUTCD 11th Ed. (`validation-artifacts/ta10_flagger/mutcd_part6.pdf`), printed p. 775 / PDF p. 11, "Table 6B‑2. Stopping Sight Distance as a Function of Speed": "65 mph 645 feet … 75 mph 820 feet". §6B.06 ¶11, printed p. 773: "If a longitudinal buffer space is used, the values shown in Table 6B-2 may be used to determine the length of the longitudinal buffer space."
- Dropping the Case 11 cite leaves 645 / 820 ft sourced by Table 6B-2. No safety distance changes, so this isn't a park.
- No Ryan ruling covers this citation. #355 R3 and #361 R3 (both R145 self-ruled) set the Case 11 wording on shoulder plans and left it off the lane step-down.

## R1 (R145 self-ruled): the lane buffer cites Table 6B-2 alone
- A new `supplement_speed and is_lane` branch, ahead of the shoulder one. Its `source` is "MUTCD 11th Ed. Sec 6B.06, Table 6B-2 (stopping sight distance)." This is the issue's first proposed option, and #361 R3's lane step-down source word for word.
- Not the second option (the lane closure's own S-630-1 sheet and its buffer note): that would need a new sourced reading of a lane sheet's buffer note for a gated kind, which the fix doesn't need.

## R2 (R145 self-ruled): the lane wording
- `lookup_text`: "MUTCD Table 6B-2: 645 ft. CDOT S-630-1 Sheet 14 posts a 570 ft minimum at 65 mph, but only as part of the Case 26 mandatory speed step-down (65 → 60 mph), and Sheet 14 is drawn for shoulder work on a freeway or expressway; this plan closes a lane, so the federal posted-speed value governs." (75 mph: 820 ft, 650 ft, Case 27, 75 → 65 mph.)
- It keeps the shoulder branch's first sentence and adds #361 R3's reason ("drawn for shoulder work on a freeway or expressway … this plan closes a lane"). "This plan has no qualifying reduction" is dropped: on a lane closure no reduction qualifies (#361 R1).

## Rule 5 churn prediction (made before the diff)
- Moves: the audit `buffer` section's `lookup_text` and `source` on CDOT lane closures at 65/75 mph without the step-down. In the snapshot: `lane-65`, `lane-75`, `lane-65-55`, `lane-75-70`, 2 lines each. `buffer_ft` and `result_text` don't move.
- Byte-identical: every shoulder plan (Case 11, Case 26/27, the non-step-down reductions, the #355 off-class step-down), the lane step-downs `lane-65-60` / `lane-75-65` (#361's branch), and the flagger plans, on audit JSON, crew markdown and PDF text.

## Proof
- `snapshot.py`: 10 live plans × audit JSON, crew markdown and PDF text through the API, plus 6 gated lane plans' audit JSON through the producers (36 files), base vs. fix.
- `byte-identity-diff.txt`: exactly the 4 predicted lane files move, each by the `lookup_text` and `source` lines (16 changed lines in all). The other 32 files are byte-identical. Prediction = actual.
- `tests/s630/test_lane_buffer_cite_367.py`: 8 tests. On the base: 4 failed (the 4 lane plans), 4 passed (the shoulder plans, which keep their Case 11 cite).
- Full suite on the fix: 3580 passed, 2 skipped (base: 3572 passed, 2 skipped; +8 is the new file). ruff and mypy clean.
