"""MUTCD Part 6 lookup tables and Colorado Supplement constants.

Encodes the raw reference data that the spacing/layout engines consume.
No calculation logic lives here — only named constants, typed table rows,
and lookup structures.

Authoritative sources:
  - MUTCD 11th Edition, Part 6 (Temporary Traffic Control)
    * Table 6B-1: Suggested Advance Warning Sign Spacing
    * Table 6C-2: Longitudinal Buffer Space
    * Section 6C.08: Tapers
    * Section 6C.09: Channelizing Device Spacing
  - Colorado Supplement to MUTCD (effective 2026-01-18)
  - CDOT Standard Plan S-630-1 (19-page set, 2019; revised 01/14/26)
"""

from __future__ import annotations

from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Taper length formula threshold
# ---------------------------------------------------------------------------

# Source: MUTCD 11th Ed. §6C.08
# Below this speed:    L = W × S² / 60
# At or above this:    L = W × S
TAPER_LENGTH_FORMULA_THRESHOLD_MPH: int = 40

# ---------------------------------------------------------------------------
# Shifting taper ratio
# ---------------------------------------------------------------------------

# Source: MUTCD 11th Ed. §6C.08 — shifting taper length = L / 2
SHIFTING_TAPER_RATIO: float = 0.5

# ---------------------------------------------------------------------------
# Downstream taper
# ---------------------------------------------------------------------------

# Source: MUTCD 11th Ed. §6C.08 — downstream taper is 50–100 ft per lane
DOWNSTREAM_TAPER_LENGTH_PER_LANE_FT: tuple[int, int] = (50, 100)

# ---------------------------------------------------------------------------
# Advance warning sign spacing — MUTCD Table 6B-1
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AdvanceWarningRow:
    """One row from MUTCD Table 6B-1.

    Distances A, B, C are measured upstream from the first sign in the
    transition area.  A is closest to the work zone, C is farthest.
    All distances in feet.
    """

    road_category: str
    speed_min_mph: int  # inclusive lower bound
    speed_max_mph: int  # inclusive upper bound
    a_ft: int  # distance from transition area to Sign A
    b_ft: int  # distance from Sign A to Sign B
    c_ft: int | None  # distance from Sign B to Sign C (None if C not used)


# Source: MUTCD 11th Ed. Table 6B-1 (verified 2026-04-24)
# Note: expressway and freeway rows have asymmetric A/B/C distances.
# Speed ranges define typical applicability; road category is selected
# by the scenario, not by speed alone.
ADVANCE_WARNING_SIGN_SPACING: tuple[AdvanceWarningRow, ...] = (
    AdvanceWarningRow(
        road_category="urban_low",
        speed_min_mph=20,
        speed_max_mph=35,
        a_ft=100,
        b_ft=100,
        c_ft=100,
    ),
    AdvanceWarningRow(
        road_category="urban_high",
        speed_min_mph=40,
        speed_max_mph=55,
        a_ft=350,
        b_ft=350,
        c_ft=350,
    ),
    AdvanceWarningRow(
        road_category="rural",
        speed_min_mph=45,
        speed_max_mph=75,
        a_ft=500,
        b_ft=500,
        c_ft=500,
    ),
    AdvanceWarningRow(
        road_category="expressway",
        speed_min_mph=45,
        speed_max_mph=75,
        a_ft=1000,
        b_ft=1500,
        c_ft=2640,
    ),
    AdvanceWarningRow(
        road_category="freeway",
        speed_min_mph=55,
        speed_max_mph=75,
        a_ft=1000,
        b_ft=1500,
        c_ft=2640,
    ),
)

# ---------------------------------------------------------------------------
# Buffer space — MUTCD Table 6C-2 (federal) + CDOT Supplement (Sheet 14)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BufferSpaceRow:
    """One row of a longitudinal buffer space table.

    Used for both the federal MUTCD Table 6C-2 baseline (``BUFFER_SPACE``)
    and the CDOT supplement minimums (``CDOT_BUFFER_SPACE``).  Buffer is
    measured between the downstream end of the merging taper and the
    upstream end of the work space, keyed to posted speed.
    """

    speed_mph: int
    buffer_ft: int | None  # None = value needs verification against source


