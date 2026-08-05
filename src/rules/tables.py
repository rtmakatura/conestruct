"""MUTCD Part 6 lookup tables and Colorado (CDOT) constants.

Encodes the raw reference data that the spacing/layout engines consume.
No calculation logic lives here — only named constants, typed table rows,
and lookup structures.

Authoritative sources:
  - MUTCD 11th Edition, Part 6 (Temporary Traffic Control)
    * Table 6B-1: Suggested Advance Warning Sign Spacing
    * Table 6B-2: Longitudinal Buffer Space
    * Section 6B.08: Tapers
    * Section 6K.01: Channelizing Device Spacing
  - Colorado Supplement to MUTCD (effective 2026-01-18)
  - CDOT Standard Plan S-630-1 (26 sheets, issued July 1, 2026)
"""

from __future__ import annotations

from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Taper length formula threshold
# ---------------------------------------------------------------------------

# Source: MUTCD 11th Ed. §6B.08
# Below this speed:    L = W × S² / 60
# At or above this:    L = W × S
TAPER_LENGTH_FORMULA_THRESHOLD_MPH: int = 45

# ---------------------------------------------------------------------------
# Shifting taper ratio
# ---------------------------------------------------------------------------

# Source: MUTCD 11th Ed. §6B.08 — shifting taper length = L / 2
SHIFTING_TAPER_RATIO: float = 0.5

# ---------------------------------------------------------------------------
# Downstream taper
# ---------------------------------------------------------------------------

# Source: MUTCD 11th Ed. §6B.08 — downstream taper is 50–100 ft per lane
DOWNSTREAM_TAPER_LENGTH_PER_LANE_FT: tuple[int, int] = (50, 100)

# ---------------------------------------------------------------------------
# One-lane, two-way traffic taper (flagger-controlled alternating flow)
# ---------------------------------------------------------------------------

# Source: MUTCD 11th Ed. §6B.08 ¶14 (Guidance) — "A taper having a
# minimum length of 50 feet and a maximum length of 100 feet with
# channelizing devices at approximately 20-foot spacing should be used
# to guide traffic into the one-lane section."  This taper is
# deliberately short: it positions stopped traffic behind the flagger,
# it does NOT merge moving traffic.  CDOT S-630-1 Case 17 (Sheet 9)
# carries the warning "THIS TAPER MUST BE SHORT ENOUGH TO NOT BE
# MISTAKEN FOR A TRANSITION."  Conestruct uses the 100 ft maximum of
# the band (best driver visibility; six devices at the prescribed
# spacing) — fixtures: tests/fixtures/ta10_flagger/.
ONE_LANE_TWO_WAY_TAPER_LENGTH_FT: tuple[int, int] = (50, 100)
ONE_LANE_TWO_WAY_DEVICE_SPACING_FT: float = 20.0

# Flagger-station positions (TA-10 corrected geometry, PR 2):
#   * Approach flagger stands 50–100 ft upstream of the one-lane
#     two-way taper start (MUTCD Fig. 6P-10 dimension); Conestruct uses
#     the 100 ft maximum.
#   * Opposing flagger stands 200–300 ft from the work-area end (CDOT
#     S-630-1 Case 17 "200' TO 300'"; Case 42 reuses the value as the
#     pilot-car turnaround space).  Conestruct uses the 300 ft maximum.
FLAGGER_TO_TAPER_FT: tuple[int, int] = (50, 100)
OPPOSING_FLAGGER_STANDOFF_FT: tuple[int, int] = (200, 300)

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


