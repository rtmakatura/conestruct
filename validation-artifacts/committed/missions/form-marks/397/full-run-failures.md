# Full-run failures (#397)

## Run 1 — vitest, after the fix, before any test edit
- `components/bands/MoveLedger.form.test.tsx > rule 68's values (correction 3) > 'Extent' separates the value from its producer with the column's middle dot`
  - Expected: the change predicted in rulings.md (the fixture's untouched 1,000 ft now reads "1,000 ft · default", not "· typed"). Deterministic, not a flake; the assertion is updated in this branch.

## Repair cycle 3, first full vitest run on 525c2e4 + this diff

Tests 1 failed | 2580 passed | 1 skipped (2582). Failing test, saved before any re-run:
- components/GeneratorShell.a11y-announce.test.tsx > generation announcements (#193) > clears at the click so a repeat Generate with identical counts re-announces
- On its own: `npx vitest run components/GeneratorShell.a11y-announce.test.tsx`: Tests 8 passed (8). PASSED alone.
- Second full run: Test Files 242 passed | 1 skipped (243); Tests 2581 passed | 1 skipped (2582). The test mounts the whole shell, but what it asserts is the Generate announcement, which this diff does not change; recorded as a flake (timing under the full run), not fixed here.
