# #493 checkpoint: the intersection map reuses the WHERE tap's cross street

Mission `ux-columns-copy-maps` (#494). Branch `issue-493-cross-street-reuse`, stacked on `origin/mission-494-prod-check` (`f9126089`; first built on `issue-491-failure-copy` `cf5ddffd`, an ancestor, and rebased in mission retap-and-cap).

Ryan's brief: "#484: the intersection map reuses the cross street the WHERE tap already found (#440) instead of a new lookup; record the time saved."

## Plan (written before the diff)

1. **Problem.** `render_needs_you_map` (`src/api/render_api.py:2096-2101`) calls `cross_street_geometry` for the intersection question's full image: one more Overpass read (`site_detection.py:1248-1275`, its own 8 s budget) for a street the WHERE tap (#440, `lib/cross-street-mark.ts` → `lookupCrossStreet` → `/api/road-bearing`) already found. The tap keeps only the name on `meta.intersection` (`intersectionRecord`, `cross-street-lookup.ts:67`); the candidate's geometry (`RoadCandidate.geometry`, the stitched same-name chain, at most `GEOMETRY_MAX_NODES` = 300) is fetched and dropped.
2. **Change (smallest honest one).** The tap keeps the geometry it already fetched: `CrossStreetCandidate.geometry` ← the candidate's `geometry`; `intersectionRecord` writes it as `meta.intersection.geometry`. Backend `IntersectionPin.geometry` (≤ 300 points, the producer's cap). The route draws from it with no Overpass read when the record stands at the question's crossing (the tapped point within `CROSS_STREET_RADIUS_M` of the crossing node, and the line passes within it); otherwise it runs #484's lookup. Header `x-map-cross-source: tap | lookup` on every intersection full image that sought a cross street, relayed by the proxy for the checks (Rule 10: the path that ran is said). The tag's name is the tap's name.
3. **Wire.** Three hops: `IntersectionRecord.geometry` (types.ts) → the proxy relays the scenario whole → `IntersectionPin.geometry` (schemas.py). Read only by `/render/needs-you-map`; no deliverable reads it. Size: a payload-level test of the worst case (300-node centerline + 300-node cross-street geometry) under the 32 KB render-family cap.
4. **Not here.** #487's edge cases (in the base since `7db92510`; the tap path uses its `_street_key`, R145-10). No device count, no audit, no PDF change.
5. **Proof.** Red first: a payload-level pytest that a tap record makes zero Overpass `around:` calls (red on the base: one). Then: the drawn line and tag on the E Colfax fixture match #484's lookup output (same frame, point, name, tag place; every lookup dash on the tap line); the fallback paths (no record, no geometry, a record at another crossing) run the lookup and say so; the header relay; the record test; the worst-case size test. Time saved: one live Overpass read of #484's committed query, timed (the evidence has whole-image times only, no time for this read alone), plus the stubbed call count before/after.

## Rule 5 churn prediction (before the diff)

Behaviour change, deliberate: a near-intersection plan whose cross street was marked by the tap or the picker (after this lands) draws the intersection question's line from the tap's geometry, with no second Overpass read; its dashes follow the tap's stitched chain, so their phase and reach across the frame can differ from #484's per-way lines. A plan with no geometry on its record (every saved plan today, every other kind) is unchanged: #484's lookup, now with `x-map-cross-source: lookup`. Plans, PDFs, audits, device counts: byte-identical (nothing else reads the field).

Files (predicted):
- `src/api/schemas.py` (+~10): `IntersectionPin.geometry`.
- `src/rules/site_detection.py` (+~30): `tapped_cross_street`.
- `src/api/render_api.py` (+~15): tap first, lookup fallback, the header.
- `tests/test_needs_you_map.py` (+~130): the new tests.
- `tests/fixtures/needs-you/colfax-franklin-tap.json` (new): the tap's record on E Colfax, produced by the real producer.
- `conestruct/site/lib/road-detection/cross-street.ts` (+~5), `cross-street-lookup.ts` (+~4), `lib/scenarios/types.ts` (+~6), `lib/render-proxy.ts` (+~2).
- `conestruct/site/lib/road-detection/cross-street-lookup.test.ts` (+~70): the record test gains the key; the producer→fixture test; the size test.
- `conestruct/site/lib/render-proxy.needs-you-map.test.ts` (+~5): the header relay.
- Possibly churned by the new key: tests that `toEqual` a derived candidate or a record (`cross-street.test.ts`, `GeneratorShell.cross-street-tap.test.tsx`, `cross-street-mark` tests).
- Evidence: this folder.

