# #355 rulings — non-freeway 65→60 / 75→65 shoulder plans stop citing Sheet 14

Sources and quotes: `checkpoint.md` in this folder.

## R1 (R145 self-ruled): option (a), route them like any non-Case-26/27 reduction
- A CDOT shoulder plan at 65→60 or 75→65 on a road whose Table 6B-1 class isn't freeway or expressway takes the federal posted-speed buffer (MUTCD 11th Ed. Table 6B-2: 645 ft at 65, 820 ft at 75), the Case 11 taper citation and the Case 11 reduced-speed case label, as 65→55 already does.
- Why it fits existing rules: Sheet 14's only titles are "Shoulder Work - Freeway/Expressway" (Cases 26/27), so its 570/650 ft floors belong to that road class (Rule 12: a borrowed safety value isn't a sourced one). The audit must not say the plan follows a typical it doesn't draw (Rule 10). The replacement value is already sourced and in the repo (`BUFFER_SPACE`), and it is longer, so no safety value goes down. It is the issue's own recommendation; no new source, number or design direction.
- Option (b) (a road-class ruling that a 65 mph `rural_divided` road is an expressway) is not taken: no source in the repo defines expressway for the form's road types. Option (c) keeps the borrowed floor. Option (d) refuses plans that a sourced value can serve.
- The gate reads `ScenarioParams.road_type` (the Table 6B-1 class). "expressway" counts with "freeway" because Sheet 14's title names both; the form never produces it today.

## R2 (R145 self-ruled): lane closures stay as they are in this arc
- A lane closure at 65→60 / 75→65 also takes the 570/650 floor today (`buffer_space` keys on speed only), under a Case 10 label. That is the same borrowing, but outside this issue's acceptance ("every other plan stays byte-identical"). The predicate gates shoulder closures only, so lane plans don't move. Filed as a follow-up.

## R3 (R145 self-ruled): the wording names why Sheet 14 doesn't apply
- The buffer `lookup_text` says the plan has the Case 26/27 step-down but isn't on a freeway or expressway, so Sheet 14's minimum doesn't apply and the federal posted-speed value governs (Sheet 7 Case 11: buffer VARIES per General Note 24). The existing "no qualifying reduction" sentence would be false for these plans.
- The case narrative says the same instead of "does not match the Case 26/27 mandated step-down".
- `narrative_2` replaces "The generated plan follows the same device layout as the reference case …" with a disclosure (the #103 posture): S-630-1 draws no reduced-speed shoulder typical for this road class; the advance signs follow MUTCD Table 6B-1 and the buffer MUTCD Table 6B-2 at the posted speed.
- The disclosure rides only these plans, so every other plan's case section stays byte-identical.

## R4 (R145 self-ruled): one predicate, every caller passes the scenario
- `buffer_space`, `_cdot_buffer_or_none` and `_is_cdot_minimum` take keyword-only `road_type` and `closure_type`. `None` (the default) keeps the speed-only lookup for direct table calls; every `src/` call with a scenario passes both, and a sentinel test fails on one that doesn't.
