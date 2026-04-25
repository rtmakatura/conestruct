"""Hard-coded scenario generator: CDOT S-630-1 right-shoulder closure on a divided highway.

This module is a Phase 3 milestone — a single function that emits a
complete, MUTCD-compliant device layout for one specific scenario.  It
will be replaced in Phase 4 by a generic layout engine that consumes
the rule pack and the road geometry to lay out arbitrary closures.

Authoritative sources:
  - MUTCD 11th Edition, Part 6 (Temporary Traffic Control)
  - CDOT M&S Standard Plan S-630-1 (Right Shoulder Closure)
  - Colorado Supplement to MUTCD (effective 2026-01-18)
"""

from __future__ import annotations

import math

from src.rules.devices import DeviceType
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    co_construction_plaques,
    device_spacing_in_taper,
    downstream_taper_length,
    num_devices_on_tangent,
    shoulder_taper_length,
)
from src.rules.validators import DevicePlacement, ScenarioParams

# Categories accepted by ``advance_warning_spacing`` directly; any other
# value (e.g., the descriptive "divided_highway") is mapped to None so
# the function falls back to its speed-based inference.
_TABLE_6B_1_CATEGORIES: frozenset[str] = frozenset(
    {"urban_low", "urban_high", "rural", "expressway", "freeway"}
)


