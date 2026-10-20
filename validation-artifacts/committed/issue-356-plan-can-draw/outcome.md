# #356 outcome

Wording only. The four refusal sentences now read:

- Shoulder (src/api/schemas.py) and near_intersection (src/api/schemas.py):
  "… = N ft exceeds the 52 ft half-road this plan can draw. …"
- Shoulder, freeway branch (R1): "… (CDOT S-630-1 Sheet 7 Case 11 '11' MIN.'),
  so this plan draws at most 3 lanes in this direction. Reduce the lane count to 3."
- Freeway lane width (src/rules/validators.py, R3): "At 11 ft this plan draws at
  most 3 lanes in this direction beside the 10 ft shoulder (the widest half-road it
  can draw is 52 ft). Set lanes per direction to 3 and lane width to 11 ft"

Proof: `tests/test_refusal_plan_can_draw.py` drives each refusal through
`/render/audit` and checks the full sentence and that none says "plan sheet",
"the sheet draws" or "widest half-road is". Red on base: `red-on-base.txt`
(4 failed). After: 4 passed.

Rule 5 check against rulings.md: as predicted. pytest 3444 → 3448 passed
(+4, the new file; nothing else moved), 2 skipped. vitest 2493 passed, 1 skipped
(no count change; three fixture strings and one `toContain`). mypy and ruff clean.
No snapshot, PDF or audit baseline moved.
