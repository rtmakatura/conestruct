# 📋 Checkpoint: lane-closure audit (#370)

I filed the tracking issue: https://github.com/rtmakatura/conestruct/issues/370 (labels `audit-lane` and `priority-medium`). The `audit-lane` label didn't exist, so I created it in the same style as `audit-shoulder`.

The worktree is `.claude/worktrees/issue-370-audit-lane` on branch `issue-370-audit-lane`, built on `issue-366-prod-check` (`e6453ef`). Nothing is committed and nothing has run. The pause is recorded in handoff.md.

## 1. Which kinds are live

| Kind | Status | Basis |
|---|---|---|
| `flagger_lane_closure` | **Live** | MUTCD Fig 6P-10 (TA-10); S-630-1 Cases 17 and 42 as analogs. Two-lane two-way roads only; a third lane is allowed only if it's a center turn lane (#86). One-way roads are refused. |
| `near_intersection` | **Live** | S-630-1 Sheet 10 Case 18; MUTCD Figs 6P-21/22 and §6N.12. The mainline must be **undivided with 2+ lanes per direction** (`layout.py:1726`). Speeds 25–55 mph, one or two approaches. |
| `lane_closure_divided`, `work_beyond_shoulder`, `mobile_op_2lane`, `mobile_op_multilane` | Gated | Not audited |

How near-intersection plans work:
- **Near side or far side** isn't a choice. The plan works it out from where the cross street sits: before the work zone is near side (§6N.12), after it is far side (Fig 6P-22 note 7).
- **Right lane:** both sides are live.
- **Left lane, near side:** only on a confirmed one-way street.
- **Left lane, far side:** needs `turnBayStorageFt`.

Live is confirmed from `ENABLED_SCENARIOS` (`render_api.py:141`) and the site's `ENABLED_SCENARIO_KINDS` (`conestruct/site/lib/scenarios/index.ts:290`). Session 2 confirms it on production with one plan per kind.

## 2. The plan matrix: 31 plans and 10 refusals

