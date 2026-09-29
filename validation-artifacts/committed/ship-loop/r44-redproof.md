# R44 red-proof: the cleanup also removes superseded branches

The ruling is in `rulings.md`. After "SHIP VERIFIED" the branch cleanup deletes a branch whose tip is in main (R31), and now also a branch whose every commit is patch-equivalent to a commit in main: `git cherry <main> <branch>` prints at least one line and only `-` lines. A branch with one `+` commit is never touched. Red-proven with the scratch remote.

Branch `ship-cleanup-superseded`, off `main` at `8215533`, 2026-09-29.

## What was built

- **`scripts/branch-cleanup.ps1`.**
  - New `Test-Superseded($sha)`: `git cherry $Main $sha`. It returns true only when the command succeeds, prints at least one line, and every line starts with `- `. An empty result (the tip is already an ancestor) is left to the ancestor rule.
  - `Test-Shipped($sha)` = ancestor (R31) or superseded (R44). It replaces `Test-InMain` in the two places that decide deletion: the origin branch and the local branch of the same name.
  - Everything else is R31's path, unchanged: the gh-only push with `--force-with-lease` on the sha just checked, the printed sha and restore command, the worktree rules (never `_ship`, never outside `.claude\worktrees`, locked or dirty listed for Ryan, junctions unlinked first, no `--force`), and `main` skipped by name.
  - The header now reads "Branch cleanup (R31, R44): branches already in main <sha>, by ancestry or by patch".
- **`scripts/ship.ps1`:** unchanged. Step 8 already runs the cleanup after SHIP VERIFIED.

## The scratch remote

`tests/test_branch_cleanup.py` keeps R31's fixture and adds a `picked` fixture on top of it:

| Branch | Built as | `git cherry main <branch>` | Expected |
|---|---|---|---|
| `picked-g` | main's two commits (`a1`, `b1`) cherry-picked onto the base | `-`, `-` | deleted on origin and locally |
| `extra-h` | `picked-g` plus one new commit `h1` | `-`, `-`, `+` | kept, not listed |
| `picked-locked` | `a1` cherry-picked onto the base, checked out in a locked worktree | `-` | origin deleted; worktree and local branch listed for Ryan |

Each test first asserts its premise with `git cherry`, so a fixture that stopped producing the intended shape fails loudly.

## Red before the fix

With the new tests and the old script: `3 failed, 6 passed`.

- `test_a_cherry_picked_copy_goes`: failed. The copy survived on origin.
- `test_a_superseded_branch_keeps_the_r31_safety_rules`: failed. No `deleted origin/picked-locked` line.
- `test_the_r31_cases_are_unchanged_with_superseded_branches_present`: failed. `picked-g` and `picked-locked` were still on origin.
- `test_one_commit_main_lacks_keeps_the_branch` passed before and after. It's the safe side of the rule; its job is to fail if the fix ever deletes too much.

## Green after

- `tests/test_branch_cleanup.py`: `9 passed` (R31's 5 unchanged, R44's 4 new).
- Full backend suite: `2378 passed, 2 skipped`.

## What the first real run should remove (read 2026-09-29, before this branch ships)

```
== origin/copy/unslop-platform
- 3f3c41afe8c88e4f73b2a857db5a19d15f952bf0 docs(copy): R33 Part B -- platform copy inventory, investigate only
- 07e71f933d96a282bc14c4f7890a9eb2427f8dcb docs(copy): R37 Part B checkpoint -- plan, churn, six questions, before PDFs
== origin/copy/unslop-platform-inventory
- 99b159faccc083be9699907d48b5669029067fef docs(copy): R33 Part B -- platform copy inventory, investigate only
```

Neither has a `+` commit. Their commits were cherry-picked onto `copy/unslop-platform-b` (`8af3db3`, `6ae0aca`), which is in main. Both local branches exist and neither is checked out in a worktree, so both should go on origin and locally.

## What this does not prove

- **No ship ran.** The ship_gate hook gates every run of `scripts/ship.ps1`. The cleanup script ran for real against the scratch remote; the ship's wiring to it is R31's, read as text by `test_cleanup_runs_only_after_ship_verified`.
- **Which copy runs.** The ship runs the cleanup from the ship worktree after the merge, so this branch's own ship should already use the new rule. That is read from the code, not observed; the ship's output will show it (the header line names R44).
