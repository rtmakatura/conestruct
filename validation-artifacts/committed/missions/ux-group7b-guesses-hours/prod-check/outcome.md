# #525 production check — main 99d828d

Ship: SHIP VERIFIED 2026-11-12. Healthz sha and served frontend sha both `99d828d`.

- Script: `script/walk-525-prod.mjs`, copied from `../issue-525/walk-script/walk525.mjs` with the site pointed at https://www.conestruct.com. The gate token goes in a header only (`scripts/gate.cjs` `newGatedContext`), never in a body or in any file here.
- Output: `run.log` and `crops/prod-walk.json`. Kept crops: `crops/prod-<w>-colfax-pennsylvania.png`. The other pins' crops are in `validation-artifacts-extra/ux-group7b-guesses-hours/prod-check/` (untracked).

## Colfax and Pennsylvania (39.7401, -104.9811): PASS at all three sizes

| Size | Rows | axe | Console errors |
|---|---|---|---|
| 1440x900 | Pennsylvania Street, 2 m, "at East Colfax Avenue"; East Colfax Avenue, 5 m, "at Pennsylvania Street" | 0 | 0 |
| 1198x930 | same two rows | 0 | 0 |
| 390x844 | same two rows | 0 | 0 |

One Pennsylvania row, not two. The rows match the local walk's `after-walk.json` word for word.

## Churn pins at 1440: PASS, matches plan.md's replay table

- E Colfax at Williams (39.73997, -104.96632): East Colfax Avenue 1 m "at Williams Street"; Williams Street 27 m "at East Colfax Avenue" (R145-8).
- N Lincoln (39.7345, -104.9862): one row, North Lincoln Street, 6 m, no cross street.
- E Speer (39.7197, -104.97677): one row, East Speer Boulevard, 0 m, no cross street.

## 44 px

Under 44 px at 1440 and 1198: the Latitude and Longitude inputs only (43 px high), the same as the local before and after walks, so #525 didn't cause it. None at 390. Mapbox's own marks are excepted (#505).

Token scan of this folder before the commit: 0 occurrences.
