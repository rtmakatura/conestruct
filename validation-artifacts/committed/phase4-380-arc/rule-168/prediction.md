# Rule 5 prediction: `rule-168-cards` (Phase 4 branch 6, R137 Q1, R145 self-ruled)

Written 2026-10-13, off main `72a602a`, before any change. Authority: `../rulings.md` (R137 Q1;
"Rule 168 (Phase 4 branch 6): R145 self-ruled").

## Measured first (production `72a602a`, `measure-before/`, `probe168.cjs`)

Results for a shoulder closure on N Broadway SB (NEEDS YOU has items, so the zip is the ghost):

| | 320 | 360 | 1440 |
|---|---|---|---|
| Zip control ("4 files ↓ All (.zip)") | 44 tall | 44 tall | 32 tall |
| Card row | 1 column, **604 tall** | 1 column, **604 tall** | 4 columns, 142 tall |
| Cards | 4 (5 download buttons) | the same | the same |

## Deliberate changes

1. **≤480 px, sandbox (the zip renders):** the four cards are closed behind a "4 files" line
   under the zip, a disclosure button (44 px, `aria-expanded`, `aria-controls` the row). Opening
   it shows the four cards as today. The count beside the zip is not shown there, so the count
   stays stated once at each width (§8.29).
2. **≤480 px, saved plan (no zip):** unchanged; the cards render.
3. **1440:** unchanged; the line is hidden, the cards render, the count sits beside the zip.

## Predicted outcome

- 320 and 360, closed: the download row is the zip plus a 44 px "4 files" line; no card on
  screen; the row about 560 px shorter than today's 604 px card column plus the zip.
- 320 and 360, opened: the four cards, each 142 tall, all five download buttons present.
- 1440: identical to today (zip, count, four cards in one row).
- The fit check passes at 320 and 360.

## Not changing

What the zip holds, what each card downloads, the zip's primary/ghost derivation (#288 clause 3),
the saved-plan cards, the desk layout.
