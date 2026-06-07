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
    VALID_ROAD_TYPES,
    advance_warning_spacing,
    buffer_space,
    co_construction_plaques,
    co_speed_reduction_signs,
    device_spacing_in_taper,
    device_spacing_on_tangent,
    shoulder_taper_length,
    taper_length,
)

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

# Minimum travel-lane width through a freeway work zone (CDOT S-630-1
# Sheet 7, Case 11, "11' MIN." annotation on the temporary edge line
# callout).  Applied in ``validate_corridor_geometry`` independent of
# closure type — a freeway with sub-11 ft lanes is a design
# non-conformance regardless of what's being done on it.
FREEWAY_MIN_LANE_WIDTH_FT: float = 11.0

# Sign labels that may sit upstream of the taper but are *not* part of
# the Table 6B-1 advance-warning sequence — they are instructional or
# regulatory signs that travel with the flagger station, work-zone
# boundary, or pedestrian-access detour.  Excluded from the A/B/C
# spacing analysis in ``validate_advance_warning_signs``.  Compared
# against the label's pre-``(`` prefix so speed-encoded labels like
# ``W3-5(60)`` collapse to their family code before lookup.
_NON_ADVANCE_WARNING_SIGN_LABELS: frozenset[str] = frozenset(
    {
        "G20-4",  # PILOT CAR FOLLOW ME — co-located with flagger station
        "R9-9",  # SIDEWALK CLOSED — USE OTHER SIDE — at work-zone boundary
        # Fines Double envelope signs (V1-Wide Item 3) — regulatory signs
        # in the speed-reduction Fines Double envelope per CO Supplement
        # §2B.13 + S-630-1 Sheet 12.  Excluded from A/B/C cluster math so
        # R2-10 sitting upstream of the taper doesn't corrupt the
        # advance-warning spacing analysis.
        "R2-1",  # SPEED LIMIT — downstream restoration sign past R2-11
        "R2-6P",  # FINES DOUBLE plaque — paired with G20-5P in envelope
        "R2-10",  # BEGIN DOUBLE FINES ZONE — upstream envelope boundary
        "R2-11",  # END DOUBLE FINES ZONE — downstream envelope boundary
        # W3-5 advisory-speed sign (V1-Wide G5) — sits upstream of R2-10
        # per CO Supplement §2B.13(A); excluded from A/B/C cluster math
        # for the same reason as R2-10.
        "W3-5",
        # W5-1 ROAD NARROWS (V1-Wide G2) — emitted 500 ft upstream of
        # taper start on freeway no-reduction shoulder closures per
        # CDOT S-630-1 Sheet 7 Case 11.  Sits between the taper and the
        # A-position W21-5aR (which lives ≥ 1000 ft upstream of taper on
        # freeway per Table 6B-1), so without exclusion the cluster
        # selector would pick W5-1 as cluster[0] and corrupt the A/B/C
        # spacing analysis.
        "W5-1",
    }
)


def _advance_warning_label_key(label: str | None) -> str:
    """Strip any ``(speed)`` suffix and uppercase, for non-advance lookup.

    Speed-encoded labels (e.g. ``W3-5(60)``, ``R2-1(60)``) collapse to
    their family code (``W3-5``, ``R2-1``) so the
    ``_NON_ADVANCE_WARNING_SIGN_LABELS`` frozenset can match by code
    alone without enumerating every possible speed value.
    """
    return (label or "").upper().split("(", 1)[0]


