# R31/R32 red-proof: branch cleanup after a verified ship

The rulings are in rulings.md. After "SHIP VERIFIED" the ship deletes every origin branch already in the new main, plus its local branch and worktree, and never `_ship` or main. Unmerged branches are untouched, and unmerged throwaway red-proof branches are listed for Ryan. Red-proven with a scratch remote.

Branch `ship-branch-cleanup`, stacked on `ship-env-check`, 2026-09-28.

## What was built

- **`scripts/branch-cleanup.ps1 -Main <sha>`.**
  - **Branches on origin:** for each branch whose tip is an ancestor of `<sha>` (main excluded), it deletes the branch through the gh-only push (R27), with `--force-with-lease=refs/heads/<name>:<sha>` so a branch that moved since the fetch is refused. It prints `deleted origin/<name> at <sha>   (restore: git push origin <sha>:refs/heads/<name>)`.
  - **The local branch of the same name:** deleted only if its own tip is also in main.
  - **Its worktree:** removed only if it is under `.claude\worktrees`, is not `_ship`, is clean and is not locked. Every junction or symlink inside is unlinked first, and it never uses `--force`.
  - **Left for Ryan:** anything it would not remove is listed there, and so are unmerged branches named `*-redproof*` (R32).
- **`scripts/ship.ps1` step 8:** runs the cleanup after the SHIP VERIFIED block. Both NOT VERIFIED verdicts `exit 1` before it. A failed cleanup prints "CLEANUP INCOMPLETE" and does not un-verify the ship.

**R32's throwaway rule is a naming convention, chosen, not ruled:** a throwaway red-proof branch has `redproof` as a hyphen-separated word in its name. Every existing one does (`ship-loop-1-redproof`, the deleted `ship-loop-redproof`). CC still names each throwaway in its report with its last sha.

## Red before the fix

At `6b23a22`, `tests/test_branch_cleanup.py` ran `5 failed`: the three scratch-remote tests on the missing script, the wiring test with `([181], [])` (no cleanup line in the ship script), and the push/remove test with `FileNotFoundError`. The scratch remote and its worktrees were built each time; only the script and the wiring were missing.

## The scratch remote

The scratch setup has a bare `remote.git` and a clone standing in for the main checkout. `main` is fast-forwarded to `stacked-b`, which sits on `merged-a`. The worktrees are under `repo/.claude/worktrees`:

