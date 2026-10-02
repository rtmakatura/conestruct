# issue-292-mirror-strategy — checkpoint (written before Ryan rules)

**Issue:** #292 — the Overpass mirror chain asks its least reliable mirror first, and the order is the
lever on the scan's refusal rate. `rulings.md` is beside this file.
**Base:** `ccb5042` = prod `healthz` for every measured window. Read-only probes, no product code.
**Evidence:** `probes/`. Every number below comes from `simulate.txt` or a window file.

## The answer, in brief

1. **Three windows, 2026-10-01, 9 Denver pins each.** Morning 15:50Z, midday 18:07Z, evening
   01:07Z. In each, every mirror got the exact query prod sends, all three at once
   (`measure_window.py`), followed by one cold prod Generate. Asked directly:
   - **`overpass.openstreetmap.fr` answered 27 of 27** (median 3.0 s, max 5.2 s).
   - **`overpass-api.de` answered 16 of 27** (median 6.5 s, max 13.5 s). The rest were 504s after
     6–14 s.
   - **`overpass.kumi.systems` answered 1 of 27,** in 20.7 s. The other 26 timed out at 30 s.
2. **Prod answered 27 of 27, slowly.** The scan's median was **17.0 s** of its 20 s budget. 16 of
   27 scans ran over 15 s, and one ran over 20 s (21.4 s). The chain asks the 504ing primary and the
   dead kumi before the one mirror that answers, each with a 7 s cap.
3. **Replaying the strategies on the measured times reproduces prod.**
   - Today's chain simulates at a 16.9 s median, against prod's measured 17.0 s.
   - Dropping kumi: 9.9 s.
   - Asking fr first, or all mirrors at once: **3.0 s.**
   - A 25 s or 30 s budget changes nothing in these windows.
4. **None of these three windows hit a refusal period. This morning's did.**
   - At 14:44–14:51Z, 6 of 10 and then 4 of 8 scans refused
     (`../issue-306-double-scan/probes/`). Every one was **fr's** ReadTimeout at the end of the
     budget.
   - So fr is the fastest mirror *today*, but it is also the one that failed in the worst
     measured hour.
5. **Recommendation:**
   - **Drop kumi.**
   - **Ask the two live mirrors at once and take the first valid answer** (option (c)). It is
     robust to either one failing, which a fixed order isn't.
   - **Keep the 20 s budget,** and make it a real deadline: today a slow read can overrun it.
   - The cheaper alternative is **(d), hedged:** fr first, and the primary too if fr hasn't
     answered within a short delay.

---

## 1. Measurements (`probes/`)

