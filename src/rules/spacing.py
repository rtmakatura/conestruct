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
    COLORADO_OVERRIDES,
    DOWNSTREAM_TAPER_LENGTH_PER_LANE_FT,
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

    Source: MUTCD 11th Ed. §6C.08.
    Below ``TAPER_LENGTH_FORMULA_THRESHOLD_MPH`` (40 mph): ``L = W * S² / 60``.
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

    Source: MUTCD 11th Ed. §6C.08 — shifting taper equals
    ``SHIFTING_TAPER_RATIO * L``.  Used at both ends of a lateral lane
    shift.
    """
    return taper_length(speed_mph, offset_ft) * SHIFTING_TAPER_RATIO


def shoulder_taper_length(speed_mph: int, offset_ft: float) -> float:
    """Shoulder taper length, in feet (L/3).

    Source: MUTCD 11th Ed. §6C.08 — shoulder taper is one-third of the
    full merging taper length.  Applies when only the shoulder is being
    closed.
    """
    return taper_length(speed_mph, offset_ft) / 3


def downstream_taper_length(num_lanes: int, use_max: bool = False) -> float:
    """Downstream taper length, in feet.

    Source: MUTCD 11th Ed. §6C.08 — downstream taper is 50 to 100 ft per
    lane closed.  The designer chooses within that range; this function
    returns the lower bound by default and the upper bound when
    ``use_max=True``.
    """
    per_lane_min, per_lane_max = DOWNSTREAM_TAPER_LENGTH_PER_LANE_FT
    return float(num_lanes * (per_lane_max if use_max else per_lane_min))


# ---------------------------------------------------------------------------
# Buffer space
# ---------------------------------------------------------------------------


def buffer_space(speed_mph: int) -> float:
    """Longitudinal buffer space, in feet.

    Source: MUTCD 11th Ed. Table 6B-2.  Buffer is keyed to posted speed
    in 5-mph increments from 20 to 75 mph.

    Raises:
        ValueError: ``speed_mph`` is not in {20, 25, 30, ..., 75}, or
            the table value at that speed is missing.
    """
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


# ---------------------------------------------------------------------------
# Advance warning sign spacing
# ---------------------------------------------------------------------------


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

                ≤ 35 mph        → ``urban_low``
                36–44 mph       → ``urban_high``
                ≥ 45 mph        → ``rural``

            Auto-inference cannot distinguish rural from expressway or
            freeway; callers operating on expressway or freeway routes
            must pass ``road_type`` explicitly to get the asymmetric
            1000/1500/2640 spacing.
    """
    if road_type is None:
        if speed_mph <= 35:
            road_type = "urban_low"
        elif speed_mph < 45:
            road_type = "urban_high"
        else:
            # NOTE: callers should pass ``road_type`` explicitly when the
            # roadway is an expressway or freeway; auto-inference always
            # selects "rural" for 45+ mph and so will under-spec the
            # advance warning distances on those facilities.
            road_type = "rural"

    for row in ADVANCE_WARNING_SIGN_SPACING:
        if row.road_category == road_type:
            return {
                "A": float(row.a_ft),
                "B": float(row.b_ft),
                "C": float(row.c_ft) if row.c_ft is not None else 0.0,
            }

    raise ValueError(
        f"Unknown road_type {road_type!r}; expected one of "
        "'urban_low', 'urban_high', 'rural', 'expressway', 'freeway'."
    )


# ---------------------------------------------------------------------------
# Channelizing device spacing
# ---------------------------------------------------------------------------


def device_spacing_in_taper(speed_mph: int) -> float:
    """Maximum channelizing device spacing within a taper, in feet.

    Source: MUTCD 11th Ed. §6C.09 — equals the posted speed expressed
    in feet (e.g., 55 mph → 55 ft).
    """
    return float(in_taper_spacing_ft(speed_mph))


def device_spacing_on_tangent(speed_mph: int) -> float:
    """Maximum channelizing device spacing on a tangent section, in feet.

    Source: MUTCD 11th Ed. §6C.09 — twice the in-taper spacing.
    """
    return float(on_tangent_spacing_ft(speed_mph))


def num_devices_in_taper(speed_mph: int, offset_ft: float) -> int:
    """Number of channelizing devices required within a merging taper.

    Source: MUTCD 11th Ed. §6C.08 (taper length) + §6C.09 (spacing).
    Computed as ``ceil(L / in_taper_spacing)`` so the taper is never
    under-populated.
    """
    return math.ceil(taper_length(speed_mph, offset_ft) / device_spacing_in_taper(speed_mph))


def num_devices_on_tangent(tangent_length_ft: float, speed_mph: int) -> int:
    """Number of channelizing devices required on a tangent section.

    Source: MUTCD 11th Ed. §6C.09.  Computed as
    ``ceil(length / tangent_spacing)``.
    """
    return math.ceil(tangent_length_ft / device_spacing_on_tangent(speed_mph))


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
