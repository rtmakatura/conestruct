# The cosmetic lane and five speed fixes: rulings

*Arc `cosmetic-lane`, 2026-11-03. Prompt: `cc-prompt-cosmetic-lane.md`. It follows the speed audit of 2026-11-03 (median 46 min per small change, about 6 of them the change itself).*

## R numbers
The highest R number in use before this arc was R155 (#331, `validation-artifacts/committed/issue-331-lsd-sign-distance/rulings.md:3`). Assigned in the ruling order:
- **R156** = Ruling A (the cosmetic lane)
- **R157** = Ruling B (handoff.md stays lean)
- **R158** = Ruling C (ship_gate blocks runs, never mentions)
- **R159** = Ruling D (orphan dev servers cleared at session start)

## Rulings (Ryan, 2026-11-03), word for word

```
RULING A — The cosmetic lane.
Scope: a change that alters only how the frontend looks or reads, on any page including /sandbox: copy, CSS, layout, SVG, marker styling, using existing type roles and tokens. A change is in the lane only if its diff touches no backend file, no API route, no middleware or gate, nothing under lib/ except lib/design/, no wire field, no scenario/audit/pricing/MUTCD logic, no PDF content, and needs no new type size or hex exception. CC checks this from the diff paths before pushing and states the result on the first line of its report. If any file falls outside, the change leaves the lane and runs the full process.
Procedure:
1. No issue required (R146 does not apply in this lane); the handoff session log names the change.
2. No checkpoint. Rulings appended to rulings.md word for word as the first commit, as today.
3. Build. Run the formatter before any test, screenshot or commit, so the evidence sha is final.
4. Local checks: the affected vitest files only; tsc runs in the commit hook. No full pytest, mypy or ruff locally; CI runs them and R50 blocks the ship on red.
5. If a dev server is already up, take one crop of the changed region at 1440 and 390 for the reviewer. No axe, contrast or target suite locally. Do not start a dev server for this.
6. The independent reviewer runs on the diff, the crops and every user-facing string (unslop rules, Rule 10). It must pass before commit. The diff-verifier does not run in this lane.
7. Push and print the preview: and result: lines immediately. Do not wait for CI before result:.
8. Ryan's hand-check on the preview is the visual gate.
9. Ready cosmetic branches stack on each other so one go ships the batch.
10. After the ship: the light lane's four-step prod smoke only. No CC prod check, no evidence branch.
If the reviewer finds a product defect or CI is red at ship, fix on the same branch and stay in the lane. R29, R50, the ship_gate and Ryan's go are unchanged.

RULING B — handoff.md stays lean.
handoff.md holds the current state, § Next, the board, the ship loop, standing conventions and cautions, and the light/cosmetic lane procedures. Shipped-work logs older than the current board move verbatim to handoff-archive.md, which no session reads at start. Nothing is deleted or reworded in the move.

RULING C — ship_gate blocks runs, never mentions.
The ship_gate blocks a command that executes ship.ps1 (directly, via pwsh/powershell, or via &). Reads, greps, heredocs and file views that merely contain the text "ship.ps1" pass. A branch name followed by a full stop in the result: line or in Ryan's go matches the same branch.

RULING D — orphan dev servers are cleared at session start.
/start lists node processes running next dev from this repo or its worktrees, kills any not started by this session by process tree, and reports what it killed. Session end still kills the session's own server by process tree.
```

## R145 self-ruled calls
- **C1 (R158): a positional branch is the branch.** The ship script's first parameter is `$Branch`, so `pwsh <script> <branch>` names it as surely as `-Branch <branch>`. Three real ships were refused for this before (2026-10-18 `issue-340-field-named-refusals`, 2026-10-20 `issue-342-buffer-devices` ×2; `gate-replay.md`). The go must still name the same branch.
- **C2 (R158): an interpreter string that spawns the script is a run.** Ruling C names direct, pwsh/powershell and `&`. A `python -c` / `node -e` string that names the script AND spawns a process (subprocess, os.system, spawn, exec...), `bash/sh/cmd -c`, `Start-Process`, `Invoke-Expression`/`iex` and dot-sourcing (`. <script>`) are also gated, so a passing mention can't become a bypass. A heredoc fed to an interpreter (`python - <<EOF`) stays unseen, as Ruling C says heredocs pass; the hook's docstring states it.
- **C3 (R158): a command that only mentions the script still gets rule 2's git checks** (it used to skip them whenever the text matched). Tested: `grep ... <script>; git rebase feature` on main is blocked.
- **A1 (R156): the check is a Python script** (`scripts/cosmetic_lane_check.py`), like the other repo checks, importable by its tests. "no wire field" and "no scenario/audit/pricing/MUTCD logic" are read by path: those live under `lib/`, `app/api/` or the backend, all OUT. Logic written inline in a component can't be seen from a path; R156 step 6's reviewer covers it.
- **A2 (R156): "a new type size or hex exception"** = a quoted value (`"13.5px"`, `"clamp(...)"`, `"#3a3a3a"`) added to `lib/design/type-exceptions.ts` or `lib/design/ink-exceptions.ts` that the base file doesn't already hold. A quoted issue reference such as `"#436 ruling 2"` is not a value.
- **A3 (R156): the round's own evidence and rulings** (`validation-artifacts/committed/**`) and `conestruct/site/DESIGN-*.md` are in the lane; the site's build, dependency and Sentry config, `db/` and `conestruct/site/tests/` (build and gate helpers) are OUT.
- **B1 (R157): what stays in § Next.** The open entry (#438, paused), the latest shipped entry (#437, which names the pending evidence branch and the next step), and two standing notes that aren't shipped-work logs (the #357 flag, the #345 ship-gate notes). Every other § Next bullet and every `## #NNN ... shipped` section moved, in order, to the end of handoff-archive.md under "Moved from handoff.md on 2026-11-03 (R157, verbatim)".
- **D1 (R159): the sweep is a script** (`scripts/orphan_dev_servers.py --kill`), so its match rule is tested. It matches a `next dev` (or Next's dev-server entry, or `npm run dev`) whose command line names a path inside the repo root, worktrees included; a process whose command line can't be read is never touched. A child whose parent is also matched is left to the parent's tree kill. `--keep <pid>` spares a server this session started.

## Rule 5: the prediction and the outcome
Predicted before the diff: tracked changes only in `scripts/hooks/ship_gate.py`, `tests/test_ship_gate.py`, two new scripts with their tests, and this folder; no product file; no existing test's expectation changes (the old blocked-run tests keep blocking). Actual: as predicted. The 83 existing ship_gate tests are unchanged and green. Of the 26 new R158 cases, 13 are red on the old hook (`red-proof.txt`: the mentions, heredocs, the full-stop go, the positional branch, the mention-keeps-git-checks case) and 13 were already green there (the 10 blocked runs, the escaped `rg` pattern, the plain go, the positional mismatch), since the old hook blocked every mention; all 109 pass on the new hook.
