# #453 walk evidence (2026-11-07)

A local walk; the production check follows the ship. Setup: `next dev` on the issue-453 worktree (port 3453), started by a scratchpad launcher that reads the main checkout's `.env.local` into the environment (no copy into the worktree) and sets a walk-only `GATE_BYPASS_TOKEN` (as #450 X12). Backend: `ux-group3-where/evidence/script/serve_replay.py` from this worktree (port 8453), Overpass replayed from a scratchpad copy of `ux-group3-where/evidence/overpass-fixture/`; `/api/road-bearing` stubbed from the same fixture. Plan: 1600 E Colfax Ave, Denver, kind Shoulder, one-way, Generate through the page (30 mph, urban low speed). Chromium, DPR 2, 1440x900 and 390x844. The gate header went through `scripts/gate.cjs` `newGatedContext`. Script: `script/walk.mjs`; PDF pages: `script/pdf_pages.py`.

`before/` was captured on the unchanged tree (base `edaffb3e`) before any edit; `after/` on the final diff (re-walked whole after repair round 1). Two `before/*-error.png` screenshots left by the first, aborted before-run (a walk-script bug in its open-all loop, fixed before the run kept here) were deleted in repair round 1; they showed no detail. Each holds `walk.json` (every opened detail as text, each run with its font family, size and case) and one crop per row.

## Results

| Check | 1440 | 390 |
|---|---|---|
| Rows opened, one at a time | 23 (13 in "Checked and passed", 10 in "Denver rules and site facts") | 23 |
| axe, every row open at once (before / after) | 0 / 0 violations | 0 / 0 |
| 44 px sweep, every row open (before / after) | 0 / 0 targets under 44 px | 0 / 0 |
| Horizontal overflow | 0 | 0 |
| Search "sidewalk": axe, small targets | 0, 0 | 0, 0 |
| Search "taper": axe, small targets | 0, 0 | 0, 0 |
| Page errors | 0 | 0 |

## What each crop shows (after, both widths)

