# #358 rulings — near-side corner extension is not a downstream taper

Issue: https://github.com/rtmakatura/conestruct/issues/358
Branch: `issue-358-corner-not-taper`, on #356's evidence commit `f4f0c23`.

## Checkpoint (no stop reason under R145)

Repro on the base (`/render/audit`, `tests.test_lane_confidence_block._ni_body()`, near side, alongStationFt -60):

    Downstream taper: 48 ft at ~48 ft spacing -> 1 cones (MUTCD Sec 6B.08: 50-100 ft downstream taper); 9 tangent + 3 buffer + 1 downstream = 13 cones total

The layout (`src/generation/layout.py`, `generate_near_intersection` step 7) places NO downstream taper on this
plan: `near_intersection_stations(...)["extend_to_corner"]` is true, and the cones run from the work-zone end to the
upstream curb line at -48 ft at tangent spacing.

## R1 — R145 self-ruled: the corner cones get their own line
The issue offers two options: give the corner cone its own line, or fold it into the tangent count. Own line: the
cones sit past the work zone, not along it, so folding them into "tangent" would misname them too (Rule 10). The
line is `corner_count_text`; its count field is `n_corner_extension_cones`. The `downstream_count_text` and
`n_downstream_taper_cones` keys are absent on these plans (absent element, absent key). `n_cones_placed_total` stays,
so the stated total still equals the bill/XLSX count.

## R2 — R145 self-ruled: the signal is the generator's own station dict, not a placement label
The issue suggests tagging the placements. `DevicePlacement.label` is the device list's aggregation key
(`src/export/device_list.py:116`), so a label on the corner cones would split the cone row on the XLSX and quote,
which is churn outside this issue. The generator decides the corner branch from
`near_intersection_stations(...)["extend_to_corner"]` (`layout.py` step 7); the audit already computes that same dict
(`audit.py`, `ni = near_intersection_stations(...)`). Reading it keeps one producer (Rule 3), with no inference
from station signs.

## R3 — R145 self-ruled: the new line carries no source parenthetical
MUTCD 11th Ed. §6N.12.08 (p. 849) reads: "Near-side work spaces, as depicted in Figure 6P-21, are simply handled as
a midblock lane closure." It does not state the run-to-the-corner rule, so the line does not cite it. The line
states only placement facts: the length from the work-zone end to the upstream curb line and the cone count. Both
come from the layout, not from a source table (Rule 12: nothing to source).

## R4 — R145 self-ruled: counts pluralize
"1 cone", "N cones", on both the corner line and the downstream-taper line. The downstream line never prints a
count below 2 today (shoulder 2, flagger ~4), so it stays byte-identical.

## Rule 5 churn prediction (before the diff)
- Moves: near-side near_intersection audits with `extend_to_corner` true. In `sections.spacing`,
  `downstream_count_text` and `n_downstream_taper_cones` are replaced by `corner_count_text` and
  `n_corner_extension_cones`, and the last `formula_text` entry changes to the corner line. The audit PDF and the
  Streamlit panel print the corner line in place of the downstream one.
- Byte-identical: every other plan's audit (shoulder, flagger, far side, near-side midblock); the XLSX, plan sheet,
  crew narrative and quote; `result_text`; `n_cones_placed_total`; `corridor_spec`. No test snapshot or tiering
  fixture holds an extend-to-corner audit (grep: no "Downstream taper: 48" under tests/).
- The branch also carries #356's production-check evidence commit `f4f0c23` (docs only).
- Amended before that test's diff: `tests/test_formula_fields.py::_common` lists the keys that may follow the
  tangent line (`buffer_count_text`, `downstream_count_text`). Its `_near()` fixture is an extend-to-corner plan, so
  it fails once the corner key exists. The key list gains `corner_count_text`. Found by the full run (1 failed);
  missed by the first prediction, which grepped only for the 48 ft text.

## Not in scope, filed separately
`sections.corridor_spec.downstream_taper_ft` reads 48 on the same plan (`placed_downstream_taper_ft`,
`src/rules/corridor.py`), and that value also feeds the corridor geometry (`corridor_layout.py`). That's a
different file and needs a ruling on what the sidebar prints, so it's filed as its own issue: #365
(https://github.com/rtmakatura/conestruct/issues/365).
