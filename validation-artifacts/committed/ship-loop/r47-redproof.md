# R47 red-proof: local-only branches, recorded throwaways, real work listed once

The ruling is in `rulings.md`. After "SHIP VERIFIED" the cleanup also removes local branches with no origin twin that are already in main, and throwaway red-proof branches whose last sha a committed red-proof doc records, each with its restore command. Real unmerged work is never touched and is listed once per ship. Red-proven with the scratch remote.

Branch `ship-loop-r47`, off main at `09b2210`, 2026-09-29.

## What was built

- **`scripts/branch-cleanup.ps1`.**
  - **Every local deletion now prints its restore command**: `deleted local <name> at <sha>   (restore: git branch <name> <sha>)`.
  - **`Test-Recorded(name, sha)`**: true when a file under `validation-artifacts/committed/` with `redproof` in its name, read from the new main (`git grep` on the main commit), contains both the branch name and at least the first 7 characters of its tip. *Chosen, not ruled:* the name and the sha must be in the same doc, so a sha that happens to appear elsewhere never retires a branch.
  - **Origin loop:** an unmerged throwaway on origin whose sha is recorded is now deleted (origin, then its local branch only if at the same sha). An unrecorded one is listed, as R32 did.
  - **New local loop:** for every local branch that is not `main`, not on origin, and not already judged by the origin loops:
    - in main by ancestry or patch: removed under R31's worktree rules (never `_ship`, never outside `.claude\worktrees`, locked or dirty listed, junctions unlinked first, no `--force`);
    - a throwaway (`redproof` in the name) whose sha is recorded: removed;
    - an unrecorded throwaway: kept and listed;
    - anything else: real work, never touched, listed once under "Unmerged work, kept (R47):".
  - Unmerged branches on origin stay unmentioned, as before.
- **`scripts/ship.ps1`:** unchanged.

## The scratch remote

A `locals_` fixture on R31's:

| Branch | Built as | Expected |
|---|---|---|
| `local-l` | local only, at a commit in main | deleted locally, restore printed |
| `local-dirty` | local only, in main, dirty worktree | kept, listed |
| `rec-redproof` | origin + local, unmerged, recorded in `change-redproof.md` (7-char sha) | deleted on origin and locally, restore printed |
| `loc-redproof` | local only, unmerged, recorded (full sha) | deleted locally, restore printed |
| `unrec-redproof` | local only, unmerged, recorded nowhere | kept, listed |
| `elsewhere-redproof` | local only, its sha only in `notes.md` (not a red-proof doc) | kept, listed |
| `real-work` | local only, unmerged | never touched, listed exactly once under "Unmerged work, kept (R47):" |

R31's own branches are not judged twice: `dirty-d` and `ahead-f` still appear once each in "Left for Ryan", and `unmerged-c` (on origin) is still not mentioned.

## Red before the fix

With the new tests and the R46 script: `4 failed, 14 passed`. The four were the local-only, recorded-throwaway, unrecorded-throwaway and listed-once tests; the second-run test passes both before and after.

## Green after

`tests/test_branch_cleanup.py`: `18 passed` (R31 5, R44 4, R46 4, R47 5). Full backend suite: `2387 passed, 2 skipped`.

## What this ship's cleanup should do (read 2026-09-29, before the ship)

Local branches in the main checkout's repo, with no origin twin:

| Branch | Tip | In main | Worktree | Expected |
|---|---|---|---|---|
| `copy/unslop-platform-b` | 8215533 | yes | none | deleted |
| `copy/unslop-public` | a0f1c48 | yes | none | deleted |
| `s2-triage-2` | 60098ae | yes | none | deleted |
| `worktree-s2-ui-inventory` | 60098ae | yes | none | deleted |
| `issue-178-snapshot-fixes` | 1513fbc | yes | `.claude\worktrees\issue-136-single-lane-block`, unlocked | worktree removed if clean (its ignored files, such as its `.venv`, go with it; junctions unlinked first), then the branch; listed if dirty |
| `ship/r42-r45` | 09b2210 | yes | none after this session switched branches | deleted |
| `ship-loop-1-redproof` | 6846e34 | no | none | deleted: `change1-redproof.md` names it and records `6846e34` as "Recovery sha of the branch tip" |
| `issue-162-mapbox-browser-token` | 274f37a | no | none | listed once, never touched |
| `worktree-issue-151-jurisdiction-deltas` | 0b48b17 | no | `.claude\worktrees\issue-151-jurisdiction-deltas` | listed once, never touched |
| `ship-loop-r47` (this branch) | — | yes after the ship | this session's, locked | origin deleted by R31; local kept and listed while locked |

On origin, `docs-287-phase0-complete` and `issue-243-note-8` are unmerged work and stay unmentioned.

## What this does not prove

- **No ship ran.** The ship_gate hook gates `scripts/ship.ps1`; the cleanup ran for real against the scratch remote only.
