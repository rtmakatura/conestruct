# #333 outcome (after code)

## Matches the prediction
- **The helper.** `layout.buffer_cone_stations` places `ceil(buffer / 2S) − 1` interior lane-edge cones in both shoulder generators. On every speed from 25 to 75 mph, divided and undivided, no gap from the work zone's downstream end to the taper exceeds 2S (`tests/test_buffer_cones_333.py`).
- **Counts.**

  | Plan | Buffer cones | Cones total |
  |---|---|---|
  | N Broadway 30 mph | 3 | 10 |
  | Ogden 25 mph, 50 ft zone | 3 | 7 |
  | US 24 65 mph | 4 | 19 |

  The verify scripts move by exactly that: +3 at 25, 35 and 45 mph, +5 at 75 mph.
- **Every surface agrees.** Rendered locally with `render333.py`; images are in `after/`, with "before" being the production audit's page 1 in `validation-artifacts/committed/audit-shoulder/runs/<row>/page1.png`.

  | Surface | What it shows |
  |---|---|
  | Page 1 device summary | the new cone count |
  | Device XLSX | the same count |
  | Quote | the same count |
  | Audit | `buffer_count_text`, plus "T tangent + B buffer + D downstream = N cones total" |
  | Audit PDF | the buffer line, in `audit_blocks.py` |
  | Crew step 3 | "Then continue the line through the buffer space: N more traffic cones at S ft spacing … (CDOT S-630-1 Sheet 2 General Note 18b …)" |
  | Page 1 label | "BUFFER = N ft (NTS) · K CONES"; no cone drawn inside the compressed buffer |

- **Parity against #332's tip** (107 scenarios, 963 responses):
  - **Shoulder:** 57 of 62 changed. The 5 unchanged are refusals (`boundary_*`), which build no plan.
  - **Flagger:** 0 of 38 changed.
  - **Near-intersection:** 0 of 7 changed.
- **Snapshots regenerated** through `tests._snapshot_helper.write_snapshot` (`regen333.py`): 7 audit baselines and 43 grid files. In all 50, the only changed lines are the spacing section's cone fields: `n_buffer_cones`, `buffer_count_text`, `buffer_cone_spacing_ft`, and the "+ N buffer +" term with its totals. The flagger grid snapshots have no content change.

## One change the prediction didn't list
- **Page 1's dimension-label anchoring.** The longer buffer label put "BUFFER" past the page margin on the `adv-shoulder` fixture (containment edge 1).
- **The fix.** The greedy label path now hangs a raised label from its leader toward the page ("left"/"right" anchor, #330's `_draw_anchored`) when it would cross a margin centred. Labels that fit keep "center" and are unchanged.
- **Result.** Containment is back to 0/0/0 on every fixture, and `test_page1_channelizers` passes.
- **Also touched.** The Streamlit panel (`src/api/app.py`) prints the buffer line, as it prints the tangent one.

## A test flake fixed in passing
`tests/test_quote_default_rates_324.py::test_without_the_flag_the_quote_is_unchanged` (from #324) compared two quote workbooks cell by cell, including the "Generated" timestamp. It failed once in the full run, when the two requests straddled a second, and passed alone. The comparison now leaves out timestamp cells. No product code changed.

## Left as is (noted for Ryan)
- **Lane closures** (`layout.py` `generate_lane_closure_divided`) and the **flagger** layout carry the same "buffer is device-empty" convention. S-630-1 Note 18b reads the same for their buffers. That's outside #333's shoulder scope, so it's a candidate follow-up issue.
- **`crew_narrative.md`** at the repo root is an old carry-over sample. Its header already doesn't match today's output, and no test reads it, so it isn't regenerated here.
