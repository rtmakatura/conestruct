# Rule 5 prediction: `issue-266-colorado-heading` (#266)

Written 2026-10-14, stacked on `issue-293-residual` (`82a1de0`, on main `40f23e6` + #321's flagger
arrow), before any change. R145 self-ruled: #266's own fix ("Read the summary's `cdot_sheet` …
one producer").

## Deliberate change

`src/rendering/audit_blocks.py`, `_colorado_blocks`: the audit PDF's Colorado heading reads the
audit summary's `cdot_sheet` ("Colorado Requirements (CDOT {cdot_sheet})") instead of the literal
"S-630-1". With no `cdot_sheet` it reads "Colorado Requirements" alone (Rule 10: no sheet
invented).

## Predicted outcome

- The live kinds (shoulder, flagger, near-intersection) all carry `cdot_sheet: "S-630-1"`: their
  audit PDFs are unchanged, byte for byte in the blocks.
- The gated divided lane-closure kinds (`lane_closure_divided`, `mobile_op_multilane`: S-630-3)
  now print "CDOT S-630-3", agreeing with the plan sheet and the screen.
- No snapshot changes (the audit JSON is untouched; this is PDF rendering only).
