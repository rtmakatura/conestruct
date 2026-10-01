# issue-292-mirror-strategy — the rulings this arc is built under

**Issue:** #292 — "Overpass mirror ordering: the least reliable mirror is asked first, and it is the remaining lever on the refusal rate".
**Arc:** investigate first, measured at three times of day; a checkpoint (`checkpoint.md`) before any code.
**Base:** `ccb5042` = `origin/main` = prod `healthz`, 2026-10-01.

This file is the arc's authority; every commit on this branch cites it.

---

## #292's body, verbatim (fetched 2026-10-01 with `gh issue view 292`; open; opened 2026-09-17)

> ## Problem
>
> `OVERPASS_MIRRORS` (`src/rules/site_detection.py`) is tried in a fixed order, and its own comment asserts a property that measurement contradicts:
>
> > Each mirror is independently rate-limited and operated; **ordering puts the most-reliable first**.
>
> Mirror 1 is `overpass-api.de`. Across four measured runs it is the mirror that stalls most, and the mirror the chain always asks first.
>
> **s2-arc31 (before the per-mirror cap):** mirror 1 answered cleanly **1 of 10** spaced tries; mirror 2 stalled 25–27 s; mirror 3 answered the full Denver scan **3/3 clean in 2.8–4.4 s** and was **never reached in production** — provenance read `overpass-api.de` on **80 of 80** prod rows.
>
> **After the cap (#256 fix 1), the mirror index actually reached on cold rows:**
>
> | run | sha | denver | lakewood |
> |---|---|---|---|
> | run 2 | `5d569d7` | `#1 ×10, #2 ×1, #3 ×8, none ×1` | `#1 ×14, #3 ×6` |
> | run 3 | `2e5a647` | `#1 ×14, #3 ×5, none ×1` | `#1 ×7, #3 ×11, none ×2` |
> | run 4 | `cc820bf` | `#1 ×11, #3 ×8, none ×1` | `#1 ×7, #3 ×13` |
>
> The cap did what it was for — 15, 16 and 21 of 40 cold rows now reach mirror 2 or 3, against 0 of 80 before. But **mirror 1 is still asked first every time**, so roughly half of all requests still spend up to 7 s on the mirror least likely to answer before trying one that is.
>
> The remaining refusals are the direct consequence. All three refusals in run 3 (the run that missed ruling f's bar on Lakewood at 2/20) were the same shape:
>
> ```
> site_scan_unavailable | https://overpass.openstreetmap.fr/api/interpreter:
> ReadTimeout: The read operation timed out
> ```
>
> scan duration **20.30 s** each — the full `SCAN_BUDGET_S`. Mirror 3 timed out **as the last mirror in the chain**, after mirrors 1 and 2 had spent their 7 s caps. 7 + 7 leaves ~6 s; mirror 3 needed more than that and the budget ended the chain.
>
> Classification: **behaviour-changing, and the known remaining lever on the refusal rate.** Not a regression — #256's original defect (mirror 1 consuming the whole budget) is fixed and closed on three runs.
>
> ## Impact
>
> - A refusal is an honest 400 and the operator sees PLAN DECLINED → Retry, so nothing is silently wrong. The cost is a failed generate on a corridor that would have succeeded had a faster mirror been asked earlier.
> - Lakewood measured 0, 2, 0 refusals across the three closing runs. The bar is ≤ 1 in 20 per pin; one run missed it. Ordering is the lever most likely to move that variance.
> - Every request pays the ordering cost, not just the ones that refuse: reaching mirror 3 third means two caps burned first.
>
> ## Options to evaluate
>
> (a) **Static reorder.** Put the measured-fastest mirror first. Cheapest possible change — one list. Risk: today's ranking is a snapshot; a static order is exactly what is already wrong, just pointing elsewhere.
>
> (b) **Per-mirror rolling health score.** Track recent outcomes per mirror in the container and try them best-first. Adapts to the hour, which is the property the static list lacks. Costs: per-container state (the memo's own caveat applies — `max_containers=8`, so a score is per container and cold on a new one), and a tie-break/decay rule that is itself a CHOSEN constant.
>
> (c) **Randomise the order per request.** Removes the systematic penalty without claiming to know which is best. Cheap and stateless; gives up the ability to exploit a genuinely better mirror.
>
> (d) **Leave it and re-rule the bar.** ≤ 2 in 20 with the reason recorded. Honest, and it is the only option that costs nothing — but it accepts a failure rate the evidence says is reducible.
>
> Recommendation deferred. The measurement below decides it.
>
> ## Acceptance
>
> - The mirror-index distribution and refusal rate measured **before and after**, on the same two pins, same cycle shape, same N = 20 cold per pin, sha-gated at both ends — the `accept-256.js` harness already does exactly this and its three runs are the "before".
> - **Denver ≤ 1 in 20 and Lakewood ≤ 1 in 20**, and Lakewood held across **at least two** runs in different hours — its 0/2/0 spread is why one run is not enough.
> - `check_unavailable` on ok audits stays ≤ 1 in 20 (it is currently 0 of 115).
> - No budget raised: `SCAN_BUDGET_S` stays 20.0 and the per-mirror caps stay 7 s / 3 s unless a measured argument moves them.
> - Every new constant (a decay rate, a score window, a tie-break) traced or marked CHOSEN in its docstring (Rule 12).
> - Refusal honesty unchanged — a chain that exhausts every mirror still returns the honest 400.
>
> ## Reference
>
> - `src/rules/site_detection.py` — `OVERPASS_MIRRORS` and its "most-reliable first" comment; `PER_MIRROR_READ_S` / `PER_MIRROR_CONNECT_S`; `_overpass_request_with_fallback`.
> - `validation-artifacts/committed/s2-arc31-scan-budget/` — the per-mirror measurements (1/10, 25–27 s stall, 3/3 clean at 2.8–4.4 s, 80/80 prod rows on mirror 1).
> - `validation-artifacts/committed/issue-256-scan-chain/` — the three closing legs, their mirror-index tables, and run 3's refusal detail.
> - #256 (closed on the set of three; this is the remaining lever, not a reopening).
> - Priority-medium. Not blocking; the refusal is honest today.

## #292's comment, verbatim (2026-10-01T14:09:28Z)

> New measurement, prod `c055262`, 2026-09-30 18:57–19:14Z (`validation-artifacts/committed/scan-refusal-rate/`, `85be5be`): 37 cold scans, 1 refused (2.7%), inside the ≤ 1 in 20 bar for this window. Mirror reached: `overpass-api.de` 11, `kumi` 0, `overpass.openstreetmap.fr` 25. The third-mirror answers landed at 15.4–18.3 s of the 20 s budget. The one refusal was the third mirror's ReadTimeout at 20.19 s, the same shape as run 3's. Kumi timed out on two direct 30 s posts. Separate finding filed: Generate runs the scan twice (breakdown + audit), which doubles the per-Generate chance of a refusal.

*(The 2026-10-01 morning comment, R67, is with the chat to post; its numbers are in
`validation-artifacts/committed/issue-306-double-scan/probes/`.)*

---

## Ryan's instruction, verbatim (2026-10-01, with the #306 rulings)

> Then #292 becomes the top priority: investigate with a checkpoint. Measure at three times of day (morning, midday, evening). Options to evaluate include dropping kumi if it's dead, asking mirrors in parallel and taking the first answer instead of waiting 7 s each in turn, and the budget. No code until I rule.

---

## The ruling on the checkpoint, verbatim

*(Not yet ruled.)*
