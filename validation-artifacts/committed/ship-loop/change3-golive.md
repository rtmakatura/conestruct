# ship-loop Change 3: build record and go-live steps

**Built on `ship-loop-3`:**
- `623459b`: R9–R15, verbatim.
- `bd09f7e`: `ship.ps1` in a ship worktree, `scripts/hooks/ship_gate.py`, `tests/test_ship_gate.py`.
- `e544f39`: `[CmdletBinding()]`, and the guarded handover. It also corrects `bd09f7e`'s
  transition note.

**Per R13, the hook is not live.** It goes live only after your manual ship of this branch, by
the steps below, in this order.

## What is proven already

| Item | Evidence |
|---|---|
| R14: a full run works in the ship worktree | `ship.ps1 -Branch ship-loop-3 -DryRun -Handoff`, run from CC's PowerShell tool: it created `.claude\worktrees\_ship`, fast-forward merged `origin/ship-loop-3`, printed `623459b` and `bd09f7e`, and reset. `origin/main`, `_ship` and prod healthz were still `55c9054` afterwards |
| Unknown parameters fail | `-Bogus`: "A parameter cannot be found that matches parameter name 'Bogus'", exit 1 |
| No handover to a copy that would ignore `-DryRun` | against today's `main` (the Change 2 `ship.ps1`, which has no `-Handoff`): "SHIP FAILED: main's ship.ps1 predates the ship worktree (no -Handoff)…", exit 1, nothing merged |
| The hook (R4, R10, R11) | `tests/test_ship_gate.py`, 54 cases through the real hook, all pass. **Mutation check:** with `decide()` neutered, 39 of 54 fail, which is every blocking case |
| R15 | `origin/ship-loop-redproof` deleted (`ls-remote` shows 0 heads). Recovery sha `ca70344` is still in the object store |

## Go-live, after your manual ship (R13)

1. **You ship this branch by hand, as today:** `.\scripts\ship.ps1 -Branch ship-loop-3`.
   - Your checkout's copy is the Change 2 `ship.ps1`, so it merges and pushes from your checkout
     exactly as before.
   - That is the last ship to do so.
2. **CC refreshes the ship worktree to the shipped `main`.** It runs a read-only
   `ship.ps1 -DryRun -Handoff` with no branch, which fetches, detaches `_ship` at `origin/main`,
   pushes nothing and prints nothing to ship.
   - **Why this comes before step 3:** the hook runs from `_ship`'s copy. If that file were missing,
     `python` would exit 2, and Claude Code treats exit 2 as **block**, so every Bash and
     PowerShell command would be blocked. CC confirms
     `.claude\worktrees\_ship\scripts\hooks\ship_gate.py` exists before step 3.
3. **CC registers the hook** in `.claude/settings.json` (untracked; the diff is shown in the
   report). The `Stop` hook is kept as is:

   ```json
   "PreToolUse": [
     {
       "matcher": "Bash|PowerShell",
       "hooks": [
         {
           "type": "command",
           "command": "C:/Users/rtmak/Documents/traffic-control-tool/.venv/Scripts/python.exe C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/_ship/scripts/hooks/ship_gate.py"
         }
       ]
     }
   ]
   ```

   **Claude Code reads hooks when a session starts.** A running session may need `/hooks` (review
   and accept) or a restart to pick it up. The live red-proof runs in a session where `/hooks` lists
   it.
4. **CC applies the wording** (untracked files; before and after shown in the report):
   - **`CLAUDE.md:27`** becomes: "Deploy: `ship.ps1` works in the ship worktree
     (`.claude\worktrees\_ship`) and merges the pushed `origin/<branch>`. CC runs it only after
     Ryan writes `ship <branch>` in the CC session, naming a branch in CC's latest `result:` line.
     One go = one branch = one run. The `ship_gate` PreToolUse hook enforces it. This is the one
     named exception to the background-job rule 'never push to main, never merge': CC moves `main`
     only through `ship.ps1` on that go. After the run CC pastes the healthz sha, the served sha (or
     the skip) and ship.ps1's full output; Ryan's browser check closes the ship."
   - **`handoff.md:50`:** "Never two ship gos — CC stacks ready branches onto one. `ship <branch>`
     must name the branch in CC's latest `result:` line."
   - **`handoff.md:77`:** "…the verbatim verdict, and the go to type: `ship <branch>`."
   - **`handoff.md:87`:** "…ship.ps1 merges the pushed `origin/<branch>` fast-forward only; the hook
     refuses a branch CC did not state."
   - **`handoff.md:47`:** (gh drafts; Ryan runs them) unchanged.
5. **The live red-proof (R12), about 5 minutes of yours, all against `-DryRun`.** CC first posts a
   report whose `result:` line names a throwaway branch `golive-check`, pushed at `main`. Then:

   | You type | CC runs | Expected |
   |---|---|---|
   | (nothing new) | `ship.ps1 -Branch golive-check -DryRun` | **BLOCKED**: no go |
   | `ship golive-check` | the same | allowed; dry-run output, nothing pushed |
   | (nothing new) | the same again | **BLOCKED**: the go was already used |
   | `ship other-branch` | `ship.ps1 -Branch other-branch -DryRun` | **BLOCKED**: not in the `result:` line |
   | `ship golive-check` | `ship.ps1 -Branch golive-check -DryRun` | allowed (a new go) |

   Plus, with no go needed, run in a scratch clone whose `origin` is a local bare repo, so nothing
   can reach GitHub even if the hook failed: `git push origin main`, `git push -f origin x`, and
   `git push origin --delete x` are each **BLOCKED**. An ordinary branch push is allowed.
   The throwaway branch is deleted afterwards, by the same ruling's pattern.
6. **The next real ship is CC's,** on your `ship <branch>`.

## If the hook ever misbehaves

- **Remove the `PreToolUse` block** from `.claude/settings.json`; the `Stop` hook is separate.
- **Or run `/hooks`** and disable it.
- **The ledger** of used gos is `.claude/ship-gate-ledger.json`. Deleting it re-arms old gos. Don't,
  unless you mean to.