# Lateral offset delta (ft) below which a channelizer pair is treated as
# tangent (constant offset) rather than taper (changing offset).  V1
# generators place tangent channelizers at exactly constant offsets, so
# the threshold only needs to reject floating-point round-off — anything
# above 0.1 ft is intentional lateral progression.  Set higher than that
# and fine-grained tapers (e.g., 12 ft of lateral travel over 12 drum
# intervals = exactly 1.0 ft per step) get misclassified as tangent.
TAPER_OFFSET_DELTA_THRESHOLD_FT: float = 0.1


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
    closure_type: str  # "lane" | "shoulder" | "full_road" | "mobile" | "off_road"
    # Speed/access category from MUTCD Table 6B-1.  Divided-ness is
    # carried separately by ``is_divided`` below — do not encode it here.
    road_type: str  # "urban_low" | "urban_high" | "rural" | "expressway" | "freeway"
    work_zone_length_ft: float
    lane_width_ft: float = 12.0
    shoulder_width_ft: float = 10.0
    is_night: bool = False
    is_divided: bool = False
    jurisdiction: str = "CDOT"
    # Project metadata — surfaced on the rendered title block.  These
    # don't drive any validation logic, but live on ScenarioParams so
    # they thread through the API/CLI/UI without a separate side
    # channel.  ``bearing_deg`` is the road's compass bearing (0 = N,
    # 90 = E) and rotates the north arrow on the schematic when
    # supplied; None defaults to "up = north" with a verify-bearing
    # caveat printed under the arrow.
    project_name: str = "Untitled Project"
    location_description: str = ""
    bearing_deg: float | None = None
    # Work-zone speed limit when reduced below ``speed_mph``.  None when
    # no reduction is in effect.  Taper, buffer, and advance-warning math
    # stay keyed to ``speed_mph`` — drivers enter the zone at posted
    # speed before reading the reduction sign.  This field drives only
    # the CO Supplement §2B.13(A) audit check today; stepped-sign
    # placement for >15 mph reductions is tracked separately (see #36).
    work_zone_speed_mph: int | None = None


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


