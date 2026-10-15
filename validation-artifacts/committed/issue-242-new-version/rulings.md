# issue-242-new-version: the rulings this arc is built under

**Issue:** #242, "A tab open across a deploy keeps running the old bundle indefinitely; no new-version affordance".

## R151 (Ryan, 2026-10-15), verbatim

> Ryan's answers (2026-10-15), R151:
> 1. #204: (a) saved plans stay off on prod until a lawyer reviews /terms and /privacy.
> 2. #202: (a), with a guard: the migration is additive only (new nullable column; nothing dropped, renamed or rewritten). Put the exact SQL in your report before the ship. If it needs anything beyond an additive change, stop and ask.
> 3. Saved-plan prod checks: (b) local and mounted tests only for now. Revisit when #204 turns saved plans on.
> 4. #242: (a) one line in the nav. Unslop rules for the copy.
> 5. #28: (a) close as not planned, with the reason.
> 6. #205: (a) the four cities stay unreachable until 02-JURISDICTION-DATA.md exists.
> 7. #128: (a) parked.
> 8. #146: (a) parked.
> 9. #307: (a) downloads send back a signed copy of Generate's scan. The server verifies the signature and refuses honestly if it's invalid. Prove 20 of 20 downloads on prod with no re-scan.
> Build #202, #242 and #307 in your order, close or park the rest with a comment each, and give a backticked result: line for "ship ready".

The option ruled for #242 was "(a) one line in the nav, "New version. Reload.", and never an automatic reload".

## R145 self-ruled (2026-10-15)

1. **Which sha each side knows.** The tab knows the build it runs: `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, inlined at build time. That's the same value the ship's served-frontend check reads from the chunks. A new `GET /api/version` returns the value inlined into the deployment that answers it, which is the current one, since nothing pins a tab to its deployment. They differ only when a newer frontend deployment is live. No new environment name: the route reads the same inlined variable. With no sha baked in (local, tests), it never shows.
2. **When it checks.** Every 5 minutes (`VERSION_POLL_MS`, CHOSEN: a deploy is rarely more urgent than that, and the request is a few bytes), and whenever the tab becomes visible again. It never reloads by itself.
3. **Where and how it reads.** One button in the nav's right slot, at every width (the phone is where an old tab is likeliest): "New version. Reload". Pressing it reloads the page. The nav is a fixed 52 px (`--nav-h`), so nothing below it moves (P1), and the button fills that height, above the 44 px floor. It uses the nav items' type (mono 10 px uppercase), so AppNav's census row goes 4 → 5 uses. It's announced politely (`role="status"`) when it appears.
