# #370 lane-closure audit: rulings

`checkpoint.md` beside this file is the session-1 plan checkpoint (2026-10-22), copied word for word from that session's transcript. The rulings below amend it.

## Ryan, 2026-10-22: plan approved with amendments
Recorded on #370: https://github.com/rtmakatura/conestruct/issues/370 (comment of 2026-10-22).
- **F18 added:** a flagger plan on a two-way road with a center turn lane (#86), on a real pin at 35–45 mph.
- **N14:** try a few pins for a rural undivided four-lane road. If none fits, use an undivided urban arterial at 50–55 mph, so the top near-intersection speed (55) is still covered.
- **F5 and N12** (Lakewood's 35 mph breakpoint) score `INFO`, not findings, while `02-JURISDICTION-DATA.md` is missing.
- **The two stale docs** (`src/api/schemas.py:935` "GATED", `skills/cdot-s630-cases/SKILL.md`) wait for `findings.md`.
- Totals: 32 plans, 10 refusals.

## R1 (R145 self-ruled, session 2): the checkpoint is recovered from the transcript
The session-1 checkpoint wasn't committed. It's recovered word for word from that session's transcript and committed as `checkpoint.md`, so the verifier and later sessions can read the matrix and checks C1–C15. Fits the rule that the checkpoint sits beside `rulings.md` before any ruling.

## R2 (R145 self-ruled, session 2): the oracle stands alone and is numbered L1–Ln
`audit-lane/oracle.py` copies the shoulder oracle's values it needs (taper L, Table 6B-1, Table 6B-2, device spacing, downstream taper, cone and barricade notes) by hand, and imports nothing from `audit-shoulder/` or `src/`. Its sources are numbered L1–Ln in `oracle-sources.md`. Each copied value names the shoulder item it came from (O1–O16), and the independent check re-checks every L item on its page, copies included. Same method as the shoulder audit (ruling a, 2026-10-16).

## R3 (R145 self-ruled, session 2): pin swaps and what the pins read
The checkpoint said each new pin is swapped out if the map reads divided or one-way. Applied on production `/api/road-bearing` (2026-10-22, `pins.md`):
- **E Colfax at Race reads divided.** Denver maps E Colfax as two one-way roads 9–13 m apart (Race, Ogden, Cherry, the 2200 block). N1–N6, R3, R8 and R10 move to W Colfax Ave in Denver (39.74035, −105.04014): undivided, 2 + 2 lanes plus a center lane, 30 mph. They run at its posted 30 mph, not the planned 35. Session 4 records as INFO that the #117 reference pin now reads divided.
- **N12:** W Colfax in Lakewood is mapped as two one-way roads at 35 mph; the only undivided stretch (near Simms) is posted 45. N12 runs at 45. Like F5 (30 mph), it now sits on the same side of the 35 and 45 mph splits, so neither row probes Lakewood's breakpoint. Both score INFO anyway (Ryan, 2026-10-22).
- **Lookout Mountain Rd reads urban, 20 mph** (place Golden / Paradise Hills), not rural 35. F7–F8 run as the road reads.
- **US 24 and US 285 read as trunk roads,** so the site guesses divided though each has one lane per direction. F11–F13 set `divided: false` as an operator edit. Session 4 records the guess as INFO, or as a finding if it blocks a flagger plan.
- **El Paso County and Loveland:** the jurisdiction suggestion returns none for either pin, so F14 and F15 set the jurisdiction as an operator edit. The Loveland pin is W 8th St (place reads Loveland), not the agent's first pick on N Lincoln Ave (place reads Browns Corner).
- **N14 found:** CO 67 in Florence reads rural, undivided, 2 lanes each way, 55 mph. No urban fallback needed.
- **Single-lane road found:** Gamble Gulch Rd, Gilpin County (1 lane, two-way). Memory's "#136 single-lane never found" no longer holds.
- **F18:** E 40th Ave, Denver: `lanes=3` with 1 + 1 + `lanes_both_ways=1`, 35 mph. The road-bearing tags don't carry `turn:lanes:both_ways`.

## R4 (R145 self-ruled, session 3): cross streets, N6 and N14
Each near-intersection row marks its cross street the way an operator does: the site's cross-street search (`/api/geocode`) gives the intersection, and the road-bearing scan there gives the cross street (the site's nearest-non-mainline pick). The searches are in `matrix.json` (`cross` on each pin); every answer is cached in `runs/_pins/`.
- **W Colfax, Denver:** Perry St (signal). Newton and Osceola sit where Colfax is mapped as two one-way roads.
- **Lakewood:** Taft Ct, where Colfax is one two-way road (Simms and Owens sit on the one-way pieces).
- **Others:** Broadway at E 11th Ave, S Colorado Blvd at E Iliff Ave, Sheridan Blvd at W 52nd Ave, Ogden St at E 7th Ave (R7), Colorado Blvd at Exposition Ave (R6).
- **N6 (one approach):** the site lays one approach only for a one-way cross street (`cross-street.ts:221`). The undivided W Colfax stretch has none, so N6 runs on Broadway at E 14th Ave (one-way), right lane, far side.
- **N14 is deferred to session 4.** CO 67 in Florence is four lanes for only about 300 m, with no crossing. CO 7 (E 160th Ave) is the same. The search "US 287 & Dillon Rd, Lafayette" with CDOT selected answered Lafayette, Louisiana (`placeType: place`, 30.22, −92.02); session 4 checks whether that is a finding. Session 4 hunts a pin for Ryan's fallback (an undivided arterial at 50–55 mph) by coordinates.

## R5 (R145 self-ruled, session 3): where fetch.py puts the work start, and the defaults it keeps
- **Station:** the backend measures the cross street's station from the work start (`schemas.py` `work_start_cross_station`): a cross street D ft downstream of the pin is at station workLen − D, one U ft upstream at workLen + U. fetch.py walks from the intersection to the pin by that rule. CHOSEN: a near row with no station runs at −100 ft like N1. A far row puts the cross street 100 ft upstream of the work start. R8 puts it 200 ft into the work zone. N1 came back at `along_station_ft −100`, side `near`.
- **Direction:** on a two-way road fetch.py tries both directions and keeps the first whose work-start pin snaps to the same named two-way road. A one-way road has one legal direction. The side is the backend's own side option (`/render/corridor-geometry`), written verbatim.
- **Site defaults kept** where the matrix is silent: flagger `utility_cut`, `long`; near-intersection `utility_cut`, `short`, 500 ft work zone, lane width 12 ft. The mainline lane count is set to what the road reads, per direction, capped at 4. The site doesn't prefill that count; it's an operator entry.
- **Refusal rows:** the side is chosen before the row's edit (speed 60, an 8 ft lane, `divided: true`) applies, so the deliverables refuse, not the side read. R10's mismatched approach lane tags (4 = 1 + 1) are injected and recorded in its `fetch.json`.
- **R6:** since #312 the site builds a divided near-intersection plan from carriageway facts, with the wire's `divided` left false. R6 sends `divided: true` as the row says, so it tests the schema refusal only. Session 4 records that.
- **First run (2026-10-22), three reruns:** N12 and N13 were refused because the 500 ft default work zone is shorter than the 540 ft merging taper at 45 mph. An operator lengthens it, so the 45+ mph near-intersection rows (N12–N14) use 600 ft (CHOSEN, the next 100 ft step). R6 first ran without its `divided: true` edit. Through #312's carriageway path it built a TA-21 / Case 18 plan; session 4 records that as INFO. It reruns with the edit. F3's device XLSX answered 502 once, so F3 reruns.

## R6 (R145 self-ruled, session 4): N14 runs on CO 2 in Commerce City at 700 ft
No rural undivided four-lane road with a crossing turned up (R4), so N14 takes Ryan's fallback: an undivided urban arterial at 50–55 mph. CO 2 ("Highway 2") at E 104th Ave, Commerce City reads two-way, primary, 55 mph, urban (`pins.md`, session 4 note). The first run at 600 ft was refused: the 660 ft merging taper at 55 mph (12 ft × 55) is longer than the work zone. As in R5, the operator lengthens to the next 100 ft step, 700 ft (CHOSEN). The rerun built a TA-21 / Case 18 near-side plan with all five downloads (`runs/fetch-log-n14-run1.txt`, `-run2.txt`). 104th Ave is mapped as two one-way roads, so the site lays one approach for its nearest one-way piece (`cross-street.ts:221`, as in R4's N6), and the cross street lands at station −99.