def _is_flagger_scenario(params: ScenarioParams) -> bool:
    """True when the scenario is a flagger-controlled alternating-flow operation.

    Single-source predicate for the flagger carve-out used by
    ``validate_flagger_stations`` (positive trigger) and
    ``validate_fines_double_envelope`` (negative carve-out, per Sheet
    12's freeway/expressway scope).  Same logic mirrored by
    ``src.api.audit.build_audit_trail`` for the ``fines_double``
    section's ``applicable=False`` branch.

    Matches a single-lane closure on a non-divided 2-lane road —
    ``num_lanes`` is read permissively (1 = per-direction count, 2 =
    total-lane count both describe the same physical road).
    """
    return params.closure_type == "lane" and not params.is_divided and params.num_lanes <= 2


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
    place of a fixed channelizing taper.  Off-road work (MUTCD §6G.04)
    is also exempt since the work occurs beyond the shoulder and the
    travel lanes are unaffected.
    """
    if params.closure_type in ("mobile", "off_road"):
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
        # NOTE: MUTCD §6C.09 specifies a *maximum* spacing, not a minimum.
        # Tighter-than-target spacing is conservative (more devices, more
        # delineation) and is not a code violation.  Bug Fix 4 dropped the
        # TOO_TIGHT branch here; cost-vs-safety tradeoffs around extra
        # devices belong in the quote, not the layout validator.
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
    sign_idx = [
        i
        for i in _sign_indices(placements)
        if placements[i].station_ft > taper_upstream
        and _advance_warning_label_key(placements[i].label) not in _NON_ADVANCE_WARNING_SIGN_LABELS
    ]

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

    # Use the scenario's road_type directly — every value in
    # ScenarioParams.road_type is now a Table 6B-1 category, so we
    # don't need to nullify-and-infer.
    distances = advance_warning_spacing(params.speed_mph, params.road_type)

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

    Sources: MUTCD 11th Ed. Table 6C-2 (federal baseline) and CDOT
    Standard Plan S-630-1 Sheet 14 (CDOT supplement minimums at 65 and
    75 mph).

    The work zone is taken to occupy stations ``[0, work_zone_length_ft]``
    and the buffer is the gap between the work zone's upstream end and
    the taper's downstream end.  Tolerance depends on jurisdiction and
    speed: CDOT supplement minimums (per :func:`_is_cdot_minimum`) are
    regulatory floors enforced strictly (tolerance = 1.0); MUTCD
    advisory values carry the standard 10% rounding tolerance.
    """
    from src.rules.spacing import _is_cdot_minimum

    taper = _extract_taper_indices(placements)
    if not taper:
        return []

    taper_downstream = min(placements[i].station_ft for i in taper)
    actual_buffer = taper_downstream - params.work_zone_length_ft
    expected = buffer_space(params.speed_mph, jurisdiction=params.jurisdiction)
    is_cdot_min = _is_cdot_minimum(params.jurisdiction, params.speed_mph)
    tolerance = 1.0 if is_cdot_min else BUFFER_SPACE_TOLERANCE_LOW

    if actual_buffer < tolerance * expected:
        source_text = "CDOT S-630-1 Sheet 14" if is_cdot_min else "MUTCD Table 6C-2"
        tolerance_text = (
            "no tolerance — CDOT minimum is a hard floor"
            if is_cdot_min
            else f"{BUFFER_SPACE_TOLERANCE_LOW:.0%} tolerance allowed"
        )
        return [
            Violation(
                rule_id="BUFFER_TOO_SHORT",
                severity="error",
                message=(
                    f"Longitudinal buffer is {actual_buffer:.0f} ft; "
                    f"{source_text} requires at least {expected:.0f} ft at "
                    f"{params.speed_mph} mph ({tolerance_text})."
                ),
                mutcd_section="Table 6C-2",
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

    Skipped for mobile, full-road, and off-road closures.  Also skipped
    when flagger stations or AFAD-labeled portable signals are present,
    since alternating-flow control stops drivers at the flagger station
    and there is no merging taper for the arrow board to indicate.
    Severity is warning because some jurisdictions accept a PCMS in
    place of an arrow board.
    """
    if params.closure_type in ("mobile", "full_road", "off_road"):
        return []

    has_flagger = any(
        p.device_type == DeviceType.FLAGGER_STATION
        or (
            p.device_type == DeviceType.TEMPORARY_SIGNAL
            and p.label is not None
            and p.label.upper().startswith("AFAD")
        )
        for p in placements
    )
    if has_flagger:
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

    Source: CO Supplement §6C.04(A).  Triggered when the road is
    divided.  Each sign on one side must have a mirror at approximately
    the same station on the opposite side (matching label), within
    ``CO_BOTH_SIDES_STATION_TOLERANCE_FT``.

    Severity is ``error``: a divided-highway plan that signs only the
    right shoulder is non-compliant and the UI must surface that
    failure rather than passing the layout silently.

    NOTE: §6C.04(A) also extends to one-way streets and multi-lane
    ramps, but those facilities are not currently expressible through
    ``ScenarioParams`` (they are not Table 6B-1 road categories).
    Re-introduce them as separate ``ScenarioParams`` flags before
    extending the trigger.
    """
    if not params.is_divided:
        return []

    sign_idx = _sign_indices(placements)
    out: list[Violation] = []
    tol = CO_BOTH_SIDES_STATION_TOLERANCE_FT

    for i in sign_idx:
        p = placements[i]
        if p.offset_ft == 0:
            # Centerline-mounted signs (e.g. flagger PCMS) are inherently
            # visible to both directions and don't need a mirror.
            continue
        has_mirror = any(
            j != i
            and DEVICE_CATALOG[placements[j].device_type].is_sign
            and (placements[j].label == p.label)
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
                        f"Sign {p.label!r} at station {p.station_ft:.0f} ft "
                        f"(offset {p.offset_ft:+.1f} ft) has no mirror sign "
                        "on the opposite side of the roadway."
                    ),
                    mutcd_section="CO Supplement §6C.04(A)",
                    device_index=i,
                )
            )
    return out