## Actual churn (after the diff)

| File | Predicted | Actual |
|---|---|---|
| `src/api/schemas.py` | +~10 | +11 −1 |
| `src/rules/site_detection.py` | +~30 | +31 |
| `src/api/render_api.py` | +~15 | +32 −4 (the docstring, the import split over lines) |
| `tests/test_needs_you_map.py` | +~130 | +201 (a scenario builder for E Colfax: no E Colfax scenario fixture existed) |
| `tests/fixtures/needs-you/colfax-franklin-tap.json` | new | new, 89 lines |
| `conestruct/site/lib/road-detection/cross-street.ts` | +~5 | +9 |
| `conestruct/site/lib/road-detection/cross-street-lookup.ts` | +~4 | +5 −1 |
| `conestruct/site/lib/scenarios/types.ts` | +~6 | +7 −1 |
| `conestruct/site/lib/render-proxy.ts` | +~2 | +2 |
| `conestruct/site/lib/road-detection/cross-street-lookup.test.ts` | +~70 | untouched: the new tests went in a new file, `cross-street-tap-record.test.ts` (187 lines), and the old record test passes unchanged (no line, no key) |
| `conestruct/site/lib/render-proxy.needs-you-map.test.ts` | +~5 | +20 (also the scenario-out test) |
| "possibly churned" tests | possibly | none churned |
| `conestruct/site/vercel-ignore.sh` | not predicted | +1: the R2 build-inputs check (`full-run-failures.txt`) |

Behaviour: as predicted. Unpredicted: the vercel-ignore.sh line; the tag 8 px lower at 846x423 on the tap path falls under the predicted "reach can differ".

## Repair cycle 1: amended prediction (before the repair diff)

Reviewer FAIL, finding 1: `IntersectionPin.geometry`'s `max_length=300` would refuse a whole plan (every route, saved plans included) whenever the lookup kept an own-way line longer than 300 points (the stitch is skipped or fails: `app/api/road-bearing/route.ts` own-way baseline, trim only on the stitch path). Behaviour after the repair: a plan is never refused for this optional field. The frontend writes no line longer than 300 points (the record keeps its other keys); the backend drops an over-long or malformed line (log line) and the intersection question runs #484's lookup (`x-map-cross-source: lookup`). Predicted files: `src/api/schemas.py` (+~25: a before-validator replaces the cap), `cross-street-lookup.ts` (+~3), `types.ts` (note, ±2), `tests/test_needs_you_map.py` (+~60: over-long/malformed render via lookup on needs-you-map and the audit/bundle route; the E Colfax match parametrized over three sizes; the offset-T case), `cross-street-tap-record.test.ts` (+~15: the over-long line is dropped; the size figure), evidence files (`live-timing.txt`, `size-measurement.txt`, evidence.md and rulings.md reworded). No other behaviour change.

## Repair cycle 1: actual

`src/api/schemas.py` +52 −3 in total (predicted +~25 for the repair: the validator, `_usable_line` and the constant came out larger); `cross-street-lookup.ts` +11 −1 total (+6 in the repair); `types.ts` +9 −1 total; `tests/test_needs_you_map.py` +286 total (+85 in the repair, predicted +~60); `cross-street-tap-record.test.ts` 187 lines in cycle 0, 202 after repair 1 (the drop cases and the held size figure); new evidence files `live-timing.txt`, `size-measurement.txt`, `script/live_time.py`. No other behaviour change.

## Repair cycle 2: amended prediction (before the repair diff)

