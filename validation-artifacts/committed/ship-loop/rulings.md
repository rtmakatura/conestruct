# ship-loop — the rulings this arc is built under

## Change 1 (branch `ship-loop-1`): the standing rulings in force, verbatim

> R6. Change 1: Preview gets a Clerk development instance. Ryan does the dashboard part; CC writes step-by-step instructions for it.
>
> R7. For frontend-only branches, a preview hand-check PASS replaces the prod hand-check, plus a one-minute prod smoke. Branches that touch the backend keep today's path.

Change 1's plan is `checkpoint-1.md`. Nothing is built and no Clerk, Vercel or Modal setting is
changed until Ryan rules on it; that ruling is appended at the bottom as "The ruling on
`checkpoint-1.md`, verbatim".

---

**Arc:** the faster ship loop: three changes (a Vercel preview hand-check, skipping the Vercel
build for backend-only changes, and CC running `ship.ps1` after Ryan's go). Investigate first.
**Base:** `fee2f77` (= `main` = `origin/main` = the prod backend `healthz` sha, checked 2026-09-28
at `https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz`). The served bundle of
the public `/` page also carries `fee2f775be3d79bba368571bba216fcd5efaa9fd`.

This file is the arc's authority. It is filed as a stub beside `checkpoint.md` (the per-arc
convention of 2026-09-16). **Nothing is built, and no Vercel, Modal, Clerk, CLAUDE.md, handoff.md
or settings change is made, until Ryan rules on the checkpoint.** His ruling is appended below as
"The ruling, verbatim".

---

## The brief, verbatim (pasted 2026-09-28)

