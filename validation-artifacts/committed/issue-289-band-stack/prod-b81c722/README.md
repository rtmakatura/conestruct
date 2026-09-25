# Prod re-measure after the density ship — `b81c722`, 2026-09-24

After the `issue-289-s4-prod` stack shipped, Ryan asked: "re-measure on prod: WHAT height at
1440, the 380 layout, and the S4 first-Generate placeholder." Every run hit
https://www.conestruct.com/sandbox, with healthz reporting `b81c722`, at the arc's standing
spot: E Colfax, 39.74020, −104.95600, shoulder work. The run stamps (`ranAt`, UTC) are in the
JSONs.

## WHAT height — `what-density/what-height.cjs`

| width | band | grids | file |
|---|---|---|---|
| 1440 | **1059.75** | 89.25 / 205.5 / 105 / 305.5 | `what-height-prod-1440.json`, `what-prod-1440.png` |
| 380 | **2178.25** | 295.75 / 439.75 / 224 / 805 | `what-height-prod-380.json`, `what-prod-380.png` |

The 1440 figure is the local "after" from `../what-density/` to the quarter-pixel (1059.75),
against prod's 1227.25 before the ship. The same runs carry the figures for the two
follow-ups:
- `reserveStates`: the jurisdiction line's four states, 15.75 / 31.5 / 31.5 / 31.5;
- `suggRows`: the at-rest suggestion rows' widths.

## The 380 layout

`what-prod-380.png` is one column with no horizontal overflow. Each field has its control and
one provenance line; the toggles sit on their label rows, right-aligned.

**One defect, fixed on `issue-289-density-followups`:** `toggle-defect-380.png`. The toggle's
44 px box (rule 163) overhung its row by 14 px both ways, so `.a-lk`'s box-edge underline was
drawn across the Divided chips, and the box's lower 8 px sat on the control below. The fix
overhangs upward only and puts the underline under the word.

## S4 on a first Generate — `fidelity-audit/probe.cjs` (plan request held)

`s4-facts.json`, `s4-w1440.png`, `s4-w380.png`. This is the gap `../s4-prod/` found, now
closed on prod:

| rule 117 | 1440 | 380 |
|---|---|---|
| results placeholder: "02 · RESULTS" + "No package yet — the plan is being built." | present | present |
| 1 px #2c3e53 / ground #101c29 / padding 22 16 / body value #6e7c8e | `rgb(44, 62, 83)` / `rgb(16, 28, 41)` / `22px 16px` / `rgb(110, 124, 142)` | same |
| verdict slot mounted, empty, holding its height | 57 px, "" | 80 px, "" |
| fact lines at .5, "locked" | Where, What's the job?, Generate | same |
| working band mounted (and after the capture) | yes | yes |
| no primary | 0 | 0 |
| no "Previous answer" ribbon, no pre-Generate results | none | none |

The one remaining difference from rule 117 is the one `../s4-prod/` already recorded: the slot
is visible and empty, and holds its room with `min-height`, where the rule says "visibility
hidden".
