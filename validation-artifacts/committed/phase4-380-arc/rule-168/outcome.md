# Rule 5 outcome: `rule-168-cards` (Phase 4 branch 6, R137 Q1, R145 self-ruled)

Prediction: `prediction.md` (committed `72a9924`, before any change). Before = production at
`72a602a` (`measure-before/`). After = the Vercel Preview of `ca161cd`, this branch's code
(frontend-only; `after/`). The plan both times: a shoulder closure on N Broadway SB (NEEDS YOU has
items, so the zip is the ghost). `probe168.cjs` measures the row as the results flow leaves it
(every `aria-expanded` control opened, the new line included), then closes the line and measures
the default.

## Measured

| | 320 before | 320 after, closed | 320 after, opened | 360 before | 360 after, closed | 360 after, opened | 1440 before | 1440 after |
|---|---|---|---|---|---|---|---|---|
| Download block height | 44 + 604 of cards | **100** (zip 44, line 44) | 716 | 44 + 604 | **100** | 716 | 186 | 186 |
| Cards on screen | 4 | **0** | 4 | 4 | **0** | 4 | 4 | 4 |
| Download buttons reachable | 5 | 5 (behind the line) | 5 | 5 | 5 | 5 | 5 | 5 |
| "4 files" shown | beside the zip | **the line** ("4 files ›", 44 tall) | the line | beside the zip | the line | the line | beside the zip | beside the zip |
| Page width | 320 | 320 | 320 | 360 | 360 | 360 | 1440 | 1440 |

Screenshots: `after/dl-closed-320.png`, `after/dl-closed-360.png` (the default),
`after/dl-open-320.png`, `after/dl-open-360.png`, `after/dl-open-1440.png`; production's in
`measure-before/dl-*.png`.

Fit check on the Preview (`fit-after/fit.log`): `FIT CHECK PASSED at 320 and 360 px`, every
stage and every calculation row.

## Prediction vs. outcome

| Predicted | Outcome |
|---|---|
| Phone, closed: the zip plus a 44 px "4 files" line, no card; about 560 px shorter | ✓ the block is 100 px, against 648 (604 + the zip's 44): 548 shorter |
| Phone, opened: the four cards, 142 tall, all five download buttons | ✓ |
| 1440 unchanged | ✓ the same zip, count and one row of four |
| The fit check passes at 320 and 360 | ✓ |

**Tests that moved (not listed in the prediction):** the count's tests. The count now has two
homes in the markup, one shown per width, so `GeneratorShell.primary.test.tsx` (three tests) and
`OutputCards.test.tsx` count two homes where they counted one; `components/rule-168.test.tsx`
pins the CSS that shows exactly one per width. The new button also joined two guard lists:
`GeneratorShell.hit-targets.test.tsx`'s floored classes (44 px at ≤480, not displayed at the
desk) and the write lock's reads (`data-read`, as `DisclosureRow`'s control).

Site suite: 2160 passed (209 files). One write-lock test failed once under full-suite load at
5 s; it passed alone and on the next full run (2160 passed).
