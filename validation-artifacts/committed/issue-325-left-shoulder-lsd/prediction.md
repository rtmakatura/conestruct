# issue-325-left-shoulder-lsd: rulings and Rule 5 prediction (written before the change)

## R152 (Ryan, 2026-10-15), the #325 part, verbatim

> Then #325: triage it under R145 and build it after TA-23 if you can self-rule it; otherwise add its question to your next report.

## R145 self-ruled (2026-10-15)

#325 self-rules. Limited sight distance already moves every advance warning sign in `_ADVANCE_SIGN_LABELS` 50% farther upstream (`src/rules/site_adjustments.py:46-72`, MUTCD §6B.04). The right shoulder's `W21-5aR` is in the list; the left shoulder's `W21-5aL` (#300) isn't. Adding it gives the left plan the treatment its right twin already gets: no new value, no new rule, and it fixes a sign left out of sequence. TA-23 (Q1) is stopped on Q3, so #325 goes first, stacked on the far-side checkpoint branch.

## Change

`_ADVANCE_SIGN_LABELS` gains `"W21-5aL"`. Nothing else.

## Predicted outcome

- **A left-shoulder plan with `limited_sight_distance`:** `W21-5aL` moves 50% upstream with the other advance signs. The record's "Moved N" count rises by the number of `W21-5aL` placements (one per side posted; a one-way street's single-shoulder exception posts one). The moved set mirrors the right plan's: the same stations, same count, `L` for `R`.
- **Unchanged:** every right plan; every left-shoulder plan without the flag; every other kind. Proof: #323's parity harness (`validation-artifacts/committed/issue-323-left-lane/parity323.py`: 102 scenarios × 9 routes, incl. the Broadway left shoulder) identical before (`main` `bc7280c`) and after.
- **Tests:** new `tests/test_left_shoulder_limited_sight_325.py` pins the mirror (left moved set = right moved set with L for R, and the record counts equal). Suites green; mypy 0.
