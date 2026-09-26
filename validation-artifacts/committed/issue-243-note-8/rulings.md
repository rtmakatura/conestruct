# issue-243-note-8 — the rulings this arc is built under

**Issue:** #243 — "\"Signs on both sides of divided highway\" check counts site-adjustment signs and fails on sidewalk/bike detections".
**Arc:** s2-arc37, investigate first (probes and read-only runs only; no product code until Ryan rules).

**Base:** `0ddc85e` (= `main` = `origin/main`). Checked 2026-09-26: the prod backend `healthz`
(`https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz`) returns
`"sha":"0ddc85efd824930fa8307d9a9fb7b6faffff517e"`, and the served `/sandbox` bundle carries the same
40-hex sha (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, inlined in three of the page's eleven chunks; Next
`buildId` `BLhTCLNABlalEyv3mmKSe`).

This file is the arc's authority: every commit on this branch cites it. It is filed as this arc's
**first** commit, per the per-arc rulings convention adopted 2026-09-16.

**What this file holds at the checkpoint.** #243 has not been ruled yet. Ryan rules on the
checkpoint (`checkpoint.md`, committed next to this file), and nothing is built until that ruling
lands. So the sections below are what the arc **carries in**: #243's body and its one comment,
verbatim. Ryan's ruling is appended here as "The ruling, verbatim".

---

## #243's body, verbatim (fetched 2026-09-26 with `gh issue view 243`; open; 1 comment)

Labels: bug, priority-medium, audit-trail, backend, p2. Opened 2026-09-04.

> ## Problem
>
> The CDOT S-630-1 Sheet 2 General Note 8 check ("Signs on both sides of divided highway") counts every placed sign per side. Site-adjustment signs added by `apply_site_adjustments` (`src/rules/site_adjustments.py:175` — 2× R9-9 SIDEWALK CLOSED; `:200` — 2× M4-9a BIKE DETOUR) are placed on the facility side only, by design. On a divided road where the scan detects a sidewalk and a bike facility, the check reads the asymmetry as a violation and renders a red ✗ under Needs attention:
>
> > Signs on both sides of divided highway — Required: True. Signs placed: 7 left, 11 right.
>
> The same plan without those detections passes at 6 left, 6 right (replication snapshot `plan_replication (34)`, N Lincoln St, 2026-09-03). The 4-sign delta equals exactly the two adjustment rules' output.
>
> Classification: behavior-changing fix to the checker; currently causes a false compliance FAIL (`plan_flags.compliance_fails` increments) on a correct plan. Pre-existing — surfaced more often since #224 phase 2/3 because the scan now fires these rules automatically.
>
> ## Reproduction
>
> 1. Pin N Federal Blvd, Denver, 39.7342642691076, -105.02504468168067, bearing 0, kind shoulder, jurisdiction denver.
> 2. Generate. Scan detects `pedestrian_facility` and `bicycle_facility`.
> 3. Section 03 shows ✓ rows for the two adjustments AND a ✗ "Signs on both sides of divided highway — 7 left, 11 right".
>
> Expected: the Note 8 check passes; adjustment signs are excluded from the per-side count (or counted as satisfied by their single-side placement). Actual: FAIL.
>
> ## Impact
>
> - Estimator sees a compliance failure on a plan that is correct, on exactly the plans where the scan did its job.
> - `is_clean` goes false and the audit-PDF cover counts a failure the TCS will chase for nothing.
> - Trust erosion on the newest feature.
>
> ## Proposed solution
>
> In the Note 8 checker, count only the signs the rule governs (advance warning + regulatory pairs) and exclude devices tagged by `apply_site_adjustments`. Adjustment records already carry their `flag`; tag the emitted devices with their origin and filter on it. Backend-owned (Rule 3); no frontend change.
>
> ## Acceptance
>
> - The N Federal Blvd plan above passes Note 8 with the R9-9 and M4-9a signs present.
> - The N Lincoln St plan (no detections) still passes at 6/6.
> - A plan with a genuinely missing left-side W20-1 still fails.
> - Existing `test_audit_blocks_site_scan.py` and tiering expectation fixtures unchanged.
>
> ## Reference
>
> - `src/rules/site_adjustments.py:175, 200`
> - Note 8 checker: grep the label string `Signs on both sides of divided highway` under `src/rules/` (exact location to confirm at investigation).
> - Citation: CDOT S-630-1 (July 2026) Sheet 2, General Note 8.
> - Priority-medium. Not blocking #224 phase 3 close; slot before the intersection-interior kind.

## #243's comment, verbatim (rtmakatura, 2026-09-08)

> ## Principles
> Backend honesty (out of scope for this audit). One principle applies on the surface: P2/P12 — a ✕ under Needs attention on a correct plan lowers trust in every other row (the aesthetic-usability effect runs both ways). Ranked in Part 4 under "honesty first" because the screen misleads, even though the fix is backend-only (Rule 3).
> Labels: p2 (backend)

---

## The ruling, verbatim

*(Not yet ruled. Appended when Ryan rules on `checkpoint.md`.)*
