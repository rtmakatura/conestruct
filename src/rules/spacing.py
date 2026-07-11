"""Pure calculation functions for MUTCD/CDOT taper, buffer, and spacing math.

All functions consume constants and tables from ``src.rules.tables`` and
return scalar or simple-collection results.  No side effects, no I/O,
no state.

Authoritative sources:
  - MUTCD 11th Edition, Part 6 (Temporary Traffic Control)
  - Colorado Supplement to MUTCD (effective 2026-01-18)
"""

from __future__ import annotations

import math

from src.rules.tables import (
    ADVANCE_WARNING_SIGN_SPACING,
    BUFFER_SPACE,
    CDOT_BUFFER_SPACE,
    CDOT_BUFFER_STEPDOWN,
    COLORADO_OVERRIDES,
    DOWNSTREAM_TAPER_LENGTH_PER_LANE_FT,
    FLAGGER_TO_TAPER_FT,
    ONE_LANE_TWO_WAY_DEVICE_SPACING_FT,
    ONE_LANE_TWO_WAY_TAPER_LENGTH_FT,
    OPPOSING_FLAGGER_STANDOFF_FT,
    SHIFTING_TAPER_RATIO,
    TAPER_LENGTH_FORMULA_THRESHOLD_MPH,
    in_taper_spacing_ft,
    on_tangent_spacing_ft,
)

# ---------------------------------------------------------------------------
# Taper lengths
# ---------------------------------------------------------------------------


def taper_length(speed_mph: int, offset_ft: float) -> float:
    """Merging taper length L, in feet.

    Source: MUTCD 11th Ed. §6B.08.
    Below ``TAPER_LENGTH_FORMULA_THRESHOLD_MPH`` (45 mph): ``L = W * S² / 60``.
    At or above the threshold:                              ``L = W * S``.

    Args:
        speed_mph: Posted speed limit or 85th-percentile speed (mph).
        offset_ft: Lateral offset to be tapered (ft) — typically a lane
            width (11 or 12 ft) or the shoulder width being closed.
    """
    if speed_mph < TAPER_LENGTH_FORMULA_THRESHOLD_MPH:
        return offset_ft * speed_mph * speed_mph / 60
    return offset_ft * speed_mph


def shifting_taper_length(speed_mph: int, offset_ft: float) -> float:
    """Shifting taper length, in feet (L/2).

    Source: MUTCD 11th Ed. §6B.08 — shifting taper equals
    ``SHIFTING_TAPER_RATIO * L``.  Used at both ends of a lateral lane
    shift.
    """
    return taper_length(speed_mph, offset_ft) * SHIFTING_TAPER_RATIO


def shoulder_taper_length(speed_mph: int, offset_ft: float) -> float:
    """Shoulder taper length, in feet (L/3).

    Source: MUTCD 11th Ed. §6B.08 — shoulder taper is one-third of the
    full merging taper length.  Applies when only the shoulder is being
    closed.
    """
    return taper_length(speed_mph, offset_ft) / 3


def one_lane_two_way_taper_length(use_min: bool = False) -> float:
    """One-lane, two-way traffic taper length, in feet.

    Source: MUTCD 11th Ed. §6B.08 ¶14 — 50 ft minimum, 100 ft maximum,
    channelizing devices at approximately 20-foot spacing.  Used by
    flagger-controlled alternating-flow layouts (TA-10) in place of the
    merging taper L: this taper guides traffic into the one-lane
    section behind a flagger, it does not merge moving traffic.  CDOT
    Case 17: "THIS TAPER MUST BE SHORT ENOUGH TO NOT BE MISTAKEN FOR A
    TRANSITION."  Returns the 100 ft maximum by default (Conestruct's
    pick — best driver visibility) and the 50 ft minimum when
    ``use_min=True``.
    """
    lo, hi = ONE_LANE_TWO_WAY_TAPER_LENGTH_FT
    return float(lo if use_min else hi)


def one_lane_two_way_device_spacing() -> float:
    """Device spacing inside the one-lane, two-way taper, in feet.

    Source: MUTCD 11th Ed. §6B.08 ¶14 — "approximately 20-foot
    spacing."  Overrides the speed-based §6K.01 / CDOT note 18a spacing
    for this specific taper type (the §6B.08 guidance is taper-specific
    and more granular).
    """
    return ONE_LANE_TWO_WAY_DEVICE_SPACING_FT