| Branch | State | Worktree |
|---|---|---|
| `merged-a` | in main | clean, holds a `node_modules` **junction** to a directory outside it with `sentinel.txt` |
| `stacked-b` | in main (= main's tip) | none |
| `done-redproof` | in main | none |
| `old-redproof` | unmerged throwaway | none |
| `unmerged-c` | unmerged | clean |
| `dirty-d` | in main | uncommitted edit |
| `locked-e` | in main | locked |
| `ahead-f` | in main on origin; local has one more commit | none |
| (none) | `_ship` detached at main | |

Output of run 1, with the tmp path shortened:

```
Branch cleanup (R31): branches already in main e8bea03
  deleted origin/ahead-f at 530ba67551600d64b5c405217bc4becdc0271112   (restore: git push origin 530ba67551600d64b5c405217bc4becdc0271112:refs/heads/ahead-f)
  deleted origin/dirty-d at 530ba67551600d64b5c405217bc4becdc0271112   (restore: …)
  deleted origin/done-redproof at 530ba67551600d64b5c405217bc4becdc0271112   (restore: …)
  deleted local done-redproof at 530ba67551600d64b5c405217bc4becdc0271112
  deleted origin/locked-e at 530ba67551600d64b5c405217bc4becdc0271112   (restore: …)
  deleted origin/merged-a at 530ba67551600d64b5c405217bc4becdc0271112   (restore: …)
  unlinked <tmp>\run\repo\.claude\worktrees\merged-a\node_modules (a link; its target is untouched)
  removed worktree <tmp>\run\repo\.claude\worktrees\merged-a
  deleted local merged-a at 530ba67551600d64b5c405217bc4becdc0271112
  deleted origin/stacked-b at e8bea03fbbb90abbe94cdadaff1e7d55c85e6d7d   (restore: …)
  deleted local stacked-b at e8bea03fbbb90abbe94cdadaff1e7d55c85e6d7d
Left for Ryan:
  ahead-f -- local branch at 8ff0e296aab90723819136f4faa9452335913968 has commits main lacks; kept
  dirty-d -- worktree <tmp>\run\repo\.claude\worktrees\dirty-d has uncommitted changes; worktree and local branch kept at 530ba67…
  locked-e -- worktree <tmp>\run\repo\.claude\worktrees\locked-e is locked (a live session?); worktree and local branch kept at 530ba67…
  old-redproof at b95eed7304d477d36770ec66bf157194ddc0c875 -- unmerged throwaway red-proof branch (R32); delete it on origin when done
 exit=0
```

Afterwards:
- **origin:** `main`, `old-redproof`, `unmerged-c`.
- **Local branches:** `ahead-f`, `dirty-d`, `locked-e`, `main`, `old-redproof`, `unmerged-c`.
- **Worktrees:** `_ship` (still at `e8bea03`, detached), `dirty-d` (edit intact), `locked-e`, `unmerged-c`.
- **The sentinel behind the removed worktree's junction:** `keep me`.

Run 2 deleted nothing: `no merged branches on origin.`, and `old-redproof` is listed again.

Tests: `tests/test_branch_cleanup.py` has 5 passed; the ship-loop suites have 100 passed; the full `tests/` has `2353 passed, 2 skipped`.

## Control: why the unlink is load-bearing

This was a clean worktree holding a `node_modules` junction to a directory with `sentinel.txt`, removed with plain `git worktree remove` (no `--force`, no unlink first):

```
git worktree remove exit=0
sentinel survives: False | target dir exists: True
```

Git on Windows followed the junction and deleted the files behind it, leaving the empty target directory. In the real repo that target is the main checkout's `node_modules`. The cleanup unlinks every junction first and was proven above to leave the target intact.

## What the first real run will touch (read 2026-09-28, before this branch ships)

- **origin branches already in `origin/main`, which the ancestor rule deletes (25):**
  - `coming-soon-*` ×7
  - `docs-issue-citations`, `golive-check`
  - `issue-289-final-evidence`, `issue-290-*` ×8, `issue-301-band-aerial`
  - `light-sheet-flip`, `s2-ui-inventory`, `ship-creds-frontend-only`
  - `ship-loop`, `ship-loop-1`, `ship-loop-3`
- **Branches this ship adds to that list:** `ship-env-check` and `ship-branch-cleanup`.
- **Unmerged, untouched:** `docs-287-phase0-complete`, `issue-243-note-8`. Listed for Ryan (R32): `ship-loop-1-redproof`.
- **Worktrees:** `light-sheet-flip` (branch `ship-creds-frontend-only`) and `ship-env-check` (now on branch `ship-branch-cleanup`) are locked by Claude sessions, so each stays, with its local branch, and is listed. A clean, unlocked worktree for a merged branch (for example `ship-loop-1`, `issue-cites` on `docs-issue-citations`, `coming-soon-gate` on `coming-soon-photos`) is removed; a dirty one is listed.

## What this does not prove

- **No ship ran.** The ship_gate hook gates every run of `scripts/ship.ps1`, so the step-8 wiring is proven as text: after the SHIP VERIFIED line, with both NOT VERIFIED verdicts exiting before it.
- **The first ship won't clean up.** The ship of this branch runs main's copy of `ship.ps1` from before R31, so it does no cleanup, and `light-sheet-flip` and `ship-creds-frontend-only` go on the first ship after it. The same was true for R27 and R29.
- **Lingering local branches.** A local branch whose origin twin was already deleted (by an earlier run or by hand) is no longer matched, so it is not revisited. It was listed for Ryan on the run that deleted its twin.
