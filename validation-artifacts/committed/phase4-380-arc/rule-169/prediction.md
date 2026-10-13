# Rule 5 prediction: `rule-169-geometry-home` (Phase 4 branch 5B, R144 Q4 and its fold-in)

Written 2026-10-13, off main `c109778`, before any change. Authority: `../rulings.md` (R144 Q4;
the fold-in below is quoted there with this branch's commit).

> R144 Q4: (a). A "Zone geometry" group in Reference, and the hero's geometry cell is not rendered
> at ≤480.

> Fold in the advance row's sign table at 360: it's cut off at the right edge, and its codes break
> mid-code ("W20-" / "1"). Make it fit 360 and 320 with codes kept whole, phone-only.

Rule 169, verbatim (`../../issue-288-results-stack/rulings.md:349`): "The counts hero goes to 2
tracks and the numerals to 42 px; the geometry cell is not rendered — its four rows are reachable
in the reference disclosure." #288 kept the cell because the second half wasn't true yet.

## Measured first (production `c109778`, `measure-before/`, `probe169.cjs`)

Results for a shoulder closure on N Broadway SB, every disclosure open and the advance row open:

| | 320 | 360 | 1440 |
|---|---|---|---|
| Page scroll width | **378** | **378** | 1440 |
| Hero geometry cell | rendered | rendered | rendered |
| Zone geometry in Reference | none | none | none |
| Advance sign table: right edge vs. its box's | 378.5 vs. 289 | 378.5 vs. 329 | 845 vs. 1143 |
| Codes on more than one line | W20-1, W20-2, W21-5aR | the same | none |

**New finding: the page scrolls sideways on a phone** whenever the advance row is open, at 360
and at 320. R143's fit check (`scripts/verify-phone-fit.cjs`) passed because it opens every
disclosure by its `aria-expanded`, and the audit rows are plain buttons without one: it never
opened a calculation row.

## Deliberate changes

1. **Zone geometry in Reference, at every width.** A "Zone geometry" group in the `i Reference`
   chip's body, before the device schedule: the hero's four rows ("Taper L 40 ft", "Buffer B
   200 ft", "Device spacing 30 ft o.c.", "Work zone 1,000 ft"), from `zone_geometry` through one
   helper the hero uses too, so the two can't drift. No `zone_geometry` renders the hero's one
   "Zone geometry unavailable" row (rule 83). The chip's summary line gains "zone geometry".
2. **The hero's geometry cell is not rendered at ≤480** (rule 169): the counts hero keeps its two
   cells. The cell's other line, the jurisdiction and its TCP term ("Denver · TCP"), stays
   reachable in the WHAT band's jurisdiction cell (ruling 196). At 1440 the hero is unchanged.
3. **The advance sign table at ≤480** (the fold-in): one block per sign, as R141 did for the
   device schedule. The code and position on the first line, then the labelled station and
   distance from the taper. Codes never break, at any width (`white-space: nowrap`); otherwise
   the desk table is unchanged.
4. **The fit check opens the calculation rows.** `scripts/verify-phone-fit.cjs`'s results stage
   also opens each audit row in turn and checks the page width with it open.

## Predicted outcome

- 320 and 360, every disclosure and the advance row open: page scroll width **320** and **360**
  (were 378); every code on one line.
- 320 and 360: no hero geometry cell; the Zone geometry group in Reference with the same four
  strings the hero shows at 1440 for the same plan.
- 1440: the hero unchanged; Reference gains the group and "zone geometry" in its summary; the sign
  table unchanged.
- The extended fit check fails on production (`c109778`) at 320 and 360 and passes on this branch.

## Not changing

The calculation rows' content and place (R144 Q3); the device schedule (R141); the desk layout
of the advance table; the backend (no wire change: `zone_geometry` is already sent).
