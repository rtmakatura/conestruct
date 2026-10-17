# #334 rulings — freeway shoulder plans place their signs at Case 11's distances

Issue: https://github.com/rtmakatura/conestruct/issues/334. Checkpoint: `checkpoint.md` (committed `a924cde` before any ruling).

## Q1, ruled by Ryan, 2026-10-17: A
> Q1 A, Q2 A (Ryan, 2026-10-17): drop W20-2 to match Case 11; fix Case 11 only in this arc and file Cases 26/27 (Sheet 14) as a new issue labelled audit-shoulder. Usual loop to a result: line.

A freeway shoulder plan that cites Case 11 places no W20-2. Case 11 shows none.

## Q2, ruled by Ryan, 2026-10-17: A
This arc moves only the plans that cite Case 11. Case 26/27 plans (CDOT, 65 to 60 or 75 to 65) keep today's layout. They are filed as a new issue with the Sheet 14 reading from `checkpoint.md`.

## S1, R145 self-ruled: one producer for the Case 11 distances
`CASE_11_FREEWAY_SIGN_FT` in `src/rules/spacing.py` holds the four distances from the start of the shoulder taper. They come from S-630-1 Sheet 7, Case No. 11 (PDF p. 155), read on the rendered sheet (oracle O16; `tests/fixtures/cdot_s630_typicals/case_11.json`):
- W5-1: 500 ft;
- second W21-5aR with W7-3a: 1,000 ft;
- first W21-5aR with W16-2a: 2,000 ft;
- W20-1: 5,200 ft.

`case_11_freeway_series(params)` in `src/rules/validators.py` is the one predicate. It is true for a freeway shoulder closure that is not a Case 26/27 plan (`_is_cdot_minimum` false). Both generators, the audit and the crew sheet read the stations from these two. The validator reads them too (Rule 3).

## S2, R145 self-ruled: the validator scores Case 11 plans against Case 11
On a Case 11 plan, `validate_advance_warning_signs` checks that each sign is at least its Case 11 distance from the taper, cited "CDOT S-630-1 Sheet 7 Case 11". The Table 6B-1 A/B/C check stays for every other plan. Case 11's own gaps (500 / 500 / 1,000 / 3,200 ft) don't fit Table 6B-1's freeway row, so scoring the plan on that row would flag the typical it cites.

## S3, R145 self-ruled: exactly the Case 11 distances
The signs are placed at exactly the listed distances. Case 11 treats them as minimums ("1700' is min"), so exactly is the shortest run that complies.

## S4, R145 self-ruled: the audit names Case 11 positions
On a Case 11 plan, the audit's advance section says where its distances come from. `spacing_text` lists the four Case 11 distances, and `source` cites Sheet 7 Case 11. The sign table's position labels drop the Table 6B-1 A/B/C words, which no longer describe the series:
- "Furthest (Case 11)";
- "First W21-5aR (Case 11)" and its plaque;
- "Second W21-5aR (Case 11)" and its plaque;
- "W5-1 (Case 11)".

Every other plan keeps its labels.

## S5, out of scope (listed in the close comment)
- Case 11's G20-5P / R2-1(XX) group at 3,000 ft and R2-10 at 3,500 ft. Today the plan puts G20-5P inside the work zone.
- W20-1's face: Case 11 says "ROAD WORK 1 MILE"; the plan's says "ROAD WORK AHEAD".
- W5-1 on a reduced-speed plan that still cites Case 11 (for example 65 to 55). It stays omitted, as today.
- The #331 limited-sight shift: freeways keep their spacing under R155, so it doesn't apply to these plans.
