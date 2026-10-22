"""Lane-closure audit oracle: values copied by hand from the sources.

Every number here is quoted, with its page, in oracle-sources.md (L1-L20),
and was checked against the page by an independent agent (oracle-check.md).
This module imports nothing from src/ or audit-shoulder/, so the audit never
checks the code against itself (rulings.md R2).
"""

from __future__ import annotations

# L5: MUTCD Table 6B-1, p. 773; S-630-1 Sheet 9 key.  (A, B, C) in feet.
ADVANCE = {
    "urban_low": (100, 100, 100),
    "urban_high": (350, 350, 350),
    "rural": (500, 500, 500),
    "freeway": (1000, 1500, 2640),
}
CDOT_URBAN_HIGH_FROM_MPH = 45  # S-630-1 Sheet 9 key: URBAN (<= 40 MPH) / URBAN (>= 45 MPH)
# data/jurisdictions/lakewood.json; INFO only (02-JURISDICTION-DATA missing)
LAKEWOOD_URBAN_HIGH_FROM_MPH = 35

# L9: MUTCD Table 6B-2, p. 775 (mph -> ft).  Also §6D.06 ¶03's flagger option (L7).
BUFFER = {20: 115, 25: 155, 30: 200, 35: 250, 40: 305, 45: 360, 50: 425,
          55: 495, 60: 570, 65: 645, 70: 730, 75: 820}

ONE_LANE_TWO_WAY_TAPER_FT = (50, 100)  # L3: Table 6B-3, p. 775; §6B.08 ¶14, p. 776; Sheet 9
DOWNSTREAM_TAPER_FT = (50, 100)  # L4: Table 6B-3, p. 775; §6B.08 ¶12, p. 776 (not "per lane")
SHORT_TAPER_DEVICE_SPACING_FT = 20  # L3/L4: "approximately 20-foot spacing"
OPPOSITE_FLAGGER_PAST_WORK_FT = (200, 300)  # L7: S-630-1 Sheet 9, Case 17 (drawing dimension)
PILOT_TURNAROUND_FT = (200, 300)  # L17: S-630-1 Sheet 25, Case 42
# L15: Sheet 10, Case 18, the southbound approach (work area past the intersection)
CASE18_TAPER_TO_INTERSECTION_FT = 100

# L6: Fig 6P-10 p. 879 / Case 17 Sheet 9, upstream -> downstream on each approach.
FLAGGER_SERIES = ("W20-1", "W20-4", "W20-7")
# W3-4: notes 4 and 8 (between W20-7 and W20-4); the others are labelled "(optional)"
FLAGGER_OPTIONAL = ("W3-4", "W16-2P", "G20-2")
# L15: Case 18 Sheet 10 / Fig 6P-22 p. 903, the closed approach (side letter per closed lane).
NEAR_INTERSECTION_SERIES = ("W20-1", "W20-5", "W4-2")
PILOT_CAR_SIGN = "G20-4"  # L17: §6E.04 ¶03, p. 787

DRUM_MIN_HEIGHT_IN = 36  # L11: §6K.06 ¶01, p. 820
CONE_MIN_IN_NIGHT_OR_FREEWAY = 36  # L12: S-630-1 Note 15
TYPE1_BARRICADE_BANNED_FROM_MPH = 55  # L13: S-630-1 Note 16


def taper_L(width_ft: float, speed_mph: int) -> float:
    """L1: MUTCD Table 6B-4, p. 775."""
    if speed_mph <= 40:
        return width_ft * speed_mph ** 2 / 60
    return width_ft * speed_mph


def merging_taper_min(width_ft: float, speed_mph: int) -> float:
    """L2: Table 6B-3, p. 775: merging taper at least L."""
    return taper_L(width_ft, speed_mph)


def category(road_type: str, speed_mph: int,
             urban_high_from: int = CDOT_URBAN_HIGH_FROM_MPH) -> str:
    """L5: the Table 6B-1 row for a road.  `road_type` is the scenario's."""
    if road_type == "freeway":
        return "freeway"
    if road_type.startswith("rural"):
        return "rural"
    return "urban_high" if speed_mph >= urban_high_from else "urban_low"


def buffer_min(speed_mph: int) -> int:
    """L9: Table 6B-2 at the given speed.

    Rounding up to the table's 5 mph grid and clamping to 20-75 mph is CHOSEN
    (Rule 12); the table gives only its rows.
    """
    s = min(75, max(20, 5 * -(-speed_mph // 5)))
    return BUFFER[s]


def taper_spacing_max(speed_mph: int) -> float:
    """L10: MUTCD §6K.01 ¶04, p. 815; S-630-1 Note 18a."""
    return 1.0 * speed_mph


def tangent_spacing_max(speed_mph: int) -> float:
    """L10: MUTCD §6K.01 ¶04, p. 815; S-630-1 Note 18b (buffer space or work area)."""
    return 2.0 * speed_mph


def arrow_board_mode_ok(kind: str, mode: str | None) -> bool:
    """L14: §6L.06 ¶17-18, p. 833; Note 26.  Flagger (two-lane two-way): caution only."""
    if mode is None:
        return True
    if kind == "flagger_lane_closure":
        return mode == "caution"
    return True
