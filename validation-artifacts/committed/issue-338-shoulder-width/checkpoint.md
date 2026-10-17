# #338 checkpoint, 2026-10-16: does an assumed shoulder width cost a plan its green strip?

## What the build found
S2 (the audit discloses the width as a `pending_verification` item, as #308 R88 does for one-way streets) was built and run. A pending item counts as a V1 limitation, so `plan_flags` moves from `is_clean: True, v1_limitations: 0` to `is_clean: False, v1_limitations: 1` on every two-way and divided shoulder plan. `StatusBar.tsx:439` reads `is_clean`, so all those plans lose "✓ VERIFIED · READY FOR TCS REVIEW". Full suite: 63 failed, 2925 passed, 2 skipped. Of the failures, 43 are corpus grid snapshots, 14 are audit-endpoint pins and 5 are tier-ledger covers, all from this flip. The last 1 is the citation single-source guard rejecting the "MUTCD Table 6B-4" literal in `audit.py`. `prediction.md` did not predict the flip (a Rule 5 miss, recorded here).

This is an R145 stop: it changes the verdict on most live plans (design direction), and confidence is low.

## Q1: how does the audit disclose the assumed width?
- **A. Pending item, as built.** Same mechanism as R88. Every two-way and divided shoulder plan reads not-clean until a shoulder-width input exists, and about 60 snapshots get re-baselined.
- **B. (Recommended) Beside the value, no pending item.** The audit's taper section gains `shoulder_width_basis: "assumed"`. The audit PDF and the /sandbox audit panel print "8 ft (assumed)" wherever W appears. `is_clean` doesn't change. Precedent: R110 Q2 ("a guessed plan reads as clean as an operator-set one"). Rule 10 is met because the value is labelled where it's shown.
- **C. Pending item that doesn't count as a V1 limitation.** This needs a new class of pending item, so it's new machinery.

Page 1's row (S1) holds under every option.

## State while Q1 waits
The withdrawn S2 code is removed from the branch: `src/api/audit.py` and `tests/test_oneway_street_audit.py` are back to origin/main. The branch now carries S1 only (page 1's row) and `tests/s630/test_shoulder_width_338.py` (4 cases: page 1 states the width and it equals the audit's `taper.shoulder_width_ft`, on undivided, divided and one-way plans, plus a flagger control). Red on origin/main src: 3 failed, 1 passed. Full suite: 2988 passed, 2 skipped. The audit half is built after Q1.
