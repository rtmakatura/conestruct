# #335 proof — the two refusals no longer loop

Branch `issue-335-freeway-4lane-recovery`, built on evidence branch `issue-334-prod-check` (`7fdb6e5`).

## The new messages (4 lanes, divided freeway, 10 ft shoulder)
- At 10.5 ft (the site's fitted default), `LANE_WIDTH_BELOW_FREEWAY_MIN`:
  > Lane width 10.5 ft is below the 11 ft minimum for freeway work zones (CDOT S-630-1 Sheet 7 Case 11 '11' MIN.' annotation). At 11 ft the plan sheet draws at most 3 lanes in this direction beside the 10 ft shoulder (its widest half-road is 52 ft). Set lanes per direction to 3 and lane width to 11 ft, or verify the scenario is not actually on a freeway.
- At 11 ft, the schema's drawable refusal:
  > 4 lanes x 11.0 ft + 10 ft shoulder = 54.0 ft exceeds the plan sheet's drawable half-road (52 ft). Freeway lanes must be at least 11 ft (CDOT S-630-1 Sheet 7 Case 11 '11' MIN.'), so the sheet draws at most 3 lanes in this direction. Reduce the lane count to 3.
- The site's inline copy (`validateLanes`), same case:
  > 4 lanes × 11 ft + 10 ft shoulder is wider than the plan sheet can draw (52 ft per direction). Freeway lanes must be at least 11 ft, so the sheet draws at most 3 lanes per direction. Set lanes to 3.

## Tests (Rule 11: through the real endpoint)
`tests/test_freeway_four_lane_recovery.py` replays the scenario fields of the audit-shoulder run `i25-r-65-night` (`validation-artifacts/committed/audit-shoulder/runs/i25-r-65-night/request.json`) through `/render/audit`, reads each refusal's own suggested fix out of its text, applies it, and requires HTTP 200.
- Red on the unfixed code (`git archive HEAD` of `dfc614d`'s src/data): the two loop tests fail on the old wording ("Increase lane width", "Use a lane width of"); the two control tests pass on both.
- `conestruct/site/lib/scenarios/validation.test.ts`: two new cases. Red with the old `validation.ts` swapped in (received "Use a lane width of 10.5 ft or less, or fewer lanes."), green with the fix.

## Suites
- Backend: baseline 3000 passed, 2 skipped; now 3005 passed, 2 skipped (+5, all new). mypy clean (49 files); ruff check and format clean.
- Frontend: 2315 passed (vitest); tsc clean.

## Rule 5
Predicted: only these three messages change, and only where `lanes × 11 + shoulder > 52` on a freeway; 0 existing tests change. Observed: 0 existing tests changed. No plan, PDF or audit output changes for any request that produced a plan before.
