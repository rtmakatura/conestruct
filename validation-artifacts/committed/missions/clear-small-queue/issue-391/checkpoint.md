# #391 plan (R145, no stop)

- Cause: `test_still_running_at_the_limit_stops_and_says_how_long` gives `scripts/ci-check.ps1` `-WaitMin 0.02` (1.2 s). The script prints its `waiting` line only when the first `Read-CI` (two stand-in gh runs) returns before the limit (`scripts/ci-check.ps1:100-112`). Under full-suite load on Windows the first read ran past 1.2 s, so no `waiting` line.
- Fix (test-only): `-WaitMin 0.1` (6 s), `-PollSec 1` unchanged; the expected failure line becomes `(waited 0.1 min)`. CHOSEN, reason in the test comment. The script is not touched.
- Measured: one read (whole ci-check run with WaitMin 0) took 0.47-0.48 s on this machine, warm, 5 of 5. 6 s is about 12x that.
- Red proof: a git-archive copy of 692de98 with the new test and the script's `waiting` Write-Host line deleted must fail on `assert "waiting" in out`.
- Churn prediction (Rule 5): one file, tests/test_ci_check.py, ~10 lines in one test; same test IDs; this test goes from ~2 s to ~7.5 s; no behaviour change in any script.
