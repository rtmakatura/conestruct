# The cosmetic lane and five speed fixes: rulings

*Arc `cosmetic-lane`, 2026-11-03. Prompt: `cc-prompt-cosmetic-lane.md`. It follows the speed audit of 2026-11-03 (median 46 min per small change, about 6 of them the change itself).*

## R numbers
The highest R number in use before this arc was R155 (#331, `validation-artifacts/committed/issue-331-lsd-sign-distance/rulings.md:3`). Assigned in the ruling order:
- **R156** = Ruling A (the cosmetic lane)
- **R157** = Ruling B (handoff.md stays lean)
- **R158** = Ruling C (ship_gate blocks runs, never mentions); amended in round 3: the mention-pass part is dropped, every command naming the script is gated again, the full stop and the R52 resume stay (§ Round 3)
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

## Amendments (Ryan, 2026-11-03, after the first report), word for word

Recorded as R156, R158 and R159 amendments, as Ryan asked. Ryan's text:

```
Q1: Yes. Allow lib/public-copy.ts, lib/coming-soon-copy.ts and lib/landing.ts by name. An edit to them is in the lane only if it changes string values and nothing else; if it touches imports, types, exports or logic it's OUT. lib/legal.ts stays out.

Q2: The reviewer writes the marker (verdict_hook.py write PASS), only when the lane check says IN LANE and only after the reviewer passes. Add the lane exception to CLAUDE.md's "only the diff-verifier writes" line. The hook itself stays unchanged.

R52 resume: allow `ship.ps1 -Resume -Sha <sha>` when <sha> is the tip of the branch named in the go used for this session's last ship, and that ship's output asked for the resume. Anything else stays blocked. Add tests for both.

R159: kill a repo dev server only if its parent process no longer exists. List the rest without killing them.

Stale #345 note: R157 governs the move only. Once R158 ships, mark the note superseded with one line pointing to R158.

Record these as R156/R158/R159 amendments in rulings.md word for word, re-run the reviewer and verifier, push, and print result:.
```

- **R156 amendment, Q1** (`scripts/cosmetic_lane_check.py`): the three copy modules are in the lane by name; `lib/legal.ts` stays OUT. **R145 self-ruled A4:** "string values and nothing else" is checked by masking every string literal in the base and the new file and requiring the rest to match but for whitespace. A comment edit and a `${...}` template count as code (OUT). A copy module checked with `--files` alone (no diff to read) is OUT, as is a new or deleted copy module. With the amendment, R33 Part A reads IN (its two copy-module edits were string values only); the other eight rounds are unchanged (`lane-check-nine-rounds.txt`).
- **R156 amendment, Q2:** CLAUDE.md's verifier line carries the lane exception; handoff.md § Cosmetic lane, `/start` and `/mission` § 2.2 give the reviewer the write step. `verdict_hook.py` unchanged.
- **R158 amendment, the R52 resume** (`scripts/hooks/ship_gate.py` `check_resume`): allowed only when (1) the transcript holds this session's last ship run (not a resume, not a frontend check), (2) the ledger records a used go for that run's branch, (3) that run's output says FRONTEND NOT VERIFIED and printed `-Resume -Sha <sha>` for this sha, and (4) <sha> is the tip of `origin/<branch>`; the R77 cwd rule applies too. Anything else is blocked with its reason. Tests: one allowed, four blocked (output didn't ask; not the tip; no ship this session; go never spent). Red-proof in `red-proof.txt`.
- **R159 amendment** (`scripts/orphan_dev_servers.py`): a match is killed only when its parent PID is not among the live processes (every process counts, readable command line or not); a match with a live parent is listed and left running. Two tests added.
- **R158 amendment, the stale #345 note:** after the ship, the "Ship-gate notes from #345" line in handoff.md § Next gets one line marking it superseded by R158 (handoff.md § Next records this as a post-ship step).

## The independent reviewer's FAIL (2026-11-03) and the repair

