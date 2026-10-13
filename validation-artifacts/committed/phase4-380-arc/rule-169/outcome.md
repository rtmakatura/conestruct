# Rule 5 outcome: `rule-169-geometry-home` (Phase 4 branch 5B, R144 Q4 and its fold-in)

Prediction: `prediction.md` (committed `1072139`, before any change). Before = production at
`c109778`. After = the Vercel Preview of `a62504b` (this branch's code), which runs on the
production backend; the branch changes no backend code and `zone_geometry` is already on the wire.
The plan both times: a shoulder closure on N Broadway SB, every disclosure open and the advance
row open (`probe169.cjs`).

## Measured

| | 320 before | 320 after | 360 before | 360 after | 1440 before | 1440 after |
|---|---|---|---|---|---|---|
| Page scroll width | **378** | **320** | **378** | **360** | 1440 | 1440 |
| Hero geometry cell | rendered | **not rendered** | rendered | **not rendered** | rendered | rendered |
| Zone geometry in Reference | none | **4 rows** | none | **4 rows** | none | **4 rows** |
| Sign table right edge vs. its box's | 378.5 / 289 | 273 / 289 | 378.5 / 329 | 313 / 329 | 845 / 1143 | 845 / 1143 |
| Codes on more than one line | W20-1, W20-2, W21-5aR | none | the same three | none | none | none |

The group's rows at every width: "Taper L 40 ft", "Buffer B 200 ft", "Device spacing 30 ft o.c.",
"Work zone 1,000 ft", the strings the hero shows at 1440 for the same plan
(`after/measure.json`, `heroMetaRows` against `zoneGeoRows`).

Screenshots, `after/`: `results-320.png`, `results-360.png`, `results-1440.png` (full page);
`zonegeo-320.png`, `zonegeo-360.png`, `zonegeo-1440.png` (the group close up);
`advance-*.png` (the open advance row); `hero-*.png`. The same set for production is in
`measure-before/`.

## The extended fit check

`scripts/verify-phone-fit.cjs` now opens each calculation row in turn at the results stage.

- **Production `c109778`** (`fit-before/fit.log`): `FIT CHECK FAILED: 320 row 4 (Advance warning
  sign set); 360 row 4 (Advance warning sign set)`, scroll 378, `table. right=378`. Every other
  stage and row fits.
- **This branch's Preview** (`fit-after/fit.log`): `FIT CHECK PASSED at 320 and 360 px`, every
  stage and all 5 rows.

## Prediction vs. outcome

| Predicted | Outcome |
|---|---|
| 320 and 360: page 320 / 360 (were 378), codes on one line | ✓ |
| No hero geometry cell at 320 and 360; the group in Reference with the hero's strings | ✓ |
| 1440: hero unchanged; Reference gains the group and "zone geometry" in its summary; the sign table unchanged | ✓ (table 845 / 1143 both sides; codes already whole there) |
| The extended fit check fails on production at 320 and 360, passes on this branch | ✓ exactly, on the advance row only |

**Changed during the build:** the first CSS draft joined the new selectors onto the hero's and the
device schedule's existing rules. The type census keys each font-size site by its selector, and
two existing tests pin those rules' text, so they failed. The new elements have their own rules
now (the existing rules are byte-identical to main), and the census declares three new sites at
sizes already in the sheet (`cssDeclarations` 128 → 131).

Tests: site suite 2154 passed (208 files), including `components/rule-169.test.tsx` (10). The globals.css diff against main removes no line.
