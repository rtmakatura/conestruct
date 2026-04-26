"""Layout validation — MUTCD/Colorado conformance checks for proposed device layouts.

Given a list of device placements and the scenario parameters they're
meant to address, this module returns a list of violations.  It does
not generate layouts; it lints them.

Authoritative sources:
  - MUTCD 11th Edition, Part 6 (Temporary Traffic Control)
  - Colorado Supplement to MUTCD (effective 2026-01-18)
"""

from __future__ import annotations

from dataclasses import dataclass

from src.rules.devices import DEVICE_CATALOG, DeviceType
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    co_construction_plaques,
    device_spacing_in_taper,
    device_spacing_on_tangent,
    shoulder_taper_length,
    taper_length,
)
from src.rules.tables import COLORADO_OVERRIDES

# ---------------------------------------------------------------------------
# Tolerances and thresholds
# ---------------------------------------------------------------------------

# Multiplicative tolerance around the formula taper length.  Field-rounded
# tapers may run a little long but should not run materially short.
TAPER_LENGTH_TOLERANCE_LOW: float = 0.9
TAPER_LENGTH_TOLERANCE_HIGH: float = 1.2

# Multiplicative tolerance around channelizer spacing.
DEVICE_SPACING_TOLERANCE: float = 0.10  # ±10 %

# Multiplicative tolerance around advance warning sign spacing.
ADVANCE_SIGN_SPACING_TOLERANCE: float = 0.15  # ±15 %

# Multiplicative tolerance around buffer space.  The buffer can be longer
# than computed but not materially shorter.
BUFFER_SPACE_TOLERANCE_LOW: float = 0.9

# Station match tolerance for mirror signs across a divided road.
CO_BOTH_SIDES_STATION_TOLERANCE_FT: float = 50.0

# Station tolerance for "arrow board near taper start".
ARROW_BOARD_TAPER_PROXIMITY_FT: float = 100.0

# Minimum number of advance warning signs upstream of a taper.
MIN_ADVANCE_WARNING_SIGNS: int = 3

# Minimum number of flagger stations for alternating one-way operations.
MIN_FLAGGER_STATIONS: int = 2

# Lateral offset delta (ft) below which a channelizer pair is treated as
# tangent (constant offset) rather than taper (changing offset).
TAPER_OFFSET_DELTA_THRESHOLD_FT: float = 1.0


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class DevicePlacement:
    """One physical device placed at a specific station and offset.

    station_ft is measured along the road from the downstream end of
    the work zone, increasing upstream (against traffic flow).
    offset_ft is measured laterally from the road centerline; positive
    values are to the right of the centerline when facing upstream.
    """

    device_type: DeviceType
    station_ft: float
    offset_ft: float
    label: str | None = None


@dataclass(frozen=True)
class ScenarioParams:
    """Inputs the validators need to interpret a proposed layout."""

    speed_mph: int
    num_lanes: int
    closure_type: str  # "lane" | "shoulder" | "full_road" | "mobile"
    road_type: str  # "urban_low" | "urban_high" | "rural" | "expressway" | "divided_highway"
    work_zone_length_ft: float
    lane_width_ft: float = 12.0
    shoulder_width_ft: float = 10.0
    is_night: bool = False
    is_divided: bool = False
    jurisdiction: str = "CDOT"


@dataclass(frozen=True)
class Violation:
    """A single validation finding.

    severity is "error" (must fix) or "warning" (should review).
    mutcd_section cites the MUTCD or CO Supplement reference.
    device_index is the index into the placements list, or None if
    the violation is zone-level rather than device-level.
    """

    rule_id: str
    severity: str
    message: str
    mutcd_section: str
    device_index: int | None = None


# ---------------------------------------------------------------------------
# Internal helpers — placement extraction
# ---------------------------------------------------------------------------


def _channelizer_indices(placements: list[DevicePlacement]) -> list[int]:
    return [i for i, p in enumerate(placements) if DEVICE_CATALOG[p.device_type].is_channelizer]


def _sign_indices(placements: list[DevicePlacement]) -> list[int]:
    return [i for i, p in enumerate(placements) if DEVICE_CATALOG[p.device_type].is_sign]