The reviewer, run on the amendment round, returned FAIL with two blocking findings; both were right and are fixed on this branch.
1. **Runs the gate read as mentions** (Ruling C says it "blocks a command that executes ship.ps1"): a bash `&` background job, `( )`, `$( )`, `{ }`, `if/then`, PowerShell `if { }` and `% { }`, `timeout`, `xargs`, `Get-Content … | iex`, `Start-Job -FilePath`, and a quoted `'<<EOF'` hiding later lines as a fake heredoc. **R145 self-ruled C4: the gate now fails closed.** A segment that names the script is a run unless its command only reads or prints (`_READERS`: grep, rg, cat, head, tail, sed, wc, ls, echo, Get-Content, Select-String, git, gh, …) or is python/node whose -c string names it without spawning a process; a command that names the script and also hands text to an evaluator (iex, Invoke-Expression, source, Start-Job, Invoke-Command, a bare shell on stdin) is a run as a whole; a `&` after other words ends the segment; a `<<` counts only outside quotes; `#` comments are dropped. **C5:** a bare `VAR=value` naming the path, or PowerShell `$v = "<quoted path>"`, is a mention; `$v = & '<script>'` is a run. 14 bypass tests and 2+2 assignment tests added; the 14 bypasses plus 3 flag cases are red on the first R158 hook (`red-proof.txt`).
2. **Copy edits the masker passed although Q1 sends them OUT:** an import path, a string-literal type, a comparison, a quoted key, code after a regex holding a quote, code after a nested template. **R145 self-ruled A5 (replaces A4): a "string value" is prose (a space, a capital, sentence punctuation or a non-ASCII letter) in a value position** (an object property value, an array element, or the whole initializer of a const/let/var), outside any `type`/`interface` declaration or a const's own type annotation. Every other string, comments, regexes and `${...}` templates stay as code; the lexer handles regex literals and nested templates. 8 code-string tests (OUT) and 2 prose tests (IN) added. On the real modules it marks 2 of 2 strings in public-copy.ts, 127 of 145 in coming-soon-copy.ts and 8 of 17 in landing.ts as copy. Known limit, stated in the docstring's spirit: a prose string that is a ternary branch inside an object value, or inside an object-type annotation in a function parameter, is treated as copy; R156 step 6's reviewer covers those.

Non-blocking findings, also fixed: (3) a `-FrontendCheckOnly` in a comment, a redirect target or quotes no longer makes a run read-only (only unquoted switches count; 3 tests); (4) the lane check lists paths with `--no-renames`, so a move out of `lib/` is checked under both names (1 test); (6) the resume check needs the ledger to hold the very go that preceded the last ship, not any go for that branch (1 test). (5) is for Ryan: under R159's amendment a `npm run dev` server whose cmd.exe parent outlived its session is listed, not killed; the code follows the ruling and the docstring no longer claims "its session or shell is gone".

## Rule 5: the prediction and the outcome
Predicted before the diff: tracked changes only in `scripts/hooks/ship_gate.py`, `tests/test_ship_gate.py`, two new scripts with their tests, and this folder; no product file; no existing test's expectation changes (the old blocked-run tests keep blocking). Actual: as predicted. The 83 existing ship_gate tests are unchanged and green. Of the 26 new R158 cases, 13 are red on the old hook (`red-proof.txt`: the mentions, heredocs, the full-stop go, the positional branch, the mention-keeps-git-checks case) and 13 were already green there (the 10 blocked runs, the escaped `rg` pattern, the plain go, the positional mismatch), since the old hook blocked every mention; all 109 pass on the new hook.
Amendment round (predicted before its diff: the same three scripts and their tests, CLAUDE.md, handoff.md and the two skills; no product file): as predicted. 5 resume tests (all red on the old hook, one on behaviour and four on the reason text), 13 copy-module test cases (4 string-only, 7 beyond string values, 1 legal, 1 with no diff) and 2 parent-rule tests added; one OUT case changed from `lib/public-copy.ts` (now in the lane by ruling) to `lib/legal.ts` and `lib/coming-soon-road.ts`. ship_gate 114 tests, lane check 52, orphan sweep 7. After the reviewer's FAIL repair (same files, predicted; no product file): ship_gate 137, lane check 63, orphan sweep 7; full pytest 3741 passed, 2 skipped.