def flagger_to_taper_distance(use_min: bool = False) -> float:
    """Approach-flagger standoff upstream of the taper start, in feet.

    Source: MUTCD 11th Ed. Fig. 6P-10 — the flagger stands 50 to 100 ft
    upstream (approach side) of the one-lane two-way taper.  Returns
    the 100 ft maximum by default.
    """
    lo, hi = FLAGGER_TO_TAPER_FT
    return float(lo if use_min else hi)


def opposing_flagger_standoff(use_min: bool = False) -> float:
    """Opposing-flagger standoff from the work-area end, in feet.

    Source: CDOT S-630-1 Case 17 (Sheet 9) "200' TO 300'" dimension
    from the work-area end to the opposing flagger station; Case 42
    (Sheet 25) annotates the same span "200'-300' BUFFER PILOT
    TURNAROUND".  CDOT supplements MUTCD here (the MUTCD figure's
    far-end 50–100 ft dimension covers only the channelizing-device
    run-out).  Returns the 300 ft maximum by default.
    """
    lo, hi = OPPOSING_FLAGGER_STANDOFF_FT
    return float(lo if use_min else hi)


def downstream_taper_length(num_lanes: int, use_max: bool = False) -> float:
    """Downstream taper length, in feet.

    Source: MUTCD 11th Ed. §6B.08 — downstream taper is 50 to 100 ft per
    lane closed.  The designer chooses within that range; this function
    returns the lower bound by default and the upper bound when
    ``use_max=True``.
    """
    per_lane_min, per_lane_max = DOWNSTREAM_TAPER_LENGTH_PER_LANE_FT
    return float(num_lanes * (per_lane_max if use_max else per_lane_min))


def stopping_sight_distance_ft(speed_mph: int) -> float:
    """Stopping sight distance at posted speed, in feet.

    Source: MUTCD 11th Ed. Table 6B-2 "Stopping Sight Distance as a
    Function of Speed" (PDF p.11 of the local Part 6 copy, MUTCD
    p.775).  §6D.06 "Flagger Stations" ¶03 (PDF p.22, p.786): "The
    distances shown in Table 6B-2 ... may be used for the location of
    a flagger station."  Table 6B-2 is the same table BUFFER_SPACE
    encodes, so this is a thin, correctly-named view of the federal
    lookup — added in engine-removal PR B so the audit's flagger
    sight-distance value is backend-sourced (the frontend previously
    carried its own copy of this table under a §6E.06/"Table 6E-1"
    citation, both wrong-subject/nonexistent in the 11th edition).

    Raises:
        ValueError: ``speed_mph`` is not a Table 6B-2 row.
    """
    return buffer_space(speed_mph, jurisdiction="federal")


# ---------------------------------------------------------------------------
# Buffer space
# ---------------------------------------------------------------------------


