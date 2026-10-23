# Lane-closure audit: findings for review

Production `d6d9a14`, 2026-10-22. 31 plans, 10 refusal cases, and F17 (a plan row that was refused). The full check tables and each plan's page 1 are in [index.md](index.md); the scores are in [results.json](results.json).

Ryan reviewed the findings on 2026-10-22 and confirmed all eight, with one change: G2 goes to high. G3 and G4 stay separate. Each is filed as its own issue, labelled `audit-lane`:

| Finding | Rows | Issue | Severity |
|---|---|---|---|
| G2 urban flagger arrow board: no mode, missing from the crew sheet | F1–F4, F6, F18 | #379 | high |
| G1 near-intersection page 1 undercounts the signs | N1–N14 | #372 | medium |
| G3 pilot car missing from page 1, the spreadsheets and the audit's device list | F12 | #373 | medium |
| G4 the AFAD has three names | F16 | #374 | medium |
| G5 a 50 ft flagger zone is refused against a "merging taper" | F17 | #375 | medium |
| G6 the cross-street search leaves Colorado | Lafayette search | #376 | medium |
| G7 the one-way flagger refusal doesn't say one-way | R1 | #377 | low |
| G8 near-intersection is still described as gated or divided-unsupported | docs, R6 | #378 | low |

Also filed from the review: #371 (priority-high). A site-scan token never expires, and the audit fetch scripts committed real tokens (`a408abe`, 30 `audit.json` files). Ryan ruled an age limit, not a secret rotation, and that the scripts strip tokens before writing `audit.json`.

**Severity** (as in the shoulder audit):
- **High:** the plan tells a crew to do something the sources don't support, or describes the road wrongly. G2 (Ryan, 2026-10-22): with no mode stated, a crew could run arrow mode on a two-lane road and send drivers toward oncoming traffic.
- **Medium:** a sourced value is missed, or two documents disagree.
- **Low:** the API or the wording.

## High

### G2 (#379). Urban flagger plans carry an arrow board with no mode, and the crew sheet leaves it out (C8, C10; F1–F4, F6, F18)
- **What the plans do:** page 1, both spreadsheets and the audit list one arrow board. The crew sheet's equipment list has none. No surface says which mode it runs in. All six are Denver plans; the audit's reason is Denver's trigger: "Arrow board required if closing one or more lanes".
- **The rule:** MUTCD §6L.06 ¶18 (Standard), p. 833: "… for temporarily closing one lane on a two-lane, two-way roadway, an arrow board shall be used only in the caution mode." S-630-1 Sheet 2 General Note 26 says the same (L14).
- **Why it matters:** a flagger closure is exactly the case ¶18 limits. The crew sheet is what the crew carries, and it neither lists the board nor says caution mode.

## Medium

### G1. Page 1's device summary leaves out the cross-street signs (C10, N1–N14)
- **What page 1 says:** "CROSS-STREET CONTROL PER CDOT S-630-1 SHEET 10, CASES 18/19: NOT DRAWN … SEE DEVICE LIST, CREW NARRATIVE, AND AUDIT." Its TRAFFIC CONTROL DEVICE SUMMARY then counts only the mainline W20-1, R2-10 and R2-11.
- **What the others say:** the device XLSX, quote XLSX, crew sheet and audit count the cross-street sets too.

  | Row | Sign | Page 1 | XLSX, quote, crew, audit |
  |---|---|---|---|
  | N1 | W20-1, R2-10, R2-11 | 1 each | 3 each |
  | N6 | W20-1, R2-10, R2-11 | 2 each | 3 each |
  | N10 | W20-1, R2-10, R2-11 | 2 each | 4 each |
  | N14 | W20-1, R2-10, R2-11 | 1 each | 2 each |

- **Totals (N1):** page 1 "TOTAL DEVICES 37"; the device XLSX summary "Total device count 43".
- **Why it matters:** page 1's table is titled a summary and gives a total, so a reader counting from it is short six signs. Not drawing the cross street is a ruled choice (#117 Option C); undercounting it isn't.

### G3. The pilot car is missing from page 1's summary, both spreadsheets and the audit's device list (C10, F12)
- **Crew sheet:** "1× Pilot car with G20-4 "PILOT CAR/FOLLOW ME" sign mounted on the rear of the vehicle" (`runs/F12/crew.md:27`).
- **Audit:** its flagger section says `"pilot_car_text": "1 vehicle"` (`runs/F12/audit.json:186`), but its device list has no pilot car.
- **Page 1 summary, device XLSX, quote XLSX:** no pilot car line.
- **Why it matters:** the quote and the bid list leave out a vehicle §6E.04 ¶03–¶04 govern (L17), and the audit's own device list disagrees with its flagger section.

### G4. The AFAD goes by three names (C10, F16)
| Surface | Name |
|---|---|
| Page 1 summary, device XLSX, quote XLSX | "Portable traffic signal (standard, compact, AFAD, or RDTS)" × 2 |
| Crew sheet | "Temporary Traffic Signal" × 2 |
| Audit | "Temporary Signal" × 2 |

The same plan's crew steps and signs say AFAD ("Staff both AFAD stations", W20-7a AFAD AHEAD). One device, one name (P2): the crew sheet's equipment list doesn't say AFAD, and page 1's description allows four kinds of device.

