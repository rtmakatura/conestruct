# R50 red-proof: CI was red on main; the ship now stops unless CI is green on the tip

Ruling R50 (rulings.md): find why CI failed on `main`, fix each failure at its cause, and make the ship check that both CI workflows are green on the tip being shipped, before the merge. Red, missing or still running stops it with "Nothing was merged or pushed." and names the failing workflow. Red-prove it against a scratch run or a fixture.

Branch `ship/r48-r50`, 2026-09-29. Everything below was run on this machine or read from GitHub Actions that day.

## When it went red

Both workflows ran only on pushes to `main`, so no branch was ever tested before its ship.

| Workflow | Last green on main | First red on main |
|---|---|---|
| Frontend tests | fee2f77, 2026-09-28 14:31 UTC | **55c9054, 2026-09-28 15:50 UTC** (run 36446594294) |
| Python tests | 7ea649d, 2026-09-29 04:16 UTC | **467ffaf, 2026-09-29 14:42 UTC** (run 36584715643) |

Every push to main after those was red on the same failures: 9 red Frontend runs and 5 red Python runs, through 884081c (runs 36627688642 and 36627688461).

## Each failure: cause and fix

**Frontend tests: 4 tests in `tests/vercel-ignore.test.ts`** ("skips a backend-only commit", "builds a site commit", "builds a change to an outside input only", "compares the whole push").
- Error: `git rev-parse 71cc403^` (and `a7225ff^`, `aab8caa^`, `0ddc85e^`) failed with "unknown revision".
- Introduced by aee5a5c (R1, change 2). The test runs the ignore script over real commits in this repo's history.
- Cause: `actions/checkout` clones one commit by default, so those commits don't exist on the runner. Local runs have full history, so they passed.
- Fix: `frontend-tests.yml` checks out with `fetch-depth: 0`.

**Python tests: 7 tests in `tests/test_vercel_env_check.py`**, every test that runs the check.
- Error: the output showed the real Vercel CLI (`Vercel CLI 61.0.0 … ENOENT: chdir … 'C:\Users\rtmak\…\conestruct\site'`) where the stand-in's answers should have been.
- Introduced by ac04cd4/9eebbbc (R29).
- Cause, in two parts:
  - The stand-in CLI was a Windows `.cmd` file, which Ubuntu can't run.
  - `& $Vercel` then threw a statement-terminating error, and under `$ErrorActionPreference = "Continue"` the check went on to the next line, which runs the real `npx vercel`. That second part is a bug in the check itself: it reproduces on Windows with a stand-in path that doesn't exist (below).
- Fixes:
  - `vercel-env-check.ps1` wraps the stand-in in try/catch and stops ("could not run the Vercel CLI stand-in …") rather than falling through.
  - The tests use `tests/_fake_cli.py`: one Python stand-in behind a `.cmd` shim on Windows and an executable `sh` shim elsewhere.
  - No assertion was removed. All 7 now run and pass on Ubuntu (the runner has `pwsh`).

**Python tests: 16 setup errors in `tests/test_branch_cleanup.py`.**
- Error: `FileNotFoundError: 'cmd'`.
- Introduced by 6b23a22 (R31/R32). R44, R46 and R47 added to that file.
- Cause: the scratch fixture makes an NTFS junction with `cmd /c mklink /J`. The script under test can't run on Linux either: `Norm` turns `/` into `\`, and worktrees are matched against a `.claude\worktrees\` prefix. It runs only on the Windows ship machine.
- Fix: these 16 tests are skipped when not on Windows, and the skip message says why. CI runs `pytest -rs`, so each skip prints its reason. The 2 wiring tests in that file still run everywhere.

## Why local runs passed

Every ship ran the suites on Windows, from a full clone:
- `cmd` exists there.
- The `.cmd` stand-in runs.
- The junction can be made.
- The historical commits are present.

CI's Ubuntu runner, with a one-commit checkout, has none of that. Nothing in the ship read CI, so red runs went unnoticed.

## So it can't recur

- `scripts/ci-check.ps1 -Sha <sha> [-Ref <branch>]`:
  - For each of `python-tests.yml` and `frontend-tests.yml`, it runs `gh run list --workflow <file> --commit <sha>` and takes the newest run.
  - Exit 0 only if both newest runs are `completed`/`success`.
  - Red, missing or still running prints `CI CHECK FAILED: <workflow> …` and exits 1.
  - A gh error, or an answer that isn't JSON, also stops it (it fails closed).
- `scripts/ship.ps1` step 1d:
  - Runs after the R29 env check and before `git merge`.
  - Checks the sha of `origin/<branch>`, which is the tip the fast-forward makes main.
  - On exit 1: `SHIP FAILED: CI is not green on the commit being shipped: <what failed>. … Nothing was merged or pushed.`
- Both workflows now run on pushes to every branch (`branches: ["**"]`), so a tip has its runs before the ship go.

The ship runs main's copy of the check. So the first ship to use step 1d is the one after this branch lands; this branch's own ship still runs main's older copy. This branch's tip was checked by hand instead (the report has the links).

## Red-proof

**Tests, red before the fix (733870f), on Windows:** 13 failed:
- `tests/test_ci_check.py`: all 12 tests except the fixtures check (the script didn't exist yet).
- `tests/test_vercel_env_check.py::test_a_stand_in_that_cannot_run_never_falls_through_to_the_real_cli`: the old check answered "npx is not on PATH, so the Vercel CLI can't run." It had fallen through past the missing stand-in.

After the fix (fc81539):
- Windows: 45 passed across `test_ci_check.py`, `test_vercel_env_check.py` and `test_branch_cleanup.py`.
- Ubuntu CI: all 27 in `test_ci_check.py` and `test_vercel_env_check.py` ran and passed; the 16 cleanup tests were skipped with the Windows-only reason.

**Fixtures** (`tests/fixtures/ci-runs/`):
- Real `gh run list --commit` answers:
  - `python-green.json` (7ea649d);
  - `frontend-green.json` (fee2f77);
  - `python-red.json` (884081c).
- Edited from the red one:
  - `python-running.json` (still running);
  - `python-green-then-red.json` (a newer red run after an older green one on the same commit; the newest decides).

**Against real GitHub runs, read-only** (`powershell -File scripts\ci-check.ps1 …`):

```
Checking CI on 884081c (R50)...
  Python tests: failure https://github.com/rtmakatura/conestruct/actions/runs/36627688461
  Frontend tests: failure https://github.com/rtmakatura/conestruct/actions/runs/36627688642
CI CHECK FAILED: Python tests failed on 884081c (failure); Frontend tests failed on 884081c (failure)
exit=1
Checking CI on fee2f77 (R50)...
  Python tests: success https://github.com/rtmakatura/conestruct/actions/runs/36436590101
  Frontend tests: success https://github.com/rtmakatura/conestruct/actions/runs/36436590081
CI green on fee2f77: Python tests and Frontend tests.
exit=0
Checking CI on 272e013 (R50)...
  Python tests: no run on 272e013. Push the branch, or run: gh workflow run python-tests.yml --ref docs/demo-prep-snapshot
  Frontend tests: no run on 272e013. Push the branch, or run: gh workflow run frontend-tests.yml --ref docs/demo-prep-snapshot
CI CHECK FAILED: Python tests has no run on 272e013; Frontend tests has no run on 272e013
exit=1
```

**CI on this branch's first push (fc81539, the R50 fix), Ubuntu:**
- Python tests: success (run 36630229506).
- Frontend tests: success (run 36630229466).
