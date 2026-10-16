"""Shoulder-work audit oracle: values copied by hand from the sources.

Every number here is quoted, with its page, in oracle-sources.md (O1-O16),
and was checked against the page by an independent agent (oracle-check.md).
This module imports nothing from src/, so the audit never checks the code
against itself.
"""

from __future__ import annotations

# O3: MUTCD Table 6B-1, p. 773; S-630-1 Sheet 4 key.  (A, B, C) in feet.
ADVANCE = {
    "urban_low": (100, 100, 100),
    "urban_high": (350, 350, 350),
    "rural": (500, 500, 500),
    "freeway": (1000, 1500, 2640),
}
CDOT_URBAN_HIGH_FROM_MPH = 45  # S-630-1 Sheet 4: URBAN (<= 40 MPH) / URBAN (>= 45 MPH)
LAKEWOOD_URBAN_HIGH_FROM_MPH = 35  # data/jurisdictions/lakewood.json (02-JURISDICTION-DATA missing)

# O5: MUTCD Table 6B-2, p. 775 (mph -> ft).
BUFFER = {20: 115, 25: 155, 30: 200, 35: 250, 40: 305, 45: 360, 50: 425,
          55: 495, 60: 570, 65: 645, 70: 730, 75: 820}
# O5: S-630-1 Sheet 14 minimums by posted speed (Case 26: 65 mph; Case 27: 75 mph).
CDOT_FREEWAY_BUFFER_MIN = {65: 570, 75: 650}


def taper_L(width_ft: float, speed_mph: int) -> float:
    """O1: MUTCD Table 6B-4, p. 775."""
    if speed_mph <= 40:
        return width_ft * speed_mph ** 2 / 60
    return width_ft * speed_mph


def shoulder_taper_min(width_ft: float, speed_mph: int) -> float:
    """O2: Table 6B-3, p. 775: shoulder taper at least 0.33 L (about 1/3 L)."""
    return taper_L(width_ft, speed_mph) / 3


def category(road_type: str, speed_mph: int, urban_high_from: int = CDOT_URBAN_HIGH_FROM_MPH) -> str:
    """O3: the Table 6B-1 row for a road.  `road_type` is the scenario's."""
    if road_type == "freeway":
        return "freeway"
    if road_type.startswith("rural"):
        return "rural"
    return "urban_high" if speed_mph >= urban_high_from else "urban_low"


def buffer_min(speed_mph: int) -> int:
    """O5: Table 6B-2 at the given speed (rounded up to the table's 5 mph grid)."""
    s = min(75, max(20, 5 * -(-speed_mph // 5)))
    return BUFFER[s]


def taper_spacing_max(speed_mph: int) -> float:
    """O6: MUTCD §6K.01 ¶04, p. 815; S-630-1 Note 18a."""
    return 1.0 * speed_mph


def tangent_spacing_max(speed_mph: int) -> float:
    """O6: MUTCD §6K.01 ¶04, p. 815; S-630-1 Note 18b (buffer space or work area)."""
    return 2.0 * speed_mph


# O16: S-630-1 Sheet 7, Case No. 11 (freeway shoulder work): distance from the
# shoulder taper to W5-1, the first W21-5aR (with W7-3a) and the second
# W21-5aR (with W16-2a "1500 FT").
CASE11_FROM_TAPER = (("W5-1", 500), ("W21-5aR", 1000), ("W21-5aR", 2000), ("W20-1", 5200))

DOWNSTREAM_TAPER_FT = (50, 100)  # O7: §6B.08 ¶12, p. 776
CONE_MIN_IN_NIGHT_OR_FREEWAY = 36  # O13: S-630-1 Note 15
TYPE1_BARRICADE_BANNED_FROM_MPH = 55  # O14: S-630-1 Note 16
