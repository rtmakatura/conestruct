# ship-loop: checkpoint before building Change 3 (R8)

**Ruled:** R4 and R5 (`rulings.md`). CC may merge and push `main` **only** by running `ship.ps1`,
from a dedicated ship worktree, after Ryan writes `ship <branch>` naming a branch in CC's last
report. One go = one branch = one run. The PreToolUse hook is the real guard. After the run, CC
pastes the healthz sha, the served sha (or the skip) and the `ship.ps1` output, and Ryan's browser
check closes the ship.

This file is the build plan, and four questions that change what gets built. **Nothing is built
until you answer them.**

## The design

### A. `ship.ps1` works in a ship worktree, never your checkout

- **Today:** `$RepoDir` is the shared checkout (`ship.ps1:22`, `Set-Location` at `:115`, after
  `aee5a5c`). It does `git checkout main` there, merges a **local** branch ref and pushes.
- **New:** `$ShipDir = <repo>\.claude\worktrees\_ship`. On each run it:
  1. creates the worktree if it is missing (`git worktree add --detach`);
  2. `fetch`es and detaches at `origin/main`;
  3. `merge --ff-only origin/<branch>`. The branch must be **pushed**, which ties the go to the
     sha you reviewed;
  4. `push origin HEAD:main`;
  5. `modal deploy` from that worktree, so `_git_sha()` (`modal_app.py:32`) reads the shipped sha;
  6. runs the healthz poll (step 6) and the served-sha check (step 7), as now.
- **Your shared checkout is never touched.** It no longer needs to be clean or on `main`. The
  tracked-changes check moves to the ship worktree.
- **Self-update.** A copy of `ship.ps1` run from anywhere first refreshes `_ship` to `origin/main`.
  If the running file differs from `_ship\scripts\ship.ps1`, it re-runs that copy with the same
  arguments. So a stale copy (your checkout's, which stops moving once CC ships) always hands
  over to `main`'s current version.
- **New `-DryRun`:** it does steps 1–3 and stops. It prints the ff range it **would** push, then
  discards the merge. The hook treats it exactly like a real run, so the red-proofs below can use
  real gos without shipping.

### B. `ship_gate.py`, a PreToolUse hook on the Bash and PowerShell tools

| Command | Allowed only if |
|---|---|
| any command containing `ship.ps1`, except `-FrontendCheckOnly` (read-only) | (1) the **latest human message** in the transcript is exactly `ship <branch>`, with nothing else; (2) `<branch>` appears as a whole word in **CC's last report**, defined as the last assistant message before that go containing a `result:` line; (3) the command's `-Branch` equals `<branch>`; (4) that go has not been used. The go's message id is recorded in a ledger on first use |
| `git push` whose target is `main`: `main`, `HEAD:main`, `…:refs/heads/main`, `+main`, or a bare `git push` while on `main` | **never.** Only `ship.ps1` pushes `main` |
| `git merge` / `git pull` while the current branch is `main` | **never** |
| everything else | allowed (the hook says nothing) |

- **Fails CLOSED.** Any error, an unreadable transcript, or a missing ledger **blocks** a
  `ship.ps1` command. The verdict hook fails open (`verdict_hook.py:11-12`), and a guard must not.
- **Exit 2 with a reason on stderr**, which CC sees and reports. For example: `BLOCKED by
  ship_gate: no "ship <branch>" go in the latest message`.
- **The source is tracked** (`scripts/hooks/ship_gate.py`, with `tests/test_ship_gate.py` over
  synthetic transcripts). `.claude/settings.json` points at the **ship worktree's** copy, which
  every ship refreshes to `main`. The ledger lives at `.claude/ship-gate-ledger.json` (untracked).

### C. The wording (untracked files; applied by hand at build, and shown in the report)

- **`CLAUDE.md:27`:** "Deploy: `ship.ps1` … CC runs it only after Ryan writes `ship <branch>` in
  the CC session, naming a branch CC stated in its last report. One go = one branch = one run.
  The `ship_gate` PreToolUse hook enforces it. **This is the one named exception to the
  background-job rule 'never push to main, never merge': CC merges and pushes `main` only through
  `ship.ps1` on that go.** After the run CC pastes the healthz sha, the served sha (or the skip),
  and ship.ps1's full output; Ryan's browser check closes the ship."
- **`handoff.md:50`, `:77`, `:87`:** as in `checkpoint.md` (Change 3 table).
- **The session rule "Give ONE ship line; never ship"** becomes "End with the go to type:
  `ship <branch>`; run nothing until it is typed."

## Red-proof (R4), each case both in pytest and live in a session with you

| Case | How | Expected |
|---|---|---|
| no go | CC runs `ship.ps1 -Branch X -DryRun` with no go typed | BLOCKED |
| a used go | you type `ship X`; CC runs `-DryRun` (allowed), then runs it again | the second is BLOCKED |
| a branch not in the last report | you type `ship Y`, where Y is not in CC's last report | BLOCKED |
| a mismatched `-Branch` | go `ship X`, command `-Branch Y` | BLOCKED |
| a go plus other words | "ship X please" | BLOCKED (exact form only) |
| `git push origin main`, `git push origin HEAD:main`, bare `git push` on main | CC runs each in a scratch clone whose `origin` is a local bare repo | BLOCKED (and it could not reach GitHub anyway) |
| `git merge` on `main` | the same scratch clone | BLOCKED |
| a branch push (`git push origin some-branch`) | the same | allowed |
| a hook error (the transcript path is unreadable) | pytest | BLOCKED (fails closed) |
| the real ship | you type `ship ship-loop` after Change 3 lands | one ship, output pasted |

## Questions (they change what gets built)

1. **"Any git push/merge outside ship.ps1" (R4):** I read it as pushes and merges that **move
   `main`**. CC pushes feature branches on every arc, and blocking all pushes would stop that.
   **Recommend:** block anything that targets `main`, and allow branch pushes. Confirm, or say to
   block every push.
2. **What counts as "CC's last report":** the last assistant message containing a `result:` line
   (the job-list convention). **Recommend** this. The alternative is the last assistant message
   of any kind, which a mid-work "pushed" line would then satisfy.
3. **The live red-proof needs you for about 5 minutes,** typing three gos (`ship X`, reused; and
   `ship Y`) in one session, all against `-DryRun`. OK?
4. **The first ship after Change 3 lands is yours**, run by hand as today, because the hook's copy
   in `_ship` doesn't exist until one ship has run. **Recommend:** yes, then the next ship is
   CC's.

**Estimate:** about 3.5 h. `ship.ps1` with the worktree, self-update and `-DryRun` is 1.25 h. The
hook and pytest are 1.25 h. The live red-proof with you is 0.5 h. The wording and report are 0.5 h.

**One risk found, not resolved yet:**
- **The concern:** this session's worktree guard refuses git commands aimed outside the session's
  worktree. `ship.ps1` doing git in `_ship` is script-internal, and the guard allowed exactly that
  shape today (`ship.ps1 -FrontendCheckOnly` ran `git -C` from the PowerShell tool).
- **Plan:** the first live `-DryRun` shows whether a full run is let through. If it isn't, I stop
  and report; I don't work around it.
