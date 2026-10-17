# #338 Rule 5 churn prediction (written before the full suite ran)

## Changes, deliberately
| Surface | Plans | Change |
|---|---|---|
| Page 1 PDF, PARAMETERS | every `closure_type == "shoulder"` plan (undivided, divided, one-way, divided carriageway, left shoulder, reduced-speed variants) | Gains "Shoulder width: N ft (assumed)" at row 2, column 2. "Shoulder taper (L/3)" moves to row 3, column 1 and "Buffer" to row 3, column 2. Still 6 cells in 3 grid lines, so the panel height and everything below it stay where they were. |
| Audit JSON `pending_verification` | undivided and divided shoulder plans (not one-way, not divided carriageway) | +1 item `shoulder_width_assumed`, so `count` goes up by 1. `sections.case` is unchanged (the marker is popped). |
| Audit PDF | the same plans | The pending block prints the new item, and the tier ledger gains one ◌ pending fact. |
| /sandbox results (AuditTrail, tiering) | the same plans | "Verification status" shows one more reference pending, and the tier ledger gains one pending fact. |
| Tests | `tests/test_oneway_street_audit.py::test_a_two_way_plan_carries_none_of_it` | Asserted 0 pending on a two-way plan. Now it asserts the one item is `shoulder_width_assumed`. Any other test that pins a two-way or divided shoulder plan's pending count or page-1 parameter text moves the same way. |

## Byte-identical
- Every non-shoulder plan (lane, flagger, mobile, near-intersection, work beyond shoulder) on every surface.
- One-way-street and divided-carriageway shoulder plans' audit JSON and audit PDF (R88's item already discloses the width).
- Crew sheet (markdown and PDF), XLSX and device breakdown for every plan. None of them print `pending_verification` or the PARAMETERS block.
- Geometry, placements, taper length and every number on page 2.
