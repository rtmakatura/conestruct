# #343 outcome

## Rule 5 prediction (made before the full run)
- Changes: the divided work-beyond-shoulder crew sheet (freeway and rural divided) only. The four mirror sentences go away, and its Safety Notes line changes from "posts signs on both sides of the roadway by choice" to "signs go on the right side only".
- Byte-identical: every other crew sheet. That covers divided shoulder and lane (they mirror), undivided, one-way, flagger and near-intersection plans. It also covers every audit, PDF and XLSX surface, since only the crew template and its context change.
- Rides along: #342's production-check evidence `1abfee2` (this branch is built on `issue-342-prod-check`).

## Result
- Full suite: `3073 passed, 2 skipped` (baseline 3067 + 6 new). No existing test or snapshot moved, so the prediction held.
- Red proof: on the base (`git archive` of `1abfee2` plus the new test file), `2 failed, 4 passed`. The two divided work-beyond-shoulder cases fail, and the shoulder/lane/undivided guards pass.
- ruff and mypy: clean, run as CI runs them.

## The divided freeway sheet (55 mph, 500 ft, long duration), mirror lines
Before:
- Step 2: "... right side of road 28 ft from centerline. Place matching sign on left side."
- Step 4: "... at approximately 500 ft intervals. Place matching plaques on left side."
- Step 6: "Place matching signs on left side at each location."
- Takedown 1: "Remove advance warning signs: W21-5 first. Remove both sides at each station."
- Safety: "Divided highway: this plan posts signs on both sides of the roadway by choice. ..."

After:
- Steps 2, 4, 6 and takedown 1 end at the right-side sentence.
- Safety: "Divided highway: signs go on the right side only. CDOT S-630-1 Sheet 2 General Note 8 doesn't require both sides when only one shoulder is closed (Case 11 on Sheet 7)."

Placements: `W21-5` at 1,500 ft and `G20-2` at -100 ft, both at offset +26 ft. Test: `tests/s630/test_wbs_crew_mirror_343.py`.
