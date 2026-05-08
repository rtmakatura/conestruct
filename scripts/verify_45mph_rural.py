"""45 mph rural shoulder closure — linear taper, undivided.

Critical check: §6C.04(A) must NOT fire (is_divided=False), all signs
right-side only, sign count roughly half of the divided variant.

Run from project root:  uv run python scripts/verify_45mph_rural.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from _edge_verify import Expected, run_scenario

run_scenario(
    scenario_name="45 mph rural (linear, undivided)",
    speed_mph=45,
    num_lanes=1,
    road_type="rural",
    work_zone_length_ft=800.0,
    lane_width_ft=11.0,
    shoulder_width_ft=8.0,
    is_divided=False,
    # NOTE — taper W = shoulder_width_ft (8 ft), not lane_width_ft (11 ft).
    # NOTE — undivided generator: pick_device_count(min_count=4).
    # 120 / 45 = 2.67 -> floor=2 (60 ft, out [40.5,49.5]); ceil=3 (40 ft,
    # out).  Both out -> ceil wins -> 3 intervals -> max(4, 4) = 4 drums.
    expected=Expected(
        L_full_ft=8 * 45,  # 360 (W=shoulder=8)
        L_third_ft=(8 * 45) / 3,  # 120
        buffer_ft=360.0,
        advance_A=500.0,
        advance_B=500.0,
        advance_C=500.0,
        spacing_in_taper_ft=45.0,
        spacing_on_tangent_ft=90.0,
        n_taper_drums=4,  # min_count floor; 3 intervals @ 40 ft
        n_tangent_cones_total=12,  # 10 tangent + 2 ds-taper
        formula_kind="linear",
    ),
)
