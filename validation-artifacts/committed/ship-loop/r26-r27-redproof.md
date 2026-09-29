# R26–R27 red-proof

Branch `ship-creds-frontend-only`, stacked on `light-sheet-flip` (`5a966c2`). Rulings: `rulings.md` § "R26–R27, verbatim". Measured 2026-09-28 on Ryan's machine (git 2.47.1.windows.2, Git Credential Manager 2.6.0, gh 2.94.0). Outputs are pasted as printed.

## R26 — committed evidence doesn't count against frontend-only

**Change.** `Get-FrontendOnly` (scripts/preview-url.ps1) sets aside every path under `validation-artifacts/committed/` first, then applies the existing rule to what is left. A branch of evidence alone has nothing left and stays `no`, as an empty branch does. `ship.ps1` and `vercel-ignore.sh` are unchanged.

**Behavior change (Rule 5), predicted:** only branches that mix site inputs with committed evidence move, `no` → `yes`. Every existing `test_frontend_only_…` case keeps its expected answer; the evidence-only case (`checkpoint-1.md`) stays `no`, now because nothing is left rather than because it is not a site input.

**Red** (commit "test(ship-loop): red …", before the fix): 3 failed, 24 passed. The R26 failure:

```
FAILED tests/test_preview_url.py::test_frontend_only_is_yes_only_when_every_file_is_a_site_input[files7-yes]
  … frontend-only: no
```

`files7` is light-sheet-flip's real 13-file list (3 site files + its R25 ruling + 9 light-check files).

**Green** (after the fix): the ruled pair, plus two look-alikes:

| files | expected |
|---|---|
| light-sheet-flip's 13 files | yes |
| the same + `scripts/preview-url.ps1` | no |
| site file + `validation-artifacts/probe/out.png` (not `committed/`) | no |
| site file + `validation-artifacts/committed-notes.md` (prefix look-alike) | no |
| `validation-artifacts/committed/ship-loop/checkpoint-1.md` alone | no |

**Live**, this branch's copy of the script against the real preview of light-sheet-flip. Before (main's copy, earlier today):

```
preview: https://conestruct-ngc780f2x-rtmakaturas-projects.vercel.app -- serves 5a966c2 = branch tip (checked in the bundle); frontend-only: no
```

After:

```
Looking for the Preview of light-sheet-flip at 5a966c2 (up to 10 min)...
preview: https://conestruct-ngc780f2x-rtmakaturas-projects.vercel.app -- serves 5a966c2 = branch tip (checked in the bundle); frontend-only: yes
```

## R27 — the ship push goes through gh only; a gh check runs before the merge

**Change** (scripts/ship.ps1):
- New step 1b, after the stale-copy handoff and before step 2 (merge): `Get-Command gh` (a missing gh would otherwise leave `$LASTEXITCODE` at the last git call's 0 and pass silently), then `gh auth status --hostname github.com`; a nonzero exit prints gh's output and Fails with "Nothing was merged or pushed." It runs on `-DryRun` too. `-FrontendCheckOnly` exits before it.
- Step 3's push is the ruled line: `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin HEAD:main`.

**The cause, measured** (report on light-sheet-flip): git runs the system helper `manager` (GCM) before the repo's `!gh auth git-credential`. GCM finds two github.com accounts (`rtmakatura`, `fLu-2`), tries to ask which, and with `GCM_INTERACTIVE=never` (the Claude Code PowerShell environment `ship.ps1` runs in) it fails:

```
[GetCredentialAsync] Found 2 accounts in the store for service=https://github.com:
[GetCredentialAsync] Multiple accounts available - prompting user to select one...
fatal: Cannot prompt because user interactivity has been disabled.
```

Git then asks gh, which answers.

**No test runs ship.ps1**: it merges, pushes and deploys, and the ship_gate hook gates any command naming it. `tests/test_ship_push.py` pins the text: the one push line is the ruled form, `Get-Command gh` < `gh auth status` < `git merge` < the push, and each check ends in `Fail`. It also asks PowerShell's parser for errors in the script (nothing runs; a deliberately broken file gives `errors=1`). Red: 2 failed (the plain push line; no `Get-Command gh`). Green: pass.

What the lines do is proven on the same commands, run on their own. The pushes are `--dry-run` to this branch's own ref, never main. The env is the ship's (`GCM_INTERACTIVE=never GIT_TERMINAL_PROMPT=0`).

**1. Before: the old push line reproduces the ship's symptom.**

```
$ git push --dry-run origin HEAD:refs/heads/ship-creds-frontend-only
fatal: Cannot prompt because user interactivity has been disabled.
To https://github.com/rtmakatura/conestruct.git
 * [new branch]      HEAD -> ship-creds-frontend-only
exit=0
```

**2. After: the R27 line, no GCM, same result.**

```
$ git -c credential.helper= -c "credential.helper=!gh auth git-credential" push --dry-run origin HEAD:refs/heads/ship-creds-frontend-only
To https://github.com/rtmakatura/conestruct.git
 * [new branch]      HEAD -> ship-creds-frontend-only
exit=0
```

`GIT_TRACE` on the same command shows the only helper run is `'gh auth git-credential get'` (then `store`); `git credential-manager` is never started.

**3. No credential source: the push fails cleanly, with no fallback.** GitHub requires auth even for a dry-run push of this public repo:

```
$ git -c credential.helper= push --dry-run origin HEAD:refs/heads/ship-creds-frontend-only
fatal: could not read Username for 'https://github.com': terminal prompts disabled
exit=128
```

**4. The step 1b lines** (pasted verbatim from the script into a script block with a stand-in `Fail`; the hook stops a command reading them out of `ship.ps1`):

```
== 1. logged in
check passed -> the merge would run
== 2. gh logged out (empty GH_CONFIG_DIR)
  You are not logged into any GitHub hosts. To log in, run: gh auth login
SHIP FAILED: gh is not logged in to github.com. Run gh auth login, then ship again. Nothing was merged or pushed.
== 3. gh not on PATH (last exit code 0 from git beforehand)
LASTEXITCODE before: 0
gh resolvable: False
SHIP FAILED: gh is not on PATH. The push goes through gh (R27); install gh, run gh auth login, then ship again. Nothing was merged or pushed.
```

**A limit, measured: `gh auth status` and gh's credential helper can disagree.** With an empty `GH_CONFIG_DIR`, `gh auth status` says "You are not logged into any GitHub hosts" (exit 1). But `gh auth git-credential get` still returns a token from the Windows keyring (exit 0, `username=x-access-token`, a 40-char password). The keyring holds a `gh:github.com:` entry with no user. So case 2 above fakes "logged out" for the check but not for the push, and a dry-run push under it succeeds. The disagreement falls on the safe side: the check stops a ship the push might have survived. A real `gh auth logout` removes the keyring token, and a revoked token should fail `gh auth status` (it checks the token with GitHub). Neither was tested here: logging out would touch Ryan's real login. A live logged-out ship, and the first real ship through the new push, are proven on the next `ship <branch>`; the hook allows no run before that.
