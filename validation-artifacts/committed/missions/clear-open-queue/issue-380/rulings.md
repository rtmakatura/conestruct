# #380 rulings: the overspan head-start test allows one clock tick

Issue: https://github.com/rtmakatura/conestruct/issues/380. Branch
`issue-380-overspan-tick-tolerance`, stacked on `issue-383-footer-scan-stub`
(`4f76a8e`). Mission tracking issue #387.

## R1 (R145 self-ruled): the fix goes in the test, not the code
The cause is asyncio, not the race. `BaseEventLoop._run_once` (CPython
3.12.13, `asyncio/base_events.py`) runs every timer whose `_when` is
before `self.time() + self._clock_resolution`, so `asyncio.wait(...,
timeout=head)` can return up to one clock resolution early. On this
machine `time.get_clock_info("monotonic")` is `GetTickCount64()`,
resolution `0.015625` s. The wire's stamps are `time.monotonic()` reads
at the same resolution. So the free mirrors join after the head start
within one tick, which is what the code means to do.
`OVERSPAN_HEAD_START_S` (`src/rules/site_detection.py:110`, 4.0 s) is a
production number and is not touched; the test monkeypatches it to 0.3.

## R2 (R145 self-ruled): the tolerance is the clock's own resolution
The issue suggests `0.3 - 0.02`. The branch uses
`0.3 - time.get_clock_info("monotonic").resolution` instead: it is read
from the clock, not chosen, so no CHOSEN mark is needed (Rule 12). It is
15.625 ms on Windows and 1 ns on Linux, so CI's bound is unchanged in
practice. A comment above the assertion names the asyncio early-fire
and the Windows tick.

## Rule 5 churn (predicted before the diff, measured after)
Prediction: one assertion in `tests/test_overspan_mirror.py` gains the
tick tolerance, plus a comment. No `src/` change, so every API response
is byte-identical. The other assertions and the collected test IDs stay
the same.

Measured: `git diff --stat` on tracked files: `tests/test_overspan_mirror.py
| 7 ++++++-` (6 insertions, 1 deletion). No `src/` file changes. The
file still collects 5 tests; the full suite counts 3571 tests on base
(`1 failed, 3568 passed, 2 skipped`) and branch (`3569 passed, 2 skipped`).
New files are this folder's evidence only. Matches the prediction.

## Evidence
- Red proof, `sample_head_start.py` (this folder): runs the test's race
  100 times in one process, with the test's own `_Wire`, and checks the
  earliest free-mirror start against both bounds. Result:
  - `monotonic resolution 0.015625 s; N=100`
  - `min free start: lowest 0.2960 s, highest 0.3600 s`
  - `misses old bound (>= 0.3): 27/100`
  - `misses new bound (>= 0.3 - resolution): 0/100`
- The test alone, 10 runs each: base 0/10 failed, branch 0/10 failed.
  (The miss shows in repeated in-process runs and in full suites, as the
  issue reports, not in a cold single run.)
- Full suite, base `4f76a8e`: `1 failed, 3568 passed, 2 skipped`
  (name not captured; see `failing-tests.md`). Branch:
  `3569 passed, 2 skipped`.
- `ruff check .`: `All checks passed!`. `mypy`:
  `Success: no issues found in 49 source files`.
