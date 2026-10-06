# R95: why R77 didn't fire on the #308 ship, the fix, and its red-proof

R95 is quoted verbatim in `issue-308-oneway-read-as-divided/rulings.md` (on `issue-308-page1-fixes`), as the prompt directs.

## Why it didn't fire

**R77 was never live.**

- The hook that gates `ship.ps1` runs from the ship worktree. `.claude/settings.json` (untracked, main checkout) has, at line 12:

  ```
  …/.venv/Scripts/python.exe C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/_ship/scripts/hooks/ship_gate.py
  ```

  `ship.ps1` resets `_ship` to `main` on every ship, so the live gate is always `main`'s `ship_gate.py`.
- R77's guard is commits `a07c1c7` (2026-10-04 11:29) and `74da4cf` (11:40). Both sit only on `issue-292-acceptance`, which hasn't shipped: `git log main..issue-292-acceptance` lists exactly those two. R77 was ruled "ride along on the next branch", but the next branch to ship was #308, and the guard wasn't on it. `git grep R77 main -- scripts/hooks/ship_gate.py` finds nothing.
- So the #308 ship ran under `a748a7b`'s gate. The session's cwd was `.claude/worktrees/oneway-read-as-divided`, and the gate didn't look at it. The cleanup's `git worktree remove` then failed with "Permission denied".

**Ryan's Windows hypothesis is right, and R77 already accounts for it.** Windows won't delete a folder while a process has it as its working directory. A `Set-Location` inside the ship command moves only that command's shell, not the session. That's why R77 judges the hook payload's `cwd`, which is the session's own. On #308, once the session left the worktree (`ExitWorktree`), the empty folder came out at once.

**A second gap.** R77's refusal said "Move the session to the main checkout first (cd there)". A worktree-isolated session can't do that: its guard refuses a `cd` or `git -C` into the shared checkout. Such a session leaves with `ExitWorktree` (action `keep`), which returns it to its launch directory.

## The fix (branch `ship-loop-r95`)

- **R77 carried over from `issue-292-acceptance`.** Commits `a07c1c7` and `74da4cf` were cherry-picked unchanged. The gate refuses the ship command while the session's cwd is inside the shipped branch's checkout, or anywhere under `.claude/worktrees/` except `_ship` (judged by path). The refusal comes before the ledger, so the go isn't spent.
- **The message names how to leave.** "a session that entered the worktree with EnterWorktree runs ExitWorktree (action keep), which returns it to where it started; any other session moves to the main checkout (cd there)."
- **It takes effect for the ship after this one.** The gate is live once this branch is in `main` and `_ship` resets to it. The ship of this branch itself runs under the old gate. CC leaves its worktree by hand before running it.
- When `issue-292-acceptance` later rebases onto `main`, git drops its two R77 commits as already applied (patch-identical). The cleanup's R44 `git cherry` check treats them the same way.

## Red-proof

`tests/test_ship_gate.py::test_the_308_shape_is_refused_and_says_how_to_leave` replays #308. The session sits in `.claude/worktrees/oneway-read-as-divided`, a folder named unlike the branch it holds, and ships `issue-308-oneway-read-as-divided`.

**1. Red against the live gate.** `scripts/hooks/ship_gate.py` was swapped for `git show a748a7b:scripts/hooks/ship_gate.py`, run, then restored:

```
FAILED tests/test_ship_gate.py::test_a_ship_from_inside_the_branch_worktree_is_refused_and_keeps_the_go[top]
FAILED tests/test_ship_gate.py::test_a_ship_from_inside_the_branch_worktree_is_refused_and_keeps_the_go[subdir]
FAILED tests/test_ship_gate.py::test_a_set_location_inside_the_command_does_not_move_the_session
FAILED tests/test_ship_gate.py::test_a_ship_from_anywhere_under_the_worktrees_folder_is_refused[other-arc]
FAILED tests/test_ship_gate.py::test_a_ship_from_anywhere_under_the_worktrees_folder_is_refused[stale-folder]
FAILED tests/test_ship_gate.py::test_a_ship_from_anywhere_under_the_worktrees_folder_is_refused[stale-subdir]
FAILED tests/test_ship_gate.py::test_the_308_shape_is_refused_and_says_how_to_leave
7 failed, 69 passed in 18.47s
```

The live gate allowed the exact #308 ship.

**2. Red against R77 as cherry-picked,** before the message change. It refuses, but tells the session to `cd`:

```
E       assert 'ExitWorktree' in "BLOCKED by ship_gate: this session's working directory (C:\\Users\\rtmak\\AppData\\Local\\Temp\\pytest-of-rtmak\\pyte...ion sits in.  Move the session to the main checkout first (cd there), then run the ship again.  The go is not spent.\n"
FAILED tests/test_ship_gate.py::test_the_308_shape_is_refused_and_says_how_to_leave
1 failed, 75 passed in 18.19s
```

**3. Green.** `76 passed in 17.21s`. R77's own allow-direction tests still pass: the main checkout, `_ship` and a main-checkout subdirectory are allowed.

## Rule 5 churn

- Predicted: a ship from any arc worktree flips from allowed to refused, which is R77's own predicted churn. The refusal text changes. Nothing else in the gate changes.
- Matched: the tests that changed are R77's own block cases plus the one new case.
