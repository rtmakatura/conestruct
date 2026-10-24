# #369 full-suite failures

Full run on the branch's uncommitted change (base `418a16e`):
`1 failed, 3571 passed, 2 skipped in 1157.45s (0:19:17)`.

Failing test names, saved before any re-run:
- `tests/test_ci_check.py::test_still_running_at_the_limit_stops_and_says_how_long`

Alone:
- `test_still_running_at_the_limit_stops_and_says_how_long`: failed 4 of 4
  runs alone in this worktree (`1 failed`), and 1 of 1 alone in the main
  checkout (`origin/main`'s script and test, identical to `418a16e`'s).
  With the rest of its file, `tests/test_ci_check.py`: `19 passed`.

Not caused by #369: this branch touches neither `scripts/ci-check.ps1` nor
`tests/test_ci_check.py`. The test gives the script a 1.2 s wait and
expects a `waiting` line, which prints only when the first `Read-CI`
beats that limit (`scripts/ci-check.ps1:100-112`). Filed as #391
(https://github.com/rtmakatura/conestruct/issues/391).

## Later full run (the diff-verifier's, `pytest -q -rf`)
`3572 passed, 2 skipped`, with
`test_still_running_at_the_limit_stops_and_says_how_long` passing. So it
is timing-flaky, not a hard fail. That run is the branch's test line;
the `1 failed` run above is kept as history.