# Source: MUTCD 11th Ed. Table 6B-1, p. 773 (verified 2026-07-07)
# Note: expressway and freeway rows have asymmetric A/B/C distances.
# Speed ranges define typical applicability; road category is selected
# by the scenario, not by speed alone.  The federal table carries no
# speed numbers for the urban split — its footnote delegates the
# low/high determination to the highway agency.  Colorado's is on
# CDOT S-630-1: URBAN (<=40 MPH) -> 100 ft, URBAN (>=45 MPH) -> 350 ft,
# so 40 mph is urban_low (matches _map_road_type's ``speed > 40``).
ADVANCE_WARNING_SIGN_SPACING: tuple[AdvanceWarningRow, ...] = (
    AdvanceWarningRow(
        road_category="urban_low",
        speed_min_mph=20,
        speed_max_mph=40,
        a_ft=100,
        b_ft=100,
        c_ft=100,
    ),
    AdvanceWarningRow(
        road_category="urban_high",
        speed_min_mph=45,
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
# Buffer space — MUTCD Table 6B-2 (federal) + CDOT Supplement (Sheet 14)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BufferSpaceRow:
    """One row of a longitudinal buffer space table.

    Used for both the federal MUTCD Table 6B-2 baseline (``BUFFER_SPACE``)
    and the CDOT supplement minimums (``CDOT_BUFFER_SPACE``).  Buffer is
    measured between the downstream end of the merging taper and the
    upstream end of the work space, keyed to posted speed.
    """

    speed_mph: int
    buffer_ft: int | None  # None = value needs verification against source


# Source: MUTCD 11th Ed. Table 6B-2 (verified 2026-04-24 via
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
# GENERAL NOTE 24 ON SHEET 2)", deferring to project-specific
# engineering judgment.  Sheet 2 General Note 24 verbatim: "BUFFER SPACE
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

# The CDOT supplement buffer minimums above are NOT unconditional.  Each
# is the stopping-sight distance at the *reduced* work-zone speed that
# Cases 26/27 mandate as part of the standard layout: Case 26 steps the
# posted 65 mph down to 60 (SSD ~570 ft), Case 27 steps 75 down to 65
# (SSD ~645, posted on the Sheet 14 diagram as 650).  The 570/650 floors
# therefore apply only when that exact step-down is in effect.  A plain
# closure at 65/75 mph with no reduction — or a non-standard reduction
# such as 65 -> 55 — is the generic Sheet 7 Case 11 ("SHOULDER WORK -
# FREEWAY/EXPRESSWAY"), whose buffer is labeled "VARIES (SEE GENERAL
# NOTE 24 ON SHEET 2)" with no posted minimum; those fall back to the
# federal MUTCD Table 6B-2 value at the posted speed.  This map encodes
# the qualifying (posted -> work-zone) step-down for each supplement row;
# ``spacing._cdot_buffer_or_none`` returns the minimum only on a match.
CDOT_BUFFER_STEPDOWN: dict[int, int] = {65: 60, 75: 65}

# ---------------------------------------------------------------------------
# Channelizing device spacing — MUTCD §6K.01
# ---------------------------------------------------------------------------

# Source: MUTCD 11th Ed. §6K.01
# In a taper: maximum device spacing (ft) = posted speed (mph)
# On tangent through work zone: spacing = 2 × taper spacing


def in_taper_spacing_ft(speed_mph: int) -> int:
    """Maximum channelizing device spacing inside a taper, in feet.

    Source: MUTCD 11th Ed. §6K.01 — spacing equals the posted speed
    limit expressed in feet (e.g., 55 mph → 55 ft).
    """
    return speed_mph


def on_tangent_spacing_ft(speed_mph: int) -> int:
    """Maximum channelizing device spacing on tangent sections, in feet.

    Source: MUTCD 11th Ed. §6K.01 — tangent spacing is twice the
    taper spacing.
    """
    return 2 * speed_mph


# ---------------------------------------------------------------------------
# Colorado (CDOT) overrides — sourced from S-630-1 general notes; see
# validation-artifacts/committed/arc12-citation-tail/arc12-citations.md
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ColoradoOverrides:
    """Colorado-specific constants that override or supplement federal MUTCD.

    Each field has a source comment in the class body.  Where a value
    could not be confirmed, it is set to None with a TODO.
    """

    # Source: CDOT S-630-1 (July 2026) Sheet 2, General Note 3 (final ¶):
    # "The regulatory or advisory speed reduction displayed shall not
    # exceed 15 mph per sign installation."  (Formerly cited to CO
    # Supplement §2B.13(A) — the current Supplement, effective
    # 2026-01-18, contains no §2B.13; see arc12-citations.md.)
    max_speed_reduction_per_sign_mph: int = 15

    # Source: CDOT S-630-1 (July 2026) Sheet 2, General Note 4: "Work
    # Zone (G20-5p) and Fines Double (R2-6p) signs shall be provided
    # every 2640' between R2-10 and R2-11 signs."  The sheet names
    # G20-5p the Work Zone sign (an earlier comment here called it the
    # "CONSTRUCTION ZONE" G20-4a plaque — wrong subject).
    construction_zone_plaque_interval_ft: int = 2640  # ½ mile = 2640 ft

    # Source: CDOT S-630-1 (July 2026) Sheet 2, General Note 22 —
    # flagger-station flood lighting during hours of darkness: quartz
    # light source, 500 watt minimum.
    flagger_station_light_watts: int = 500

    # Source: CDOT S-630-1 (July 2026) Sheet 2, General Note 22 —
    # "variable light height from a minimum of eight feet above the
    # roadway."
    flagger_station_light_height_ft: int = 8

    # Source: CDOT S-630-1 (July 2026) Sheet 23, Case 38 Note 1: "In
    # roadway where the aadt is 2,000 or less, a single work vehicle
    # with appropriate warning devices on the vehicle may be used" —
    # above the threshold, the drawn configuration (mobile attenuator
    # train) applies.  Stated on Case 38 (mobile striping, multi-lane);
    # applied here to all mobile kinds — a documented generalization.
    mobile_operation_aadt_threshold: int = 2000

    # CHOSEN default (Rule 12): formerly cited to CO Supplement §4D.01,
    # which the current Supplement does not contain; no in-repo source
    # identified (#70).  No consumer reads this field today.
    horizontal_signal_faces_allowed: bool = False

    # Source: CDOT S-630-1 (July 2026) Sheet 2, General Note 8: "All
    # warning and regulatory signs shall be posted on both sides of the
    # roadway on divided highways, multi-lane ramps, one-way streets,
    # and as directed by the Engineer, except where only one shoulder
    # is closed (ex: Case 11 on Sheet 7)."
    # Divided highways are covered separately by ``ScenarioParams.is_divided``
    # and are not listed here (divided-ness is not a road_type).
    both_sides_signage_required_on: tuple[str, ...] = (
        "multi_lane_ramp",
        "one_way_street",
    )


# Singleton instance for import convenience.
COLORADO_OVERRIDES: ColoradoOverrides = ColoradoOverrides()


@dataclass(frozen=True)
class ColoradoCitations:
    """Citation text for each Colorado requirement the audit renders.

    Single source (#83): ``audit.py`` reads these instead of carrying
    parallel string literals.  Each enforced value lives on
    ``ColoradoOverrides`` above; its rendered citation lives here — one
    section number, one definition.  ``fines_double`` has no value
    field (the envelope is geometry, not a scalar) but its citation is
    single-sourced the same way.
    """

    signs_both_sides: str = "CDOT S-630-1 (July 2026) Sheet 2, General Note 8"
    construction_zone_plaques: str = "CDOT S-630-1 (July 2026) Sheet 2, General Note 4"
    speed_reduction: str = "CDOT S-630-1 (July 2026) Sheet 2, General Note 3"
    flagger_station_lighting: str = "CDOT S-630-1 (July 2026) Sheet 2, General Note 22"
    mobile_operation_aadt: str = "CDOT S-630-1 (July 2026) Sheet 23, Case 38 Note 1"
    fines_double: str = "CDOT S-630-1 (July 2026) Sheet 12, Fines Double Signing Notes"


# Singleton instance for import convenience.
CO_CITATIONS: ColoradoCitations = ColoradoCitations()
