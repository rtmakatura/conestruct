# R158: the historical ship_gate blocks, replayed through the new hook

*2026-11-03. Source: every Bash/PowerShell tool result containing "BLOCKED by ship_gate" in the Claude Code transcripts under `~/.claude/projects/` for this repo (main folder from 2026-10-05, worktree folders from 2026-09-29; older transcripts are pruned). Each blocked command was paired with its tool call and the latest human message before it, then judged with the final hook's `ship_runs` / `ship_branch_arg` / go parsing (the fail-closed version after the independent reviewer's FAIL). Git-rule (R10) and cwd (R77) refusals depend on that moment's checkout and are counted as unchanged. The speed audit counted 102 blocks; the 107 here add five from the audit session and this arc's session, all reads.*

| Outcome under the new hook | Calls |
|---|---|
| Now passes: a mention (read, grep, `ls`, `sed`, `git show`, a variable holding the path, heredoc edit of handoff.md, memory write), not a run | 66 |
| Now passes: a real run with a valid go that named the branch positionally (2026-10-18 `issue-340-field-named-refusals`; 2026-10-20 `issue-342-buffer-devices` ×2) | 3 |
| Now passes: an internal error on a `sed` read of the hook (2026-10-14) | 1 |
| **Total that would now pass** | **70** |
| Still blocked: R77, the session's cwd inside a worktree (unchanged) | 16 |
| Still blocked: R10 git rules on main (unchanged) | 11 |
| Still blocked: a real run with no go (each checked by hand: `& '<script>' -Branch …` or `powershell -File <script> -Branch …`) | 5 |
| Still blocked: the go's branch isn't in the latest `result:` line (each a real run) | 3 |
| Still blocked: the go was already used / `ship ready` order | 2 |
| **Total still blocked** | **37** |

There are 15 "the go names X but the command ships Y" refusals among the 107 (the audit's count of 13 split them by date and missed two). 12 were reads after a valid go (the old hook treated any mention as a ship and found no `-Branch`), and 3 were the positional runs above. None was a go with a trailing full stop; the full-stop case is covered by the new test `test_a_go_ending_with_a_full_stop_names_the_same_branch`.

## Round 3: the amended R158 (every command naming the script is gated again)

*Replayed the same way through this round's hook (`SHIP` match, `frontend_check_only`, `resume_sha`, `ship_run_branch`, the full-stop go). The transcripts now hold 108 distinct blocked calls (one more from this arc's session, a read).*

| Outcome under the amended hook | Calls |
|---|---|
| Still blocked: names the script, no go or the go's other checks (`not exactly "ship <branch>"` 56, branch not in the `result:` line 3, go already used 2, `ship ready` order 1, no `result:` line 1) | 63 |
| Still blocked: names the script but is not one bare `-Branch` run (the 12 reads after a valid go and the 3 positional runs) | 15 |
| Still blocked: R77, the session's cwd inside a worktree (unchanged) | 16 |
| Still blocked: git rules (R10) or cwd, no script named (unchanged) | 14 |
| **Would now pass** | **0** |

The round-2 table above (70 would pass) no longer applies: its 66 mentions are gated again, as the amendment rules, and its 3 positional runs are refused because only a full `-Branch` counts.