### G5. A 50 ft flagger zone is refused against a "merging taper" (F17)
- **The answer (400, `WORK_ZONE_SHORTER_THAN_TAPER`):** "Work zone length (50 ft) is shorter than the required merging taper (L) of 100 ft at 25 mph."
- **The taper a flagger plan uses:** the one-lane, two-way traffic taper, "50 feet minimum, 100 feet maximum" (MUTCD Table 6B-3, p. 775; §6B.08 ¶14, p. 776; L3). F1 at the same pin and speed draws it at 100 ft.
- **Two problems:**
  - The message names the wrong taper. The label is "merging taper (L)" for every non-shoulder closure (`src/rules/validators.py:1972-1973`).
  - The work-zone-at-least-the-taper rule itself (docstring at `validators.py:1872-1879`) has no source for that limit; the refusal only tags it `"mutcd_section": "6B.08"` (`runs/F17/pdf-error.txt`). Rule 12. A 50 ft taper would fit a 50 ft zone under L3.

### G6. The cross-street search answers outside Colorado (Lafayette)
Re-run on production `d6d9a14` on 2026-10-22 (log: `runs/fetch-log-g6-rerun.txt`); answers in `runs/_pins/geo_US_287_Dillon_Rd_Lafayette*.json`:

| Search | Jurisdiction | Answer |
|---|---|---|
| "US 287 & Dillon Rd, Lafayette, CO" | none | place, 37.891883, −122.120302 (Lafayette, California) |
| "US 287 & Dillon Rd, Lafayette" | none | place, 30.222907, −92.018777 (Lafayette, Louisiana) |
| "US 287 & Dillon Rd, Lafayette" | CDOT | place, 30.222907, −92.018777 (Louisiana) |
| "US 287 & Dillon Rd, Lafayette, Colorado" | none | intersection, 39.957998, −105.090397 |

- **Why it matters:** "CO" is read as something other than Colorado, and with CDOT selected the answer still lands in Louisiana, though #352 gave CDOT a Colorado search extent. The site works only in Colorado.

## Low

### G7. The one-way flagger refusal names the lane count, not one-way (R1)
- **The row:** a flagger plan on N Broadway at E 11th Ave, a one-way street (#158).
- **The answer (400):** "This road appears to carry more lanes than a flagger operation covers. TA-10 applies where one through lane runs in each direction."
- Broadway does carry five lanes, so the reason is true. But it doesn't tell the operator the road is one-way, which no lane-count edit fixes.

### G8. Near-intersection is still described as gated, and divided as unsupported (docs; R6)
- **`src/api/schemas.py:935`** (`NearIntersectionScenario` docstring): "GATED: absent from `ENABLED_SCENARIOS` (render_api.py) …". The kind is live (`render_api.py:141-142`).
- **`skills/cdot-s630-cases/SKILL.md:41-48`:** "Gated scenarios … (currently gated off via `ENABLED_SCENARIO_KINDS = ["shoulder"]`)", listing `flagger_lane_closure`.
- **`src/api/schemas.py:997`** (R6's refusal): "divided intersections aren't supported yet." Since #312 the site builds a divided near-intersection plan from the carriageway facts with the wire's `divided` false (R6's first run did exactly that on Colorado Blvd). The API gives two answers for the same road.

## Edition (commented on #265)
- **C11b, 31 of 31 plans:** every audit links the 19-page S-630-1 set, while page 1 cites the July 2026, 26-sheet edition. Same as the shoulder audit's C9d.

## Recorded, not findings
- **Clean on every plan:** taper (C1), buffer (C2), device spacing (C4), device type and size (C5, drums on the tapers), the flagger and closed-approach sign series (C6), flagger stations (C7), pilot car and AFAD placement (C7b, C7c), near or far side (C9), far-side R3-7R or continuous channelizers (C9b), notes against the drawing (C10b), containment (C11), limited sight distance (C12), pedestrian access (C13), night cone height and flagger station lighting (C14, C14b).
- **Refusals that pass (9 of 10):** single-lane road, four-lane two-way flagger, 60 mph, an 8 ft lane, `divided: true`, one lane per direction near an intersection, a cross street inside the work zone, a far-side left lane without storage, and mismatched approach lane tags.
- **INFO (rulings R8):** the 100 ft upstream flagger offset; W20-7a AFAD AHEAD; N10's turn-bay entry and storage; F7/F8's sight-distance move distance; urban near-intersection gaps under A (N2, N6, N9; Sheet 10 Note 1); no downstream taper on near-intersection rows (§6B.08 ¶12 "If used"); 36-inch cones at 45+ mph without an ADT input; Lakewood's breakpoint on F5 and N12 (Ryan, 2026-10-22).
- **The #117 reference pin now reads divided.** Denver maps E Colfax as two one-way roads 9–13 m apart at Race, Ogden, Cherry and the 2200 block (R3). The near-intersection reference moves to W Colfax at Perry St.
- **Trunk roads don't read divided in production.** `pins.md` marks US 24 and US 285 "divided (by class)" from `fetch.py`'s classifier mirror, which predates #332. Since #332 the site plans a two-way trunk undivided, so F11–F13's `divided: false` is what production sends anyway.
- **No jurisdiction suggestion for the El Paso County and Loveland pins** (R3). Both records are unreachable; #205 tracks that.
- **R6's first run** built a divided near-intersection plan through #312's carriageway path. That path is #312's ruled behaviour; the mismatch with the schema's refusal is G8.
