Draft for the chat to repost (R114 Q3: "(a) Keep today's behavior for a divided verdict on this kind, and draft the follow-up issue for the chat to repost.").

```
Title: Lane closure near an intersection on a divided road builds an undivided plan with right-side signs only; S-630-1 Note 8 requires both sides
Labels: bug, priority-medium, backend, frontend, audit-trail, p21

## Problem

The near-intersection kind (S-630-1 Sheet 10 Case 18) can't be built on a divided road, but it doesn't refuse one either. `NearIntersectionScenario._check_not_divided` (`src/api/schemas.py`) rejects `divided: true`, and the frontend hard-codes `divided: false` for the kind (`conestruct/site/lib/scenarios/auto-apply.ts`, the `near_intersection` branch's `fitLaneWidth(…, false, …)`). So a plan on a divided road is built as an undivided road with right-side mainline signs only.

#309 (R114) relays #308's carriageway facts on this kind and builds the one-way case: every mainline sign on both curbs. Its Q3 ruling kept a `divided` verdict (a one-way-tagged carriageway with a same-name twin within 100 m) on today's plan:
- the plan sheet draws a two-way road with a centerline;
- the audit narrative reads "applied to an undivided highway with single-side mainline signing";
- the Note 8 row reads "Signs on both sides of divided highway", "Required: False".

S-630-1 (July 2026) Sheet 2, General Note 8 (`validation-artifacts/committed/issue-308-oneway-read-as-divided/sources/s630-1-2026-pdf150.txt:76-80`):

> "All warning and regulatory signs shall be posted on both sides of the roadway on divided highways, multi-lane ramps, one-way streets, and as directed by the Engineer, except where only one shoulder is closed (ex: Case 11 on Sheet 7)."

A lane closure is not the single-shoulder exception. Behavior-changing to fix. It can produce non-compliant output in prod today on any divided road with a cross street, and it violates P21 and Rule 10: the audit states a road the plan isn't on and a Note 8 basis the plan doesn't meet.

## Reproduction

1. Pin Colorado Blvd at E Exposition Ave, `39.70900, -104.94070`. The repo records it as OSM way 16991616, primary, `oneway=yes`, 3 lanes, with a same-name twin at 14.8 m (`issue-308-oneway-read-as-divided/probes/twin_probe.txt`), so the verdict is `divided`.
2. Choose "Lane closure near an intersection", pick the cross street, Generate.
3. Expected: Note 8's both-sides mainline signing (median side and right side), and the plan, title and audit name a divided highway.
4. Actual: right-side signs only, a two-way drawing, and "applied to an undivided highway" in the audit. Pinned at payload level by `tests/test_r114_one_way_near_intersection.py::test_a_divided_verdict_keeps_today_s_plan`, which asserts today's 34-device plan and audit, byte for byte.

## Impact

- A permit reviewer applying Note 8 rejects the sheet, or a crew posts it as drawn.
- The audit names the wrong road type and calls the Note 8 row "Required: False".

## Options to evaluate

(a) Build the divided case as its own carriageway: the one-way geometry (each roadway of a divided highway runs one way), with the left curb read as the median side. Needs its own title ("· Divided Highway"), the Note 8 row label, the narrative, the plan sheet's median-side drawing, and an answer to the median-opening question `_check_not_divided`'s message defers.
(b) An honest 400 on a `divided` verdict for this kind, with a recovery affordance (the WHAT band's Carriageway row, or another kind), until (a) is built. Plans that render today would start refusing.
(c) Leave as is. Not recommended: it's the gap #309 closed for one-way streets.

Recommendation deferred to a design conversation.

## Acceptance

- A near-intersection plan on Colorado Blvd either posts each mainline warning and regulatory sign on both sides, with the title, audit and page 1 naming a divided highway, or is refused honestly with a recovery affordance.
- The Note 8 row never reads "Required: False" on a divided road's lane closure.
- One-way and two-way near-intersection plans unchanged (#309 R114; `test_r114_one_way_near_intersection.py`).

## Reference

- `src/api/schemas.py` (`NearIntersectionScenario._check_not_divided`; the bridge's `is_divided=False`)
- `conestruct/site/lib/scenarios/auto-apply.ts` (the `near_intersection` branch)
- `src/generation/layout.py` (`generate_near_intersection`, the #309 one-way mirror as the model)
- `validation-artifacts/committed/issue-309-oneway-near-intersection/checkpoint.md` §5 Q3; `rulings.md` R114
- Split from #309 by ruling R114 Q3 (a). Distinct from #309 (one-way streets) and #308 (the carriageway verdict itself).
- Priority-medium. A live gap on an enabled kind; not blocking.
```