def validate_begin_end_road_work_pair(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Verify G20-1 BEGIN ROAD WORK accompanies G20-2 END ROAD WORK.

    Source: MUTCD 11th Ed. §6F.55 / CDOT S-630-1 typical sheet.  The two
    guide signs are bookends of the work zone; END without BEGIN is
    asymmetric and disorients drivers.  Mobile and off-road operations
    are exempt because they have no fixed work area to bookend.

    Applies to fixed-area closures (shoulder or lane).  Mobile and
    off-road operations are exempt because they have no fixed work
    area to bookend.
    """
    if params.closure_type not in ("shoulder", "lane"):
        return []

    has_begin = any(
        p.device_type == DeviceType.SIGN_GENERIC
        and p.label is not None
        and p.label.upper() == "G20-1"
        for p in placements
    )
    has_end = any(
        p.device_type == DeviceType.SIGN_GENERIC
        and p.label is not None
        and p.label.upper() == "G20-2"
        for p in placements
    )
    if has_end and not has_begin:
        return [
            Violation(
                rule_id="MISSING_BEGIN_ROAD_WORK",
                severity="error",
                message=(
                    "G20-2 END ROAD WORK is present but G20-1 BEGIN ROAD WORK "
                    "is missing — the two guide signs must bookend the work zone."
                ),
                mutcd_section="6F.55",
                device_index=None,
            )
        ]
    return []


def validate_flagger_advance_sign_sequence(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Verify flagger advance-sign codes appear at the correct A/B/C positions.

    Source: MUTCD 11th Ed. §6E.05 / TA-10.  When a flagger station (or
    AFAD) is present, drivers should encounter the sign sequence:
    C (farthest upstream) ROAD WORK AHEAD (W20-1) → B (middle) BE
    PREPARED TO STOP (W3-4) → A (closest to flagger) FLAGGER (W20-7;
    or W20-7a for AFAD).  Spacing is checked elsewhere
    (``validate_advance_warning_signs``); this rule pins the *labels*
    to their positions so a regenerated layout cannot silently
    re-introduce the old "BE PREPARED TO STOP at A" inversion or the
    W20-4 typo.

    Only fires when at least one flagger station / AFAD is present and
    we have at least 3 advance-warning sign clusters upstream of the
    taper.  Otherwise the sign-count rule in
    ``validate_advance_warning_signs`` handles the missing-sign case.
    """
    has_flagger = any(
        p.device_type == DeviceType.FLAGGER_STATION
        or (
            p.device_type == DeviceType.TEMPORARY_SIGNAL
            and p.label is not None
            and p.label.upper().startswith("AFAD")
        )
        for p in placements
    )
    if not has_flagger:
        return []

    taper = _extract_taper_indices(placements)
    if not taper:
        return []
    taper_upstream = max(placements[i].station_ft for i in taper)

    sign_idx = [
        i
        for i in _sign_indices(placements)
        if placements[i].station_ft > taper_upstream
        and _advance_warning_label_key(placements[i].label) not in _NON_ADVANCE_WARNING_SIGN_LABELS
    ]
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

    if len(clusters) < 3:
        return []

    out: list[Violation] = []
    expected_a = {"W20-7", "W20-7A"}  # FLAGGER (or W20-7a AFAD AHEAD)
    expected_b = {"W3-4"}
    expected_c = {"W20-1"}

    def cluster_labels(cluster: list[int]) -> set[str]:
        return {(placements[i].label or "").upper() for i in cluster}

    a_labels = cluster_labels(clusters[0])
    b_labels = cluster_labels(clusters[1])
    c_labels = cluster_labels(clusters[2])

    if not (a_labels & expected_a):
        out.append(
            Violation(
                rule_id="FLAGGER_ADVANCE_SIGN_ORDER",
                severity="error",
                message=(
                    "Position A (closest to flagger) must include FLAGGER "
                    f"(W20-7 or W20-7a); found {sorted(a_labels)!r}.  "
                    "MUTCD §6E.05 places FLAGGER at the last advance station "
                    "before the stop point."
                ),
                mutcd_section="6E.05",
                device_index=clusters[0][0],
            )
        )
    if not (b_labels & expected_b):
        out.append(
            Violation(
                rule_id="FLAGGER_ADVANCE_SIGN_ORDER",
                severity="error",
                message=(
                    "Position B (middle) must include BE PREPARED TO STOP "
                    f"(W3-4); found {sorted(b_labels)!r}.  Note W20-4 is "
                    "ONE LANE ROAD AHEAD, not BE PREPARED TO STOP — "
                    "the BE PREPARED TO STOP code is W3-4."
                ),
                mutcd_section="6E.05",
                device_index=clusters[1][0],
            )
        )
    if not (c_labels & expected_c):
        out.append(
            Violation(
                rule_id="FLAGGER_ADVANCE_SIGN_ORDER",
                severity="error",
                message=(
                    "Position C (farthest upstream) must include "
                    f"ROAD WORK AHEAD (W20-1); found {sorted(c_labels)!r}."
                ),
                mutcd_section="6E.05",
                device_index=clusters[2][0],
            )
        )
    return out


def validate_mobile_shadow_vehicle(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Mobile operations require a shadow vehicle with TMA.

    Source: MUTCD 11th Ed. §6G.05 / CDOT M&S S-630-1.  A mobile work
    crew without a shadow vehicle has no rear-end impact protection
    and no signal to drivers that the work truck is moving slowly.
    The shadow is identified by a TRUCK_MOUNTED_ATTENUATOR placement
    whose label starts with "SHADOW" (the work truck has label
    "WORK_TRUCK").
    """
    if params.closure_type != "mobile":
        return []
    has_shadow = any(
        p.device_type == DeviceType.TRUCK_MOUNTED_ATTENUATOR
        and p.label is not None
        and p.label.upper().startswith("SHADOW")
        for p in placements
    )
    if not has_shadow:
        return [
            Violation(
                rule_id="MISSING_SHADOW_VEHICLE",
                severity="error",
                message=(
                    "Mobile operation has no shadow vehicle (TMA labeled "
                    "SHADOW_TMA).  §6G.05 requires a trailing shadow with "
                    "rear-impact attenuator at the work-truck speed."
                ),
                mutcd_section="6G.05",
                device_index=None,
            )
        ]
    return []


def validate_mobile_advance_warning(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Mobile operations require at least one upstream advance warning sign.

    Source: MUTCD 11th Ed. §6C.05.  Even a moving work zone needs
    drivers to know they're approaching it; the shadow vehicle's
    beacon/arrow board is the close-range cue but does not substitute
    for a roadside sign read at advance distance.

    Counts SIGN_GENERIC placements upstream of the work truck (station
    > 0 in the mobile-snapshot coordinate system).  Severity is error —
    the canonical layout emits two signs and a regression to zero
    should not pass silently.

    Scoped to 2-lane (undivided) mobile ops for V1.  Multi-lane mobile
    (TA-26) has separate signing requirements under §6G.06 that have
    not been reviewed yet; widen this rule when that scenario lands.
    """
    if params.closure_type != "mobile" or params.is_divided:
        return []
    advance_signs = [
        p for p in placements if p.device_type == DeviceType.SIGN_GENERIC and p.station_ft > 0
    ]
    if not advance_signs:
        return [
            Violation(
                rule_id="MISSING_MOBILE_ADVANCE_SIGN",
                severity="error",
                message=(
                    "Mobile operation has no advance warning sign upstream "
                    "of the work truck.  §6C.05 requires at least one "
                    "roadside sign so drivers see the work zone before "
                    "reaching the shadow vehicle."
                ),
                mutcd_section="6C.05",
                device_index=None,
            )
        ]
    return []


def validate_co_construction_plaques(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Colorado: CONSTRUCTION ZONE plaques at half-mile intervals.

    Source: CO Supplement §6C.06(A).  Counts plaque-bearing
    SIGN_GENERIC placements (label ``G20-5P`` or ``R2-6P``) and
    compares to ``co_construction_plaques(zone_length)``.  Position is
    not enforced — only count.

    Mobile and off-road operations are exempt: mobile work zones move
    with the operation and have no fixed work area to plaque, and
    off-road work (MUTCD §6G.04) keeps the travel lanes open with no
    work zone to delimit.
    """
    if params.closure_type in ("mobile", "off_road"):
        return []
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

    AFAD-labeled ``TEMPORARY_SIGNAL`` placements count as flagger
    stations — MUTCD §6E.04 treats AFADs as a permitted substitution
    for human flaggers in alternating-flow control.
    """
    # ``num_lanes`` is interpreted permissively: 1 (the per-direction count
    # for a 2-lane two-way road) and 2 (the total-lane count for the same
    # road) both describe the alternating-flow case.  Multi-lane undivided
    # facilities (num_lanes >= 3) handle a single-lane closure without
    # alternating flow and are excluded here.  The lane-closure branch
    # delegates to ``_is_flagger_scenario`` so the predicate stays in
    # one place (also consumed by ``validate_fines_double_envelope``
    # and the audit-trail ``fines_double`` section).
    needs_flaggers = (
        params.closure_type == "full_road" and not params.is_divided
    ) or _is_flagger_scenario(params)
    if not needs_flaggers:
        return []

    flagger_count = sum(
        1
        for p in placements
        if p.device_type == DeviceType.FLAGGER_STATION
        or (
            p.device_type == DeviceType.TEMPORARY_SIGNAL
            and p.label is not None
            and p.label.upper().startswith("AFAD")
        )
    )
    if flagger_count < MIN_FLAGGER_STATIONS:
        return [
            Violation(
                rule_id="MISSING_FLAGGER_STATIONS",
                severity="error",
                message=(
                    "Alternating one-way flow requires at least "
                    f"{MIN_FLAGGER_STATIONS} flagger stations (or AFADs); "
                    f"found {flagger_count}."
                ),
                mutcd_section="6C.13",
                device_index=None,
            )
        ]
    return []


def validate_fines_double_envelope(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[Violation]:
    """Verify the R2-10/R2-11 envelope when work-zone speed is reduced.

    Source: CO Supplement §2B.13 + CDOT S-630-1 Sheet 12.  When the
    work-zone posted speed is reduced below the nominal posted speed
    and the closure type is shoulder or lane on a non-flagger
    facility, the layout must emit R2-10 (BEGIN DOUBLE FINES ZONE)
    upstream of the work zone and R2-11 (END DOUBLE FINES ZONE)
    downstream.  Sheet 12 explicitly scopes Fines Double signing to
    freeway/expressway work zones, so flagger-controlled
    alternating-flow operations on 2-lane undivided roads are
    exempt — see ``_is_flagger_scenario``.

    Pins behavior so a regression in the layout engine that silently
    drops the envelope on a reduced-speed plan would fail this test
    rather than ship an undersigned plan.  Assembly-count and
    placement-spacing checks are intentionally out of scope; Sheet 12
    permits engineer adjustment of the 2640 ft interval, so the
    validator encodes the regulatory floor (envelope must exist),
    not the implementation specifics (asserted in
    ``tests/test_generators.py``).
    """
    if params.work_zone_speed_mph is None or params.work_zone_speed_mph >= params.speed_mph:
        return []
    if params.closure_type not in ("shoulder", "lane"):
        return []
    if _is_flagger_scenario(params):
        return []

    has_r2_10 = any(
        p.device_type == DeviceType.SIGN_GENERIC and (p.label or "").upper() == "R2-10"
        for p in placements
    )
    has_r2_11 = any(
        p.device_type == DeviceType.SIGN_GENERIC and (p.label or "").upper() == "R2-11"
        for p in placements
    )
    # G4: entrance R2-1 posts the reduced limit as drivers enter the
    # zone (CO Supplement §2B.13(A)).  Entrance R2-1 is currently
    # anchored to the §6C.06(A) plaque, always inside wz
    # (0 < station <= wz_len).  If anchor changes in future, update
    # station bounds here.
    has_entrance_r2_1 = any(
        p.device_type == DeviceType.SIGN_GENERIC
        and (p.label or "").upper() == "R2-1"
        and 0 < p.station_ft <= params.work_zone_length_ft
        for p in placements
    )
    # G5: W3-5 advisory-speed sign(s) per CO Supplement §2B.13(A).
    # Count by label prefix so stepped placements (W3-5(60), W3-5(45),
    # ...) all aggregate to one family code.  Required count tracks
    # ``co_speed_reduction_signs`` — 1 for Δ ≤ 15, ceil(Δ/15) for
    # Δ > 15.  Split into two violations so the field-engineer message
    # distinguishes "no W3-5 at all" from "partial stepped sequence".
    n_w3_5 = sum(
        1
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC and (p.label or "").upper().startswith("W3-5")
    )
    required_w3_5 = co_speed_reduction_signs(params.speed_mph, params.work_zone_speed_mph)

    out: list[Violation] = []
    if not has_r2_10:
        out.append(
            Violation(
                rule_id="MISSING_R2_10",
                severity="error",
                message=(
                    "Work-zone speed reduced below posted speed but no "
                    "R2-10 (BEGIN DOUBLE FINES ZONE) placement found. "
                    "CO Supplement §2B.13 and S-630-1 Sheet 12 require "
                    "the Fines Double envelope on freeway/expressway "
                    "work zones whenever the work-zone speed is reduced."
                ),
                mutcd_section="CO Supplement §2B.13 / S-630-1 Sheet 12",
                device_index=None,
            )
        )
    if not has_r2_11:
        out.append(
            Violation(
                rule_id="MISSING_R2_11",
                severity="error",
                message=(
                    "Work-zone speed reduced below posted speed but no "
                    "R2-11 (END DOUBLE FINES ZONE) placement found. "
                    "CO Supplement §2B.13 and S-630-1 Sheet 12 require "
                    "the Fines Double envelope on freeway/expressway "
                    "work zones whenever the work-zone speed is reduced."
                ),
                mutcd_section="CO Supplement §2B.13 / S-630-1 Sheet 12",
                device_index=None,
            )
        )
    if not has_entrance_r2_1:
        out.append(
            Violation(
                rule_id="MISSING_R2_1_ENTRANCE",
                severity="error",
                message=(
                    "Work-zone speed reduced below posted speed but no "
                    "entrance R2-1 (work-zone SPEED LIMIT posting) found "
                    "inside the work zone. CO Supplement §2B.13(A) "
                    "requires the reduced limit be posted as drivers "
                    "enter the zone; without it, drivers have no "
                    "regulatory indication of the reduced limit until "
                    "they exit past R2-11."
                ),
                mutcd_section="CO Supplement §2B.13(A)",
                device_index=None,
            )
        )
    if n_w3_5 == 0:
        out.append(
            Violation(
                rule_id="MISSING_W3_5",
                severity="error",
                message=(
                    "Work-zone speed reduced below posted speed but no "
                    "W3-5 (ADVISORY SPEED) advance warning sign found. "
                    "CO Supplement §2B.13(A) requires at least one W3-5 "
                    "advisory upstream of the reduced-speed work zone "
                    "(stepped sequence when the reduction exceeds 15 mph)."
                ),
                mutcd_section="CO Supplement §2B.13(A)",
                device_index=None,
            )
        )
    elif n_w3_5 < required_w3_5:
        out.append(
            Violation(
                rule_id="INSUFFICIENT_W3_5_COUNT",
                severity="error",
                message=(
                    f"Found {n_w3_5} W3-5 advisory-speed sign(s); "
                    f"{required_w3_5} required for a "
                    f"{params.speed_mph} → {params.work_zone_speed_mph} mph "
                    "reduction per CO Supplement §2B.13(A) (max 15 mph "
                    "per sign installation)."
                ),
                mutcd_section="CO Supplement §2B.13(A)",
                device_index=None,
            )
        )
    return out


# ---------------------------------------------------------------------------
# Pre-generation: corridor geometry sanity check
# ---------------------------------------------------------------------------


def validate_corridor_geometry(params: ScenarioParams) -> list[Violation]:
    """Pre-flight check: are the corridor dimensions physically reasonable?

    Runs against ``ScenarioParams`` alone — no placements needed — so the
    render pipeline can short-circuit a geometrically nonsensical request
    before invoking the generator.

    Hard rule (``WORK_ZONE_SHORTER_THAN_TAPER`` / error): the work zone
    must be at least as long as the required merging taper.  A taper
    longer than the work zone means traffic has fully transitioned into
    the closed configuration before reaching the work area, which is
    geometrically impossible to lay out — the closure would either
    overlap the taper or extend past the actual work.  Surfaces as a
    blocking error in the render API; the user must lengthen the work
    zone or lower the speed.

    Soft rule (``WORK_ZONE_SHORT_VS_BUFFER`` / warning): the work zone
    should not be dwarfed by the buffer.  When the buffer is more than
    twice the work zone, the corridor reads as a buffer with a tiny work
    area inside, which is usually a sign that the user mis-typed the
    length.  Does not block — just warns.

    Hard rule (``LANE_WIDTH_BELOW_FREEWAY_MIN`` / error): travel lane
    width on a freeway must meet ``FREEWAY_MIN_LANE_WIDTH_FT``
    (CDOT S-630-1 Sheet 7 Case 11).  Checked before the mobile/off-road
    exemption because the minimum is a roadway design constraint, not a
    closure-geometry rule — a freeway with sub-11 ft lanes is
    non-compliant whether the work zone is a fixed taper, mobile op,
    or work beyond the shoulder.

    Mobile and off-road closures are exempt from the taper/buffer rules:
    they use a moving TMA or operate beyond the shoulder respectively,
    so a fixed merging taper is not part of the geometry.  The freeway
    lane-width rule still applies.
    """
    out: list[Violation] = []

    if params.road_type == "freeway" and params.lane_width_ft < FREEWAY_MIN_LANE_WIDTH_FT:
        out.append(
            Violation(
                rule_id="LANE_WIDTH_BELOW_FREEWAY_MIN",
                severity="error",
                message=(
                    f"Lane width {params.lane_width_ft:.1f} ft is below the "
                    f"{FREEWAY_MIN_LANE_WIDTH_FT:.0f} ft minimum for freeway "
                    "work zones (CDOT S-630-1 Sheet 7 Case 11 '11' MIN.' "
                    f"annotation). Increase lane width to at least "
                    f"{FREEWAY_MIN_LANE_WIDTH_FT:.0f} ft, or verify the "
                    "scenario is not actually on a freeway."
                ),
                mutcd_section="CDOT S-630-1 Sheet 7 (Case 11)",
                device_index=None,
            )
        )

    if params.closure_type in ("mobile", "off_road"):
        return out

    if params.closure_type == "shoulder":
        taper_ft = shoulder_taper_length(params.speed_mph, params.shoulder_width_ft)
    else:
        taper_ft = taper_length(params.speed_mph, params.lane_width_ft)
    buffer_ft = buffer_space(params.speed_mph, jurisdiction=params.jurisdiction)
    work_zone_ft = params.work_zone_length_ft

    taper_label = (
        "shoulder taper (L/3)" if params.closure_type == "shoulder" else "merging taper (L)"
    )
    if work_zone_ft < taper_ft:
        out.append(
            Violation(
                rule_id="WORK_ZONE_SHORTER_THAN_TAPER",
                severity="error",
                message=(
                    f"Work zone length ({work_zone_ft:.0f} ft) is shorter than the "
                    f"required {taper_label} of {taper_ft:.0f} ft at "
                    f"{params.speed_mph} mph. Increase the work zone to at least "
                    f"{taper_ft:.0f} ft, or reduce the speed limit."
                ),
                mutcd_section="6C.08",
                device_index=None,
            )
        )
    if work_zone_ft < buffer_ft / 2.0:
        out.append(
            Violation(
                rule_id="WORK_ZONE_SHORT_VS_BUFFER",
                severity="warning",
                message=(
                    f"Work zone ({work_zone_ft:.0f} ft) is unusually short relative "
                    f"to the required buffer space ({buffer_ft:.0f} ft) at "
                    f"{params.speed_mph} mph. Verify this matches the actual job."
                ),
                mutcd_section="6C.06",
                device_index=None,
            )
        )
    return out


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

    Raises:
        ValueError: ``params.road_type`` is not a Table 6B-1 category.
            We fail fast rather than letting individual sub-validators
            silently fall back to rural distances on a freeway plan
            (Bug Fix 6).
    """
    if params.road_type not in VALID_ROAD_TYPES:
        raise ValueError(
            f"ScenarioParams.road_type={params.road_type!r} is not a "
            f"Table 6B-1 category; expected one of "
            f"{sorted(VALID_ROAD_TYPES)!r}.  'divided_highway' was "
            "removed in Bug Fix 6 — use is_divided=True with one of the "
            "speed/access categories instead."
        )

    out: list[Violation] = []
    out.extend(validate_taper_present(placements, params))
    out.extend(validate_taper_length(placements, params))
    out.extend(validate_channelizer_spacing(placements, params))
    out.extend(validate_advance_warning_signs(placements, params))
    out.extend(validate_buffer_space(placements, params))
    out.extend(validate_arrow_board_present(placements, params))
    out.extend(validate_co_signs_both_sides(placements, params))
    out.extend(validate_begin_end_road_work_pair(placements, params))
    out.extend(validate_flagger_advance_sign_sequence(placements, params))
    out.extend(validate_mobile_shadow_vehicle(placements, params))
    out.extend(validate_mobile_advance_warning(placements, params))
    out.extend(validate_co_construction_plaques(placements, params))
    out.extend(validate_flagger_stations(placements, params))
    out.extend(validate_fines_double_envelope(placements, params))
    return out
