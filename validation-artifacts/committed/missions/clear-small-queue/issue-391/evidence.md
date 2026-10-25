# #391 evidence (branch issue-391-ci-check-wait, base 692de98)

- Alone, 10 of 10 passed (7.48-7.60 s each).
- Red proof: git archive of 692de98 (tests/_fake_cli.py, tests/fixtures/ci-runs, scripts/ci-check.ps1, pyproject.toml) plus the new test, with the script's `waiting, {2:0.0} of {3} min` Write-Host line deleted: `FAILED ... assert 'waiting' in 'Checking CI on 884081c (R50)... CI CHECK FAILED: Python tests is still running on 884081c (waited 0.1 min)'`. Control, same copy with the script restored: 1 passed. The worktree's script was never edited.
- tests/test_ci_check.py: 19 passed.
- Full suite: 3593 passed, 2 skipped. ruff check, ruff format --check, mypy: clean.
