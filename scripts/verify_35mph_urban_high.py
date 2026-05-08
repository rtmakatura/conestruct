"""35 mph urban_high shoulder closure — quadratic taper just below 40 mph cutoff,
undivided.

Critical check: urban_high A=B=C=350 (NOT rural's 500), §6C.04(A) skipped.

Run from project root:  uv run python scripts/verify_35mph_urban_high.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from _edge_verify import Expected, run_scenario

run_scenario(
    scenario_name="35 mph urban_high (quadratic, undivided)",
    speed_mph=35,
    num_lanes=2,
    road_type="urban_high",
    work_zone_length_ft=600.0,
    lane_width_ft=11.0,
    shoulder_width_ft=6.0,
    is_divided=False,
    # NOTE — taper W = shoulder_width_ft (6), not lane_width_ft (11).
    # NOTE — undivided generator: pick_device_count(min_count=4).
    # 40.83 / 35 = 1.17 -> floor=1 (40.83, out [31.5,38.5]); ceil=1 (40.83, out).
    # ceil intervals = 1 -> max(4, 2) = 4 drums (min_count floor binds).
    expected=Expected(
        L_full_ft=6 * 35 * 35 / 60,  # 122.50
        L_third_ft=(6 * 35 * 35 / 60) / 3,  # 40.83
        buffer_ft=250.0,
        advance_A=350.0,
        advance_B=350.0,
        advance_C=350.0,
        spacing_in_taper_ft=35.0,
        spacing_on_tangent_ft=70.0,
        n_taper_drums=4,  # min_count floor binds
        # 600 / 70 = 8.57 -> floor=8 (75, in [63,77]); ceil=9 (66.67, in).
        # both in -> smaller dev wins -> ceil (66.67, dev=3.33) over floor (75, dev=5).
        # 9 intervals -> 10 cones on tangent + 2 ds-taper = 12.
        n_tangent_cones_total=12,
        formula_kind="quadratic",
    ),
)
