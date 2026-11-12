# #525 plan (written before the diff)

Baseline (worktree, base e331b15): `vitest run dedup.test.ts group.test.ts app/api/road-bearing LocationPickerModal.map-window.test.tsx` → Test Files 6 passed (6), Tests 56 passed (56). Orphan dev servers: none started by this sub-agent; the orchestrator ran /start's § 0.

1. **Problem.** `conestruct/site/lib/road-detection/dedup.ts` (`dedupCandidates`) keys same-road pieces by (name, class, bearing octant). At the pin, Pennsylvania's way 812978772 is drawn north to south and the others south to north, so it falls in the S octant and becomes its own row; its nearest point is its south end, about 22 m north of the rounded pin (trace.md).
2. **Rulings.** Ryan's item 2 ruling (rulings.md, verbatim); group 8 R145-1/R145-2 (#507); self-ruled R145-1..12 (R145-11 and R145-12 added in gate round 2).
3. **Change.**
   - `lib/road-detection/dedup.ts`: `mergeSameStreet(raw, kept)`: folds a kept entry into an earlier one with the same name when they connect (shared node, through any chain of raw same-name ways) or run along the same line (25°, 3 m), and their travel reads the same; never two opposite one-way carriageways.
   - `lib/road-detection/dedup.ts`: `attachCrossStreets(raw, entries, pin)`: each entry's `cross_street`, the nearest other named, non-parallel listed street sharing a node with it within 30 m of the pin.
   - `app/api/road-bearing/route.ts`: calls both (merge after dedup, cross streets after grouping).
   - `lib/road-detection/types.ts`: optional wire field `cross_street?: string | null`.
   - `components/LocationPickerModal.tsx` `roadRowLine`: appends " · at <cross street>" when present.
4. **Rule 5 churn prediction.**
   - Changes: a same-name street drawn in pieces with opposite vertex order (or in parallel pieces on one line) now lists once, at the nearest piece's distance. At this pin: two Pennsylvania rows become one (the 0.8 m row stays, the 22 m row goes). Every row whose street meets another listed street at the pin gains " · at <name>" (Pennsylvania: "at East Colfax Avenue"; Colfax: "at Pennsylvania Street").
   - Byte-identical: every surviving entry's way id, geometry, bearing, distance, tags, twin evidence and travel words; the twin grouping (Colfax, Speer, Lincoln keep one entry each); the plan, scenario wire, PDF, audit and every backend file (no Python change); the picker's cross-street step; `primary_index` stays 0. A lookup with no same-name split and no crossing returns the same body as today, with no `cross_street` key.
   - Possible list churn elsewhere (deliberate): any street drawn in reversed pieces near a pin drops its duplicate row.
   - (Amended while building, before the tests ran green: see § Churn actual for the new-module placement.)
5. **Proof.** Recorded Overpass fixture `app/api/road-bearing/__fixtures__/colfax-pennsylvania-525.json` (both round trips, recorded 2026-11-11) drives the real route in `route.colfax-pennsylvania.test.ts`: one Pennsylvania entry at the nearest way's distance, "at East Colfax Avenue", Colfax still one grouped entry. Unit tests in `dedup.test.ts` (connect, same line, opposite carriageways stay apart, divided-two-way-tagged stays apart, one-way change keeps two rows, cross street rules). `roadRowLine` test in `LocationPickerModal.map-window.test.tsx`. Red proof against the old route in red-proof.md. Crops before/after at 1440, 1198x930, 390 with axe and the 44 px measure. All committed in this folder.

## Round 2 amendment (gate round 1 reviewer findings; written before the round 2 diff)

