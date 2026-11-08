# #453 production check on 24603de (2026-11-07)

SHIP VERIFIED: `/healthz` sha is `24603de072f4c3a50ffc328efbcc3a13be79e859`, which is `origin/main`, read before the walk; the served frontend at 24603de was confirmed at the ship.

Run: `script/walk-prod.mjs` against https://www.conestruct.com/sandbox, read-only (no NEEDS YOU answer given, nothing saved). Everything live: geocoding, `/api/road-bearing` (no stub, no Overpass replay), the generate, the site scan, the audit and the audit PDF. The context comes from the shared helper `scripts/gate.cjs` `newGatedContext`; the gate token from `conestruct/site/.env.local` (`GATE_BYPASS_TOKEN`), never printed or saved. Chromium at DPR 2 (crops at CSS scale), 1440x900 and 390x844. Plan: 1600 E Colfax Ave, Denver (the address #450's check and #453's local walk used), East Colfax, kind Shoulder, One-way, Generate through the page. Numbers: `walk/walk.json` (every opened detail as text with each run's font, size and case). PDF pages: `../evidence/script/pdf_pages.py`, output in `pdf/`.

**Result: PASS at 1440x900 and 390x844 on live data.** Live road detection was up: the one `/api/road-bearing` call per run answered `ok` with 4 candidates; one attempt per width, no live failure.

Strongest single check: every opened detail's text runs (tag, mono or not, size, case, text) were compared with the local walk's `../evidence/after/walk.json`, row by row. All 23 rows at both widths match exactly except five lines that carry live data: the two scan stamps ("Scanned 2026-11-08 at 04:04 UTC") and the three site evidence lines (counts and positions from the live scan, e.g. "50 found · nearest 73.2 ft from anchor · unnamed at 39.7400, -104.9648 (in the work zone, 125 ft along the corridor)"). Those five still read in the new words.

| Check | 1440x900 | 390x844 |
|---|---|---|
| Rows opened one at a time ("Checked and passed" 13, "Denver rules and site facts" 10) | PASS: 23, a crop each | PASS: 23 |
| Each detail: plain sentence(s), not mono, sentence case | PASS: every `p` sentence in Inter; none uppercase | PASS |
| Label–value rows, values only in mono | PASS: every `dt` label in Inter, values in mono (`dd`, plus the sign codes, fee amounts, device counts and the hours timeline, as in the local walk) | PASS |
| "Source:" line: at most one per detail, sentence case | PASS: 17 details carry exactly one, each "Source: …" in sentence case, not mono; 6 reference rows carry none (keep-in-mind, hazards, hours, permit, devices, zone geometry; same as the local walk) | PASS |
| No raw key in a sentence (`road_type`, `urban_low`, `[work_zone`, snake_case, `STALENESS RISK`, `->`) | PASS: none, except the known "->" in the keep-in-mind rule text (the corpus's own, #454, recorded in the local evidence) | PASS, same |
| Search "sidewalk": Permit shows only matching lines, "N of M … shown" + "Show all" | PASS: status "5 matching lines, all in Denver rules and site facts"; Permit: "Opened because the match is inside. 0 of 7 lines shown. 1 of 3 notices shown. 0 of 14 fee lines shown.", the one matching notice, then "Show all 3 notices", "Show all 14 fee lines", "Show all 7 lines" | PASS, same |
| Search "taper": Warning signs has no "Show all" for its signs when all show | PASS: status "4 matching lines, in 2 sections"; all 3 signs shown, no "3 of 3 signs shown", no "Show all 3 signs"; its two sentences behind "Show all 2 lines" (ruling 3, as locally) | PASS, same |
| Driveways short result "Advisory · keep access gaps, no devices across driveways" | NOT SEEN: no driveways row on the live plan | NOT SEEN |
| Audit PDF downloaded through the page ("Download audit trail PDF") | PASS: `East-Colfax-Avenue_shoulder_2026-11-07_540ad2.audit.pdf`, 4 pages | PASS: same file name, 4 pages |
| PDF page 1 prints the new sentences | PASS: "At 30 mph, below the 45 mph threshold, the taper length is the offset width times the speed squared, divided by 60." and "MUTCD Table 6B-2 sets 200 ft; the CDOT supplement sets no value at this speed." (page 2: the spacing and Table 6B-1 sentences); the extracted lines equal the local `after-pdf-lines.txt` | PASS, same |
| Engine keys anywhere in the PDF | PASS: `road_type`, `urban_low`, `[work_zone`, `threshold ->` none; `->` stays on the count lines (rulings X17) | PASS |
| axe: checked section open, reference open, every row open, each search | PASS: 0 in every state | PASS: 0 |
| 44 px sweep, every row open (33 targets) and each search | PASS: 0 under 44 px | PASS: 0 |
| Horizontal overflow (every row open, and at the end) | 0 | 0 |
| Page errors | 0 | 0 |
| Gate header only on the site's own host (per `route.fetch` hop) | PASS: www.conestruct.com 42 of 42; no other host | PASS: 42 of 42 |
| Clerk loads | PASS | PASS |
| Layout shift (no recent input), recorded only (#452) | RECORDED: total 0.57, all of it by the time the plan rendered (largest single 0.55) | RECORDED: total 0.96, all by the plan render (largest single 0.87) |

Layout shift: the total after Generate equals the total at the end at both widths, so opening the 23 details, both searches and the PDF download shifted nothing without input. The numbers sit where #450's check had them at the same point (0.57 / 0.96 by the plan render).

## Crops opened (`walk/`, `pdf/`)

- `390-checked-01-calc-0-Taper_length.png`: the sentence, three label–value rows with mono values, "Source: MUTCD 2023 edition · Chapter 6B · Table 6B-3".
- `1440-checked-04-calc-3-Warning_signs.png`: the Table 6B-1 row sentence and the A/B/C sentence, the three signs, sentence-case source.
- `1440-checked-11-site-adjacent_intersection.png`: "(in the work zone, 125 ft along the corridor)" on live data.
- `1440-reference-04-permit.png`: "Denver publishes no permit tiers.", the rewritten fee note, lead-time rows, the three notices with "Notice to …" under each, the 14 fee lines.
- `390-reference-07-corridor-warn.png`: the corridor warning in words, "Source: OpenStreetMap".
- `1440-search-sidewalk-permit.png`: Permit under the "sidewalk" search, as in the table.
- `390-search-taper-calc-3-Warning_signs.png`: Warning signs under "taper": three signs, "taper" marked, only "Show all 2 lines".
- `pdf/1440-pdf-page-1.png`: page 1 with the taper and buffer sentences; it matches the local `after-pdf-page-1.png`.

The other crops were not opened one by one; their text is in `walk.json` and matched the local walk. Ryan's browser check is still the visual gate.

## Not seen

- The driveways row and its short result: not on this live plan (also not on the local plan; pinned by `tests/test_not_checked_yet_450.py` and `tests/test_details_clean_453.py`).
- The other text branches #453 rewrote that this plan doesn't take (the 45 mph and flagger taper sentences, the CDOT-divergent buffer, Case 11 freeway advance, the undecidable and no-class permit reasons).
- A live failure of road detection or the backend.
- PDF page 1 still prints "Routing: shoulder_no_reduction", a raw key outside #453's scope; the local after-PDF prints the same. Noted, not failed.
- Real phones, real Safari, a screen reader.
