# issue-208-mypy-ratchet: the rulings this arc is built under

**Issue:** #208, "mypy ratchet baseline has slipped — TYPES.md says 35 errors / 6 files, actual 63 / 10".

## Ryan, 2026-10-14 (the backlog arc), verbatim excerpt

> 1. Triage. List every open issue on gh. Put each in one bucket:
>    - BUILD: you can rule it yourself under R145. Give it an order.
>
> 3. Build BUILD items one arc per branch, usual loop: plan, Rule 5 prediction before the diff, verifier, backticked result: line. Batch ready branches so one "ship ready" can take several. After each ship, check production yourself and close the issue.

The triage report put #208 at BUILD 1.

## R145 self-ruled (2026-10-14)

1. **Both halves in one arc.** The issue offers (a) re-baselining TYPES.md and (b) typing the ScenarioParams family, "either order". Today's count is 75 errors in 13 files (measured at `4c52c49`), so I'm doing both: every error fixed, and the baseline restated as 0.
2. **The ratchet joins CI.** TYPES.md already says "Mypy is manual / future server-side CI only … When server-side CI exists, mypy joins it there." CI exists (`.github/workflows/python-tests.yml`), and R50 stops a ship unless CI is green. So `uv run mypy` becomes a CI step, and a new mypy error stops the ship. The issue's own diagnosis is that the local gate "is how it drifted silently". This follows the documented plan and adds no new direction.
3. **No behavior change.** Every fix is an annotation, a narrowing the code already guarantees, or an `assert` naming an invariant the code already enforces. If a site turns out to be a reachable bug, it gets recorded as a finding and left alone, and the arc stops rather than changing behavior under a typing issue.