## R7 (R145 self-ruled, session 4): C9 is scored on Figs 6P-21/22, not L16's paraphrase
L16's check rule says a cross street "before the work zone (upstream) is near side". The figures it quotes say the reverse: near side (Fig 6P-21) closes the lane before the intersection; far side (Fig 6P-22) has the intersection between the taper and the work. The source text governs (Rule 12), so C9 scores near = cross street downstream of the work zone, far = upstream. The correction is recorded in `oracle-sources.md`. Every N row's label matches this reading.

## R8 (R145 self-ruled, session 4): what check.py scores INFO rather than FLAG
Each follows an L item's own check rule or the "Not sourced" list:
- **Upstream flagger offset (C7):** every flagger plan puts station #1 100 ft upstream of the taper, between the taper and W20-7, with A to W20-7 kept. Fig 6P-10 draws the flagger at the taper's upstream end; L7 gives no distance, so the offset is INFO.
- **AFAD (F16):** the audit's flagger table is empty for AFAD rows, so C7 reads the two AFAD stations from the crew sheet. W20-7a AFAD AHEAD in the W20-7 slot is recorded, not scored: no AFAD sign is quoted (L18).
- **Turn bay (N10):** the closed lane reopens as a TA-23 left-turn bay (cones to station 762) and the 100 ft before the taper is left open as the bay entry. No page sets the storage length, so that gap is INFO.
- **Limited sight distance (F7, F8):** the signs move 60 ft upstream under a rule that cites §6B.04 ¶04/¶06. Those ranges aren't quoted in `oracle-sources.md`, so the move is checked but the distance isn't scored.
- **R1:** Broadway is refused for its five lanes, which is true, but the one-way reason isn't named.
- **Urban near-intersection gaps under A** (N2, N6, N9): INFO per S-630-1 Sheet 10 Note 1 (L5).
- **Scan tokens:** `check.py` strips `site_scan_token` from each `audit.json`, as the shoulder audit did. Session 3's commit `a408abe` still carries them in history.

## R9 (R145 self-ruled, session 5): findings are numbered G1–G8, and severities follow the shoulder audit's scale
- **Numbering:** findings are G1–G8, because F1–F18 already name the flagger rows.
- **Severity:** the shoulder audit's scale (high / medium / low, defined in `findings.md`). No finding reaches high: none tells a crew to do something the sources don't support. G2 is medium, not high, because the plans are silent on the arrow board's mode rather than stating a wrong one.
- **G6 re-run:** the Lafayette searches were re-run on production `d6d9a14` (2026-10-22) through `fetch.py`'s paced client, so the finding cites saved answers (`runs/_pins/geo_US_287_Dillon_Rd_Lafayette*.json`), not only session 4's note. The console log and the healthz read are in `runs/fetch-log-g6-rerun.txt`.
- **G3:** `check.py`'s C10 counts the audit's device list, which has no pilot car; the audit's flagger section does say "1 vehicle". `findings.md` states both.
- **Trunk "divided" in `pins.md`** came from `fetch.py`'s classifier mirror, which predates #332. It is recorded in `findings.md` as not a finding; `pins.md` is left as the session-2 record.
- Ryan reviews `findings.md` before any issue is filed (the session-1 plan).
