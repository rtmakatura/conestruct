"""25 mph urban_low shoulder closure — quadratic taper, undivided.

Run from project root:  uv run python scripts/verify_25mph_urban.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from _edge_verify import Expected, run_scenario

run_scenario(
    scenario_name="25 mph urban_low (quadratic, undivided)",
    speed_mph=25,
    num_lanes=1,
    road_type="urban_low",
    work_zone_length_ft=500.0,
    lane_width_ft=11.0,
    shoulder_width_ft=6.0,
    is_divided=False,
    # NOTE — taper formula uses *shoulder width* (the lateral distance
    # being tapered), not lane width.  Original user hand-calc used 11 ft
    # lane width which produces 114.58 ft; correct value with W=6 ft
    # shoulder is 62.50 ft.
    # NOTE — undivided generator floors taper drums at min_count=4 to
    # disambiguate the upstream taper run from the downstream taper.
    expected=Expected(
        L_full_ft=6 * 25 * 25 / 60,  # 62.50 (W=shoulder=6)
        L_third_ft=(6 * 25 * 25 / 60) / 3,  # 20.83
        buffer_ft=155.0,
        advance_A=100.0,
        advance_B=100.0,
        advance_C=100.0,
        spacing_in_taper_ft=25.0,
        spacing_on_tangent_ft=50.0,
        n_taper_drums=4,  # min_count=4 floor
        n_tangent_cones_total=13,  # 11 tangent + 2 ds-taper
        formula_kind="quadratic",
    ),
)