- `*-checked-01-calc-0-Taper_length.png`: the sentence "At 30 mph, below the 45 mph threshold, the taper length is the offset width times the speed squared, divided by 60."; rows Shoulder width 8 ft (assumed), Full taper 8 × 30^2 / 60 = 120 ft, Shoulder taper, one third 120 / 3 = 40 ft, values in mono, each on one line at 390 (the long label wraps instead, X18); "Source: MUTCD 2023 edition · Chapter 6B · Table 6B-3". Before: the `->` sentence and the letter labels W, L, L/3.
- `*-checked-02-calc-1-Buffer_space.png`: two Inter sentences (the lookup is no longer a mono value); sentence-case source.
- `*-checked-03-calc-2-Device_spacing.png`: two sentences, then Taper, 40 ft = 4 drums at 13.3 ft / Tangent, 1,000 ft = 18 cones at 58.8 ft / Buffer, 200 ft (S-630-1 Sheet 2 Note 18b) = 3 cones at 50.0 ft / Downstream taper, 50 ft (MUTCD Sec 6B.08: 50-100 ft) = 2 cones at ~25 ft / Cones in all (…) = 23. Every value on one line at both widths (X18). Before: four mono value-only lines with `-> … intervals`.
- `*-checked-04-calc-3-Warning_signs.png`: "At 30 mph, the signs are spaced by MUTCD Table 6B-1's Urban (low speed) row." and the A/B/C sentence quoting Table 6B-1's note; no `road_type`, no `urban_low`. Before: `Speed 30 mph, road_type = 'urban_low' -> Table 6B-1 category: urban_low`.
- `*-checked-11-site-adjacent_intersection.png`: the evidence line ends "(in the work zone, 408 ft along the corridor)". Before: `[work_zone @ 408 ft]`.
- `*-checked-12/13-scan-*.png`: "Scanned 2026-11-08 at 00:25 UTC" (the time of the final walk's scan), "Source: OpenStreetMap". Before: the raw ISO stamp and `OPENSTREETMAP`.
- `*-reference-04-permit.png`: "Denver publishes no permit tiers.", the rewritten fee note, the lead-time rows, then the three notices as lines with "Notice to …" under each, then the 14 fee lines. Before: the lowercase reason, `STALENESS RISK:`, and `adjacent owners, businesses, residents: …` sentences.
- `*-reference-07-corridor-warn.png`: the warning message alone, in words: "No major road (motorway, trunk, primary or secondary) found within 50 m of the anchor (…); the closest road within 50 m is a residential road." Before: the slash list, the quoted `'residential'`, and `NO ROAD AT ANCHOR` under it.
- `*-reference-01-keep-in-mind.png`: the conditional rule's line reads "Conditional, so it's shown here and not applied automatically · Denver · …". Before: `conditional: shown here, …`. (Its rule text keeps the corpus's "->", #454.)
- `*-reference-02-hazards.png`: "TCP 'denied for accuracy or compliance with the MUTCD': Permit Fee + $100 each." Before: the em dash and "precisely the failure the tool exists to prevent".
- `*-reference-08-measured-absent.png`: "Source: OpenStreetMap". Before: `REFERENCE`.
- `*-reference-10-zone-geometry.png`: Taper / Buffer / Device spacing / Work zone. Before: `Taper L`, `Buffer B`.
- The other rows (Standard plan, the five rule checks, keep-in-mind, hazards, hours, the two ▲ site rows, device schedule) are unchanged in text except where a backend line above appears in them.
- `*-search-sidewalk.png`: Permit opens with "Opened because the match is inside. 0 of 7 lines shown. 1 of 3 notices shown. 0 of 14 fee lines shown.", the one matching notice and nothing else, then "Show all 3 notices", "Show all 14 fee lines" and "Show all 7 lines" (ruling 2; repair 1 filters the three lead sentences and four lead-time rows too). Before: every sentence, every row, every notice and all 14 fee lines. Hazards reads "1 of 2 hazards shown"; Device schedule "1 of 12 device types shown".
- `*-search-taper.png`: Warning signs opens with all three signs (each line's "From taper" matches) and neither "3 of 3 signs shown" nor "Show all 3 signs" (ruling 3); its two sentences, which don't say "taper", wait behind "Show all 2 lines". Before: "3 of 3 signs shown" and "Show all 3 signs".

The driveways row isn't on this plan; its short result ("Advisory · keep access gaps, no devices across driveways", ruling 4) is pinned by `tests/test_not_checked_yet_450.py` and `tests/test_details_clean_453.py`, not walked.

## The audit PDF (`pdf/`)

The same audit body (`audit-body.json`, byte-identical before and after) posted to `/api/render/audit-pdf`. `before-pdf-lines.txt` / `after-pdf-lines.txt` list the changed lines per page; `*-pdf-page-1.png` and `*-pdf-page-2.png` are the two pages that hold them. Page 1 now prints S1 and S4 (`trace.md`), page 2 S8, S10, S11, S13. Engine keys in the whole PDF, before → after: `road_type` yes → no, `urban_low` yes → no, `[work_zone` yes → no, `threshold ->` yes → no; `->` stays (the PDF's count lines, rulings X17). The spreadsheet reads none of the changed fields (`trace.md`, last line of the first table).

## Tests

- Red on the base (refreshed in repair round 2, final test versions, `git archive` of `edaffb3e` into the scratchpad): `red-pytest-on-base.txt`, all 23 cases of `tests/test_details_clean_453.py` fail on the base backend (`test_an_unresolved_road_type_names_no_row` with AttributeError, since the base has no row map and printed the raw key; the corridor case on its message); `red-vitest-on-base.txt`, all 5 cases of `ReferenceSections.details-453.test.tsx` fail on the base frontend (notices, the sidewalk search incl. its sentence and row filtering, ruling 3, the X18 one-line case, the corridor line). The changed pins in the older ReferenceSections suites failed on the base in round 0 too (the first `red-vitest-on-base.txt`, superseded).
- Snapshot re-baseline: `rebaseline-output.txt` (78 snapshots, every path inside the prediction), `-2` (the spacing sentence's period), `-3` (the shortened spacing rows).
- First full pytest after the change: `pytest-failures-1.txt` (66 string pins, checkpoint amendment 1).
- Repair round 1: `rebaseline-output-4.txt` (0 paths outside the prediction). The first full vitest after the repair failed one new case (`vitest-failures-repair1.txt`); it failed alone too: the recorded Denver wire's taper value "10.5 × 40^2 / 60 = 280 ft" is 25 characters, over the one-line threshold. Fixed by keeping a longer value's number and unit together (non-breaking space), then the case passed.
