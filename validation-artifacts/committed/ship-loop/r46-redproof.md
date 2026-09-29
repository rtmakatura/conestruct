# R46 red-proof: the cleanup deletes the branches a restack says it carries

The ruling is in `rulings.md`. A restacked or rebuilt branch commits `scripts/superseded.txt`, one line per branch whose work it carries. After "SHIP VERIFIED" the cleanup reads that file from the new main and deletes each listed branch under R31's rules. Red-proven with the scratch remote.

Built on `ship/r42-r45`, 2026-09-29, so this ship's own cleanup already applies it.

## Why R44 was not enough

A conflict resolution during a restack changes a commit's patch. `copy/leftovers`'s 4012524 became d6d7971 on the stack, differing only in `rulings.md`'s context, so `git cherry` prints `+` for it and R44 correctly keeps the branch. Only a record written at the restack can say the work is carried.

## What was built

- **`scripts/branch-cleanup.ps1`.**
  - R31's per-branch deletion (gh-only push with a lease, printed sha and restore command, then the local branch and its worktree: never `_ship`, never outside `.claude\worktrees`, locked or dirty listed, junctions unlinked first, no `--force`) moves into one function, `Remove-Branch`. The ancestry/patch loop (R31, R44) calls it unchanged.
  - A second loop reads `git show <main>:scripts/superseded.txt`. For each `<branch> <sha>` line:
    - `main` (and `HEAD`) are skipped, whatever the list says.
    - A branch with no origin ref and no local ref is skipped silently (already gone). Lines stay in the file as the record.
    - **Chosen, not ruled:** a branch whose origin tip is not the listed sha is kept and listed for Ryan ("moved since it was listed"). The lease then pins the deletion to the listed sha, so work added after the restack is never deleted by the list.
    - Otherwise `Remove-Branch` deletes it; its local branch goes only while it also sits at the listed sha.
  - The header reads "Branch cleanup (R31, R44, R46): … by ancestry, by patch or by superseded.txt".
- **`scripts/superseded.txt`**, the first list: `ship-cleanup-superseded`, `sheet-flair` and `copy/leftovers` (carried by this branch), and `copy/unslop-platform` and `copy/unslop-platform-inventory` (carried by `copy/unslop-platform-b`, already in main). Each sha was checked against origin before commit: all five match.
- **`scripts/ship.ps1`:** unchanged; step 8 runs the cleanup after SHIP VERIFIED.

## The scratch remote

`tests/test_branch_cleanup.py` adds a `listed` fixture on R31's: main carries a `scripts/superseded.txt` naming

| Branch | Built as | Expected |
|---|---|---|
| `rebuilt-x` | one commit `git cherry` cannot match in main | deleted on origin and locally, sha and restore printed |
| `moved-y` | listed at its first commit, then pushed one more | kept on origin at the new tip; listed "moved since it was listed" |
| `locked-z` | its own commit, checked out in a locked worktree | origin deleted; worktree and local branch listed |
| `gone-w` | never existed | skipped, no failure |
| `main` | listed on purpose | never deleted |

## Red before the fix

With the new tests and the R44 script: `3 failed, 10 passed`. `test_a_listed_branch_goes_though_git_cherry_cannot_match_it`, `test_a_listed_branch_that_moved_since_the_listing_is_kept_and_listed` and `test_a_listed_branch_keeps_the_r31_safety_rules` failed; `test_a_second_run_with_the_list_deletes_nothing` passes both before and after (its job is to fail if a second run ever deletes).

## Green after

`tests/test_branch_cleanup.py`: `13 passed` (R31's 5, R44's 4, R46's 4). Full backend suite: see the commit.

## What this ship's cleanup should do (read 2026-09-29, before the ship)

- By R46's list: delete `copy/leftovers` (the one R44 keeps), and `sheet-flair`, `ship-cleanup-superseded`, `copy/unslop-platform`, `copy/unslop-platform-inventory` (R44 already catches those by patch; whichever loop reaches them first deletes them, the other finds them gone).
- By R31: `ship/r42-r45` itself on origin; its local branch stays while this session's worktree holds it, and is listed.

## What this does not prove

- **No ship ran.** The ship_gate hook gates `scripts/ship.ps1`; the cleanup ran for real against the scratch remote only.