**Pins already recorded, from the shoulder audit and the test fixtures:**
- **Two-lane two-way:** Ogden St (C), E Louisiana (E), W 9th Ave in Lakewood (J), Lafayette St, Lookout Mountain Rd (M), CO 119 (N), US 24 at Hartsel (O).
- **Near-intersection:** E Colfax at Race St (the #117 live checks), and N Broadway one-way at E 11th Ave (#285/#323).

**New pins, confirmed on `/api/road-bearing` before use (each is swapped out if the map says divided or one-way):**
- US 285 near Fairplay
- A two-lane El Paso County road
- A two-lane Loveland street
- 2–3 undivided Denver/Lakewood arterials with 2+ lanes per direction, e.g. W Colfax in Lakewood
- A rural undivided four-lane road, if one exists on the map. If not, I drop the row and say so.

**Flagger plans (17):**

| | Pin | Road type | Speed | Day/night | Work length | Extra |
|---|---|---|---|---|---|---|
| F1–F2 | Ogden | urban | 25 | day / night | 200 | |
| F3–F4 | Louisiana | urban | 30 | day / night | 300 | F4 also has `pedestrianAccess` (school) |
| F5 | W 9th, Lakewood | urban | 30 | day | 300 | Lakewood's 35 mph breakpoint |
| F6 | Lafayette | urban | 35 | day | 500 | |
| F7–F8 | Lookout Mountain | rural | 35 | day / night | 300 | limited sight distance (rechecks #331's fix) |
| F9–F10 | CO 119 | rural | 45 / 55 | day / night | 500 / 1,000 | |
| F11–F12 | US 24, Hartsel | rural | 55 | day / night | 1,500 | F12 has a pilot car (Case 42); both recheck #332's fix |
| F13 | US 285, Fairplay | rural | 55 | day | 2,640, long | |
| F14 | El Paso County | rural | 45 | day | 500 | |
| F15 | Loveland | urban | 30 | night | 300 | |
| F16 | CO 119 | rural | 45 | day | 500 | AFAD |
| F17 | Ogden | urban | 25 | day | 50 | the shortest work zone |

**Near-intersection plans (14):**

| | Pin | Direction | Side and setup |
|---|---|---|---|
| N1–N3 | Colfax / Race, 35 mph | two-way | near side at −100 ft; far side; near side at night |
| N4 | Colfax / Race | two-way | near side at −60 ft, run to the corner (rechecks #358/#366) |
| N5 | Colfax / Race | two-way | four-leg intersection, two approaches |
| N6 | Colfax / Race | two-way | T-intersection, one approach, far side |
| N7–N9 | Broadway / E 11th | one-way | right lane near side; left lane near side (Case 18 mirrored); right lane far side |
| N10 | Broadway / E 11th | one-way | left lane far side with a 150 ft turn bay (TA-23) |
| N11 | Denver arterial | two-way | 40 mph, far side |
| N12 | W Colfax, Lakewood | two-way | 35 mph, near side, Lakewood rules |
| N13 | arterial, 45 mph | two-way | `signal_work` at a signal (urban-high signs) |
| N14 | rural undivided four-lane | two-way | 55 mph, near side, if a pin exists |

**Refusals (10).** Each must return the expected status and name the field (rechecks #340's fix):
1. Flagger on a one-way road (Broadway)
2. Flagger on a single-lane road
3. Flagger on a four-lane two-way road (Colfax)
4. Flagger at 60 mph
5. Flagger with an 8 ft lane
6. Near-intersection with `divided=true` (Colorado Blvd at Exposition)
7. Near-intersection on a one-lane mainline (Ogden)
8. Cross street inside the work zone
9. Left lane far side without `turnBayStorageFt`
10. Approach lane tags that don't add up (#120)

## 3. The checks

Page numbers are taken as already cited and checked in the repo, mostly the shoulder audit's `oracle-sources.md`, which uses its own page convention. Rows marked ⚠ have no page cite yet. Session 2 must find each one on the page or drop the check, so no number is used without a source (Rule 12).

| # | Check | Source and page |
|---|---|---|
| C1 | Taper: flagger one-lane two-way taper 50–100 ft; near-intersection merging taper L = WS²/60 at 40 mph or less, WS above | §6B.08 ¶14 ⚠ (§6B.08 starts p. 775); Table 6B-4 p. 775 |
| C2 | Buffer, and flagger sight distance | Table 6B-2 p. 775, §6B.06 ¶11 p. 773; §6D.06 ¶03 p. 786 |
| C3 | Downstream taper 50–100 ft | §6B.08 ¶12 p. 776. The code says "per lane" (`tables.py:41`, `spacing.py:131`) but the quote doesn't. Likely finding. |
| C4 | Device spacing: at most 1×speed in the taper, 2×speed on the tangent and buffer | §6K.01 ¶04 p. 815; S-630-1 Note 18a/b |
| C5 | Device size: cones 28 in, 36 in at night; no Type 1 barricade at 55 mph or more | S-630-1 Notes 15 and 16; drums ⚠ (no cite in the repo) |
| C6 | Sign series and spacing. Flagger: W20-1 → W20-4 → W3-4 → W20-7 at A/B/C, ending with G20-2. Near-intersection: mainline W20-1 → W20-5 → W4-2; cross street W20-1, R2-10 and R2-11 | Table 6B-1 p. 773; Fig 6P-10 ⚠ (the repo says "PDF 878-879", which doesn't fit the page convention); Sheet 10 Case 18 (PDF p. 158); Fig 6P-21 p. 900, 6P-22 p. 903; §6N.12 pp. 848–849 |
| C7 | Flagger stations: 50–100 ft before the taper; opposing flagger 200–300 ft; night lighting; pilot car | Fig 6P-10 ⚠; Case 17 Sheet 9 ⚠ and Case 42 Sheet 25 ⚠ (fixtures read from the 2019/2023 set, not the July 2026 one); Note 22 |
| C8 | Arrow board: required or allowed on a near-intersection multilane closure; not drawn on TA-10 | §6L.06 p. 832 (paragraph ⚠); Fig 6P-10 ⚠ |
| C9 | The near-side/far-side label matches the cross street's position | §6N.12; Fig 6P-22 note 7 |
| C10 | Page 1, audit, crew sheet, device XLSX and quote XLSX agree on signs, device counts, stations, taper, buffer and flaggers | the same values as above |
| C11 | Page-1 text stays inside its boxes; edition named consistently (Rule 9) | reused from the shoulder audit |
| C12 | Limited sight distance on mountain roads (rechecks #331) | §6B.04 ¶04–08 p. 771 |
| C13 | Pedestrian access (F4) | TA-28 pp. 914–915; §6N.04 ¶06 p. 843 |
| C14 | Night: lighting, cone size, and the night note on page 1 | Notes 15 and 22 |
| C15 | Refusals: status and field name | `render_api.py` and `schemas.py` refusal paths |

## 4. What I reuse, and how many sessions

**Reused from `audit-shoulder/`:**
- **`fetch.py`:** pacing, 429 back-off, the gate token, the pin cache and signed scan-token reuse. New work: building flagger and near-intersection scenarios. Near-intersection needs `approaches`, `meta.intersection` and the `work_start` pin model; the shoulder `fetch.py` never built approaches.
- **`check.py`:** PDF and XLSX parsing, page-1 containment, PASS/FLAG/INFO and edition checks. New work: the checks specific to each kind.
- **`oracle.py`:** `ADVANCE`, `BUFFER`, `taper_L`, device spacing, downstream taper and the cone/barricade values carry over unchanged. New: the flagger and near-intersection values.
- **Unchanged:** `build_index.py` and the gallery layout. The independent page check (`oracle-check.md`) runs the same way.

**Sessions.** All of it won't fit in one session under 150k, so I split it:

| Session | Work | Estimated context |
|---|---|---|
| 1 (this one) | issue, plan | about 120k |
| 2 | confirm the pins; write `oracle.py` and `oracle-sources.md`; close the ⚠ page gaps; independent page check | about 120k |
| 3 | adapt `fetch.py` and `check.py`; fetch all 41 rows from production | about 130k |
| 4 | score, gallery, `findings.md`, your review, file one issue per finding | about 110k |

## Found while planning, not yet filed
- **Stale docs:** the `NearIntersectionScenario` docstring (`schemas.py:935`) still says "GATED", and `skills/cdot-s630-cases/SKILL.md` says only shoulder is enabled.
- **The "per lane" downstream taper** (C3 above), likely finding #1.
- **`02-JURISDICTION-DATA.md` is still missing** (already flagged under #357).

**Decisions for you:**
1. Approve the matrix and the checks as they stand, or amend them.
2. **N14** (rural undivided four-lane): drop the row if no real pin exists, or keep looking for one.
3. Should the two stale docs become one cleanup issue now, or wait for `findings.md`?

Once you approve, the next step is `/start 370`.
