# #331 Rule 5 prediction

Written before the full suite ran on the change.

## Changes (plans with `limited_sight_distance` set, every live kind)
| Surface | Before | After |
|---|---|---|
| Advance sign stations | each × 1.5 from the work zone's far end (label list) | the series shifted by max(0, top − A); nearest sign at the range top from the taper (flagger: from each flagger, both approaches) |
| Audit `site_adjustments[].action` / `rule` | "50% farther upstream from the taper" | the move's numbers + the Engineer note; rule names ¶04/¶06 |
| Audit `advance.sign_table` | positions fell back to "Advance (code)" | A/B/C positions on the moved signs |
| Audit `advance.spacing_text` | table only | + "limited sight distance moves every advance sign N ft farther upstream (MUTCD §6B.04)" when N > 0 |
| Crew sheet | distances from placements; NI R2-10 from the unmoved station | same, NI R2-10 from its placement; Site-Specific Notes sentence |
| PDF page 1 | no note | one LIMITED SIGHT DISTANCE NOTES line |
| Corpus snapshot | `grid_site_limited_sight_distance.json` | moves (the one flag-set corpus row) |
| Frontend | panel "50% farther"; chip "Moves advance signs 50% farther upstream." | panel prints the backend sentence; chip text changed |

## Unchanged (byte-identical)
Every plan without the flag: placements, audit, crew sheet, PDF. Plans with the flag on an expressway or freeway, or below the range: placements unchanged (record sentence, spacing_text unchanged, page-1 note added). The school-zone S1-1 rule. The audit chip `MUTCD § 6B.04`.

## Expected test churn
- `tests/snapshots/corpus/grid_site_limited_sight_distance.json` re-baselined.
- Any test pinning the old record sentence or the ×1.5 stations.
