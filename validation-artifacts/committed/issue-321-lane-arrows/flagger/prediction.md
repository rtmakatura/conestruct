# Rule 5 prediction: `issue-321-flagger-arrow` (#321, ruled (b))

Written 2026-10-14, off main `40f23e6`, before any change.

Ryan, 2026-10-14, verbatim: "#321 flagger work-side arrow: (b). Draw it in the open lane beside the
opposing arrow, since both directions take turns in that lane on a flagger plan. Close #321 after
it ships."

## Deliberate change

Flagger plans only (the `closure_type == "lane" and num_lanes == 1` branch, the one kind whose
work-side lane is closed where the arrows are drawn): both arrows sit in the one open lane (the
opposing lane, offsets 0 to -W), the work-side arrow (pointing right) at 30 % of the lane from the
centerline and the opposing arrow (pointing left) at 70 %, 0.4 W apart (15.4 pt at 11 ft). The
pre-#321 margin placement and its #314 (R136) sidewalk-band offset are deleted.

## Predicted outcome

- Flagger page 1: two arrows, both inside the open lane, opposite directions, neither in the
  margin, the closed lane or a shoulder.
- Every other plan pixel-identical to `40f23e6` (two-way, divided, near-intersection, one-way).
- Page-1 drawing only; no snapshot changes.
