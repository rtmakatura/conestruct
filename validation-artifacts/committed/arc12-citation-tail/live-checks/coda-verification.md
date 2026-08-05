# Arc 12 coda — post-fix live verification of the expanded-body chip (Refs #70)

The merged evidence pack's transcript ends on the one residual FAIL
(assertion 1h, 2026-08-04): the Colorado row's expanded-body footer
chip read "✓ CDOT S-630-1 · COLORADO SUPPLEMENT" on production. Ryan
ruled it fixed-now-not-filed; the coda fix landed as `952f989`
(AuditTrail.tsx chip → "STANDARD PLAN", plus the sweep-found
StatusBar.tsx compliance-fails src tag, plus the pinning tests) and
shipped inside main head `4760308`. This closes the trail:
**FAIL (pre-fix, 2026-08-04) → fixed at `952f989` → verified live at
`4760308` (2026-08-05)**.

Method: same read-only Playwright harness family as the pre-fix run
(`arc12-coda-check.js`, this directory) — no accounts, no DB writes,
no plan saves. Same Lakewood control pin (S Wadsworth southbound, way
132831821), shoulder work, lane width 10.5 ft for the drawable-width
gate. Raw log: `coda-assertions-raw.md`; page text:
`coda-page-text.txt`; screenshot:
`coda-01-colorado-row-expanded.png`.

## Build gate

Final run (2026-08-05T04:30Z): **healthz `4760308` == origin/main
`4760308` == served bundle `4760308`** — clean three-way match.

Gate history, recorded for honesty: the first attempt (04:27Z) found
the served bundle stamping `952f989` — main head's direct parent —
because Vercel was still propagating; `git diff 952f989..4760308`
touches only this evidence directory (zero `conestruct/site` files),
so Ryan ruled the equivalence acceptable and the harness gate accepts
either sha (see the RULED_EQUIVALENT_SHA comment in
`arc12-coda-check.js`). By the final run Vercel had finished and the
allowance never fired — the verified state is the clean match above.

## The check — all PASS

- `gate.` healthz == origin/main == served bundle (`4760308`)
- `1a.` Colorado row expanded — body citations visible
  ("CDOT S-630-1 (July 2026) Sheet 2, General Note 3" et al.)
- `1b.` **expanded-body chip reads "CDOT S-630-1 · STANDARD PLAN"**
  (page text: `…Sheet 23, Case 38 Note 1✓CDOT S-630-1 · STANDARD
  PLAN…`)
- `1c.` defect-class guard — `/colorado supplement/i` and
  `/CO SUPPLEMENT/i` appear **nowhere** on the rendered page outside
  the one deliberate occurrence (excluded by exact text, not DOM
  geometry)
- `1d.` control — JurisdictionSection's statewide-baseline line still
  renders its deliberate text: "None — baseline · MUTCD + Colorado
  Supplement only." (true legal-layer claim per 01-FINDINGS F1; NOT
  this defect class)

**Total failures: 0.**

## Scope note

One harness iteration during this run: the first draft scoped the
defect-class scan to a DOM-derived audit-trail container; the
container hunt returned empty text (a vacuous guard), caught because
assertion 1b failed against text the full page demonstrably contained.
Rewritten to scan the whole page and exclude the deliberate baseline
phrase by its exact text — stronger (covers every surface on the
page), and the control assertion (1d) independently proves the
deliberate line survived the scan's exclusion rather than vanishing.