def buffer_space(
    speed_mph: int,
    jurisdiction: str = "CDOT",
    work_zone_speed_mph: int | None = None,
) -> float:
    """Longitudinal buffer space, in feet.

    Jurisdiction dispatch:

    * ``"CDOT"`` — checks the CDOT supplement (S-630-1 Sheet 14) first,
      but the supplement minimum is *conditional*.  The 570/650 ft floors
      at 65/75 mph are stopping-sight distance at the reduced work-zone
      speed that Cases 26/27 mandate (65 -> 60, 75 -> 65); they apply only
      when that exact step-down is supplied via ``work_zone_speed_mph``.
      A plain closure at 65/75 with no reduction — or a non-standard
      reduction like 65 -> 55 — is the generic Sheet 7 Case 11 (buffer
      "VARIES", General Note 23) and falls back to the federal MUTCD value
      at the posted speed, exactly as every other speed does.
    * ``"federal"`` — always uses MUTCD 11th Ed. Table 6B-2 at the posted
      speed; ``work_zone_speed_mph`` is ignored.  Reachable via direct
      code calls only; V1's form-driven path hardcodes ``"CDOT"`` at the
      bridge.

    The buffer is keyed to the *posted* (approach) speed in every case
    except the two qualifying Case 26/27 step-downs — drivers enter the
    zone at posted speed before reading the reduction sign, so the
    fallback SSD is the approach-speed value.

    CDOT minimums are regulatory floors (the "MIN" annotation on
    S-630-1 diagrams), not recommendations — see
    :func:`_is_cdot_minimum` for the predicate the validator uses to
    enforce them strictly.

    Args:
        speed_mph: Posted speed in mph; must be a multiple of 5 in
            {20, 25, ..., 75}.
        jurisdiction: ``"CDOT"`` (default) or ``"federal"``.
        work_zone_speed_mph: Reduced work-zone posted speed, or ``None``
            when no reduction is in effect.  Only ``(65, 60)`` and
            ``(75, 65)`` unlock the CDOT supplement minimum (Cases 26/27).

    Raises:
        ValueError: ``speed_mph`` is not in the table, or
            ``jurisdiction`` is not recognized.
    """
    if jurisdiction not in ("CDOT", "federal"):
        raise ValueError(f"Unknown jurisdiction {jurisdiction!r}; expected 'CDOT' or 'federal'.")

    if jurisdiction == "CDOT":
        cdot_value = _cdot_buffer_or_none(speed_mph, work_zone_speed_mph)
        if cdot_value is not None:
            return float(cdot_value)
        # No qualifying Case 26/27 step-down — fall through to federal.

    for row in BUFFER_SPACE:
        if row.speed_mph == speed_mph:
            if row.buffer_ft is None:
                raise ValueError(
                    f"Buffer space at {speed_mph} mph is not yet verified against MUTCD Table 6B-2."
                )
            return float(row.buffer_ft)
    raise ValueError(
        f"Speed {speed_mph} mph is not in MUTCD Table 6B-2; valid values are 20, 25, 30, ..., 75."
    )


def _cdot_buffer_or_none(speed_mph: int, work_zone_speed_mph: int | None = None) -> int | None:
    """CDOT supplement minimum buffer for this scenario, or None.

    Returns the value posted on S-630-1 Sheet 14 (Case 26 at 65 mph,
    Case 27 at 75 mph) only when ``speed_mph`` matches a supplement row
    *and* ``work_zone_speed_mph`` equals the CDOT-mandated step-down for
    that case (65 -> 60, 75 -> 65, per :data:`CDOT_BUFFER_STEPDOWN`).
    Returns ``None`` otherwise — no supplement row, no reduction, or a
    non-standard reduction — because the 570/650 floors are SSD at the
    reduced work-zone speed and are meaningless without that step-down.
    Sheet 7 Case 11 (buffer "VARIES", General Note 23) then governs and
    the caller falls back to the federal posted-speed baseline.
    """
    required_wz = CDOT_BUFFER_STEPDOWN.get(speed_mph)
    if required_wz is None or work_zone_speed_mph != required_wz:
        return None
    for row in CDOT_BUFFER_SPACE:
        if row.speed_mph == speed_mph:
            return row.buffer_ft
    return None


def _is_cdot_minimum(
    jurisdiction: str, speed_mph: int, work_zone_speed_mph: int | None = None
) -> bool:
    """True when the CDOT supplement posts a hard minimum for this scenario.

    The validator uses this to enforce the CDOT floor strictly (no
    tolerance), distinguishing CDOT regulatory minimums from MUTCD
    advisory values (which carry a 10% tolerance).  Mirrors
    :func:`_cdot_buffer_or_none`'s conditionality: the floor is strict
    only on a qualifying Case 26/27 step-down; absent that, the buffer is
    the federal advisory value and carries the normal tolerance.
    """
    return (
        jurisdiction == "CDOT" and _cdot_buffer_or_none(speed_mph, work_zone_speed_mph) is not None
    )


# ---------------------------------------------------------------------------
# Advance warning sign spacing
# ---------------------------------------------------------------------------


VALID_ROAD_TYPES: frozenset[str] = frozenset(
    {"urban_low", "urban_high", "rural", "expressway", "freeway"}
)