# Source: MUTCD 11th Ed. Table 6C-2 (verified 2026-04-24 via
# ATSSA MUTCD Flagger Reference Chart).  Federal baseline — used when
# jurisdiction="federal" and as the silent-speed fallback for
# jurisdiction="CDOT".
BUFFER_SPACE: tuple[BufferSpaceRow, ...] = (
    BufferSpaceRow(speed_mph=20, buffer_ft=115),
    BufferSpaceRow(speed_mph=25, buffer_ft=155),
    BufferSpaceRow(speed_mph=30, buffer_ft=200),
    BufferSpaceRow(speed_mph=35, buffer_ft=250),
    BufferSpaceRow(speed_mph=40, buffer_ft=305),
    BufferSpaceRow(speed_mph=45, buffer_ft=360),
    BufferSpaceRow(speed_mph=50, buffer_ft=425),
    BufferSpaceRow(speed_mph=55, buffer_ft=495),
    BufferSpaceRow(speed_mph=60, buffer_ft=570),
    BufferSpaceRow(speed_mph=65, buffer_ft=645),
    BufferSpaceRow(speed_mph=70, buffer_ft=730),
    BufferSpaceRow(speed_mph=75, buffer_ft=820),
)

# Source: CDOT Standard Plan S-630-1, Sheet 14 (Cases 26 at 65 mph and
# 27 at 75 mph) — the only two typical applications that post a specific
# minimum buffer.  Other cases label buffer "VAR. BUFFER SPACE (SEE
# GENERAL NOTE 23 ON SHEET 2)", deferring to project-specific
# engineering judgment.  Sheet 2 General Note 23 verbatim: "BUFFER SPACE
# IS OPTIONAL. NEED MUST BE DETERMINED ON A PROJECT OR SITE SPECIFIC
# BASIS AS DIRECTED BY THE ENGINEER..."
#
# Values are regulatory minimums (the "MIN" annotation on diagrams), not
# recommendations — validators enforce them as hard floors via
# ``_is_cdot_minimum``.  At silent speeds, ``buffer_space`` falls back
# to the federal ``BUFFER_SPACE`` table as the baseline.
CDOT_BUFFER_SPACE: tuple[BufferSpaceRow, ...] = (
    BufferSpaceRow(speed_mph=65, buffer_ft=570),
    BufferSpaceRow(speed_mph=75, buffer_ft=650),
)

# ---------------------------------------------------------------------------
# Channelizing device spacing — MUTCD §6C.09
# ---------------------------------------------------------------------------

# Source: MUTCD 11th Ed. §6C.09
# In a taper: maximum device spacing (ft) = posted speed (mph)
# On tangent through work zone: spacing = 2 × taper spacing


def in_taper_spacing_ft(speed_mph: int) -> int:
    """Maximum channelizing device spacing inside a taper, in feet.

    Source: MUTCD 11th Ed. §6C.09 — spacing equals the posted speed
    limit expressed in feet (e.g., 55 mph → 55 ft).
    """
    return speed_mph


def on_tangent_spacing_ft(speed_mph: int) -> int:
    """Maximum channelizing device spacing on tangent sections, in feet.

    Source: MUTCD 11th Ed. §6C.09 — tangent spacing is twice the
    taper spacing.
    """
    return 2 * speed_mph


# ---------------------------------------------------------------------------
# Colorado Supplement overrides
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ColoradoOverrides:
    """Colorado-specific constants that override or supplement federal MUTCD.

    Each field has a source comment in the class body.  Where a value
    could not be confirmed, it is set to None with a TODO.
    """

    # Source: CO Supplement §2B.13(A) — speed limit reduction in construction
    # zones shall not exceed 15 mph per posted advance sign.
    max_speed_reduction_per_sign_mph: int = 15

    # Source: CO Supplement §6C.06(A) — "CONSTRUCTION ZONE" plaque (G20-4a)
    # shall be placed at ½-mile intervals within long work zones.
    construction_zone_plaque_interval_ft: int = 2640  # ½ mile = 2640 ft

    # Source: CO Supplement §6E.02(A) — flagger stations on CDOT projects
    # require a minimum 500-watt light plant during nighttime operations.
    flagger_station_light_watts: int = 500

    # Source: CO Supplement §6E.02(A) — light plant mounting height.
    flagger_station_light_height_ft: int = 8

    # Source: CO Supplement §6G.02(A) — mobile operations on roads with
    # AADT ≥ 2,000 require a shadow vehicle with TMA.
    mobile_operation_aadt_threshold: int = 2000

    # Source: CO Supplement §4D.01 — horizontal signal face orientation
    # is permitted only for bicycle signal faces in Colorado.
    horizontal_signal_faces_allowed: bool = False

    # Source: CO Supplement §6C.04(A) — advance warning signs must be
    # placed on both sides of the roadway on these road types.
    # Divided highways are covered separately by ``ScenarioParams.is_divided``
    # and are not listed here (divided-ness is not a road_type).
    both_sides_signage_required_on: tuple[str, ...] = (
        "multi_lane_ramp",
        "one_way_street",
    )


# Singleton instance for import convenience.
COLORADO_OVERRIDES: ColoradoOverrides = ColoradoOverrides()
