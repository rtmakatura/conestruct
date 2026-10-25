# #388 rulings: Thornton stipulation 6 counts two signs per direction of travel affected

## Source
The repo's record of stipulation #6 (the Thornton Construction & TC Permit handout itself is not committed; BLOCKED.md:63 calls it undated), `data/jurisdictions/thornton.json:53`, verbatim:

> CONSTRUCTION AHEAD and MEN WORKING signs required for each direction of travel affected (stipulation #6).

Its source block (`thornton.json:64-68`): doc "Thornton Construction & TC Permit handout", section "stipulation 6", status "verified". No page cite exists, because the handout isn't in the repo. Ryan's ruling (R1) is the authority for the count. Committing the handout so the stipulation can be cited with a page is filed as #394.

## R1 (Ryan ruling, 2026-10-24)
> "#388 is sourced, not parked: count Thornton's advance warning signs from stipulation 6's exact wording (two per direction of travel affected), deciding the number of directions per plan kind from the plan's own road facts (two-way, one-way, single carriageway). Quote the stipulation in rulings.md."

## R2 (R145 self-ruled): the count is data, the direction count is the plan's
- The rule's effect gains `"qty_per_direction": 2` (the two signs the stipulation names: CONSTRUCTION AHEAD and MEN WORKING). The schema (`data/jurisdiction.schema.json`, delta effect) gains the integer field. The rule's note "per affected direction" stays.
- The count is `qty_per_direction` x the plan's `directions_of_travel_affected`, worked out in the one row walk (`_iter_fired_count_adds`, `src/rules/jurisdiction.py`). Every surface already calls that walk: device XLSX, quote, page 1, breakdown, crew sheet, replication snapshot (#151, #381). The backend owns the number (Rule 3).
- `directions_of_travel_affected` is a new `ScenarioParams` field, set per plan kind in `scenario_to_call` (`src/api/schemas.py`), the one place each kind's road facts are known. Default None.
- Side effect: editing the rule's effect changes its `delta_key` hash (`jurisdiction.py:553`, "it does change when this rule's words, source or effect are edited"). That's by design and goes in the churn prediction.

## R3 (superseded by R7 in repair cycle 1)
The first reading was that a direction is affected when the plan places an advance warning series for its traffic. Under that reading no road fact ever changed the count: shoulder was always 1, near_intersection 1 + legs. The near_intersection convention of not signing the opposing mainline had no source. It is kept here as the alternative Ryan may choose instead of R7.

## R4 (R145 self-ruled): gated kinds carry no direction count, and the rule refuses there
- `lane_closure_divided`, `work_beyond_shoulder`, `mobile_op_2lane` and `mobile_op_multilane` are gated (`ENABLED_SCENARIOS`, `render_api.py:152`). Their road facts aren't evidenced yet (Rule 8), so `directions_of_travel_affected` stays None on them.
- An `undecided` carriageway verdict also gives None (R7). The request gate already refuses it with a 400 (`_ensure_carriageway_decided`).
- A direction-counted rule on a plan with no direction count raises a ValueError naming the rule. It never guesses a number (Rule 10: honest refusal beats silent substitution). Over HTTP a gated kind is refused with a 400 before this point, so production can't reach it. The refusal is there for direct callers. `test_a_plan_with_no_direction_count_refuses` builds a real `lane_closure_divided` plan with `jurisdiction_key: "thornton"` through `scenario_to_call` and checks that it refuses. It checks the bare no-params caller too.

## R5 (R145 self-ruled): the delta panel shows the backend's count
- `JurisdictionSection.tsx` `deltaImpact` printed `+${d.effect.qty ?? 1}`. That's a frontend mirror showing "+1 device" for a rule that now adds 2 or more, a second answer (Rule 3).
- `annotate_count_effects` (already the backend's per-plan annotation of the breakdown's deltas) now puts the resolved `qty` on a direction-counted delta. The panel reads `d.qty ?? d.effect.qty ?? 1`. Only per-direction deltas carry the key, so every other jurisdiction's breakdown JSON stays byte-identical.
- Repair cycle 1, Rule 10: a delta with `effect.qty_per_direction` and no `qty` (a wire that didn't carry the plan's count) shows "—" over "per direction", never "+1". `AppliedDelta.effect` gains `qty_per_direction?: number`.

## R6 (R145 self-ruled): Lakewood and CDOT are left as they are
Lakewood's double-posting rule (`lakewood.json:106-111`) and CDOT's General Note 11 (`cdot.json:127-131`) share the `advance_warning_signs` id with no qty and still count 1. Ryan's ruling covers Thornton only, so their output stays byte-identical. Filed as #393.

## R7 (orchestrator call, R145, repair cycle 1; replaces R3): a direction is affected when its traffic passes the work on the same carriageway
Ryan's ruling says to decide the directions "from the plan's own road facts (two-way, one-way, single carriageway)", so the road facts have to change the answer. A direction of travel is affected when its traffic passes the work zone on the same carriageway. The count reads the road facts the backend already holds; nothing is re-derived:
- `ScenarioParams.one_way_street` and `is_divided` on a shoulder plan (from `scenario.carriageway_verdict()` and `plans_divided()`).
- `scenario.carriageway_verdict()` on a near_intersection plan. Its params carry `one_way_street=True` for both the one-way and the divided verdict (#312).
- One producer, `mainline_directions_of_travel` (`src/api/schemas.py`).

| Plan kind (enabled) | Road fact | Directions | Signs |
|---|---|---|---|
| shoulder | two-way undivided (`divided` false, no one-way verdict) | 2 | 4 |
| shoulder | one-way street (verdict `one_way_street`) | 1 | 2 |
| shoulder | one carriageway of a divided road (`plans_divided()`) | 1 | 2 |
| flagger_lane_closure | always two-lane two-way (a one-way road is refused upstream, #158 `_ensure_direction_eligible`) | 2 | 4 |
| near_intersection | mainline two-way undivided, plus each cross-street leg the plan signs (§6N.12.06, `generate_near_intersection`) | 2 + legs | 2 x (2 + legs) |
| near_intersection | mainline one-way street or divided carriageway (verdict `one_way_street` / `divided`), plus each leg | 1 + legs | 2 x (1 + legs) |
| any | carriageway verdict `undecided` | None (refuses, R4) | none |

- **Cross-street legs:** a leg counts on a separate basis from the mainline test. The plan places a sign set on each approach (§6N.12.06; `generate_near_intersection`, `src/generation/layout.py:1927-1929`), so each leg adds one direction whatever the mainline's road facts are.
- **No carriageway facts:** when the plan has none (verdict `not_applicable`: none were relayed, or the road isn't tagged one-way), the plan is built on the scenario's own `divided` flag, "byte-identical to every plan before #308" (`CarriagewayFacts` docstring, `schemas.py`). With `divided` false that's a two-way undivided road, and the drawing shows it that way. The count reads the same fact the drawing does, so it isn't a new default. R145 self-ruled. If you'd rather refuse here, the change is one line in `mainline_directions_of_travel`'s callers.
- **Layout unchanged:** this is a count of the jurisdiction's required signs, not a placement. Nothing in the generators reads `directions_of_travel_affected`. The undivided generators still sign only the work direction (`layout.py:1043-1045`, `1942`), and the row stays "Not placed on the drawing" (#381 R2).