> # Claude Code prompt: faster ship loop (three changes, investigate first)
>
> **Mode:** investigate-first. Stop at the 📋 plan checkpoint. No code, no config changes, no Vercel/Modal settings changes until Ryan rules on the checkpoint. Commit the checkpoint as `checkpoint.md` beside a `rulings.md` stub per the standing convention.
>
> ## Why
> Today's loop: CC finishes → report pasted to chat → review → Ryan runs `ship.ps1` → waits 5–10 min for Vercel → hand-checks prod. Ryan has approved three changes to shorten it. None of them may weaken: Ryan's explicit go, the `/healthz` sha gate, the served-bundle poll, the browser hand-check, backend-first, fast-forward-only ships, or "never two ship lines."
>
> Unchanged by ruling: every CC report still comes to chat (PASS verdicts included).
>
> ---
>
> ## Change 1 — hand-check on a Vercel preview before shipping
>
> Goal: every pushed branch gets a preview URL; Ryan hand-checks there while the report is reviewed; the prod ship afterward is a formality he doesn't have to watch.
>
> Investigate and report:
> 1. Is the Vercel project connected to GitHub with preview deployments on for non-main branches? What does a pushed branch currently produce? (Read-only: `vercel` CLI or project settings, whichever is available; say which.)
> 2. **Which backend does a preview talk to?** Find where the frontend reads the Modal base URL (env var name, file:line). If previews point at prod Modal, a branch that changes the backend wire cannot be checked on a preview — the preview frontend would hit the old backend, and Pydantic silently drops unknown fields. State this plainly.
> 3. Options for backend branches, with cost of each: (a) previews are for frontend-only branches, backend branches keep today's path; (b) a separate Modal app/environment for previews (name, how ship.ps1 or a new script would deploy a branch to it, cost); (c) anything else you find. Recommend one.
> 4. Preview-specific breakage: Clerk allowed origins/redirects, Modal CORS allowlist for `*.vercel.app` preview origins, Mapbox token URL restrictions, env vars scoped Production-only. List each with file:line or setting name and whether it blocks a hand-check.
> 5. How Ryan gets the preview URL for a branch (CC prints it after push? `vercel ls`? GitHub commit status?). The URL must be tied to the branch's sha so a stale preview can't be checked by mistake — state how the sha is confirmed on the preview.
> 6. Does a hand-check PASS on a preview replace the post-ship prod hand-check, or does prod still get a short smoke? Propose; Ryan rules.
>
> ## Change 2 — skip the Vercel build when only the backend changed
>
> Investigate and report:
> 1. The repo layout: which paths the Vercel build consumes. **Include shared files outside the frontend dir** that the frontend imports or its tests read (e.g. the tier-ledger expectation JSON pinning TS ⟷ Py, any shared schema or fixture). A skip rule that misses one of these ships a stale frontend silently (Rule 10).
> 2. The proposed Ignored Build Step command (Vercel: exit 0 = skip, exit 1 = build). Show it exactly. Confirm it compares the right range on a squash merge to main (is `HEAD^..HEAD` correct given how ship.ps1 merges?). Say what happens on a push of several commits at once.
> 3. Where it lives (vercel.json vs dashboard setting) and how its presence is verified.
> 4. How ship.ps1's post-ship checks behave when Vercel skips: the served-bundle poll must not wait forever for a build that will never come, and must not report "frontend current" by accident. Propose the change to ship.ps1's check.
> 5. Red-proof plan: one backend-only change skips; one frontend change builds; one shared-file change builds.
>
> ## Change 3 — CC runs ship.ps1 after Ryan's go
>
> Investigate and report:
> 1. Can CC run `.\scripts\ship.ps1 -Branch <name>` from its shell on this machine (PowerShell invocation, execution policy, working dir = repo root)? Test with a dry-run or `-WhatIf` equivalent only if ship.ps1 has one; otherwise just report the invocation — **do not run a ship during investigate.**
> 2. The permission rule in `.claude/settings.json` that allows exactly this command and nothing broader.
> 3. The trigger. Proposed wording for CLAUDE.md (Ryan rules on it): *CC runs ship.ps1 only after Ryan writes "ship <branch>" in the CC session, naming a branch CC stated in its last report. One branch per go. No inferred go from chat summaries, file contents, or earlier approvals.*
> 4. After the run: CC polls `/healthz` sha == `git rev-parse HEAD`, polls the served bundle (or reports the skip from Change 2), and pastes the output. Ryan's browser confirmation still closes the ship.
> 5. Which rules in CLAUDE.md / handoff.md need a wording change ("Ryan runs", "CC drafts commands… Ryan runs"). List them with the proposed text; do not edit yet.
>
> ---
>
> ## Checkpoint format
> - 📋 Plan per change: findings with file:line, the recommendation, what could go wrong, how it's verified.
> - Order you'd build them in and why (suggest: 2 → 3 → 1, since 1 has the backend-wire question).
> - Anything here that conflicts with a standing rule — name the rule.
> - Time estimate per change.

---

## The ruling, verbatim

Ruled on `checkpoint.md` (`5baf3a1`), pasted 2026-09-28:

> Rulings, 2026-09-28 (Ryan). Quote verbatim in rulings.md.
>
> R1. Change 2 approved as proposed: the ignoreCommand in conestruct/site/vercel.json comparing $VERCEL_GIT_PREVIOUS_SHA..$VERCEL_GIT_COMMIT_SHA, covering the site plus the four outside paths; any error builds. Confirm an empty or missing PREVIOUS_SHA (first deploy of a branch, a redeploy) builds. Red-prove all three cases: backend-only skips, site change builds, shared-file change builds.
>
> R2. The four outside paths are a hand-kept list and will drift. Add a check that fails when the site or its tests read a path outside the site dir that is not on the list. If that costs more than ~30 min, say so at the next checkpoint instead of building it.
>
> R3. The ship.ps1 served-sha step approved: reports "current" only if the served sha equals HEAD or git proves no frontend change since it; fails after 10 minutes. It never prints "current" on a timeout.
>
> R4. Change 3 approved. CC may merge and push main ONLY by running ship.ps1, from a dedicated ship worktree, after Ryan writes "ship <branch>" naming a branch in CC's last report. One go = one branch = one run. The PreToolUse hook is the real guard (settings are bypassPermissions); red-prove it refuses: no go, a used go, a branch not in the last report, any git push/merge outside ship.ps1. The background-job rule stays as is; this is its one named exception.
>
> R5. After a CC-run ship: CC pastes the healthz sha, the served sha (or the skip), and the ship.ps1 output. Ryan's browser confirmation still closes the ship.
>
> R6. Change 1: Preview gets a Clerk development instance. Ryan does the dashboard part; CC writes step-by-step instructions for it.
>
> R7. For frontend-only branches, a preview hand-check PASS replaces the prod hand-check, plus a one-minute prod smoke. Branches that touch the backend keep today's path.
>
> R8. Order 2 → 3 → 1. One ship line per change, stacked per the standing rule. Checkpoint before building 3 and before building 1.

