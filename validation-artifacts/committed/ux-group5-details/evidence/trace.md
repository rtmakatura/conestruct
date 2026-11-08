# #453 trace: every string changed, before → after, and its source

Examples are the walk's plan (1600 E Colfax Ave, Denver; Shoulder; one-way; 30 mph) unless a row says otherwise. "Page" is the opened detail; "PDF" is the audit PDF. Line numbers are the branch's.

## Backend sentences (page and PDF read the same string)

| # | Field (producer) | Before | After | Source of the words / facts |
|---|---|---|---|---|
| S1 | `taper.formula_choice`, below threshold (`src/api/audit.py`, taper block) | `Speed 30 mph < 45 mph threshold -> using L = W x S^2 / 60` | `At 30 mph, below the 45 mph threshold, the taper length is the offset width times the speed squared, divided by 60.` | Same branch, same threshold constant (`TAPER_LENGTH_FORMULA_THRESHOLD_MPH`); the formula is MUTCD 11th Ed. Table 6B-4's, as the code already applied it |
| S2 | `taper.formula_choice`, at/above threshold | `Speed 55 mph >= 45 mph threshold -> using L = W x S` | `At 55 mph, at or above the 45 mph threshold, the taper length is the offset width times the speed.` | Same |
| S3 | `taper.formula_choice`, flagger | `Flagger alternating-flow: one-lane two-way taper (50-100 ft fixed band per MUTCD Sec 6B.08) -> using 100 ft maximum; the merging-taper L = W x S formula does not apply` | `With flaggers alternating traffic on one lane, the taper is a one-lane, two-way taper of 50 to 100 ft (MUTCD Sec 6B.08); the plan uses the 100 ft maximum, and the merging-taper formula doesn't apply.` | Same claims as before (§6B.08 ¶14 band, the code's comment) |
| S4 | `buffer.lookup_text`, CDOT silent | `MUTCD Table 6B-2: 200 ft (CDOT supplement silent at this speed)` | `MUTCD Table 6B-2 sets 200 ft; the CDOT supplement sets no value at this speed.` | Same branch |
| S5 | `buffer.lookup_text`, federal | `MUTCD Table 6B-2: 645 ft` | `MUTCD Table 6B-2 sets 645 ft.` | Same |
| S6 | `buffer.lookup_text`, the four Sheet 14 branches (opening only) | `MUTCD Table 6B-2: 645 ft. CDOT S-630-1 Sheet 14 posts …` | `MUTCD Table 6B-2 sets 645 ft. CDOT S-630-1 Sheet 14 posts …` (rest unchanged) | Same |
| S7 | `buffer.lookup_text`, CDOT divergent | `CDOT supplement: 570 ft. MUTCD Table 6B-2: 645 ft. Plan uses CDOT supplement value. Note: CDOT supplement permits shorter buffer than federal table. Verify against project-specific engineering judgment.` | `The CDOT supplement sets 570 ft and MUTCD Table 6B-2 sets 645 ft; the plan uses the CDOT supplement value. The CDOT supplement permits a shorter buffer than the federal table, so verify it against project-specific engineering judgment.` | Same claims |
| S8 | `spacing.in_taper_text` | `30 mph -> 30 ft spacing (MUTCD Sec 6K.01: spacing equals speed in feet)` | `In the taper, devices are spaced 30 ft apart, the speed in feet at 30 mph (MUTCD Sec 6K.01).` | Same rule, same cite |
| S9 | `spacing.in_taper_text`, flagger | `20 ft spacing in the one-lane two-way taper (MUTCD Sec 6B.08: approximately 20 ft, taper-specific guidance overriding the Sec 6K.01 speed-based rule)` | `In the one-lane, two-way taper, devices are spaced 20 ft apart: MUTCD Sec 6B.08 gives about 20 ft for this taper, which overrides the Sec 6K.01 speed rule.` | Same claims |
| S10 | `spacing.on_tangent_text` | `30 mph -> 60 ft spacing (MUTCD Sec 6K.01: spacing equals 2x speed in feet)` | `Along the tangent, devices are spaced 60 ft apart, twice the speed in feet (MUTCD Sec 6K.01).` | Same |
| S11 | `advance.road_type_text` | `Speed 30 mph, road_type = 'urban_low' -> Table 6B-1 category: urban_low` | `At 30 mph, the signs are spaced by MUTCD Table 6B-1's Urban (low speed) row.` | Row names: MUTCD 11th Ed. Table 6B-1, p. 773 (`issue-360-advance-anchoring/sources/mutcd11-p773.txt:8-11`); map `_TABLE_6B_1_ROW` |
| S12 | `advance.road_type_text`, Case 11 / Sheet 14 | `Speed 65 mph, road_type = 'freeway' -> CDOT S-630-1 Sheet 7 Case 11 (freeway shoulder work)` | `At 65 mph on freeway shoulder work, the signs are placed at CDOT S-630-1 Sheet 7 Case 11's distances.` | Same source string (`advance_source`) |
| S13 | `advance.spacing_text`, Table 6B-1 | `A = 100 ft, B = 100 ft, C = 100 ft` | `Table 6B-1 spacing: A 100 ft (the distance from the transition or point of restriction to the first sign), B 100 ft (the distance between the first and second signs), C 100 ft (the distance between the second and third signs).` | Each definition quoted from Table 6B-1's note, p. 773 (`mutcd11-p773.txt:21-26`) (repair 1; the first build paraphrased it) |
| S14 | `advance.spacing_text`, every branch | (no final period) | ends with `.` | Ruling 1 (a sentence) |
| S15 | scan bucket `details[*]` (`src/rules/site_detection.py`) | `unnamed at 39.7400, -104.9707 [work_zone @ 408 ft]`; `Franklin Street [lateral 91 ft off centerline]`; `…, cross_n approach]` | `unnamed at 39.7400, -104.9707 (in the work zone, 408 ft along the corridor)`; `Franklin Street (91 ft off the centerline)`; `…, cross_n approach)` | Zone words from `classify_distance`'s zones (`src/rules/corridor.py:724-734`), `_ZONE_WORDS` |
| S16 | `permit.tier_reason` (`src/rules/jurisdiction.py` `_suggest_tier`) | `jurisdiction publishes no permit tiers` | `Denver publishes no permit tiers.` (the record's `name`) | Same branch |
| S17 | same, undecidable | `tier assignment is not machine-decidable for this jurisdiction` | `The permit type can't be worked out from the plan, so none is suggested here.` | Same branch (docstring) |
| S18 | same, no class | `street class not provided; the Minor/Major split can't be resolved` | `Street class not set, so the Minor/Major split can't be resolved.` | Same branch |
| S19 | `fees.note` (`data/jurisdictions/denver.json`) | `STALENESS RISK: this is the 2024 schedule; Denver publishes annually — 2025/2026 schedules almost certainly exist. Rate depends on road class x geographic zone (Residential / CBD-CCA / Collector-Arterial) x peak flag, with a per-lane escalator that is not a multiplier.` | `This is the 2024 fee schedule, and it may be out of date: Denver publishes a new schedule every year, so 2025 and 2026 schedules almost certainly exist. The rate depends on the road class, the zone (Residential, CBD/CCA or Collector/Arterial) and whether the work is in peak hours, with a per-lane step that is not a multiplier.` | Same claims as the record (rulings X9) |
| S21 | `advance.road_type_text`, no row resolved (repair 1) | `At 30 mph, the signs are spaced by MUTCD Table 6B-1's matching row.` (first build's silent default) | `At 30 mph, the road type wasn't resolved, so no Table 6B-1 row is named.` | Rule 10 (X23) |
| S22 | corridor warning `message` (`src/rules/site_detection.py` `validate_corridor_against_osm`, repair 1) | `No motorway/trunk/primary/secondary road detected at anchor (39.73978, -104.96825) within 50 m (closest road within 50 m: 'residential').  Verify coordinates correspond to the actual work zone.` | `No major road (motorway, trunk, primary or secondary) found within 50 m of the anchor (39.73978, -104.96825); the closest road within 50 m is a residential road.  Check that the coordinates match the actual work zone.` | Same check, same values (X19) |
| S23 | Denver hazard `rule` (`data/jurisdictions/denver.json`, repair 1) | `TCP 'denied for accuracy or compliance with the MUTCD': Permit Fee + $100 each — precisely the failure the tool exists to prevent.` | `TCP 'denied for accuracy or compliance with the MUTCD': Permit Fee + $100 each.` | Same fact; the editorial aside removed (X22) |
| S20 | driveways `short_result` (`src/rules/site_adjustments.py`) | `Keep access gaps · no devices across driveways` | `Advisory · keep access gaps, no devices across driveways` | Ruling 4, verbatim |

The spreadsheet (`src/export/device_list.py`) reads none of these fields (grep: 0 hits for any of them), so it is byte-identical.

## Backend panel-only rows (`formula_text`) and footers (`citation.footer`)

| # | Before | After | Source |
|---|---|---|---|
| R1 | `W = 8 ft (assumed)` | `Shoulder width = 8 ft (assumed)` | X3 |
| R2 | `L = 8 × 30^2 / 60 = 120 ft` (shoulder) / `L = 12 × 55 = 660 ft` (lane) | `Full taper = 8 × 30^2 / 60 = 120 ft` / `Taper length = 12 × 55 = 660 ft` | X3; `_panel_row` drops the leading letter only |
| R3 | `L/3 = 120 / 3 = 40 ft` | `Shoulder taper, one third = 120 / 3 = 40 ft` | X3 |
| R4 | `L/3 = 40 ft / 30 ft max spacing -> 4 drums at 13.3 ft intervals` | `Taper, 40 ft = 4 drums at 13.3 ft` | Same numbers as `taper_count_text` |
| R5 | `1000 ft / 60 ft max spacing -> 18 cones at 58.8 ft intervals` | `Tangent, 1,000 ft = 18 cones at 58.8 ft` | Same as `tangent_count_text` |
| R6 | `Buffer: 200 ft / 60 ft max spacing -> 3 cones at 50.0 ft intervals (CDOT S-630-1 Sheet 2 General Note 18b: …)` | `Buffer, 200 ft (S-630-1 Sheet 2 Note 18b) = 3 cones at 50.0 ft` | Same numbers as `buffer_count_text`; the row cites "S-630-1 Sheet 2 Note 18b" and drops the PDF line's "General" and "tangents along the buffer space" (recorded, not fixed, X24) |
| R7 | `Downstream taper: 50 ft at ~25 ft spacing -> 2 cones (MUTCD Sec 6B.08: …); 18 tangent + 3 buffer + 2 downstream = 23 cones total` | `Downstream taper, 50 ft (MUTCD Sec 6B.08: 50-100 ft) = 2 cones at ~25 ft` and `Cones in all (18 tangent, 3 buffer, 2 downstream) = 23` | Same as `downstream_count_text`; its spacing and band kept on the page (repair 1, X24) |
| R8 | `Corner extension: 48 ft past the work zone … -> 1 cone (…); 9 tangent + 3 buffer + 1 corner = 13 cones total` | `Corner extension to the curb line, 48 ft (no downstream taper; the lane reopens beyond the intersection) = 1 cone` and `Cones in all (9 tangent, 3 buffer, 1 corner) = 13` | Same as `corner_count_text`, its "no downstream taper" kept (repair 1, X24); the row says "to the curb line", not the PDF's "past the work zone to the upstream curb line" (recorded, not fixed) |
| F1 | `MUTCD 2023 EDITION · CHAPTER 6B · TABLE 6B-3` | `MUTCD 2023 edition · Chapter 6B · Table 6B-3` | X5 (same words) |
| F2 | `MUTCD § 6B.06 · STOPPING SIGHT DISTANCE` | `MUTCD § 6B.06 · Stopping sight distance` | X5 |
| F3 | `MUTCD § 6K.01 · CHANNELIZING DEVICE SPACING` | `MUTCD § 6K.01 · Channelizing device spacing` | X5 |
| F4 | `MUTCD § 6H.02 · TABLE 6B-1 · ADVANCE WARNING SIGN SPACING` | `MUTCD § 6H.02 · Table 6B-1 · Advance warning sign spacing` | X5 |
| F5 | `CDOT S-630-1 · SHEET 7 · CASE 11 · SHOULDER WORK - FREEWAY/EXPRESSWAY` | `CDOT S-630-1 · Sheet 7 · Case 11 · Shoulder work, freeway/expressway` | X5 |
| F6 | `CDOT S-630-1 · SHEET 14 · CASE 26 · SHOULDER WORK - FREEWAY/EXPRESSWAY W/ 65 MPH SPEED LIMIT` (and 27/75) | `CDOT S-630-1 · Sheet 14 · Case 26 · Shoulder work, freeway/expressway with 65 mph speed limit` | X5 |
| F7 | `MUTCD § 6D.06 · TABLE 6B-2 · STOPPING SIGHT DISTANCE` | `MUTCD § 6D.06 · Table 6B-2 · Stopping sight distance` | X5 |

The PDF's count lines (`taper_count_text` etc.) are unchanged; see rulings X17.

## Frontend strings

| # | Where (file) | Before | After | Source |
|---|---|---|---|---|
| P1 | Zone geometry labels (`lib/reference-sections.tsx`, from `ResultsHero.tsx` `zoneGeometryRows`) | `Taper L`, `Buffer B` | `Taper`, `Buffer` (the hero's own `plain` labels) | Ruling 1 |
| P2 | Permit notices (`lib/reference-sections.tsx` `permitRow`) | sentence `adjacent owners, businesses, residents: Lane / sidewalk / bike closure: …` | list line `Lane / sidewalk / bike closure: …` with `Notice to adjacent owners, businesses, residents` under it | X7; audience and rule from the jurisdiction data, unchanged |
| P3 | Search note (`components/ReferenceSections.tsx` `DetailView`) | `Opened because the match is inside. 2 of 3 device types shown.` (first list only) | the same, one `N of M <noun> shown.` per cut list, e.g. `1 of 3 notices shown. 0 of 14 fee lines shown.`; none when a list shows whole | Rulings 2, 3; X6 |
| P4 | Show all (same) | `Show all 3 signs` beside `3 of 3 signs shown` | per cut list, `Show all 3 notices`, `Show all 14 fee lines`; none when every line shows | Rulings 2, 3 |
| P5 | Scan rows' Source (`lib/reference-sections.tsx`) | `OPENSTREETMAP`, `REFERENCE` | `OpenStreetMap` | X5 |
| P6 | Operator rows' Source | `OPERATOR` | `Operator` | X5 |
| P7 | Scan stamp | `scanned 2026-11-07T23:18:48+00:00` | `Scanned 2026-11-07 at 23:18 UTC` | X14 |
| P8 | Buffer detail (`components/AuditTrail.tsx` `bufferItem`) | the lookup drawn as one mono value | the lookup as a second sentence (`.tr-help`) | Ruling 1 |
| P9 | Corridor warning lines (`AuditTrail.tsx` `corridorValidationItem`) | message, then `NO ROAD AT ANCHOR` | message only | X11 |
| P11 | Rule status (`lib/delta-words.ts` `STATUS_WORDS`, repair 1) | `conditional: shown here, not applied automatically`; `needs input (set the street class)` | `Conditional, so it's shown here and not applied automatically`; `Not checked until the street class is set` | X21 |
| P12 | Search inside a detail, sentences and rows (`ReferenceSections.tsx` `DetailView`, repair 1) | every sentence and label–value row shown | only the matching ones, with `N of M lines shown.` in the note and `Show all M lines` | Ruling 2 (X6) |
| P10 | Footer fallbacks and literal sources (`AuditTrail.tsx`) | `… · STOPPING SIGHT DISTANCE`, `… · CHANNELIZING DEVICE SPACING`, `… · TABLE 6B-1 · ADVANCE WARNING SIGN SPACING`, `… · TABLE 6B-2 · STOPPING SIGHT DISTANCE`, `MUTCD 2023 EDITION · CHAPTER 6B · TABLE 6B-3`, `· ARROW BOARDS`, `· WORK OUTSIDE SHOULDER`, `· WORKER PROTECTION`, `· MOBILE OPERATIONS`, `· TRUCK-MOUNTED ATTENUATORS`, `· MULTI-LANE MOBILE OPS`, `CDOT S-630-1 · STANDARD PLAN`, `MUTCD § 6N.12; CDOT S-630-1 SHEET 10`, `CDOT S-630-1 SHEET 12 · FINES DOUBLE SIGNING NOTES`, the Fines Double citation `.toUpperCase()` | the same words in sentence case (`· Multi-lane mobile operations` spells out "ops"); the Fines Double citation as the backend wrote it | X5 |

No new size or colour. One new CSS pair (`.rr-pair.is-short`, repair 1, X18): a short mono value doesn't wrap and its label wraps instead. Every string sits in an element that already existed (`.tr-help`, `.tr-note`, `.rr-num`, `.rr-link`, `.rr-lines`).