| Window | Mirrors, asked directly | Prod (its own chain, from Modal) |
|---|---|---|
| Morning, 15:50–15:56Z | de 2/9 (7 × 504 at 6–9.5 s); kumi 0/9; **fr 9/9, 2.6–5.2 s** | 9/9 answered; 4 at 17–20 s |
| Midday, 18:07–18:14Z | de 5/9 (3.2–13.5 s; 4 × 504); kumi 0/9; **fr 9/9, 2.7–3.2 s** | 9/9 answered; **8 of 9 only via fr, at 17.9–18.4 s** |
| Evening, 01:07–01:13Z | de 9/9 (2.5–11.8 s); kumi 1/9 (20.7 s); **fr 9/9, 2.6–3.7 s** | 9/9 answered; 4 via fr at 18–21 s; one scan 21.4 s, past the budget |
| *(earlier, 14:44–14:51Z: #306's probes)* | *(not measured directly)* | **6/10 and 4/8 refused, all fr's ReadTimeout at 20 s** |

**How the windows were run:**
- Midday and evening were run by Windows Task Scheduler tasks, with CC's in-session timer as the
  second trigger.
- `run_window.ps1` claims a window atomically. Both later windows show the second trigger's skip
  note.
- The task's output is UTF-16, because Windows PowerShell 5.1 redirects that way; the readers
  decode it.

**Where this view departs from prod's:**
- These are this PC's answer times; prod asks from Modal's network.
- At midday the primary answered this probe on pins where prod's chain still fell through
  (`e-colfax`: 3.2 s here, while prod used fr at 17.9 s).
- So the primary looks *better* from here than it does from Modal. Strategies that don't lean on
  the primary are the least exposed to that difference.

## 2. Simulation (`probes/simulate.py` → `simulate.txt`; 27 pin-windows)

The model: a chain abandons a mirror at min(cap, time left) and moves on from a failure at its own
time; parallel means the first success wins.

| Strategy | Refused | Median | p90 | Max |
|---|---|---|---|---|
| today: de, kumi, fr; 7 s caps; 20 s | 0 | 16.9 s | 17.3 s | 19.1 s |
| today, 25 s budget | 0 | 16.9 s | 17.3 s | 19.1 s |
| today, 30 s budget | 0 | 16.9 s | 17.3 s | 19.1 s |
| no kumi: de, fr | 0 | 9.9 s | 10.3 s | 12.2 s |
| fr first: fr, de, kumi | 0 | 3.0 s | 3.4 s | 5.2 s |
| fr first, no kumi | 0 | 3.0 s | 3.4 s | 5.2 s |
| all at once, first answer | 0 | 3.0 s | 3.3 s | 5.2 s |

**What it can't show:** a refusal period. The windows that refused weren't measured mirror by
mirror. In those, fr was the mirror that timed out, so a fixed "fr first" would have gone 7 s cap →
primary, which answers 16 of 27 at up to 13.5 s. A parallel ask would have taken whichever mirror
answered first.

## 3. The options

| | Change | Measured effect | Exposure | Cost |
|---|---|---|---|---|
| **(a) Drop kumi** | remove it from `OVERPASS_MIRRORS` (`site_detection.py:86-90`) | median 16.9 → 9.9 s; no refusal change | none: 1 of 27 answers, at 20.7 s | one line; the tests naming three mirrors |
| **(b) fr first** | reorder | median 3.0 s | rests on fr, the mirror that failed this morning | one line; order tests |
| **(c) All at once, first valid answer** (with (a): two mirrors) | `_overpass_request_with_fallback` asks both concurrently; the first 200, JSON, remark-free answer wins; the other is abandoned | median 3.0 s, and it survives either mirror failing | doubles requests to the public mirrors per scan (#306 already halved scans per Generate) | the chain function and its ~12 internal tests; provenance `mirror` = the winner |
| (d) Hedged | fr first; if it hasn't answered within H s, ask the primary too; first valid wins | ≈ (c) when fr is healthy; ≈ (c) one H later when it isn't | H is a CHOSEN constant (fr's measured p90 is 3.4 s) | like (c), plus a timer |
| (e) Budget 20 → 25/30 | `SCAN_BUDGET_S` (`site_scan.py:73`) | none in these windows; helps only when every mirror is slow | the user waits longer; #292's acceptance says the budget rises only on a measured argument, and there isn't one | one constant |
| (f) A real deadline | the budget becomes a total deadline, not a per-read timeout | measured overrun: 21.4 s against 20 s | none | small; part of any of the above |

**Recommendation: (a) + (c) + (f).**
- Two live mirrors asked at once, the first valid answer taken, and the 20 s budget enforced as a
  real deadline.
- #292's own options (a) static reorder, (b) health score and (c) random order are all ordering
  answers. A parallel ask makes the order irrelevant, without a health-score constant.
- (d) is the honest middle if doubling the load on public mirrors is a concern. It costs one
  CHOSEN delay.

## 4. Churn (Rule 5, predicted)

- **Untouched:**
  - Every test that stubs `_overpass_request_with_fallback` whole: most of the 34 files that name
    it, since its name and signature stay.
  - The recorded fixtures, which hold a mirror URL only as data.
- **Move:** the tests that pin the chain's internals.
  - `tests/test_site_detection.py`: `test_point_scan_4xx_hard_stops_the_mirror_list`,
    `test_429_on_the_first_mirror_still_reaches_a_later_clean_one`,
    `test_budgeted_chain_reaches_the_third_mirror`,
    `test_validate_budget_exceeded_reports_check_unavailable`, and
    `test_generic_details_append_safe_on_every_bucket` if its stub counts calls.
  - `tests/test_site_scan_ingenerate.py`: `test_budget_exceeded_is_unavailable_and_stops_trying_mirrors`,
    `test_remark_on_the_first_mirror_tries_the_next`,
    `test_remark_on_every_mirror_is_unavailable_with_the_remark_text`,
    `test_clean_empty_body_without_remark_is_a_complete_answer`,
    `test_remark_never_scores_ok_end_to_end_and_is_never_memoised`,
    `test_ok_scan_carries_the_fetch_provenance_and_never_a_ninth_bucket`,
    `test_refused_scan_names_the_mirror_and_the_remark`.
  - Each keeps its claim, restated for "both at once": a 4xx, a 429 or a remark from one mirror
    leaves the other's answer in play.
- **Wire:**
  - No new field.
  - `site_scan.mirror` still names the mirror that answered.
  - A refusal's `error` lists both mirrors' failures (it lists the chain's today).

## 5. Proof plan

- **Unit level:** stubbed mirrors with chosen delays and outcomes.
  - The first valid answer wins, whichever mirror it comes from.
  - One mirror's 4xx, 429 or remark doesn't end the scan while the other can still answer.
  - Both failing gives the honest `unavailable`, naming both.
  - The deadline is total (a stub that trickles bytes past 20 s is cut off at 20 s).
  - Nothing is memoised on a refusal.
- **Prod, after the ship:** the same three windows, the same 9 pins.
  - The scan median falls from 17.0 s to about the faster mirror's time.
  - **#292's own acceptance**, which these 9 Denver pins don't replace: ≤ 1 refusal in 20 per pin
    on the Denver and Lakewood pins, held across two runs at different hours.

## 6. Questions (surfaced, not decided)

- **Q1.** (c) at once, (d) hedged, or (b) fr first? Recommended: (c), with (a) and (f).
- **Q2.** Drop kumi outright, or keep it as a third mirror asked only when both live mirrors fail?
  Recommended: drop. It answered 1 of 27, at 20.7 s, which is past the budget.
- **Q3.** Keep the 20 s budget? Recommended: yes, made a real deadline. Nothing measured argues
  for more.
- **Q4.** The vantage gap (§1): measure from Modal's own network before deciding? That means a
  throwaway Modal function running the window probe, which is a new deploy target. Recommended:
  not needed for (c), because a parallel ask doesn't depend on which mirror Modal finds fastest.