- **Merge adds the class test** (finding 1): two entries fold only when their OSM `highway_class` is also the same, as group 8's R145-2, `dedup.ts` and `group.ts` all require. Predicted churn: none at the four replay pins (every Pennsylvania piece is `residential`; Colfax's carriageways never folded). A same-name `*_link` no longer folds its mainline, so the mainline still pairs with its opposite carriageway.
- **Implied one-way never folds when untagged** (finding 5): a `motorway` or `motorway_link` with no `oneway` tag no longer counts as two-way for the merge (mirror of the backend's `IMPLIED_ONE_WAY_CLASSES`, `src/rules/corridor.py`). Predicted churn: none at the four replay pins (no motorway). Roundabouts: the route doesn't relay `junction`, so the limit is stated in the module comment.
- Byte-identical, as before: every surviving entry's fields, the route body outside `candidates`, all backend files.
- New test: a same-name one-way `primary_link` nearer the pin, sharing a node with the mainline carriageway; the mainline must still pair with its opposite carriageway. Red on the round 1 code.

## Churn actual

Files: as predicted, with two placement changes made while building. (1) Both functions went into a new module, `lib/road-detection/same-street.ts` (+ `same-street.test.ts`), not into `dedup.ts`; `dedup.ts` is untouched. (2) `lib/road-detection/cross-street.ts` gains one word, `export` on `PARALLEL_TOLERANCE_DEG`, so the same-line test reads the picker's own constant. Also new: the recorded fixture `app/api/road-bearing/__fixtures__/colfax-pennsylvania-525.json` and `route.colfax-pennsylvania.test.ts`. No Python file changed.

Route replay (the group 8 walk's recorded Overpass answers plus this one, through the route at base `e331b15` and with the fix; a temporary test, deleted):

| Pin | Before | After | Surviving entries identical except `cross_street` | Rest of body identical |
|---|---|---|---|---|
| E Colfax at Williams (39.73997, -104.96632) | Colfax 600545936 (twin) 0.77 m; Williams 26.84 m | same two; Colfax "at Williams Street", Williams "at East Colfax Avenue" | yes | yes |
| N Lincoln (39.7345, -104.9862) | Lincoln 5.5 m | same; no cross street | yes | yes |
| E Speer (39.7197, -104.97677) | Speer 0.27 m | same; no cross street | yes | yes |
| Colfax and Pennsylvania (39.7401, -104.9811) | Penn 1548629055 1.69 m; Colfax 1547338992 (twin) 4.98 m; **Penn 812978772 21.75 m** | Penn 1548629055 1.69 m "at East Colfax Avenue"; Colfax (twin) 4.98 m "at Pennsylvania Street" | yes | yes |

Matches the prediction. One reading to note: at Colfax and Williams the Williams row (26.84 m away) also gains "at East Colfax Avenue", because the two streets share a node within 30 m of the pin. That is the ruled behavior (R145-8).

Two deviations from the step 3/4 prediction text (found by the gate round 1 reviewer; the prediction above is left as written):
- Step 4 said "the 0.8 m row stays". The row that stays is way 1548629055, as predicted, but it measures **1.69 m** from the rounded pin, not 0.8 m. The 0.8 m figure was a hand estimate of the gap between the two pieces' lines, not a distance to the pin.
- Step 3 said "cross streets after grouping". The code runs `attachCrossStreets` in `buildResponse`, **before** `groupCarriageways`, because it must read each way's own geometry before the centerline is stitched. Checked: a grouped divided-road entry still gets its cross street (R145-12): the grouping keeps the lead's fields, and both carriageways share one name key.

### Round 2 (after the reviewer fixes)

Changed-file tests: 20 files, 240 tests passed; tsc clean. The route replay at the same four pins returns a body identical to round 1, field for field (Colfax/Williams: Colfax 600545936 with twin 1548771425, "at Williams Street"; Williams "at East Colfax Avenue". Lincoln and Speer: unchanged, no cross street. Colfax/Pennsylvania: Penn 1548629055 1.69 m "at East Colfax Avenue"; Colfax 1547338992 with twin 628643780, "at Pennsylvania Street"). Matches the round 2 prediction: no churn at these pins. The only behavior change is in the cases the new tests cover: a same-name link, and an untagged motorway. Nothing visible changed, so the walk was not re-run. The walk JSONs were rewritten ASCII-only, with the same readings.