def _extract_taper_indices(placements: list[DevicePlacement]) -> list[int]:
    """Indices of channelizers that form the merging taper.

    Identifies the longest contiguous run of station-sorted channelizers
    whose lateral offset is monotonically changing by more than
    ``TAPER_OFFSET_DELTA_THRESHOLD_FT`` between neighbors.  Returns an
    empty list if no such run exists.
    """
    chans = sorted(
        _channelizer_indices(placements),
        key=lambda i: placements[i].station_ft,
    )
    if len(chans) < 2:
        return []

    deltas = [
        placements[chans[k]].offset_ft - placements[chans[k - 1]].offset_ft
        for k in range(1, len(chans))
    ]

    best_start, best_len = 0, 0
    cur_start, cur_len, cur_sign = 0, 0, 0
    for k, d in enumerate(deltas):
        if d > TAPER_OFFSET_DELTA_THRESHOLD_FT:
            sign = 1
        elif d < -TAPER_OFFSET_DELTA_THRESHOLD_FT:
            sign = -1
        else:
            sign = 0
        if sign == 0 or sign != cur_sign:
            cur_start = k
            cur_len = 1 if sign != 0 else 0
            cur_sign = sign
        else:
            cur_len += 1
        if cur_len > best_len:
            best_len = cur_len
            best_start = cur_start

    if best_len == 0:
        return []
    return chans[best_start : best_start + best_len + 1]


# ---------------------------------------------------------------------------
# Individual validators
# ---------------------------------------------------------------------------


