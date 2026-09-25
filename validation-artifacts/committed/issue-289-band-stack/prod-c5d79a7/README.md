# The last #289 evidence: prod `c5d79a7`, 2026-09-24

Ryan asked: "Re-measure WHAT at 1440 on prod (expect 996) and confirm the suggestion rows at
1440, 600 and 380, then commit that as the last #289 evidence."

All three runs used `../what-density/what-height.cjs` against https://www.conestruct.com/sandbox,
with healthz reporting `c5d79a7`, at the arc's standing spot: E Colfax, 39.74020,
−104.95600, shoulder work. The run stamps (`ranAt`, UTC) are in the JSONs.

## WHAT height

| width | band | grids | local before ship (`../what-density/span/`) |
|---|---|---|---|
| 1440 | **996** | 89.25 / 172 / 105 / 275.25 | 996 (equal) |
| 600 | 1103.5 | 105 / 187.75 / 120.75 / 319.75 | 1103.5 (equal) |
| 380 | 2178.5 | 295.75 / 432 / 224 / 813 | 2178.5 (equal) |

The arc at 1440, prod to prod:
- **1227.25** at `8e2761e`, before the density work;
- **1059.75** at `b81c722`, with the density ruling;
- **996** at `c5d79a7`, with #276's measured reserve and the band-spanning suggestion row.

In total that is −231.25 px (−18.8 %).

## The suggestion rows (`suggRows`)

| width | row width | jurisdiction row | street-class row | |
|---|---|---|---|---|
| 1440 | 809.98 | 32 px — one line | 32 px — one line | ⌁ · sentence · Confirm · Dismiss inline |
| 600 | 502 | 32 px — one line | 32 px — one line | the street-class sentence wraps inside its own box (31.5); the row stays one line |
| 380 | 282 | 69.75 — wraps | 108 — wraps | below 520, wrapping as before (rulings.md) |

The #276 reserve on the jurisdiction line is live at `31.5px` (3em) at all three widths.

## Found and fixed on this branch: #276's reserve was short between 481 and 840

The verification of this evidence caught it: at 600 the `reserveStates` read 47.25 px
(three lines) against the 31.5 reserve. `b8f3159` measured 1440 and 380 only, and the
3-column band between them has narrower lines. Re-measured on prod (`reserve-276/`):

| viewport | line | tallest state | reserve on `c5d79a7` |
|---|---|---|---|
| 520 | 143.33 | 63 | 31.5 — short 31.5 |
| 600 | 170 | 47.25 | 31.5 — short 15.75 |
| 700 | 203.33 | 47.25 | 31.5 — short 15.75 |
| 768 | 226 | 47.25 | 31.5 — short 15.75 |
| 840 | 250 | 31.5 | 31.5 |

`sweep-prod.json` sweeps the line width from 100 to 320 px in place, with the four states:
- ≥242 → 2 lines;
- 168–241 → 3;
- 121–167 → 4;
- 101–120 → 5.

The 4.5em before `b8f3159` was short at 520 as well. The fix, on this branch, makes the
jurisdiction cell a query container and reserves by those thresholds. Measured locally
(`local-ladder-*.json`), the reserve equals the tallest state at 380, 481, 520, 600, 700, 768,
840 and 1440, and WHAT at 1440 stays 996.

## Found, not fixed: the jurisdiction row's place at 380

At ≤480 the WHAT grid is one column. The jurisdiction suggestion row is the last item of its
field's grid row (the ruling's "in the DOM as on screen" placement), so at 380 it renders
after **Work dates**, not directly under the Jurisdiction field (`what-prod-380.png`). Before
`c5d79a7` it sat under the jurisdiction select. Street classification is unaffected: its cell
is the group's last.

Putting it back under Jurisdiction at ≤480 means one of two things:
- reorder the DOM, which makes the order on screen differ from focus order at 1440;
- use CSS `order`, which makes them differ at 380.

It is recorded here for Ryan's ruling rather than chosen in a commit.

The toggle fix (`46d4e18`) is live: at 380 the "i details" underline sits under the word, and
nothing crosses the Divided chips.
