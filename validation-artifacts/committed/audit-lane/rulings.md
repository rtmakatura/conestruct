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
