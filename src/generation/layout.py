"""Hard-coded scenario generators: CDOT S-630-1 right-shoulder and right-lane closures.

This module is a Phase 3 milestone — concrete functions that emit
complete, MUTCD-compliant device layouts for the two V1 scenarios.
It will be replaced in Phase 4 by a generic layout engine that consumes
the rule pack and the road geometry to lay out arbitrary closures.

Authoritative sources:
  - MUTCD 11th Edition, Part 6 (Temporary Traffic Control)
  - CDOT M&S Standard Plan S-630-1 (Right Shoulder Closure / Right Lane Closure)
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
    taper_length,
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

    # 3. Arrow board at the upstream start of the taper.
    # Right-arrow mode for shoulder closure (caution/right-shift indication
    # next to the closed shoulder); lane closures use LEFT_ARROW instead.
    placements.append(
        DevicePlacement(
            device_type=DeviceType.ARROW_BOARD,
            station_ft=taper_start_station,
            offset_ft=arrow_board_offset,
            label="RIGHT_ARROW",
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


def generate_lane_closure_divided(
    params: ScenarioParams,
    shoulder_width_ft: float = 10.0,
) -> list[DevicePlacement]:
    """Generate a complete CDOT S-630-1 right-lane closure layout.

    Hard-coded for a 4-lane divided highway with the right (outer)
    travel lane closed at posted speeds in the 45–65 mph range.  All
    longitudinal positions flow from the spacing functions in
    ``src.rules.spacing``, so the layout flexes with ``params.speed_mph``.
    Lateral positions assume two ``params.lane_width_ft`` lanes per
    direction plus an outer shoulder of ``shoulder_width_ft``.

    Geometry (work-side carriageway, positive offsets):
      * 0 .. lane_width_ft        — open left lane
      * lane_width_ft .. 2*lane_width_ft — closed right lane
      * 2*lane_width_ft .. + shoulder    — outer shoulder (open)

    The merging taper drums run from the right edge of the right lane
    (lane_edge_offset) DOWN to the lane line (lane_line_offset), so the
    full taper length L (not L/3) is required by MUTCD §6C.08.

    TODO (V1.1): add a shifting taper upstream of the merging taper for
    cases where geometry requires drivers to first shift laterally before
    encountering the lane drop.  V1 places the merging taper directly.
    """
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft

    # Lateral landmarks (positive = right of centerline, work side)
    lane_line_offset = params.lane_width_ft  # boundary between open and closed lanes
    lane_edge_offset = 2.0 * params.lane_width_ft  # right edge of the closed right lane
    shoulder_edge_offset = lane_edge_offset + shoulder_width_ft
    arrow_board_offset = lane_line_offset + params.lane_width_ft / 2.0  # mid-closed-lane
    sign_offset_right = lane_edge_offset + 4.0
    sign_offset_left = -sign_offset_right

    # Longitudinal landmarks: full merging taper L (not L/3) since this
    # is a travel-lane closure rather than a shoulder closure.
    taper_len = taper_length(speed, params.lane_width_ft)
    buf_len = buffer_space(speed)

    wz_end_station = 0.0
    wz_start_station = wz_len
    taper_end_station = wz_start_station + buf_len
    taper_start_station = taper_end_station + taper_len

    rt = params.road_type if params.road_type in _TABLE_6B_1_CATEGORIES else None
    spacing_abc = advance_warning_spacing(speed, rt)
    a_dist, b_dist, c_dist = spacing_abc["A"], spacing_abc["B"], spacing_abc["C"]

    sign_a_station = taper_start_station + a_dist
    sign_b_station = sign_a_station + b_dist
    sign_c_station = sign_b_station + c_dist

    placements: list[DevicePlacement] = []

    # 1. Advance warning signs — lane closure series
    advance_signs = (
        ("W4-2R", sign_a_station),  # RIGHT LANE ENDS (merge arrow)
        ("W20-5B", sign_b_station),  # RIGHT LANE CLOSED AHEAD
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

    # 2. Merging taper (drums) — full length L from lane edge to lane line
    in_taper_spacing = device_spacing_in_taper(speed)
    n_taper_devices = max(2, math.ceil(taper_len / in_taper_spacing))
    n_taper_intervals = n_taper_devices - 1
    for k in range(n_taper_devices):
        t = k / n_taper_intervals  # 0 at taper_start (upstream), 1 at buffer_end
        station = taper_start_station - t * taper_len
        offset = lane_edge_offset - t * (lane_edge_offset - lane_line_offset)
        placements.append(
            DevicePlacement(
                device_type=DeviceType.DRUM,
                station_ft=station,
                offset_ft=offset,
            )
        )

    # 3. Arrow board at the upstream start of the taper, LEFT arrow mode
    # so drivers in the closed lane merge LEFT into the open lane.
    placements.append(
        DevicePlacement(
            device_type=DeviceType.ARROW_BOARD,
            station_ft=taper_start_station,
            offset_ft=arrow_board_offset,
            label="LEFT_ARROW",
        )
    )

    # 4. Buffer space — intentionally empty.

    # 5. CONSTRUCTION ZONE plaques (G20-5P) at half-mile intervals
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

    # 6. Work-zone tangent (cones) — along the lane line between the
    # open left lane and the closed right lane.
    n_tangent = max(2, num_devices_on_tangent(wz_len, speed))
    n_tangent_intervals = n_tangent - 1
    tangent_spacing = wz_len / n_tangent_intervals
    for k in range(n_tangent):
        station = wz_end_station + k * tangent_spacing
        placements.append(
            DevicePlacement(
                device_type=DeviceType.CONE,
                station_ft=station,
                offset_ft=lane_line_offset,
            )
        )

    # 7. Downstream taper — cones angle from the lane line back out to
    # the right lane edge so the lane reopens cleanly.
    ds_taper_len = downstream_taper_length(1)
    n_ds_cones = 2
    for k in range(n_ds_cones):
        t = (k + 1) / n_ds_cones
        station = wz_end_station - t * ds_taper_len
        offset = lane_line_offset + t * (lane_edge_offset - lane_line_offset)
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

    # ``shoulder_edge_offset`` is computed for completeness (notes/legend
    # may reference the road's overall lateral extent) but is not used
    # for any device placement in a lane-only closure.
    _ = shoulder_edge_offset

    return placements


def generate_flagger_alternating_2lane(
    params: ScenarioParams,
    shoulder_width_ft: float = 8.0,
) -> list[DevicePlacement]:
    """Generate a CDOT S-630-1 flagger-controlled alternating-traffic layout.

    Hard-coded for a 2-lane undivided highway (one lane each direction)
    with the right (work-side) lane closed.  Both directions of travel
    share the open opposing lane, controlled by a flagger at each end.
    Posted speeds in the 35–55 mph range.

    Geometry (positive offsets = right of centerline, work side):
      * 0  ..  +lane_width_ft         — closed right lane
      * 0  ..  -lane_width_ft         — open left lane (opposing direction)
      * outer shoulders symmetric on either side

    Two sets of advance warning signs and two flagger stations are
    placed: one set for the right-direction approach (positive offset,
    upstream of the merging taper) and one for the opposing approach
    (negative offset, downstream of the work zone).

    TODO: confirm exact CDOT S-630-1 Case number for one-lane two-way
    flagger operation; cases 6/7 of the 19-page set are likely matches.
    """
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft

    # Lateral landmarks
    lane_edge_right = params.lane_width_ft  # right edge of closed right lane
    lane_edge_left = -params.lane_width_ft  # outer edge of opposing lane
    sign_offset_right = lane_edge_right + 4.0
    sign_offset_left = lane_edge_left - 4.0
    flagger_offset_right = lane_edge_right + 6.0
    flagger_offset_left = lane_edge_left - 6.0

    # Longitudinal landmarks: full merging taper L (this is a travel-lane
    # closure, not a shoulder closure) per MUTCD §6C.08.
    taper_len = taper_length(speed, params.lane_width_ft)
    buf_len = buffer_space(speed)
    ds_taper_len = downstream_taper_length(1)

    wz_end_station = 0.0
    wz_start_station = wz_len
    taper_end_station = wz_start_station + buf_len
    taper_start_station = taper_end_station + taper_len

    rt = params.road_type if params.road_type in _TABLE_6B_1_CATEGORIES else None
    spacing_abc = advance_warning_spacing(speed, rt)
    a_dist, b_dist, c_dist = spacing_abc["A"], spacing_abc["B"], spacing_abc["C"]

    placements: list[DevicePlacement] = []

    # 1. Right-direction (upstream-approach) advance warning signs
    sign_a_station_r = taper_start_station + a_dist
    sign_b_station_r = sign_a_station_r + b_dist
    sign_c_station_r = sign_b_station_r + c_dist
    advance_signs_right = (
        ("W20-4", sign_a_station_r),  # BE PREPARED TO STOP
        ("W20-7", sign_b_station_r),  # FLAGGER AHEAD
        ("W20-1", sign_c_station_r),  # ROAD WORK AHEAD
    )
    for label, station in advance_signs_right:
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=sign_offset_right,
                label=label,
            )
        )

    # 2. Flagger station #1 — upstream end of the merging taper
    placements.append(
        DevicePlacement(
            device_type=DeviceType.FLAGGER_STATION,
            station_ft=taper_start_station + 30.0,
            offset_ft=flagger_offset_right,
            label="FLAGGER_1",
        )
    )

    # 3. Merging taper drums — push right-lane traffic across the
    # centerline into the opposing lane.  Offset transitions from the
    # right lane edge (+lane_width) to the centerline (0).
    in_taper_spacing = device_spacing_in_taper(speed)
    n_taper_devices = max(2, math.ceil(taper_len / in_taper_spacing))
    n_taper_intervals = n_taper_devices - 1
    for k in range(n_taper_devices):
        t = k / n_taper_intervals
        station = taper_start_station - t * taper_len
        offset = lane_edge_right - t * lane_edge_right  # lane_edge to 0
        placements.append(
            DevicePlacement(
                device_type=DeviceType.DRUM,
                station_ft=station,
                offset_ft=offset,
            )
        )

    # 4. Buffer space — intentionally empty.

    # 5. Work-zone tangent cones along the centerline, delineating the
    # boundary between the open opposing lane and the closed work lane.
    # ``num_devices_on_tangent`` returns the interval count, so add one for
    # the device count to keep spacing inside the 10 % channelizer tolerance.
    n_tangent = max(3, num_devices_on_tangent(wz_len, speed) + 1)
    n_tangent_intervals = n_tangent - 1
    tangent_spacing = wz_len / n_tangent_intervals
    for k in range(n_tangent):
        station = wz_end_station + k * tangent_spacing
        placements.append(
            DevicePlacement(
                device_type=DeviceType.CONE,
                station_ft=station,
                offset_ft=0.0,
            )
        )

    # 6. CONSTRUCTION ZONE plaques (G20-5P) inside the work zone,
    # right side only (undivided road — no mirror requirement).
    total_zone_length = sign_c_station_r
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

    # 7. Opposing-direction advance warning signs (negative stations,
    # left side of road — facing traffic approaching from downstream).
    sign_a_station_l = -ds_taper_len - 30.0 - a_dist
    sign_b_station_l = sign_a_station_l - b_dist
    sign_c_station_l = sign_b_station_l - c_dist
    advance_signs_left = (
        ("W20-4", sign_a_station_l),
        ("W20-7", sign_b_station_l),
        ("W20-1", sign_c_station_l),
    )
    for label, station in advance_signs_left:
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=sign_offset_left,
                label=label,
            )
        )

    # 8. Flagger station #2 — just downstream of the downstream taper end,
    # facing opposing traffic before they enter the work area.
    placements.append(
        DevicePlacement(
            device_type=DeviceType.FLAGGER_STATION,
            station_ft=-ds_taper_len - 30.0,
            offset_ft=flagger_offset_left,
            label="FLAGGER_2",
        )
    )

    # 9. Downstream taper cones — transition right-direction traffic from
    # the centerline back to the right lane edge after the work zone.
    n_ds_cones = 2
    for k in range(n_ds_cones):
        t = (k + 1) / n_ds_cones
        station = wz_end_station - t * ds_taper_len
        offset = t * lane_edge_right
        placements.append(
            DevicePlacement(
                device_type=DeviceType.CONE,
                station_ft=station,
                offset_ft=offset,
            )
        )

    # 10. END ROAD WORK signs (G20-2) — one per direction.  The
    # right-direction sign sits past the downstream taper; the
    # opposing-direction sign sits past the upstream end of the work zone.
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=-ds_taper_len - 100.0,
            offset_ft=sign_offset_right,
            label="G20-2",
        )
    )
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=wz_start_station + 100.0,
            offset_ft=sign_offset_left,
            label="G20-2",
        )
    )

    # ``shoulder_width_ft`` is currently a layout-only nicety (used for
    # visual scaling on the rendered plan) and not consumed by device
    # placement; reserved for future shoulder/edge channelization.
    _ = shoulder_width_ft

    return placements


def _print_smoke_test(
    title: str,
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> None:
    from collections import Counter

    from src.rules.validators import validate_layout

    print(f"\n--- {title} ---")
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


if __name__ == "__main__":
    shoulder_params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="divided_highway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    shoulder_placements = generate_shoulder_closure_divided(shoulder_params)
    _print_smoke_test("Shoulder Closure Scenario", shoulder_placements, shoulder_params)

    lane_params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="lane",
        road_type="divided_highway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    lane_placements = generate_lane_closure_divided(lane_params)
    _print_smoke_test("Lane Closure Scenario", lane_placements, lane_params)

    flagger_params = ScenarioParams(
        speed_mph=45,
        num_lanes=1,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        lane_width_ft=11.0,
        is_divided=False,
        is_night=False,
        jurisdiction="CDOT",
    )
    flagger_placements = generate_flagger_alternating_2lane(flagger_params)
    _print_smoke_test("Flagger Alternating 2-Lane Scenario", flagger_placements, flagger_params)
