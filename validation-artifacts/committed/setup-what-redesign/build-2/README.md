# Branch 2 — `setup-box-r106` (R106)

Stacked on branch 1 (`setup-what-r108`, `477c951`), as R110 orders: "Build setup-what-r108, then setup-box-r106 stacked on it." Frontend only.

## What shipped

R106: the Setup box after Generate is SetupB.dc.html's title block (`components/ResultsHead.tsx`, CSS `.a-setupbox*` / `.a-setupcell*`).
- **Head:** "✓ SETUP" over the grid, with "pick a cell to change it" (rule 134: the cells are the links, and the word says so).
- **Grid:** cells with mono caps labels. Road spans two cells, so it doesn't wrap. Five tracks at 1440, where Dates also spans two so both rows close flush; two tracks at ≤600.
- **Every cell is a button** with the target it has today, carrying the same `setup-link-<key>` test ids and accessible names (`setupSegments()`, unchanged).
- **Lanes cell (R110 Q9):** two full-height buttons, "2 ×" for lanes and "12 ft" for lane width, each opening S7 on its own field as before.
  - A kind with no lane count states its fixed "1 ×" as text beside the width's button.
- **Unset values** read "◌ not set".
- **No ⚠ on the Setup box (Q9).** A guessed jurisdiction reads "Denver", and the guess markers live in the WHAT band (P2).

## P1: rule 28's reserve is the box's measured height

The box is built from fixed-floor cells (64 px), so its height is known before it forms. `--setup-box-h` is the measured height, still a floor, so a wrapping road name grows the box.

| Width | Reserve in flight before | Box at the settle | Reserve now (in flight → settled) |
|---|---|---|---|
| 1440 | 48 px | 166.75 px (a 119 px jump) | 167 → 167 |
| 390 | 48 px | 358.75 px (a 311 px jump) | 359 → 359 |

Measured by `capture_setup.cjs` (`setup-<w>-facts.json`). Rule 28's slot read `--fact-min-h`; it reads `--setup-box-h` now. The change is deliberate (checkpoint §5, P1), and `results-slot-tokens.test.tsx` states it.

## Screenshots (local build, prod backend, E Colfax)

- `setup-1440.png`: two rows of five tracks.
- `setup-390.png`: five rows of two tracks.
- `setup-<w>-facts.json`:
  - every cell 64–65 px;
  - Lanes is two buttons;
  - hint "pick a cell to change it";
  - no ⚠ in the box.
- `capture_setup.cjs`: the capture.

## Rule 5: churn

- **Re-pointed:** `ResultsHead.grid.test.tsx` (rewritten to R106), `GeneratorShell.value-links.test.tsx` (the hint's words and home), `GeneratorShell.hit-targets.test.tsx` (the cells carry rule 15's floor at 64 px) and `results-slot-tokens.test.tsx` (the reserve).
- **Type census:** `.a-setup-v` is declared at rule 8's value token (124 → 125 on branch 1, 125 → 126 here); no new size.
- **Copy:** "pick a value to change it" → "pick a cell to change it" (SetupB's words).

## Deviations and decisions to flag

1. **Value size.** SetupB draws values at 15 px. They keep rule 8's 13.5 px token (`--fs-body-value`), the size the Setup line had, because the type census admits no new size.
2. **Dates spans two cells.** SetupB's second row is LANES, ROAD TYPE, JURISDICTION, then DATES across two tracks, as drawn.
3. **Dead CSS left in place:** `.a-val-lk` (the old value-link class) is no longer rendered. The clause-7 hit-target block test pins it, so it comes out with the `.classpick` / `.jctl*` rules in one follow-up.