Fold-in (R154 fold test: same files, no ruling, small): `_usable_line` range-checks each coordinate before `math.isfinite` and treats an `OverflowError` / `TypeError` / `ValueError` as an unusable line, so a >308-digit JSON integer drops the line (lookup) instead of a 500 on every route. Predicted: `src/api/schemas.py` (±~6), `tests/test_needs_you_map.py` (+~20: the huge integer is dropped, the map runs the lookup, `/render/audit` answers 200). Write-up only otherwise (the 24,312-byte wording, the script's run command). No other behaviour change.

## Repair cycle 2: actual

`src/api/schemas.py` +59 −3 in total (+7 in repair 2: the range check before `float()` and the guarded conversion; predicted ±~6). `tests/test_needs_you_map.py` +298 in total (+12 in repair 2: the past-float-range case in `bad_lines` and its id, the parametrized never-refuse test; predicted +~20). Write-up only otherwise. No other behaviour change.

## Re-tap fix (mission retap-and-cap, #494): amended prediction (before the diff)

Gate finding: `applyCrossStreetCandidate` (`conestruct/site/lib/scenarios/cross-street-apply.ts`) tells a new candidate from the last applied one by `JSON.stringify(crossStreet)`, which since this branch includes `geometry`. The line can differ between taps of the same street (trimmed around the snapped point, or the whole own way when the stitch fails), so a re-tap of the same street would replace `approaches`, clear `detectionOverrides` and put the lane hold back on (#112's clobber class). Behaviour change, deliberate: the guard compares the candidate without `geometry`, and its memory (`appliedJson`) is that same geometry-less JSON. A candidate with no `geometry` key (every candidate before this branch, and the X4 parity cases) stringifies byte-identically, so the picker Save and the tap are unchanged except that a geometry-only difference is no longer new information. `meta.intersection.geometry` is written by `intersectionRecord`, not here, so the re-tap still refreshes the line the NEEDS YOU map draws. Plans, PDFs, audits, device counts: unchanged.

Predicted files: `cross-street-apply.ts` (+~6 −2: drop `geometry` before stringifying, a comment); `cross-street-apply.test.ts` (+~40: same street re-tapped with a different line keeps edited approaches, overrides and the hold; a different street with the same line still replaces; the memory holds no `geometry`); `red-proof-retap.txt` (new); checkpoint.md, rulings.md, evidence.md (write-up). Tests: `cross-street-apply.test.ts` 6 -> ~9 cases. No other file.

## Re-tap fix: actual churn (after the diff)

| File | Predicted | Actual |
|---|---|---|
| `cross-street-apply.ts` | +~6 −2 | +9 −2 (the comment and the doc line ran longer) |
| `cross-street-apply.test.ts` | +~40, 6 -> ~9 cases | +55, 6 -> 9 cases |
| `red-proof-retap.txt` | new | new |
| checkpoint.md, rulings.md, evidence.md | write-up | write-up |

No other file. Behaviour as predicted; the six X4 parity cases still pass unchanged (a candidate without `geometry` stringifies byte-identically). Device counts, plans, PDFs, audits: untouched.

## Gate round 1 repair (retap-and-cap): amended prediction (before the diff)

Reviewer finding: `tapped_cross_street` (`src/rules/site_detection.py`) tells the worked road from the cross street by plain `.lower()`, while the base's #487 lookup path (`cross_street_from_elements`) uses `_street_key`. At a bend past the 25° parallel test, a tapped line named "E Colfax Ave" on the road "East Colfax Avenue" would be drawn as the cross street. Behaviour change, deliberate: the tap path compares `_street_key(label)` with `_street_key(road_name)`, an empty key never matching (as the lookup path). Names that matched before still match; abbreviated or punctuated spellings of the worked road now match too, and the lookup runs instead. Device counts, plans, PDFs, audits: untouched (the map image only).

Predicted files: `src/rules/site_detection.py` (+~3 −3: the key comparison and the docstring); `tests/test_needs_you_map.py` (+~25: the tapped line at a 40° bend named as an abbreviation of the worked road is not drawn; a real cross street at the same bend still is); `red-proof-tap-street-key.txt` (new); write-up fixes in evidence.md, checkpoint.md, rulings.md, `full-run-failures.txt` (one note line), and the commit message draft.

## Gate round 1 repair: actual churn (after the diff)

| File | Predicted | Actual |
|---|---|---|
| `src/rules/site_detection.py` | +~3 −3 | +6 −4 (the docstring ran two lines longer) |
| `tests/test_needs_you_map.py` | +~25 | +21 (one parametrized test, 3 cases; 77 -> 80 passed) |
| `red-proof-tap-street-key.txt` | new | new |
| write-up (evidence.md, checkpoint.md, rulings.md, full-run-failures.txt, commit message) | as listed | as listed |

No other file. Device counts, plans, PDFs, audits: untouched.