## The ruling on `checkpoint-3.md`, verbatim

Ruled on `checkpoint-3.md` (`55c9054`), pasted 2026-09-28:

> Rulings, 2026-09-28 (Ryan), Change 3 checkpoint. Quote verbatim in rulings.md.
>
> R9. R1's two deviations accepted: the ignore rule is a script (vercel-ignore.sh at the site root) because the one-liner skips a redeploy. Recorded as forced, not chosen.
>
> R10. Push-block scope: the hook blocks anything that moves main (push, merge, fast-forward, reset, via any command), any force push to any branch, and any remote branch deletion. Ordinary pushes of arc branches stay allowed.
>
> R11. "Last report" = CC's most recent message containing a result: line. The go counts only if it comes after that message and names a branch that appears in that result: line exactly.
>
> R12. Ryan will type three gos against -DryRun for the live red-proof (~5 min). Red-prove the refusals too: no go, a reused go, a branch not in the last report.
>
> R13. The first ship after Change 3 is Ryan's, by hand. The hook goes live after that ship.
>
> R14. If the harness won't let a full run work in the ship worktree, stop and report. No workaround.
>
> R15. Delete origin/ship-loop-redproof. Recovery sha ca70344 recorded here; the red-proof evidence already lives in 0da5c3c.

## The ruling on `checkpoint-1.md`, verbatim

Ruled on `checkpoint-1.md` (`aec9a45`), pasted 2026-09-28:

> Rulings, 2026-09-28 (Ryan), Change 1 checkpoint. Quote verbatim in rulings.md.
>
> R18. checkpoint-1.md approved as written: Clerk development instance for Preview, invite-only, the coming-soon gate opened on previews through a Preview-only email allowlist, no gate or backend code change.
>
> R19. DATABASE_URL stays off Preview. If any page Ryan checks on a preview crashes without it, stop and report; don't add it.
>
> R20. scripts/preview-url.ps1 approved: read-only, prints a URL only when the preview's bundle carries the branch tip's sha. The preview: line goes directly above result: and includes frontend-only: yes|no.
>
> R21. The R7 prod smoke is the four checks in checkpoint-1.md. The 10-minute / 20-second numbers are accepted as chosen, not sourced.
>
> R22. handoff.md edits (the preview: line and the R7 smoke) are drafted by CC as before/after text in the report; the chat applies them. The throwaway test branch is deleted by Ryan.
>
> Before building: paste Ryan's 12 dashboard steps here, in full, so he can follow them.

## R26–R27, verbatim

Ruled on the `light-sheet-flip` report (`5a966c2`: its `frontend-only: no` flag and the ship-push credential investigation), pasted 2026-09-28. The numbers carry on from `coming-soon-gate/rulings.md` (which ends at R25), not from this file's R22; there is no ship-loop R23–R25.

