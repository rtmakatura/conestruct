# #344 checkpoint — Case 26/27 freeway shoulder plans place the Sheet 14 series

Issue: https://github.com/rtmakatura/conestruct/issues/344. Committed before any ruling.

## The problem
A CDOT freeway shoulder plan with the Case 26/27 step-down (65 to 60, 75 to 65) cites S-630-1 Sheet 14 but places its signs from Table 6B-1:
- `shoulder_advance_stations` (`src/generation/layout.py:246`) returns Table 6B-1 A / A+B / A+B+C, so a W20-2 is placed and W20-1 sits at A+B+C;
- `second_shoulder_closed_station` (`layout.py:268`) takes the midpoint of the first W21-5aR and taper + 500 ft;
- the Fines Double block puts R2-10 at the work zone's upstream end + 500 ft (`layout.py:619`, `:963`; copied in the audit at `src/api/audit.py:1389`), which is downstream of the taper, and W3-5 530 ft upstream of it;
- the entrance R2-1 sits on the upstream-most in-zone G20-5P plaque (`layout.py:679`, `:993`);
- `validate_advance_warning_signs` scores the plan on Table 6B-1 (`src/rules/validators.py:913`).

## The source
S-630-1 Sheet 14 (PDF p. 162, "Standard Sheet No. 14 of 26"), Case No. 26 and Case No. 27, read on the rendered sheet (issue body). Dimensions run upstream from the 1/3 L taper: "530'" to W21-5aR with W7-3aP(X); "530'" to the G20-5P / R2-1(60) group (the G20-5P / R2-6P group "VAR." inside that span); "260'" to W21-5aR with W16-2aP / W16-3aP / W16-9P; "260'" to R2-10; "530'" to W3-5(60); "530'" to W20-1 "ROAD WORK 1/2 MILE". Case 27 prints the same dimensions. `tests/fixtures/cdot_s630_typicals/case_26.json` and `case_27.json` (`advance_warning_sequence`) agree.

Cumulative from the taper start: second W21-5aR 530, G20-5P / R2-1 1,060, first W21-5aR 1,320, R2-10 1,580, W3-5 2,110, W20-1 2,640. No W20-2, no W5-1.

## Recommendation (R145: every distance is Sheet 14's; no stop reason applies)
- S1: one producer `SHEET_14_FREEWAY_SIGN_FT` and one predicate `sheet_14_freeway_series`; both generators, the audit, the crew sheet and the validator read them.
- S2: W20-1 moves to 2,640 ft, the distance Sheet 14 sets (2,500 ft closer than today on the issue's 65 to 60, 5,000 ft example). W20-2 is dropped.
- S3: one Fines Double envelope producer. Only Sheet 14 plans move their R2-10 (to 1,580 ft) and entrance R2-1 (to 1,060 ft, with its G20-5P). Every other plan keeps `wz_start + 500` and the in-zone entrance R2-1.
- S4: the validator checks each Sheet 14 sign at least its Sheet 14 distance, cited "CDOT S-630-1 Sheet 14 Case 26/27".
- S5: the audit names Sheet 14 positions and cites Sheet 14.
