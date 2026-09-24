# WHAT density: the band's height at 1440, before and after

Ryan, 2026-09-24 ("WAY too busy", P19), recorded verbatim in `../rulings.md`, "After the S4
prod run". The last sentence of that ruling: "Measure the WHAT band's height at 1440 before and
after."

## How it was measured

`what-height.cjs` follows the same S1 → S3 route as `../fidelity-audit/probe.cjs`:
- E Colfax, pin 39.74020, −104.95600, entered through the picker's manual coordinates;
- the first detected candidate, and 1,000 ft;
- shoulder work, then Confirm.

It then measures the open WHAT band (`[data-testid="band-what"]`) once the checks settle
(no VERIFYING strip, and the boundary lookup has answered). Both runs used one local
`next dev` at 1440 × 1000 against the live Modal backend, so they differ only by the change.
The local "before" matches prod: prod `8e2761e` measured the same band at **1227.25 px**
(`../s4-prod/` run, S3 capture, `section.a-open[band-what]`).

| | band | grid 1 (speed / lanes / width) | grid 2 (road type / jurisdiction / dates) | grid 3 (project / location) | second group |
|---|---|---|---|---|---|
| before (`what-height-before.json`) | **1227.25** | 89.25 | 432.75 | 105 | 245.75 |
| after (`what-height-after.json`) | **1059.75** | 89.25 | 205.5 | 105 | 305.5 |
| Δ | **−167.5 (−13.6 %)** | 0 | −227.25 | 0 | +59.75 |

Screenshots: `what-before.png` and `what-after.png`.

The second group grows because street classification is now its own cell there ("out of the
road-type cell"). It shares a row with Divided highway, so the group adds one row's worth of
height, not a stack.

## What moved behind each field's toggle

The toggle is rule 17's `i` symbol beside the word "details", and it is a button (click, tap,
Enter).

| field | stays at rest | behind "i details" |
|---|---|---|
| Road type | select · `⚠ OSM · Urban arterial · inferred` | bearing, one-way, divided (when no Divided control), #214's "road geometry governs the drawing …" (byte-identical), the kind's CDOT case note, the picker's handoff sentence |
| Jurisdiction | select · its state line · `⌁ Pin suggests: Denver` + Confirm / Dismiss | "evaluated as …", the suggestion's reason paragraph, boundary warnings, the TIGER "Boundary data is approximate (…, vintage) …" caveat, the passive agree / differ rows |
| Street classification (own cell, second group) | chips · its line · `⌁ Detected road suggests street class: …` + Confirm / Dismiss | the map chip (where the jurisdiction classifies by map), the map caveat, the passive agree / differ rows, the resolved record's tier line |
| Divided highway | chips · `median present · …` | the divided detection clause |
| Speed / lanes / lane width | control · its line | the picker's handoff sentences, when there are any |

`toggles: 4` in the after run: road type, jurisdiction and divided, plus street
classification's. Street classification's toggle is in the DOM, but its panel renders
nothing at this pin (no map on record, no class picked), so CSS hides it
(`.a-cell:has(> .a-info:empty)`).

## What still takes height, and why it stayed

- **Jurisdiction's line reserves 4.5em** (#276, ruled 196: "three states, no skeleton, no
  height change"). That reserve is most of the gap under the unset line in `what-after.png`.
- **The suggestion rows wrap as before:** the ⌁ glyph, then the sentence, then the buttons.
  The ruling's "one line + Confirm/Dismiss" is met in content. The row's layout is the
  `.jbar-suggest` / `.sugg-row` shape #227 already ruled, and restyling it is a separate
  question.

The 380 render and the prod figures are re-measured after the ship.
