# Rule 5 prediction: `issue-318-phone-drawings` (#318, R149)

Committed before any code. Stacked on `issue-291-roadtype-guess` (`fe39f46`).

## Ruling (R149)

> option (a). At phone width (360×800, fit-check 320), the plan sheet card shows this line, verbatim: "This
> is an 11×17 drawing. Open it on a bigger screen or print it." The PDF stays one tap away. The corridor aerial
> gets the same treatment only if its legend measures illegible at 360; measure it and say which. Desk width
> is unchanged (byte-identical at 1440). Controls stay ≥44 px.

## Measured before any code

### The plan sheet (`sheet318.py`, `sheet318.txt`, a real Denver plan: N Broadway SB from #322's evidence)

Page 1 is 1224 × 792 pt. A phone viewer fits the width, so 1 pt = 0.294 px at 360 and 0.261 px at 320.

| text | pt | at 360 | at 320 |
|---|---|---|---|
| smallest | 6.0 | **1.76 px** | 1.57 px |
| the bulk (notes, schedule, summary) | 6.5–8 | 1.9–2.4 px | 1.7–2.1 px |

The smallest ruled UI type role is 10 px (`lib/design/type-roles.ts`). The sheet is illegible on a phone
without zooming, which is what the line says.

### The corridor aerial's legend (`measure318.cjs`, `aerial-prod-6c25fed/`, prod `6c25fed`, N Broadway SB, laid out, five rows)

| width | legend rows | smallest text | clipped | axe color-contrast |
|---|---|---|---|---|
| 360 | 5 | **10.5 px** | 0 | 0 violations, 5 passes |
| 320 | 5 | 10.5 px | 0 | 0 violations, 5 passes |
| 1440 | 5 | 10.5 px | 0 | 0 violations, 5 passes |

The legend is HTML under the image, in a ruled role (10.5 px, above the 10 px floor). Nothing clips, and the
contrast passes. **The legend measures legible at 360, so the aerial gets no notice** (R149: "only if its
legend measures illegible").

## What gets built

- **`components/OutputCards.tsx`:** the Plan sheet card (`kind: "pdf"`) gains
  `<p class="dl-phone-note" data-testid="dl-phone-note">` with exactly "This is an 11×17 drawing. Open it on a
  bigger screen or print it." It sits between the card's description and its Download PDF button, so the
  button stays where it is and nothing is added before the PDF.
- **`app/globals.css`:** `.dl-phone-note` is `display: none` by default and shown at `@media (max-width:
  480px)` (rule 168's phone breakpoint). It uses the card's existing provenance role, with no new type size
  (P5).

## Predicted

- **At 360 and 320:** the line shows verbatim in the Plan sheet card once its "4 files" row is opened, and
  the Download PDF button is still one tap. The other three cards have no line. Tap targets in the card stay
  ≥44 px.
- **At 1440:** screenshots of the downloads row and the results column are pixel-identical to prod
  `6c25fed`. The DOM gains one hidden node, so "byte-identical" here means the rendered pixels.
- **vitest:**
  - the line is on the Plan sheet card only, verbatim;
  - the CSS hides it off the phone and shows it at ≤480;
  - the button is unchanged.
- **Snapshots:** none move. This is a frontend-only change.
