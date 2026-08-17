# s2-arc1 — sandbox honesty pair (#198 + #123)

Sequence 2, Arc 1. Branch `issue-198-sandbox-honesty`, two commits:
`a3d6bf5` (Refs #198), `4e7cbea` (Refs #123). Base `31bd1b0`.

## Pre-fix (at the branch base, before any change)

- `pre-fix-repro.test.ts.txt` — the temporary capture suite (10 cases),
  asserting the THEN-CURRENT broken behavior: each of the four #198
  mutation families silent at the seam, plus #123's rationale/value
  contradiction on secondary/tertiary/unclassified one-ways and the
  trunk misattribution the GO's ruling 1 also killed. The file lived at
  `conestruct/site/lib/scenarios/__repro-198-123.test.ts` only for the
  capture run and never entered a commit.
- `pre-fix-captures.txt` — its 10/10 green run: F1's clobbered
  before/after payloads with an empty event set, F2's identity-return
  drop, F3's silent 5→4 and 6→4 clamps, F4's `{speed:35,
  workZoneSpeed:45}` invalid pair. Fed to the backend model, that pair
  rejects with exactly: `workZoneSpeed (45) must be <= posted speed
  (35).` (captured via `src.api.schemas.ShoulderScenario`, same
  session).

## Post-fix

- `post-fix-captures.txt` — the committed regression suites green
  (116 tests across handoff-summary / auto-apply / overrides / classify
  / the mounted GeneratorShell.handoff-provenance fixtures). The
  mounted run's QuotePanel controlled-input warning pre-exists at the
  branch base (verified by stash-run against the unmodified
  picker-reapply suite) and is flagged for the saved-mode cluster.

Full-suite state at each commit: 655 and 662 vitest green respectively,
tsc clean, lint carrying only the pre-existing `restoreFallbackRef`
warning (same code on `main`).