def advance_warning_spacing(
    speed_mph: int,
    road_type: str | None = None,
) -> dict[str, float]:
    """Distances A, B, and C between advance warning signs, in feet.

    Source: MUTCD 11th Ed. Table 6B-1.

    Args:
        speed_mph: Posted speed (mph).
        road_type: One of ``"urban_low"``, ``"urban_high"``, ``"rural"``,
            ``"expressway"``, ``"freeway"``.  When ``None``, the road
            category is inferred from speed:

                ≤ 40 mph        → ``urban_low``
                41–44 mph       → ``urban_high``
                45–54 mph       → ``rural``
                ≥ 55 mph        → must be passed explicitly

            The 40/41 split follows CDOT S-630-1 ("URBAN (<=40 MPH)" /
            "URBAN (>=45 MPH)"), the agency determination the Table
            6B-1 footnote delegates — same convention as
            ``_map_road_type`` in ``src/api/schemas.py``.

            High-speed facilities span three Table 6B-1 categories
            (rural, expressway, freeway) with sharply different
            advance-warning distances — rural caps out at 500 ft for
            A/B/C while expressway/freeway use the asymmetric
            1000/1500/2640 ft series.  Silent inference at 55+ mph
            risks under-signing an interstate by thousands of feet, so
            we reject ``None`` in that range and force the caller to
            specify.

            The legacy descriptor ``"divided_highway"`` is **not** a
            valid road_type — divided-ness is carried separately by
            ``ScenarioParams.is_divided``; passing it here raises
            ``ValueError``.

    Raises:
        ValueError: ``road_type`` is ``None`` at 55+ mph, or is a
            string not in :data:`VALID_ROAD_TYPES`.
    """
    if road_type is None:
        if speed_mph <= 40:
            road_type = "urban_low"
        elif speed_mph < 45:
            road_type = "urban_high"
        elif speed_mph < 55:
            road_type = "rural"
        else:
            raise ValueError(
                f"advance_warning_spacing requires an explicit road_type at "
                f"{speed_mph} mph (auto-infer is unsafe at 55+ mph because "
                "rural / expressway / freeway differ by thousands of feet "
                "in Table 6B-1).  Pass one of 'rural', 'expressway', 'freeway'."
            )

    if road_type not in VALID_ROAD_TYPES:
        raise ValueError(
            f"Unknown road_type {road_type!r}; expected one of "
            f"{sorted(VALID_ROAD_TYPES)!r}.  Note: 'divided_highway' is "
            "not a road_type — divided-ness is a separate boolean "
            "(ScenarioParams.is_divided)."
        )

    for row in ADVANCE_WARNING_SIGN_SPACING:
        if row.road_category == road_type:
            return {
                "A": float(row.a_ft),
                "B": float(row.b_ft),
                "C": float(row.c_ft) if row.c_ft is not None else 0.0,
            }

    raise ValueError(
        f"road_type {road_type!r} is valid but missing from "
        "ADVANCE_WARNING_SIGN_SPACING table — table data may be incomplete."
    )


# ---------------------------------------------------------------------------
# Channelizing device spacing
# ---------------------------------------------------------------------------


def device_spacing_in_taper(speed_mph: int) -> float:
    """Maximum channelizing device spacing within a taper, in feet.

    Source: MUTCD 11th Ed. §6K.01 — equals the posted speed expressed
    in feet (e.g., 55 mph → 55 ft).
    """
    return float(in_taper_spacing_ft(speed_mph))


def device_spacing_on_tangent(speed_mph: int) -> float:
    """Maximum channelizing device spacing on a tangent section, in feet.

    Source: MUTCD 11th Ed. §6K.01 — twice the in-taper spacing.
    """
    return float(on_tangent_spacing_ft(speed_mph))


def num_devices_in_taper(speed_mph: int, offset_ft: float) -> int:
    """Number of channelizing devices required within a merging taper.

    Source: MUTCD 11th Ed. §6B.08 (taper length) + §6K.01 (spacing).
    Computed as ``ceil(L / in_taper_spacing)`` so the taper is never
    under-populated.
    """
    return math.ceil(taper_length(speed_mph, offset_ft) / device_spacing_in_taper(speed_mph))


def num_devices_on_tangent(tangent_length_ft: float, speed_mph: int) -> int:
    """Number of channelizing devices required on a tangent section.

    Source: MUTCD 11th Ed. §6K.01.  Computed as
    ``ceil(length / tangent_spacing)``.
    """
    return math.ceil(tangent_length_ft / device_spacing_on_tangent(speed_mph))


