# Rule 5 prediction: `phase4-sizes-tooling` (Phase 4 branch 1, R137 Q3/Q4, R138)

Written 2026-10-12, before any change, off main `0eee1a7`. Lane: tooling and docs, with **no UI
change**. Authority: `rulings.md` (R137, R138).

## Deliberate changes

1. **`scripts/verify-jbar-stability.mjs`** measures at **1440×1000 and 360×800** (was 1440×950 and
   1100×950).
   - **Its surface:** the script drives the jurisdiction summary bar (`.jbar`, `#jl-jurisdiction`,
     `.classpick`), which §8.31 removed. No component renders those selectors, so it can't run as
     written.
   - **It's repurposed to the bar's successor,** WHAT's jurisdiction cell: the select
     `#what-jurisdiction`, the street-class segmented control, and the cell's reserved provenance line
     (#276). It keeps the same three checks:
     - the height is identical across every option;
     - nothing changes while the evaluation is in flight;
     - no skeleton on a street-class switch.
   - **The before:** the old script is run once against a local stack to show it failing.
2. **`conestruct/site/DESIGN-SPACING.md`** names the supported sizes (#153's acceptance):
   1440×1000, and the phone floor 360×800 (R138), with the floor's measurement cited. Its
   "rule 169 — the counts hero at 380" row reads "at the phone width".
3. **`FLOW.md`:** "the 380 px arc" becomes "the phone arc (360 px)" (R138's rename), and the 380 px
   mention beside it is updated.
4. **The remaining 360 measurements** are committed as evidence: the other kinds' forms (flagger;
   near-intersection with its cross-street group), the results disclosures opened, and the picker's
   map after interaction (zoom, pan, pin moved).

## Not changing

- No component, CSS, or backend change.
- The CSS media query (`max-width: 480px`) and the token `--fs-hero-numeral-380` keep their names in
  code (a rename is code churn with no behaviour change; the docs say what they mean).
- **The light lane's convention lives in `handoff.md`,** which is untracked and outside the repo. It
  needs a foreground session. From now on, my own captures use 360×800.

## Predicted churn

| Area | Rough count |
|---|---|
| Tests | 0 (the script isn't in a test suite; docs only) |
