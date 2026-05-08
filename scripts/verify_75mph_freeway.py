"""75 mph expressway / freeway shoulder closure — high-speed boundary, divided.

Critical check: §6C.04(A) MUST fire and PASS, sign sides balanced,
buffer at the upper end of Table 6B-2.

Run from project root:  uv run python scripts/verify_75mph_freeway.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from _edge_verify import Expected, run_scenario

# road_type="expressway" or "freeway" — both map to 1000/1500/2640
# advance distances at 75 mph.  Pick "expressway" because the request
# specified it; the harness exercises freeway through the I-25 baseline.
run_scenario(
    scenario_name="75 mph expressway (linear, divided)",
    speed_mph=75,
    num_lanes=2,
    road_type="expressway",
    work_zone_length_ft=1500.0,
    lane_width_ft=12.0,
    shoulder_width_ft=10.0,
    is_divided=True,
    # NOTE — taper W = shoulder_width_ft (10).  Coincidentally matches
    # the lane_width_ft - 2 ft, so the user-supplied "W = 10" hand calc
    # is correct here; for the urban_low/urban_high/rural undivided
    # cases W differs from lane_width_ft.
    expected=Expected(
        L_full_ft=10 * 75,  # 750
        L_third_ft=(10 * 75) / 3,  # 250
        buffer_ft=820.0,  # Table 6B-2 max
        advance_A=1000.0,
        advance_B=1500.0,
        advance_C=2640.0,
        spacing_in_taper_ft=75.0,
        spacing_on_tangent_ft=150.0,
        # 250 ft / 75 ft = 3.33 -> floor=3 (83.33, out [67.5,82.5]),
        # ceil=4 (62.5, out).  Picker (Bug Fix 4) picks ceil -> 5 drums.
        n_taper_drums=5,
        # 1500 / 150 = 10.0 -> exact.  floor=ceil=10 intervals -> 11 cones
        # on tangent line + 2 downstream-taper cones = 13.
        n_tangent_cones_total=13,
        formula_kind="linear",
    ),
)