## Round 3: Ryan's answer to the second FAIL (2026-11-03), word for word

```
Gate: drop the mention-pass part of R158. Revert the Bash gate to blocking every command that names the script, as before. Keep the full-stop match and the R52 resume amendment, with their tests. Confirm the ship_gate only matches Bash; if it also matches Read, Grep or Glob, let those through, since they can't execute anything. Add to CLAUDE.md: "Read or search ship.ps1 only with the Read and Grep tools, never through Bash; edit files that name it with Write or Edit, never a heredoc." Record this as an R158 amendment word for word.

Copy check: take your rule. A string counts as copy only if it has two words separated by a space, or it is a whole const value. One-word edits run the full process.

Fold in the reviewer's three non-blocking points. This is a new round, so the repair count resets. Re-run the reviewer and the verifier, push, and print result:.
```

- **R158 amendment, the gate** (`scripts/hooks/ship_gate.py`, rebuilt from origin/main's hook): the run parser (`ship_runs`, `_READERS`, the heredoc and segment logic, the positional branch) is gone. Every Bash or PowerShell command whose text names the script is gated as a ship, as before R158. Kept: the full-stop go (`removesuffix(".")`) and the R52 resume (`check_resume`, `last_ship`, `_go_was_used_for`), with their tests. The name match also takes a regex-escaped `ship\.ps1` (an `rg 'ship\.ps1'` slipped past the old hook).
- **Matchers, confirmed:** `.claude/settings.json` registers ship_gate on `"matcher": "Bash|PowerShell"` only; Read, Grep and Glob never reach it. If one did, it has no `command` and passes (3 tests). A test reads the matcher where settings.json exists (the main checkout; it skips in a worktree or CI, where the file is gitignored).
- **CLAUDE.md** (gitignored, main checkout) carries the sentence word for word on the deploy line.
- **R145 self-ruled G1: the two no-go forms pass only as one bare invocation.** Before R158 the hook let any command containing `-FrontendCheckOnly` and no `-Branch` through, so `& '<script>' # -FrontendCheckOnly` ran a ship with no go (the first reviewer's finding). Now `-FrontendCheckOnly [-SiteUrl <https url>] [-Sha <hex>] [-FrontendTimeoutMin <n>]` and `-Resume -Sha <hex>` skip the go only as `[powershell|pwsh <-NoProfile|-NonInteractive|-NoLogo|-ExecutionPolicy Bypass> -File | &] <path> <params> [2>&1] [| Tee-Object <file>]`, with an optional PYTHONIOENCODING=utf-8 prefix, full parameter names, each once. Anything added makes it a ship that needs the go.
- **R145 self-ruled G2 (the reviewer's non-blocking point 4): a ship with the go must be one bare run too.** `-Branch <b>` plus optional `-DryRun`, `-Handoff`, `-SiteUrl`, `-FrontendTimeoutMin`, full names, each once, in the same bare shape. PowerShell accepts shortened names (`-Bra`, `-Site`, `-Sh`) and positional values, and the old regex read the first `-Branch` anywhere in the text (`echo -Branch a; <script> b` shipped b on a's go). Anything else is refused before the go is spent, and the message says to read the script with the Read and Grep tools.
- **The copy rule** (`scripts/cosmetic_lane_check.py`, replaces A5): a string is masked as copy only if it is the whole initializer of a `const`, or has two words separated by a space (`[^\W_]+ [^\W_]+`) and sits in an object value, an array element or a let/var initializer. `NAV_KEYS`' one-word key names are code, so changing `"ArrowUp"` to `"Tab"` is OUT. On the real modules it now masks 2 of 2 strings in public-copy.ts, 96 of 145 in coming-soon-copy.ts and 0 of 17 in landing.ts (was 2, 127, 8).
- **The reviewer's three non-blocking points** (its final notice): (3) the masker keeps one space between two word tokens, so `new Date` ≠ `newDate` and `a in b` ≠ `ain b`; (4) shortened parameters: G2 above; (5) the hook's docstring lists the runs it can't see: the script without its extension (`& ./ship x`), through a glob (`./shi?.ps1`), or as a renamed copy. Its smaller items are fixed too: the orphan sweep matches the repo root as a whole path (`traffic-control-tool-old` is not the repo); the lane check lists paths with `-z`, so a path with spaces is one path; `lstrip("./")` became a prefix strip (no path's verdict changed: no path starting with a dot is in the lane either way).

### Round 3 red-proof and replay
- On origin/main's hook, 30 of the round's gate cases are red: the escaped `rg` mention, 7 go-then-mention refusals, the full-stop go, 11 not-one-bare-run refusals, 6 resume tests, 3 frontend-check flags in a comment, redirect or quotes, and the piped frontend check. On round 2's hook, 36 are red: the 13 Bash mentions it let through, 7 go-then-mention refusals, 11 bare-run refusals, 4 resumes with something added, and the piped frontend check. Lists in `red-proof.txt`.
- Lane check and orphan sweep, against round 2's code: 8 red (6 one-word or joined-word cases, the path with spaces, the sibling folder). The two copy cases that are IN (a two-word value, a whole const) were green there too.
- `gate-replay.md`: the 108 blocked calls in the transcripts (107 plus one from this session), replayed through this hook: all 108 stay blocked.

### Rule 5, round 3
The prediction was not written before this round's diff; it is stated here after it, as such. Tracked changes are in the same three scripts and their tests and this folder; no product file. Existing expectations changed on purpose, by the ruling: the R158 mention, heredoc and variable-assignment cases flip from pass to blocked (13 cases, now `MENTIONS`); the positional-branch pass and the mention-keeps-git-checks test are removed (a positional branch is refused; a mention now needs the go first); the real frontend check's `| tail` is dropped (a pipe now needs the go). Counts: ship_gate 169 passed, 1 skipped; lane check 75; orphan sweep 8.

### Round 3, repair cycle 1 (the independent reviewer's FAIL)
- **Blocking, fixed:** the bare-invocation pattern used `\s`, which also matches a newline, so a no-go form split over two lines (the script with `-Sha`/`-SiteUrl`, then `-FrontendCheckOnly` on the next line) passed while bash and PowerShell ran the first line as a real ship; a go'd `-Branch b` NEWLINE `-DryRun` and a split `-Resume` read the same way. The pattern now uses `[ \t]` and `\Z`, and a command holding `\n` or `\r` is never a bare form. A `| Tee-Object` target must end in .txt or .log (it could overwrite the hook). 5 tests added; the reviewer confirmed the bypass ran with a stand-in script on the pre-repair code.
- **Non-blocking, fixed:** (4) an initializer is read from the tokens themselves (`const|let|var <name> = "..."`), so a keyword no longer carries into a later line without `;`; (5) a newline that automatic semicolon insertion reads as a statement end (after return/throw/break/continue/yield, or before `++`/`--`) is kept as code; (6) **R145 self-ruled A6:** "a whole const value" is a module-level `const`; a const inside a function is logic. 5 tests added (4 OUT, 1 IN).
- **Non-blocking, stated:** the R52 resume is not limited to one use; it passes while its conditions hold, as the amendment words it (hook docstring).
- Masked strings on the real modules unchanged (2, 96, 0); the nine audit rounds read as before. Counts: ship_gate 174 passed, 1 skipped; lane check 80; orphan sweep 8.
- **Independent re-review after the repair: PASS**, no blocking finding. Its non-blocking points, recorded as known limits (not fixed in this round):
  1. The gate reads the command text before the shell strips quotes, so a script name split by quoting (`sh""ip`, PowerShell's backtick) is not seen; origin/main's hook had the same gap. It belongs with the stated limits (no extension, a glob, a renamed copy); the hook's docstring should list it on its next edit.
  2. A `type` or `interface` line counts as a statement start only after `;`, `{` or `}`, so after a const with no `;` a two-word string inside the type can read as copy. With the `;` (the three copy modules use them) it reads OUT.
  3. A few logic edits compare equal with whitespace removed (`a + ++b` vs `a++ + b`; a newline after `async`). Neither shape appears in the three copy modules.