def validate_taper_present(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Verify a merging taper exists.  Source: MUTCD 11th Ed. §6C.08.

    Mobile operations are exempt — they use a shadow vehicle and TMA in
    place of a fixed channelizing taper.
    """
    if params.closure_type == "mobile":
        return []

    taper = _extract_taper_indices(placements)
    if len(taper) < 2:
        return [
            Violation(
                rule_id="MISSING_TAPER",
                severity="error",
                message=(
                    "No merging taper detected. A taper of channelizing "
                    f"devices is required for {params.closure_type} closures."
                ),
                mutcd_section="6C.08",
                device_index=None,
            )
        ]
    return []


def validate_taper_length(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Compare actual taper span to the formula length.  Source: MUTCD 11th Ed. §6C.08.

    Lane closures use ``spacing.taper_length(speed, lane_width)``;
    shoulder closures use ``spacing.shoulder_taper_length(speed,
    shoulder_width)`` — per §6C.08, the shoulder taper is one-third of
    the full merging taper length.  Tolerances
    ``TAPER_LENGTH_TOLERANCE_LOW`` and ``TAPER_LENGTH_TOLERANCE_HIGH``
    account for field rounding.
    """
    if params.closure_type == "mobile":
        return []

    taper = _extract_taper_indices(placements)
    if len(taper) < 2:
        # Absence of a taper is reported by validate_taper_present.
        return []

    stations = [placements[i].station_ft for i in taper]
    actual = max(stations) - min(stations)
    if params.closure_type == "shoulder":
        expected = shoulder_taper_length(params.speed_mph, params.shoulder_width_ft)
    else:
        expected = taper_length(params.speed_mph, params.lane_width_ft)

    if actual < TAPER_LENGTH_TOLERANCE_LOW * expected:
        return [
            Violation(
                rule_id="TAPER_TOO_SHORT",
                severity="error",
                message=(
                    f"Taper span {actual:.0f} ft is below "
                    f"{TAPER_LENGTH_TOLERANCE_LOW:.0%} of the formula length "
                    f"{expected:.0f} ft at {params.speed_mph} mph."
                ),
                mutcd_section="6C.08",
                device_index=None,
            )
        ]
    if actual > TAPER_LENGTH_TOLERANCE_HIGH * expected:
        return [
            Violation(
                rule_id="TAPER_LONGER_THAN_REQUIRED",
                severity="warning",
                message=(
                    f"Taper span {actual:.0f} ft exceeds "
                    f"{TAPER_LENGTH_TOLERANCE_HIGH:.0%} of the formula length "
                    f"{expected:.0f} ft. Excess length is permitted but uses "
                    "extra devices."
                ),
                mutcd_section="6C.08",
                device_index=None,
            )
        ]
    return []


def validate_channelizer_spacing(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Check spacing between consecutive channelizers.  Source: MUTCD 11th Ed. §6C.09.

    In-taper spacing target is the posted speed in feet; on-tangent
    target is twice that.  Tolerance is ``DEVICE_SPACING_TOLERANCE``.
    """
    out: list[Violation] = []
    taper_set = set(_extract_taper_indices(placements))
    chans = sorted(
        _channelizer_indices(placements),
        key=lambda i: placements[i].station_ft,
    )

    expected_in_taper = device_spacing_in_taper(params.speed_mph)
    expected_on_tangent = device_spacing_on_tangent(params.speed_mph)
    tol = DEVICE_SPACING_TOLERANCE

    for k in range(1, len(chans)):
        i_prev, i_cur = chans[k - 1], chans[k]
        # Skip pairs touching the downstream taper (station < 0 by our
        # coordinate convention).  Downstream tapers have their own
        # length rule (50–100 ft per lane, §6C.08) and aren't subject to
        # the in-taper / on-tangent spacing limits.
        if placements[i_prev].station_ft < 0 or placements[i_cur].station_ft < 0:
            continue
        prev_in_taper = i_prev in taper_set
        cur_in_taper = i_cur in taper_set
        # Skip pairs that straddle a zone boundary (taper ↔ tangent).  The
        # gap between zones is the buffer space, which is intentionally
        # empty and is covered by validate_buffer_space.
        if prev_in_taper != cur_in_taper:
            continue
        spacing = placements[i_cur].station_ft - placements[i_prev].station_ft
        expected = expected_in_taper if prev_in_taper else expected_on_tangent
        zone_label = "in-taper" if prev_in_taper else "tangent"

        if spacing > expected * (1 + tol):
            out.append(
                Violation(
                    rule_id="CHANNELIZER_SPACING_TOO_WIDE",
                    severity="warning",
                    message=(
                        f"Channelizer spacing {spacing:.0f} ft exceeds the "
                        f"{zone_label} maximum {expected:.0f} ft "
                        f"(±{tol:.0%}) at {params.speed_mph} mph."
                    ),
                    mutcd_section="6C.09",
                    device_index=i_cur,
                )
            )
        elif spacing < expected * (1 - tol):
            out.append(
                Violation(
                    rule_id="CHANNELIZER_SPACING_TOO_TIGHT",
                    severity="warning",
                    message=(
                        f"Channelizer spacing {spacing:.0f} ft is below "
                        f"{(1 - tol):.0%} of the {zone_label} target "
                        f"{expected:.0f} ft at {params.speed_mph} mph "
                        "(uses more devices than required)."
                    ),
                    mutcd_section="6C.09",
                    device_index=i_cur,
                )
            )
    return out


def validate_advance_warning_signs(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Verify count and spacing of advance warning signs.  Source: MUTCD 11th Ed. Table 6B-1.

    Requires at least ``MIN_ADVANCE_WARNING_SIGNS`` sign devices upstream
    of the taper and checks each pairwise distance against the A/B/C
    values from Table 6B-1, with ``ADVANCE_SIGN_SPACING_TOLERANCE``
    relative tolerance.
    """
    taper = _extract_taper_indices(placements)
    if not taper:
        # No taper means no upstream reference point for sign placement.
        return []

    taper_upstream = max(placements[i].station_ft for i in taper)
    sign_idx = [i for i in _sign_indices(placements) if placements[i].station_ft > taper_upstream]

    # Cluster signs whose stations are within
    # CO_BOTH_SIDES_STATION_TOLERANCE_FT of each other so a sign and its
    # both-sides mirror collapse to a single logical "station" before
    # A/B/C selection.  Without clustering, sorted order interleaves
    # mirror pairs and the first-three pick would compute B ≈ 0.
    sign_idx_sorted = sorted(sign_idx, key=lambda i: placements[i].station_ft)
    clusters: list[list[int]] = []
    for i in sign_idx_sorted:
        if (
            clusters
            and placements[i].station_ft - placements[clusters[-1][-1]].station_ft
            <= CO_BOTH_SIDES_STATION_TOLERANCE_FT
        ):
            clusters[-1].append(i)
        else:
            clusters.append([i])

    if len(clusters) < MIN_ADVANCE_WARNING_SIGNS:
        return [
            Violation(
                rule_id="MISSING_ADVANCE_SIGN",
                severity="error",
                message=(
                    f"Only {len(clusters)} advance warning station(s) found "
                    f"upstream of the taper; at least "
                    f"{MIN_ADVANCE_WARNING_SIGNS} are required."
                ),
                mutcd_section="Table 6B-1",
                device_index=None,
            )
        ]

    # Use the scenario's road_type when it matches a Table 6B-1 category.
    # "divided_highway" is descriptive only and falls back to inference.
    table_categories = {"urban_low", "urban_high", "rural", "expressway", "freeway"}
    rt = params.road_type if params.road_type in table_categories else None
    distances = advance_warning_spacing(params.speed_mph, rt)

    centroids = [sum(placements[i].station_ft for i in c) / len(c) for c in clusters]
    cluster_reps = [c[0] for c in clusters]
    actual_a = centroids[0] - taper_upstream
    actual_b = centroids[1] - centroids[0]
    actual_c = centroids[2] - centroids[1]

    out: list[Violation] = []
    tol = ADVANCE_SIGN_SPACING_TOLERANCE
    for label, actual, expected, idx in (
        ("A", actual_a, distances["A"], cluster_reps[0]),
        ("B", actual_b, distances["B"], cluster_reps[1]),
        ("C", actual_c, distances["C"], cluster_reps[2]),
    ):
        if expected == 0:
            continue
        if not (expected * (1 - tol) <= actual <= expected * (1 + tol)):
            out.append(
                Violation(
                    rule_id="ADVANCE_SIGN_SPACING_OFF",
                    severity="warning",
                    message=(
                        f"Advance sign {label} is {actual:.0f} ft from its "
                        f"reference; Table 6B-1 suggests {expected:.0f} ft "
                        f"(±{tol:.0%})."
                    ),
                    mutcd_section="Table 6B-1",
                    device_index=idx,
                )
            )
    return out


def validate_buffer_space(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Verify the longitudinal buffer between work space and taper.

    Source: MUTCD 11th Ed. Table 6B-2.

    The work zone is taken to occupy stations ``[0, work_zone_length_ft]``
    and the buffer is the gap between the work zone's upstream end and
    the taper's downstream end.  The buffer may be longer than required
    but not shorter than ``BUFFER_SPACE_TOLERANCE_LOW`` of the table value.
    """
    taper = _extract_taper_indices(placements)
    if not taper:
        return []

    taper_downstream = min(placements[i].station_ft for i in taper)
    actual_buffer = taper_downstream - params.work_zone_length_ft
    expected = buffer_space(params.speed_mph)

    if actual_buffer < BUFFER_SPACE_TOLERANCE_LOW * expected:
        return [
            Violation(
                rule_id="BUFFER_TOO_SHORT",
                severity="error",
                message=(
                    f"Longitudinal buffer is {actual_buffer:.0f} ft; "
                    f"Table 6B-2 requires at least {expected:.0f} ft at "
                    f"{params.speed_mph} mph "
                    f"({BUFFER_SPACE_TOLERANCE_LOW:.0%} tolerance allowed)."
                ),
                mutcd_section="Table 6B-2",
                device_index=None,
            )
        ]
    return []


def validate_arrow_board_present(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Verify an arrow board is present at or near the taper start.

    Source: MUTCD 11th Ed. §6F.63 (Arrow Boards).

    Skipped for mobile and full-road closures.  Severity is warning
    because some jurisdictions accept a PCMS in place of an arrow board.
    """
    if params.closure_type in ("mobile", "full_road"):
        return []

    arrow_indices = [i for i, p in enumerate(placements) if p.device_type == DeviceType.ARROW_BOARD]
    if not arrow_indices:
        return [
            Violation(
                rule_id="MISSING_ARROW_BOARD",
                severity="warning",
                message=(
                    f"No arrow board found for a {params.closure_type} closure. "
                    "An arrow board (or PCMS, where jurisdiction permits) is "
                    "expected at or near the start of the taper."
                ),
                mutcd_section="6F.63",
                device_index=None,
            )
        ]

    taper = _extract_taper_indices(placements)
    if not taper:
        return []
    taper_upstream = max(placements[i].station_ft for i in taper)

    out: list[Violation] = []
    if not any(
        abs(placements[i].station_ft - taper_upstream) <= ARROW_BOARD_TAPER_PROXIMITY_FT
        for i in arrow_indices
    ):
        out.append(
            Violation(
                rule_id="ARROW_BOARD_POSITION",
                severity="warning",
                message=(
                    "Arrow board is present but not within "
                    f"{ARROW_BOARD_TAPER_PROXIMITY_FT:.0f} ft of the taper "
                    "start."
                ),
                mutcd_section="6F.63",
                device_index=arrow_indices[0],
            )
        )
    return out


def validate_co_signs_both_sides(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Colorado: signs required on both sides of the roadway.

    Source: CO Supplement §6C.04(A).  Triggered when ``params.is_divided``
    is True or when ``params.road_type`` is in
    ``COLORADO_OVERRIDES.both_sides_signage_required_on``.  Each sign on
    one side must have a mirror at approximately the same station on the
    opposite side, within ``CO_BOTH_SIDES_STATION_TOLERANCE_FT``.
    """
    triggers = (
        params.is_divided or params.road_type in COLORADO_OVERRIDES.both_sides_signage_required_on
    )
    if not triggers:
        return []

    sign_idx = _sign_indices(placements)
    out: list[Violation] = []
    tol = CO_BOTH_SIDES_STATION_TOLERANCE_FT

    for i in sign_idx:
        p = placements[i]
        has_mirror = any(
            j != i
            and DEVICE_CATALOG[placements[j].device_type].is_sign
            and (placements[j].offset_ft * p.offset_ft) < 0
            and abs(placements[j].station_ft - p.station_ft) <= tol
            for j in sign_idx
        )
        if not has_mirror:
            out.append(
                Violation(
                    rule_id="CO_SIGN_BOTH_SIDES",
                    severity="error",
                    message=(
                        f"Sign at station {p.station_ft:.0f} ft "
                        f"(offset {p.offset_ft:+.1f} ft) has no mirror sign on "
                        "the opposite side of the roadway."
                    ),
                    mutcd_section="CO Supplement §6C.04(A)",
                    device_index=i,
                )
            )
    return out


def validate_co_construction_plaques(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Colorado: CONSTRUCTION ZONE plaques at half-mile intervals.

    Source: CO Supplement §6C.06(A).  Counts plaque-bearing
    SIGN_GENERIC placements (label ``G20-5P`` or ``R2-6P``) and
    compares to ``co_construction_plaques(zone_length)``.  Position is
    not enforced — only count.
    """
    required = co_construction_plaques(params.work_zone_length_ft)
    plaque_count = sum(
        1
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC
        and p.label is not None
        and p.label.upper() in {"G20-5P", "R2-6P"}
    )
    if plaque_count < required:
        return [
            Violation(
                rule_id="CO_INSUFFICIENT_PLAQUES",
                severity="warning",
                message=(
                    f"Found {plaque_count} CONSTRUCTION ZONE plaque(s); "
                    f"{required} required for a "
                    f"{params.work_zone_length_ft:.0f}-ft zone "
                    "(½-mile interval)."
                ),
                mutcd_section="CO Supplement §6C.06(A)",
                device_index=None,
            )
        ]
    return []


def validate_flagger_stations(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Verify flagger stations for alternating-flow operations.

    Source: MUTCD 11th Ed. §6C.13.  Triggered by full-road closures on
    non-divided roads, or by a single-lane closure on a two-lane,
    two-way road.
    """
    # ``num_lanes`` is interpreted permissively: 1 (the per-direction count
    # for a 2-lane two-way road) and 2 (the total-lane count for the same
    # road) both describe the alternating-flow case.  Multi-lane undivided
    # facilities (num_lanes >= 3) handle a single-lane closure without
    # alternating flow and are excluded here.
    needs_flaggers = (params.closure_type == "full_road" and not params.is_divided) or (
        params.closure_type == "lane" and params.num_lanes <= 2 and not params.is_divided
    )
    if not needs_flaggers:
        return []

    flagger_count = sum(1 for p in placements if p.device_type == DeviceType.FLAGGER_STATION)
    if flagger_count < MIN_FLAGGER_STATIONS:
        return [
            Violation(
                rule_id="MISSING_FLAGGER_STATIONS",
                severity="error",
                message=(
                    "Alternating one-way flow requires at least "
                    f"{MIN_FLAGGER_STATIONS} flagger stations; found "
                    f"{flagger_count}."
                ),
                mutcd_section="6C.13",
                device_index=None,
            )
        ]
    return []


# ---------------------------------------------------------------------------
# Top-level entry point
# ---------------------------------------------------------------------------


def validate_layout(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Run every validator against a proposed layout.

    Returns the concatenated list of violations from all sub-validators,
    or an empty list if every check passes.  Order does not encode
    priority — sort by ``severity`` if needed.
    """
    out: list[Violation] = []
    out.extend(validate_taper_present(placements, params))
    out.extend(validate_taper_length(placements, params))
    out.extend(validate_channelizer_spacing(placements, params))
    out.extend(validate_advance_warning_signs(placements, params))
    out.extend(validate_buffer_space(placements, params))
    out.extend(validate_arrow_board_present(placements, params))
    out.extend(validate_co_signs_both_sides(placements, params))
    out.extend(validate_co_construction_plaques(placements, params))
    out.extend(validate_flagger_stations(placements, params))
    return out
