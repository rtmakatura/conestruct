# #344 rulings — Case 26/27 freeway shoulder plans place the Sheet 14 series

Issue: https://github.com/rtmakatura/conestruct/issues/344. Checkpoint: `checkpoint.md` (committed `5033af1` before any ruling). Every ruling below is R145 self-ruled: each distance is Sheet 14's, and none of the R145 stop reasons applies.

## S1, R145 self-ruled: one producer, one predicate
`SHEET_14_FREEWAY_SIGN_FT` in `src/rules/spacing.py` holds the distances from the start of the shoulder taper. They come from S-630-1 Sheet 14, Case No. 26 and Case No. 27 (PDF p. 162), read on the rendered sheet (`tests/fixtures/cdot_s630_typicals/case_26.json`, `case_27.json`):
- second W21-5aR with W7-3a: 530 ft;
- G20-5P / R2-1(XX) group: 1,060 ft;
- first W21-5aR with W16-2a: 1,320 ft;
- R2-10: 1,580 ft;
- W3-5(XX): 2,110 ft;
- W20-1: 2,640 ft.

`sheet_14_freeway_series(params)` in `src/rules/validators.py` is the one predicate: a freeway shoulder closure with the Case 26/27 step-down (`_is_cdot_minimum`). It is the complement of `case_11_freeway_series` among freeway shoulder plans. `shoulder_advance_stations`, `second_shoulder_closed_station` and the new `fines_double_envelope` (`src/generation/layout.py`) read them, and so do both shoulder generators, the audit, the crew sheet and the validator (Rule 3). W3-5 keeps its existing rule (R2-10 + 530 ft), which lands it on Sheet 14's 2,110 ft.

## S2, R145 self-ruled: W20-1 at 2,640 ft and no W20-2
On the issue's example (65 to 60 mph, divided, 5,000 ft zone), W20-1 moves from 5,140 ft to 2,640 ft, 2,500 ft closer to the taper. Sheet 14 sets that distance and labels the sign "ROAD WORK 1/2 MILE". Sheet 14 shows no W20-2, so none is placed (as with Case 11, #334 Q1).

## S3, R145 self-ruled: only Sheet 14 plans move the Fines Double anchor
`fines_double_envelope` replaces the three copies of the envelope math (both shoulder generators and the audit's non-flagger branch).
- On a Sheet 14 plan, R2-10 sits at 1,580 ft from the taper start and the entrance R2-1 at 1,060 ft. The entrance R2-1 gets its own G20-5P, matching Sheet 14's G20-5P / R2-1 group.
- Every other plan keeps R2-10 at the work zone's upstream end + 500 ft and the entrance R2-1 on the upstream-most in-zone G20-5P plaque. That covers Case 11 with a non-standard reduction (65 to 55), non-freeway 65 to 60 plans and lane closures; the lane-closure generator keeps its own copy. R2-11 and the restoration R2-1 are unchanged everywhere.
- `validate_fines_double_envelope`'s entrance R2-1 check looked for the sign inside the work zone (its comment said to update the bound if the anchor moved). On a Sheet 14 plan the bound is now the envelope, downstream of R2-10.

## S4, R145 self-ruled: the validator scores Sheet 14 plans against Sheet 14
On a Sheet 14 plan, `validate_advance_warning_signs` checks that W20-1, W3-5, R2-10, the first W21-5aR, the entrance R2-1 and the second W21-5aR are each at least their Sheet 14 distance from the taper. The check is cited "CDOT S-630-1 Sheet 14 Case 26" (or 27). It is the #334 S2 check, now one shared helper (`_typical_spacing_violations`); Case 11's messages and sections stay the same. The signs are placed at exactly the listed distances.

## S5, R145 self-ruled: the audit names Sheet 14 positions
On a Sheet 14 plan, the audit's advance section reports:
- `source`: "CDOT S-630-1 Sheet 14 Case 26" (or 27);
- `citation`: "CDOT S-630-1 CASE 26", footer "CDOT S-630-1 · SHEET 14 · CASE 26 · SHOULDER WORK - FREEWAY/EXPRESSWAY W/ 65 MPH SPEED LIMIT" (the fixture's title);
- `spacing_text`: the six distances;
- position labels: "Furthest (Sheet 14)", "First W21-5aR (Sheet 14)" and its plaque, "Second W21-5aR (Sheet 14)" and its plaque, "R2-10 (Sheet 14)", "Speed limit group (Sheet 14)" (the G20-5P and R2-1 at 1,060 ft).

W3-5 keeps "W3-5 step 1". The G20-5P / R2-6P assemblies that now sit upstream of the taper take the generic "Advance (G20-5P)" and "Advance (R2-6P)".

## S6, R145 self-ruled, accepted by Ryan 2026-10-19: the first G20-5P / R2-6P assembly at 795 ft, CHOSEN
> S6 accepted: keep the first Fines Double pair at 795 ft, marked CHOSEN. (Ryan, 2026-10-19)

Sheet 14 draws a G20-5P / R2-6P group inside the 530 ft span between the second W21-5aR and the G20-5P / R2-1 group, dimensioned "VAR.". With R2-10 upstream of the taper, the old midpoint rule put an assembly 52 ft from the second W21-5aR on a 75 to 65 plan, which breaks Sheet 12 Note 4's 250 ft minimum between Fines Double signs and other signs. The first assembly now sits at the span's midpoint, (530 + 1,060) / 2 = 795 ft, 265 ft from each neighbour. The number is CHOSEN inside the window the two sources set (780 to 810 ft). The rest follow at equal gaps of at most 2,640 ft down to R2-11 (Sheet 12's interval).

## Out of scope (listed in the close comment)
- W20-1's face: Sheet 14 says "ROAD WORK 1/2 MILE"; the plan's says "ROAD WORK AHEAD" (Case 11's has the same gap, #334 S5).
- The G20-5P description reads "CONSTRUCTION ZONE plaque"; Sheet 14 labels it "WORK ZONE".
- Non-freeway 65 to 60 and 75 to 65 plans: the audit cites Case 26/27 for their taper and buffer, but they keep Table 6B-1's series, because Sheet 14 is a freeway/expressway sheet and the form has no expressway road type.
- Case 11's own G20-5P / R2-1 group and R2-10 (#334 S5).
- Sheet 12 Note 4 clearances for the downstream assemblies against in-zone signs, which the plan has never checked.
