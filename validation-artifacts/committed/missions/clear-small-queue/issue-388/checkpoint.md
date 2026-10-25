# #388 checkpoint (R145, no stop)

1. **Problem.** Thornton's stipulation 6 rule (`data/jurisdictions/thornton.json:53-68`) has no `qty`, so `_iter_fired_count_adds` (`src/rules/jurisdiction.py:749`, `effect.get("qty", 1)`) counts 1. Every surface prints `1 EACH` for a rule that asks for two signs per direction of travel affected.
2. **Rulings.** R1 is Ryan's ruling (2026-10-24): count from stipulation 6, two per direction of travel affected, with the direction count per plan kind from the plan's road facts. R2-R6 are R145 self-ruled (`rulings.md`).
3. **Change (cycle 0, superseded by R7).**
   - `thornton.json` adds `"qty_per_direction": 2`, and the schema gains the field.
   - `ScenarioParams.directions_of_travel_affected`, set per kind in `scenario_to_call`: shoulder 1, flagger 2, near_intersection 1 + legs. Gated kinds get None.
   - `_iter_fired_count_adds` multiplies, or refuses when there's no direction count.
   - `annotate_count_effects` adds `qty` to a per-direction delta, and the delta panel reads it.
4. **Churn prediction (Rule 5), measured by `churn.py` (cycle 0, superseded by R7).**
   - It moves only on bodies with `jurisdiction_key: "thornton"`, on every kind, class and day/night. The Advance Warning Signs row's count goes 1 -> 2 on shoulder, 4 on flagger, and 4 on the churn NI body (`_broadway_denver`, 1 leg). The `tests/fixtures/pdf_worst_case/adv-near-intersection.json` fixture has 2 legs, so it gets 6.
   - Surfaces that move there: the device XLSX qty, the quote XLSX qty, the page-1 summary qty and the device total. Also the breakdown JSON (`devices` qty, `total_devices`, and the delta's `qty` and `key`), the crew sheet markdown and crew PDF ("N×"), and the replication snapshot. The audit JSON moves too, through the delta `key` in its jurisdiction block, if it carries one.
   - The quote's dollar totals don't move. The row is unpriced ("—", left out of the total, #151).
   - Every other jurisdiction and the no-jurisdiction bodies stay byte-identical on all surfaces (Lakewood and CDOT included, R6).
   - Tests that pin the old count: `tests/s630/test_cross_surface_device_summary.py:126` and `tests/s630/test_cross_surface_quote_delta.py` (only if it pins qty), `tests/test_crew_sheet_rule_rows.py:124` (crew PDF "1×").
   - Frontend: `JurisdictionSection.tsx` `deltaImpact` shows "+2 devices" / "+4 devices" on Thornton. The vitest fixture `jurisdiction-demo.json` is a static copy and isn't changed.
5. **Proof.**
   - New payload-level tests (Rule 11) in `tests/test_thornton_stipulation6_count_388.py`. For each enabled kind, the device XLSX, quote XLSX, breakdown, crew markdown and page-1 summary show the same count, which equals 2 x directions. The tests also cover a gated kind's refusal and Lakewood/CDOT staying at 1.
   - Red proof against `git archive` of the base.
   - `churn.py` run on base vs branch, with the outputs committed in this folder.

## Actual churn (`churn.json`, from `churn.py` run on base 7266a62 and on the branch, then `compare.py`)
- 258 bodies: 14 jurisdictions plus none, x 3 kinds, x classes None/local/arterial, x day/night.
- Moved: the 18 Thornton bodies on device XLSX, quote XLSX, breakdown, crew markdown, replication snapshot and PDF page 1. No other body moved on any surface.
- The audit JSON didn't move: it carries no delta `key`. That was an open "if" in the prediction.
- Thornton count, the same on every surface: shoulder 1 -> 2, flagger 1 -> 4, NI (1 leg) 1 -> 4.
- Tests that pinned the old count: the two predicted (`test_cross_surface_device_summary.py`, now 4; `test_crew_sheet_rule_rows.py` crew PDF, now 2×). `test_cross_surface_quote_delta.py` didn't pin qty. No unpredicted failures.
- The frontend fixture `jurisdiction-demo.json` was left alone: regenerating it pulls in unrelated drift from earlier changes (castle_rock/e470 keys, `requires`).

## Repair cycle 1: amended prediction (written before the code change)
R3 is replaced by R7 (`rulings.md`). A direction is affected when its traffic passes the work zone on the same carriageway, read from the plan's road facts.
- **Change:**
  - `scenario_to_call` sets the direction count as follows:
    - Shoulder: 1 on a one-way street or a divided carriageway (`one_way_street` / `is_divided`), 2 otherwise (two-way undivided).
    - Flagger: 2.
    - near_intersection: (1 if `one_way_street`, which covers the divided-carriageway verdict too, else 2) + the legs.
  - The delta panel shows "per direction", not a number, when a per-direction rule carries no `qty`.
  - The schema forbids `qty` together with `qty_per_direction`.
  - A real gated-kind (`lane_closure_divided`) refusal test.
- **churn.py:** it gains three Thornton/no-jurisdiction bases: a two-way undivided shoulder (`rural_undivided`, `divided: false`, 1 lane), a one-way-street shoulder (carriageway `confirmed: "one_way_street"`), and a one-way-street NI. That's 258 -> 516 bodies (6 kinds x the same grid), with the outputs re-run on base and branch.
- **Predicted vs base:** only the Thornton bodies move, on the same surfaces as before; audit is unchanged. Counts:
  - divided shoulder 1 -> 2
  - undivided shoulder 1 -> 4
  - one-way shoulder 1 -> 2
  - flagger 1 -> 4
  - two-way NI with 1 leg (`_broadway_denver`) 1 -> 6
  - one-way NI with 1 leg 1 -> 4
- **Predicted vs the cycle-0 branch:** the two-way NI goes 4 -> 6 and the undivided shoulder 2 -> 4. Everything else is the same. The `adv-near-intersection.json` fixture (two-way, 2 legs) now gets 8.
- **Tests:** none newly pin a count beyond the cycle-0 two (both on bodies whose count doesn't change: divided shoulder 2, flagger 4).

## Repair cycle 1: actual churn (`churn.json`, re-run on base 7266a62 and the branch)
- 516 bodies, 36 of them Thornton. Moved: the 36 Thornton bodies on device XLSX, quote XLSX, breakdown, crew markdown, replication snapshot and PDF page 1. No other body moved on any surface; audit is unchanged.
- Thornton count, the same on every surface:
  - divided shoulder 1 -> 2
  - two-way shoulder 1 -> 4
  - one-way shoulder 1 -> 2
  - flagger 1 -> 4
  - two-way NI (1 leg) 1 -> 6
  - one-way NI (1 leg) 1 -> 4
- That matches the amended prediction. No test outside the new file needed a change.
- § 5's "a gated kind's refusal" is now a real `lane_closure_divided` plan (`test_a_plan_with_no_direction_count_refuses`).
