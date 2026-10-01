# issue-306-double-scan — the rulings this arc is built under

**Issue:** #306 — "Generate runs the site scan twice (device breakdown + audit in parallel); either can refuse alone, so a plan renders beside \"Device breakdown failed\"".
**Arc:** investigate first; a checkpoint (`checkpoint.md`, beside this file) before any code.
**Base:** `5e05379` = `origin/main` = prod `healthz`, 2026-10-01; the scan-refusal-rate evidence carried as `4a03ee7` (cherry-picked from `85be5be`).

This file is the arc's authority; every commit on this branch cites it.

---

## #306's body, verbatim (fetched 2026-10-01 with `gh issue view 306`; open; 0 comments)

Labels: bug, priority-medium, frontend, backend, p2. Opened 2026-10-01.

> ## Problem
>
> Every Generate sends `/api/render/device-breakdown` and `/api/render/audit` at the same moment: two effects gated on the same `fetchArmed` (`conestruct/site/components/GeneratorShell.tsx:455-472`, `:516-530`). Each endpoint builds its plan through `_placements_for`, which runs `run_site_scan` and raises `400 site_scan_unavailable` on a refusal (`src/api/render_api.py:765-766`). The scan memo is written only after a scan completes, so two concurrent requests never share one: each runs its own Overpass round trip, on its own mirror, against its own 20 s budget.
>
> Measured on prod `c055262`, 5 Denver pins, both calls sent together (`validation-artifacts/committed/scan-refusal-rate/`, `out/concurrent.jsonl`): every breakdown took scan time (4.2 / 17.7 / 4.9 / 18.0 / 21.0 s), never the ~0.9 s of a memo hit; on `e-bayaud` the two calls took different mirrors (4.9 s vs 17.1 s). On the Denver demo pin (39.7269, −104.9873) the audit answered 200 in 3.7 s while the breakdown refused:
>
> > 400 site_scan_unavailable · https://overpass.openstreetmap.fr/api/interpreter: ReadTimeout: The read operation timed out (scan 20,188 ms)
>
> Classification: behavior-changing fix; today one Generate can produce a split verdict. Violates P2 (one voice per fact): the plan says the scan ran, the breakdown says it didn't.
>
> ## Reproduction
>
> 1. On prod `/sandbox`, pin 39.7269, −104.9873 (North Broadway SB), shoulder, west side, Generate, while the primary Overpass mirror is slow.
> 2. Expected: one scan, one verdict. Actual (1 of 5 pins measured): the plan renders and the device-breakdown row reads "Device breakdown failed: HTTP 400".
>
> ## Impact
>
> - The estimator gets a plan without its device list and a failure to chase, on a scan that did answer.
> - Every Generate doubles the Overpass load, and with it the chance of a refusal (#292).
>
> ## Proposed solution
>
> Options, for the checkpoint:
> - (a) Single-flight the scan per memo key, so a second request waits on the first's result.
> - (b) The site sends the audit first and the breakdown after, so the memo is warm.
> - (c) Serve the breakdown from the audit's response.
>
> Recommendation deferred to the investigation. (a) keeps the site unchanged but works per container (`max_containers`), so two containers still scan twice.
>
> ## Acceptance
>
> - One Generate produces at most one Overpass scan; measured on prod, breakdown and audit report the same scan outcome on 20 of 20 concurrent pairs.
> - A refusal still returns the honest 400 with Retry / Generate anyway; wording unchanged.
> - Existing scan behavior unchanged for a single request.
>
> ## Reference
>
> - `conestruct/site/components/GeneratorShell.tsx:455-472`, `:516-530`
> - `src/api/render_api.py:765-766`, `:1565`, `:1692`
> - `validation-artifacts/committed/scan-refusal-rate/README.md` (`85be5be`)
> - Related, distinct: #292 (mirror order and refusal rate; this issue is the second scan per Generate).
> - Priority-medium. Not blocking; it makes #292's refusals twice as likely per Generate.

---

## Ryan's instruction, verbatim (2026-10-01)

> Then investigate #306 with a checkpoint. No code until I rule.

---

## The ruling on the checkpoint, verbatim (Ryan, 2026-10-01, on `checkpoint.md` at `133e0b5`)

> #305 closed.
>
> Rulings on #306 (quote verbatim):
> R64. Q1: (c). One scan per Generate by design.
> R65. Q2: the opt-in on /render/audit; no recorded churn.
> R66. Q3: separate issue. Draft it for the chat to repost (a download that re-scans can fail on its own; same one-voice problem).
> R67. Q4: yes, post this morning's numbers on #292.
> R68. Hook fix, ride along on #306: ship_gate must judge rebase/cherry-pick by the branch being changed, not the session's working directory. It still blocks anything that moves main. Red-prove both directions.
> Build #306, verify, give me the go.
>
> Then #292 becomes the top priority: investigate with a checkpoint. Measure at three times of day (morning, midday, evening). Options to evaluate include dropping kumi if it's dead, asking mirrors in parallel and taking the first answer instead of waiting 7 s each in turn, and the budget. No code until I rule.