> Rulings, 2026-09-28 (Ryan). Quote verbatim in rulings.md. One branch for both, stacked after light-sheet-flip.
>
> R26. validation-artifacts/committed/** doesn't count against frontend-only in Get-FrontendOnly: those files never reach the build. Everything else stays as is. Red-prove: a branch with only site files + validation-artifacts reads "yes"; add one script file and it reads "no".
>
> R27. Recommended credential fix approved: ship.ps1's push uses gh only (git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin HEAD:main), and a gh auth status check runs before the merge so a bad login stops the ship before anything moves.

## R28, verbatim (the outage ruling)

Given in the `light-sheet-flip` session at 2026-09-29T04:31:58Z (2026-09-28, 22:31 MDT), during the production outage that followed the `ship-creds-frontend-only` ship (7ea649d): every route on www.conestruct.com returned 500 (`MIDDLEWARE_INVOCATION_FAILED`) because `CLERK_SECRET_KEY` had no Production row. Recorded here as the outage ruling (R29–R30 paste, below). It was scoped to that outage and is not a standing permission.

>    Ruling R28 (Ryan): Vercel CLI is logged in and linked. For this outage you may, without asking: roll production back to 55c9054, run `vercel env ls`, add the missing Production Clerk variable(s) with the live values from Clerk if you can read them (otherwise tell me exactly which row to add), redeploy 7ea649d, and promote it once it returns 200. Never remove or change an existing Production variable. Report each step's output.

**Its deviation, recorded as ruled:** R28 said promote 7ea649d only once it returns 200. `vercel redeploy https://conestruct-2hui456yk-rtmakaturas-projects.vercel.app --target production` aliased www.conestruct.com itself as soon as the build finished ("Aliased https://www.conestruct.com", then "Ready in 4m"; deployment `conestruct-2pknt2zfd-rtmakaturas-projects.vercel.app`, GitHub deployment status `success` at 2026-09-29T04:40:53Z), before the 200 check ran. It came up 200, so nothing broke. Had the build still been failing, www would have gone down again until 55c9054 was promoted back. The other steps ran as ruled: the rollback went through `vercel promote` (`vercel rollback` answered 402 on the Hobby plan), `vercel env ls` confirmed the cause, and Ryan added the Production `CLERK_SECRET_KEY` row (CC could not read the live key). No existing Production variable was removed or changed.

## R29–R30, verbatim

Pasted 2026-09-28. The "R28 as given tonight" it names is the ruling above.

> Rulings, 2026-09-28 (Ryan). Quote verbatim in ship-loop/rulings.md. One small branch.
>
> R28 as given tonight, recorded as the outage ruling, plus its deviation: the redeploy auto-promoted before the 200 check.
>
> R29. Before the merge, ship.ps1 checks `vercel env ls production` lists every variable the site needs at runtime (at least NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, GATE_ALLOWED_EMAILS, GATE_BYPASS_TOKEN, MODAL_RENDER_URL, MODAL_RENDER_SECRET, MAPBOX_TOKEN, NEXT_PUBLIC_MAPBOX_TOKEN, DATABASE_URL — derive the full list from the code, cite file:line). Any missing, or the CLI not logged in, stops the ship with "Nothing was merged or pushed." Red-prove with a fixture listing one name short.
>
> R30. Draft a GitHub issue for tonight's outage (cause, 18-minute window, fix, R29 as the prevention) for me to post.

## R29's list, R31–R32, verbatim

Ruled on the `ship-env-check` report (`02480f6`), pasted 2026-09-28. R30's draft stands as written (`r30-outage-issue.md`); there is no ruling numbered for it here.

> Rulings, 2026-09-28 (Ryan). Quote verbatim in ship-loop/rulings.md. Stack onto ship-env-check; I'll give one go for both.
>
> R29 list accepted as built: all 17 required, including the Upstash, Sentry, webhook and Clerk URL rows.
>
> R31. Branch cleanup is part of the ship. After "SHIP VERIFIED", ship.ps1 deletes from origin every branch whose tip is an ancestor of the new main (so stacked branches go too), and the matching local branches and their worktrees under .claude\worktrees (never _ship, never main). Unmerged branches are never touched. It prints each deletion with its sha so any branch can be restored. If the ship ends "NOT VERIFIED", no cleanup runs. Also delete light-sheet-flip and ship-creds-frontend-only as part of the first run (both are already in main, so the ancestor rule covers them). Red-prove with a scratch remote: merged branch deleted, unmerged branch kept, _ship untouched.
>
> R32. Throwaway red-proof branches: CC names them in its report with their last sha; the next ship.ps1 cleanup deletes them only if they're merged, otherwise they're listed under "left for Ryan". No other change to the hook.

## R44, verbatim

From `cc-prompt-r42-r44.md` (Ryan, 2026-09-29). R42 and R43 are quoted in `coming-soon-gate/rulings.md`.

> ## R44 — cleanup also removes superseded branches
>
> The R31 cleanup only deletes branches whose tip is in main. Branches whose work was carried onto another branch (cherry-picked, rebased) are left behind, and Ryan was asked to delete them by hand. That's the gap.
>
> - After "SHIP VERIFIED", ship.ps1's cleanup also deletes any branch where **every** commit is patch-equivalent to a commit in main (`git cherry origin/main <branch>` prints only `-` lines). Same safety rules as R31: never `main`, never `_ship`, locked or dirty worktrees are listed rather than removed, each deletion prints its sha and restore command.
> - A branch with even one `+` commit (work not in main) is never touched.
> - Red-prove with the scratch remote: a cherry-picked copy is deleted, a branch with one extra commit is kept.
> - First real run should remove `copy/unslop-platform` and `copy/unslop-platform-inventory` (check with `git cherry` in the report). If either has a `+` commit, list it and say what the commit is.
> - Worktrees locked by the session that built the branch: the next ship's cleanup retries them. No change needed.

## R46, verbatim

Ryan, 2026-09-29, on the stacked `ship/r42-r45` report:

> R46 (Ryan): whenever you restack or rebuild branches, commit a superseded.txt listing every branch whose work the new branch carries; ship.ps1's cleanup deletes the listed branches once the listing branch is in main (same safety rules as R31/R44). Start with copy/leftovers. I never delete branches by hand.

## R47, verbatim

Ryan, 2026-09-29, on the `ship/r42-r45` ship report (after "Browser check PASS."):

> R47 (Ryan): yes. The cleanup also removes local-only branches already in main, same worktree rules. It also removes "redproof" throwaway branches (local and origin) whose last sha is recorded in a committed redproof doc, printing the restore command. Real unmerged work (issue-162-mapbox-browser-token, worktree-issue-151-jurisdiction-deltas) is never touched; list it once per ship. Small ship-loop branch, one go.

## R50, verbatim

From `cc-prompt-r48-r50.md` (Ryan, 2026-09-29). R48 and R49 are quoted in `coming-soon-gate/rulings.md`.

> # Rulings R48–R50 (Ryan, 2026-09-29)
>
> Quote each verbatim in the matching rulings.md (R48/R49: coming-soon-gate; R50: ship-loop). Build on top of `docs/demo-prep-snapshot` so the snapshot ships with this. Do R50 first: nothing else ships while CI is red.
>
> ## R50: CI is failing on main (investigate first, then fix)
>
> GitHub Actions emails report "Python tests: All jobs have failed" on `main` (884081c, 2 annotations) and "Frontend tests: All jobs have failed" (6 annotations, 3m42s). Ryan has been getting a string of these, so it has likely been red for several ships while local runs passed.
>
> 1. Use `gh run list --workflow` and `gh run view --log-failed` (read-only) for both workflows. Report: the first red run on `main` (sha + date), and every failing test with its error, in plain words.
> 2. Say why local runs passed and CI didn't (Windows vs Ubuntu, PowerShell-only tests, missing env such as `NEXT_PUBLIC_SHEET_REVISED`, Vercel CLI, network, timing). Name the commit that introduced each failure.
> 3. Fix each one at its cause. A test that can only run on Windows is marked as skipped on non-Windows with the reason in the skip message; it does not silently pass. No deleting assertions to go green.
> 4. **Close the gap so this can't recur:** `ship.ps1` checks that both CI workflows are green on the branch tip being shipped, before the merge (same place as the R29 env check). Red, missing, or still running stops the ship with "Nothing was merged or pushed." and names the failing workflow. Red-prove it against a scratch run or a fixture.
> 5. Report: first red run, each failure → cause → fix, CI green links for the branch tip, and the red-proof.
>
> ## Report
>
> One stacked branch (snapshot + R50 + R48 + R49), usual report: verifier verdict verbatim, before/after screenshots for R48, the scroll check for R49, CI green on the tip, `preview:` line, and the go.