def pick_device_count(
    length_ft: float,
    target_spacing_ft: float,
    *,
    min_count: int = 2,
    tolerance: float = 0.10,
) -> int:
    """Pick the device count that places interval spacing nearest target.

    For ``count`` devices spaced uniformly along ``length_ft``, interval
    spacing is ``length_ft / (count - 1)``.  This helper compares the
    floor and ceil interval-count candidates around the exact ratio
    ``length_ft / target_spacing_ft`` and returns the device count whose
    interval spacing best matches ``target_spacing_ft``.

    ``target_spacing_ft`` is the MUTCD §6K.01 **maximum** spacing.  The
    section specifies a ceiling only — tighter is conservative, wider
    is unsafe — so the acceptance window is asymmetric:

        [target * (1 - tolerance),  target]

    The lower bound gives designers rounding room toward fewer devices;
    the upper bound is the max itself, never relaxed.  Candidates with
    spacing strictly above the target are rejected outright.

      * If both candidates land inside the window, the one with smaller
        absolute deviation from target wins.
      * If only one candidate lands inside, it wins.
      * If **neither** lands inside, the candidate with the smaller
        spacing (= more devices, ceil intervals) wins, so a forced
        choice never exceeds the maximum.

    Useful for laying out channelizers on a tangent (target =
    on-tangent spacing) or within a merging taper (target = in-taper
    spacing).  The returned count is floored at ``min_count`` so callers
    can guarantee a minimum device population (e.g. for taper-extraction
    disambiguation).

    Raises:
        ValueError: ``length_ft`` or ``target_spacing_ft`` is non-positive.
    """
    if length_ft <= 0 or target_spacing_ft <= 0:
        raise ValueError(
            "length_ft and target_spacing_ft must be positive; "
            f"got length_ft={length_ft}, target_spacing_ft={target_spacing_ft}"
        )

    exact_intervals = length_ft / target_spacing_ft
    floor_intervals = max(1, math.floor(exact_intervals))
    ceil_intervals = max(1, math.ceil(exact_intervals))

    # Asymmetric window: lower bound relaxed by ``tolerance``, upper
    # bound clamped at the MUTCD max.
    tol_hi = target_spacing_ft
    tol_lo = target_spacing_ft * (1 - tolerance)

    floor_spacing = length_ft / floor_intervals
    ceil_spacing = length_ft / ceil_intervals
    floor_in = tol_lo <= floor_spacing <= tol_hi
    ceil_in = tol_lo <= ceil_spacing <= tol_hi

    if floor_in and ceil_in:
        # Both fit; smaller deviation from target wins.
        floor_dev = abs(floor_spacing - target_spacing_ft)
        ceil_dev = abs(ceil_spacing - target_spacing_ft)
        best_intervals = floor_intervals if floor_dev <= ceil_dev else ceil_intervals
    elif floor_in:
        best_intervals = floor_intervals
    elif ceil_in:
        best_intervals = ceil_intervals
    else:
        # Neither fits.  Choose the smaller-spacing (= more-device)
        # candidate so we stay under the MUTCD §6K.01 maximum even when
        # the geometry forces us out of the window.
        best_intervals = ceil_intervals

    return max(min_count, best_intervals + 1)


# ---------------------------------------------------------------------------
# Colorado Supplement helpers
# ---------------------------------------------------------------------------


def co_speed_reduction_signs(current_speed: int, target_speed: int) -> int:
    """Number of advance speed-reduction sign installations.

    Source: CO Supplement §2B.13(A) — a single advance sign may reduce
    the posted speed by no more than 15 mph
    (``COLORADO_OVERRIDES.max_speed_reduction_per_sign_mph``); larger
    reductions require a stepped sequence of signs.

    Example: 65 → 45 mph = ``ceil(20 / 15)`` = 2 sign installations.

    Raises:
        ValueError: ``target_speed`` is not strictly less than
            ``current_speed``.
    """
    if target_speed >= current_speed:
        raise ValueError(
            f"target_speed ({target_speed}) must be strictly less than "
            f"current_speed ({current_speed})."
        )
    delta = current_speed - target_speed
    return math.ceil(delta / COLORADO_OVERRIDES.max_speed_reduction_per_sign_mph)


def co_construction_plaques(zone_length_ft: float) -> int:
    """Number of CONSTRUCTION ZONE plaque sets within a long work zone.

    Source: CO Supplement §6C.06(A) — plaques shall be repeated at
    half-mile intervals
    (``COLORADO_OVERRIDES.construction_zone_plaque_interval_ft`` = 2640
    ft).  At least one plaque set is required regardless of zone length.
    """
    interval = COLORADO_OVERRIDES.construction_zone_plaque_interval_ft
    return max(1, math.ceil(zone_length_ft / interval))