def generate_shoulder_closure_divided(
    params: ScenarioParams,
    shoulder_width_ft: float = 10.0,
) -> list[DevicePlacement]:
    """Generate a complete CDOT S-630-1 right-shoulder closure layout.

    Hard-coded for a 4-lane divided highway with a right-shoulder
    closure at posted speeds in the 45–65 mph range.  All longitudinal
    positions flow from the spacing functions in ``src.rules.spacing``,
    so the layout flexes with ``params.speed_mph``.  Lateral positions
    assume two ``params.lane_width_ft`` lanes per direction plus an
    outer shoulder of ``shoulder_width_ft``.

    Coordinates follow the project convention: ``station_ft = 0`` at
    the downstream end of the work zone, increasing upstream against
    traffic; ``offset_ft = 0`` at the road centerline, positive values
    to the right when facing upstream.
    """
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft

    # Lateral landmarks
    lane_edge_offset = 2.0 * params.lane_width_ft  # right edge of right lane
    shoulder_edge_offset = lane_edge_offset + shoulder_width_ft
    arrow_board_offset = lane_edge_offset + shoulder_width_ft / 2.0
    sign_offset_right = lane_edge_offset + 4.0
    sign_offset_left = -sign_offset_right

    # Longitudinal landmarks
    taper_len = shoulder_taper_length(speed, shoulder_width_ft)
    buf_len = buffer_space(speed)

    wz_end_station = 0.0
    wz_start_station = wz_len
    taper_end_station = wz_start_station + buf_len
    taper_start_station = taper_end_station + taper_len

    # Advance warning sign A/B/C (MUTCD Table 6B-1)
    rt = params.road_type if params.road_type in _TABLE_6B_1_CATEGORIES else None
    spacing_abc = advance_warning_spacing(speed, rt)
    a_dist, b_dist, c_dist = spacing_abc["A"], spacing_abc["B"], spacing_abc["C"]

    sign_a_station = taper_start_station + a_dist
    sign_b_station = sign_a_station + b_dist
    sign_c_station = sign_b_station + c_dist

    placements: list[DevicePlacement] = []

    # 1. Advance warning signs
    advance_signs = (
        ("W21-5aR", sign_a_station),  # RIGHT SHOULDER CLOSED AHEAD
        ("W20-2", sign_b_station),  # ROAD WORK xxx FT
        ("W20-1", sign_c_station),  # ROAD WORK AHEAD
    )
    for label, station in advance_signs:
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=sign_offset_right,
                label=label,
            )
        )
        if params.is_divided:
            placements.append(
                DevicePlacement(
                    device_type=DeviceType.SIGN_GENERIC,
                    station_ft=station,
                    offset_ft=sign_offset_left,
                    label=label,
                )
            )

    # 2. Shoulder taper (drums)
    in_taper_spacing = device_spacing_in_taper(speed)
    n_taper_devices = max(2, math.ceil(taper_len / in_taper_spacing))
    n_taper_intervals = n_taper_devices - 1
    for k in range(n_taper_devices):
        t = k / n_taper_intervals  # 0 at taper_start, 1 at buffer_end
        station = taper_start_station - t * taper_len
        offset = shoulder_edge_offset - t * (shoulder_edge_offset - lane_edge_offset)
        placements.append(
            DevicePlacement(
                device_type=DeviceType.DRUM,
                station_ft=station,
                offset_ft=offset,
            )
        )

    # 3. Arrow board at the upstream start of the taper
    placements.append(
        DevicePlacement(
            device_type=DeviceType.ARROW_BOARD,
            station_ft=taper_start_station,
            offset_ft=arrow_board_offset,
        )
    )

    # 4. Buffer space — intentionally empty.

    # 5. CONSTRUCTION ZONE plaques (G20-5P).  Count is keyed to the total
    # signed length, but the plaques themselves stay inside the work zone
    # so they do not interleave with the advance-warning A/B/C cluster
    # checked in ``validate_advance_warning_signs``.
    total_zone_length = sign_c_station
    n_plaques = co_construction_plaques(total_zone_length)
    for k in range(n_plaques):
        station = (k + 0.5) * wz_len / n_plaques
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=sign_offset_right,
                label="G20-5P",
            )
        )
        if params.is_divided:
            placements.append(
                DevicePlacement(
                    device_type=DeviceType.SIGN_GENERIC,
                    station_ft=station,
                    offset_ft=sign_offset_left,
                    label="G20-5P",
                )
            )

    # 6. Work-zone tangent (cones)
    n_tangent = max(2, num_devices_on_tangent(wz_len, speed))
    n_tangent_intervals = n_tangent - 1
    tangent_spacing = wz_len / n_tangent_intervals
    for k in range(n_tangent):
        station = wz_end_station + k * tangent_spacing
        placements.append(
            DevicePlacement(
                device_type=DeviceType.CONE,
                station_ft=station,
                offset_ft=lane_edge_offset,
            )
        )

    # 7. Downstream taper — kept short (2 cones) so the merging taper
    # upstream is unambiguously the longest monotonic-offset run and
    # ``_extract_taper_indices`` selects it rather than this one.
    ds_taper_len = downstream_taper_length(1)
    n_ds_cones = 2
    for k in range(n_ds_cones):
        t = (k + 1) / n_ds_cones  # k=0 → mid, k=last → far end
        station = wz_end_station - t * ds_taper_len
        offset = lane_edge_offset + t * (shoulder_edge_offset - lane_edge_offset)
        placements.append(
            DevicePlacement(
                device_type=DeviceType.CONE,
                station_ft=station,
                offset_ft=offset,
            )
        )

    # 8. END ROAD WORK sign (G20-2)
    end_sign_station = (wz_end_station - ds_taper_len) - 100.0
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=end_sign_station,
            offset_ft=sign_offset_right,
            label="G20-2",
        )
    )
    if params.is_divided:
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=end_sign_station,
                offset_ft=sign_offset_left,
                label="G20-2",
            )
        )

    return placements


if __name__ == "__main__":
    from collections import Counter

    from src.rules.validators import validate_layout

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="divided_highway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    placements = generate_shoulder_closure_divided(params)

    print(f"Total devices: {len(placements)}")
    print()
    print("Breakdown by DeviceType:")
    counts = Counter(p.device_type for p in placements)
    for dt, n in sorted(counts.items(), key=lambda kv: kv[0].value):
        print(f"  {dt.value:25s} {n}")

    violations = validate_layout(placements, params)
    err_count = sum(1 for v in violations if v.severity == "error")
    warn_count = sum(1 for v in violations if v.severity == "warning")

    print()
    print(f"Violations: {err_count} error(s), {warn_count} warning(s)")
    for v in violations:
        loc = f" @ idx {v.device_index}" if v.device_index is not None else ""
        print(f"  [{v.severity.upper():>7s}] {v.rule_id} ({v.mutcd_section}){loc}")
        print(f"          {v.message}")
