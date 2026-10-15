# Rule 5 outcome: `issue-318-phone-drawings` (#318, R149)

Prediction: `prediction.md` (committed `1de2950`, with the measurements). Stacked on `issue-291-roadtype-guess`
(`fe39f46`).

## Built as predicted

- **`components/OutputCards.tsx`:** the Plan sheet card (`kind: "pdf"`) renders
  `<p class="dl-phone-note tr-prov" data-testid="dl-phone-note">` with:

  > This is an 11×17 drawing. Open it on a bigger screen or print it.

  It sits between the card's description and its Download PDF button. No other card has it.
- **`app/globals.css`:** the line is `display: none` off the phone. Inside rule 168's
  `@media (max-width: 480px)` block a more specific rule (`.workbench .dls .dl-card .dl-phone-note`) shows it.
  It uses the card's existing provenance role, so no new type size.
- **The corridor aerial is unchanged.** Its legend measured legible at 360 and 320 (below), so R149's
  condition for treating it the same way isn't met.

## The measurements (committed with the prediction)

| | at 360 | at 320 | verdict |
|---|---|---|---|
| plan sheet, smallest text (6 pt) at fit-width | 1.76 px | 1.57 px | illegible: the line goes on its card |
| plan sheet, the bulk (6.5–8 pt) | 1.9–2.4 px | 1.7–2.1 px | illegible |
| aerial legend (5 rows, laid out) | 10.5 px, 0 clipped, axe 0 / 5 | 10.5 px, 0 clipped, axe 0 / 5 | legible: no notice |

The smallest ruled UI type role is 10 px.

## Measured in the browser (`phone-local/`, the branch's site and backend on localhost; N Broadway SB shoulder plan)

| width | line on the Plan sheet card | shown | other cards with it | Plan sheet card controls |
|---|---|---|---|---|
| 360 | verbatim | **yes** (after the "4 files" row opens) | none | Download PDF, 302 × 44 |
| 320 | verbatim | **yes** | none | Download PDF, 262 × 44 |
| 1440 | in the DOM | **no** | none | Download PDF, 181 × 44 |

- **Desk:** at 1440 the downloads row (`phone-local/dls-1440.png` against prod `6c25fed`'s
  `phone-prod-6c25fed/dls-1440.png`) is **byte-identical**: the same PNG bytes, no pixel difference. The DOM
  gains one hidden node.
- **"The PDF stays one tap away":** the line adds nothing before the button. The phone's existing "4 files"
  row (rule 168) is unchanged.
- **Screenshots:** `phone-local/plan-card-360.png` and `phone-local/plan-card-320.png`.

## Tests

- **`components/OutputCards.phone-note.test.tsx`** (2 tests):
  - the line is verbatim, on the Plan sheet card only, before its button;
  - the CSS hides it off the phone and shows it inside the ≤480 px block.
- **Suites:**
  - vitest: 217 files, 2253 tests.
  - pytest: 2849 passed, 2 skipped (no backend change).
  - `tsc` clean; `next build` clean.
  - No snapshot moved.
