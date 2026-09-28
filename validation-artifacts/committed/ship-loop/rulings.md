# ship-loop — the rulings this arc is built under

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

*(Not yet ruled. Appended when Ryan rules on `checkpoint.md`.)*
