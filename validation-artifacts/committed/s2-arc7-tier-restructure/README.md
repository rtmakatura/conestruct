# s2-arc7 — the tier arc (#219 restructure · #220 PDF cover · #223 NI parity), evidence

Branch `issue-219-tier-restructure`, base `d8419d6`.  Commits:
fixtures + expectation + `lib/tiering.ts` + the #223 red pin →
NI parity (`buildNearIntersectionItems`) → the Zone-3 restructure
(`TieredReference`) + test migration → `tier_ledger.py` + the PDF
cover line → this evidence.

## The ruled mapping (GO 2026-08-24, flags a–k as recommended)

The specification is the checkpoint's §1.1 table; its executable form
is `conestruct/site/lib/tiering.ts` and its Python mirror
`src/rendering/tier_ledger.py`, both pinned to
`tests/fixtures/tiering/tiering-expectations.json` — the hand-computed
expected classification of two recorded wire fixtures
(`control-lakewood` shoulder, `adv-ni-denver` NI).  Either
implementation drifting breaks its own suite against that one file.

## Before-state (the exploration, production at the same `d8419d6`)

`exploration/` — the 2026-08-24 design exploration's measurements,
committed per the ruling: EVIDENCE-SUMMARY.md (headline table),
walk-log.md (the NI flow walk transcript), metrics logs + JSONs
(typical 94 words default / 685 engaged / 6 audit items · heavy NI
109 / ~1,020 / **3 audit items** — the #223 gap), screenshots.

## Proofs at the arc tip

- Frontend: 737/737 (26 classifier tests incl. the permutation grid,
  ledger-sums-to-all, ◌-never-elsewhere, plan_flags coherence; the
  mounted fixture suite asserting the RENDERED ledger equals the
  expectation; every migrated family passing — none vanished).
- Backend: 1928 passed / 2 standing skips (9 tier-ledger tests incl.
  the served cover line equal to the screen ledger for both fixtures,
  through the real API path; the s2-arc6 containment harness zero on
  the modified cover).
- `probes/wire-probes.md` — the #223 finding: the NI wire carries
  taper/buffer/spacing/advance/colorado/case today (render-existing-
  data, no backend gap; no new issue needed), plus the Denver status
  probe grounding the mapping.
- `probes/wordset-control-result.txt` — base-vs-tip audit-PDF word
  set for control-typical: 341 → 349, zero words lost, the eight new
  words are exactly the Plan-status row (the ruled #220 churn and
  nothing else).

## Predicted-churn deltas beyond the restructure itself (rule 5)

Additive audit rows persist through a refetch under the
"(refreshing…)" cue (the #187 loading-only fallback) instead of
vanishing; corridor checked-and-clean renders as a named ✓ pass
(ruled flag h).  Enumerated at the checkpoint, accepted in the GO.

Refs #219, #220, #223.
