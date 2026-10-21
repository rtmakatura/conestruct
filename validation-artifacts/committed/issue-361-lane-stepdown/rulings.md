# #361 rulings — lane closures and the crew sheet stop borrowing Sheet 14

Base: #365's evidence branch `issue-365-prod-check` (`e35d1ce`), which ships with this fix.

## Finding: the lane half can't be reached through the API today
- Only the `shoulder` kind carries `workZoneSpeed` (`src/api/schemas.py:580`, passed through at `:1536`). The flagger and near-intersection kinds cap at 55 mph (`:708`, `:953`), and `lane_closure_divided` (gated) has no work-zone speed field. The issue's repro step 1 (POST a 65 → 60 lane closure) can't be posted.
- The defect is still real where it lives: `buffer_space` / `_is_cdot_minimum` gave a lane `ScenarioParams` at 65 → 60 the 570 ft floor and a Sheet 14 source. It's fixed and tested at the producer level (`tests/s630/test_lane_stepdown_361.py`, Rule 11: the real generator, audit and crew-sheet producers), so it can't ship once a lane kind gains a work-zone speed.
- The crew-sheet half is live: every shoulder plan at 65/75 with a reduction that isn't the Case 26/27 step-down (65 → 55, 75 → 70, …) printed Sheet 14's trigger while its audit set none.

## R1 (R145 self-ruled): a lane closure takes MUTCD Table 6B-2 at the posted speed
- `sheet_14_road_class` returns False for `closure_type == "lane"`. A lane closure at 65 → 60 / 75 → 65 takes 645 / 820 ft (MUTCD 11th Ed. Table 6B-2, already in `BUFFER_SPACE`) and the advisory 10% validator tolerance, as every other lane plan does.
- Why it fits existing rules: this is #355 R1's ruling applied to the closure axis. Sheet 14's only titles are "Shoulder Work - Freeway/Expressway", so a lane closure is a plan it doesn't draw (Rule 10, Rule 12). The value is sourced and longer, so no safety value goes down. It is the issue's own recommendation. #355 R2 deferred lane closures to this issue.
- A call with no closure type (`None`) keeps the speed-only lookup, as before.

## R2 (R145 self-ruled): the crew sheet's trigger uses the audit's predicate
- `crew_narrative.py` prints the Sheet 14 trigger iff `_is_cdot_minimum(jurisdiction, speed, wz, road_type, closure_type)`, the predicate behind the audit's `is_supplement_case`. The audit sets `trigger_condition` only in the shoulder Case 26/27 branch. Near-intersection and flagger plans are lane closures, which R1 now excludes, so the two surfaces agree on every plan.
- Also drops the trigger on a federal-jurisdiction 65 → 60 crew sheet (direct calls only; the form path is CDOT), where the audit never set it.

## R3 (R145 self-ruled): the lane buffer wording
- The buffer `lookup_text` says Sheet 14 posts the minimum for the step-down, "but Sheet 14 is drawn for shoulder work on a freeway or expressway and this plan closes a lane, so the federal posted-speed value governs." The source cites MUTCD Table 6B-2 alone. The shoulder branch's "Sheet 7 Case 11 (buffer VARIES per General Note 24)" is left out, because Case 11 is a shoulder case and nothing in the repo sources a General Note 24 reading for lane closures.
- The lane case section (the Case 10 label) is unchanged; it never named Sheet 14.

## Follow-up (filed, not folded)
- A plain CDOT lane closure at 65/75 mph (no step-down) reads "… (Sheet 7 Case 11: buffer VARIES per General Note 24)" in its buffer lookup and source. That's the same Case 11-on-a-lane citation R3 avoids. It's unreachable today (no live lane kind reaches 65 mph), and it moves plans outside this issue's churn prediction, so it's filed as #367 (https://github.com/rtmakatura/conestruct/issues/367).

## Proof
- `byte-identity-diff.txt`: `snapshot.py` over 10 live plans × audit JSON, crew markdown and PDF text, base vs. fix. Only the three predicted crew sheets move (freeway 65 → 55, freeway 75 → 70, rural_divided 65 → 55), and only by losing the "## Trigger Condition" section. Case 26/27, Case 11, the #355 off-class step-down and the flagger plans are byte-identical.
- `tests/s630/test_lane_stepdown_361.py`: 17 tests; on the base, 11 fail and 6 pass (the 6 are plans whose surfaces already agreed).
