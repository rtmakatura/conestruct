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
    device_spacing_on_tangent,
    downstream_taper_length,
    pick_device_count,
    shoulder_taper_length,
    taper_length,
)
from src.rules.validators import DevicePlacement, ScenarioParams


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
    buf_len = buffer_space(speed, jurisdiction=params.jurisdiction)

    wz_end_station = 0.0
    wz_start_station = wz_len
    taper_end_station = wz_start_station + buf_len
    taper_start_station = taper_end_station + taper_len

    # Advance warning sign A/B/C (MUTCD Table 6B-1)
    spacing_abc = advance_warning_spacing(speed, params.road_type)
    a_dist, b_dist, c_dist = spacing_abc["A"], spacing_abc["B"], spacing_abc["C"]

    sign_a_station = taper_start_station + a_dist
    sign_b_station = sign_a_station + b_dist
    sign_c_station = sign_b_station + c_dist

    placements: list[DevicePlacement] = []

    # 1. Advance warning signs — mirrored on both sides of the divided
    # roadway per CO Supplement §6C.04(A).  Each W-series sign is placed
    # on the right shoulder (+offset) and the median side (-offset) at
    # the same station so drivers in either lane see the same advance
    # cues regardless of where they are in the carriageway.
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
    n_taper_devices = pick_device_count(taper_len, in_taper_spacing, min_count=2)
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
    # checked in ``validate_advance_warning_signs``.  Mirrored on both
    # sides of the divided roadway per CO Supplement §6C.04(A).
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
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=sign_offset_left,
                label="G20-5P",
            )
        )

    # 6. Work-zone tangent (cones).  ``pick_device_count`` chooses the
    # interval count whose spacing best matches the on-tangent target,
    # preferring counts that land in the validator's ±10 % tolerance.
    n_tangent = pick_device_count(wz_len, device_spacing_on_tangent(speed), min_count=2)
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

    # 8. END ROAD WORK sign (G20-2) past the downstream taper, mirrored
    # on both sides per CO Supplement §6C.04(A).
    end_sign_station = (wz_end_station - ds_taper_len) - 100.0
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=end_sign_station,
            offset_ft=sign_offset_right,
            label="G20-2",
        )
    )
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=end_sign_station,
            offset_ft=sign_offset_left,
            label="G20-2",
        )
    )

    # 9. BEGIN ROAD WORK sign (G20-1) at the upstream end of the work
    # zone, just past the buffer.  Pairs with G20-2 as bookends per
    # MUTCD §6F.55.  Mirrored on both sides per CO Supplement §6C.04(A).
    begin_sign_station = wz_start_station + 100.0
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=begin_sign_station,
            offset_ft=sign_offset_right,
            label="G20-1",
        )
    )
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=begin_sign_station,
            offset_ft=sign_offset_left,
            label="G20-1",
        )
    )

    # 10. Fines Double envelope (V1-Wide Item 3 — CO Supplement §2B.13 +
    # S-630-1 Sheet 12).  Emits only when the work-zone posted speed is
    # reduced below the nominal posted speed.  Envelope spans
    # wz_start+500 (R2-10) to wz_end-500 (R2-11), with G20-5P/R2-6P
    # assemblies at 2640 ft intervals.  Downstream R2-1 restores posted
    # speed 500 ft past R2-11.  Mirrored on both sides per CO Supplement
    # §6C.04(A).  Case 11 generic 500 ft offsets used uniformly across
    # speeds; Sheet 12 explicitly permits engineer adjustment.
    if params.work_zone_speed_mph is not None and params.work_zone_speed_mph < params.speed_mph:
        r2_10_station = wz_start_station + 500.0
        r2_11_station = wz_end_station - 500.0
        downstream_r2_1_station = wz_end_station - 1000.0
        envelope_len = r2_10_station - r2_11_station
        n_envelope_assemblies = max(1, math.ceil(envelope_len / 2640.0))

        # R2-10 BEGIN DOUBLE FINES ZONE — mirrored
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, r2_10_station, sign_offset_right, label="R2-10"
            )
        )
        placements.append(
            DevicePlacement(DeviceType.SIGN_GENERIC, r2_10_station, sign_offset_left, label="R2-10")
        )
        # R2-11 END DOUBLE FINES ZONE — mirrored
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, r2_11_station, sign_offset_right, label="R2-11"
            )
        )
        placements.append(
            DevicePlacement(DeviceType.SIGN_GENERIC, r2_11_station, sign_offset_left, label="R2-11")
        )
        # G20-5P / R2-6P assemblies — distinct placements at identical
        # station + offset; plan_sheet._deoverlap_signs_pairwise spreads
        # them vertically at render time.
        for k in range(n_envelope_assemblies):
            station = r2_11_station + (k + 0.5) * envelope_len / n_envelope_assemblies
            placements.append(
                DevicePlacement(DeviceType.SIGN_GENERIC, station, sign_offset_right, label="G20-5P")
            )
            placements.append(
                DevicePlacement(DeviceType.SIGN_GENERIC, station, sign_offset_right, label="R2-6P")
            )
            placements.append(
                DevicePlacement(DeviceType.SIGN_GENERIC, station, sign_offset_left, label="G20-5P")
            )
            placements.append(
                DevicePlacement(DeviceType.SIGN_GENERIC, station, sign_offset_left, label="R2-6P")
            )
        # Downstream R2-1 — posted-speed restoration past R2-11
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, downstream_r2_1_station, sign_offset_right, label="R2-1"
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, downstream_r2_1_station, sign_offset_left, label="R2-1"
            )
        )
        # Entrance R2-1 (V1-Wide G4 — CO Supplement §2B.13(A)).  Posts
        # the reduced work-zone limit so drivers see a regulatory sign
        # carrying the actual number as they enter the zone, not just
        # the W3-5 advisory + Fines Double envelope.  Anchored to the
        # upstream-most §6C.06(A) construction plaque (the first G20-5P
        # drivers encounter); reuses an existing convention rather than
        # inventing a new station constant.  Mirrored per CO §6C.04(A).
        entrance_r2_1_station = (n_plaques - 0.5) * wz_len / n_plaques
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                entrance_r2_1_station,
                sign_offset_right,
                label="R2-1",
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                entrance_r2_1_station,
                sign_offset_left,
                label="R2-1",
            )
        )

    return placements


def generate_shoulder_closure_undivided(
    params: ScenarioParams,
    shoulder_width_ft: float = 8.0,
) -> list[DevicePlacement]:
    """Generate a CDOT S-630-1 right-shoulder closure on a 2-lane undivided road.

    Hard-coded for a 2-lane two-way road (one lane each direction) with
    the right (work-side) shoulder closed.  Opposing traffic keeps its
    full lane and is not signed — MUTCD does not require both-sides
    advance warning for shoulder-only closures on undivided roads.

    Coordinates follow the project convention: ``station_ft = 0`` at the
    downstream end of the work zone, increasing upstream against
    traffic; ``offset_ft = 0`` at the road centerline, positive values
    to the right when facing upstream in the work direction.
    """
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft

    # Lateral landmarks — single lane in the work direction
    lane_edge_offset = params.lane_width_ft  # right edge of work-side lane
    shoulder_edge_offset = lane_edge_offset + shoulder_width_ft
    arrow_board_offset = lane_edge_offset + shoulder_width_ft / 2.0
    sign_offset_right = lane_edge_offset + 4.0

    # Longitudinal landmarks
    taper_len = shoulder_taper_length(speed, shoulder_width_ft)
    buf_len = buffer_space(speed, jurisdiction=params.jurisdiction)

    wz_end_station = 0.0
    wz_start_station = wz_len
    taper_end_station = wz_start_station + buf_len
    taper_start_station = taper_end_station + taper_len

    spacing_abc = advance_warning_spacing(speed, params.road_type)
    a_dist, b_dist, c_dist = spacing_abc["A"], spacing_abc["B"], spacing_abc["C"]

    sign_a_station = taper_start_station + a_dist
    sign_b_station = sign_a_station + b_dist
    sign_c_station = sign_b_station + c_dist

    placements: list[DevicePlacement] = []

    # 1. Advance warning signs (work-direction approach only)
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

    # 2. Shoulder taper (drums) — L/3 length per §6C.08.
    # Floor at 4 drums so the upstream taper run is strictly longer than
    # the 3-element downstream "taper + first tangent cone" run; otherwise
    # validate_taper_length picks the wrong taper at low speeds with an
    # 8-ft shoulder (formula gives 3 drums, ties with downstream).
    in_taper_spacing = device_spacing_in_taper(speed)
    n_taper_devices = pick_device_count(taper_len, in_taper_spacing, min_count=4)
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

    # 3. Arrow board at the upstream start of the taper (right-arrow).
    placements.append(
        DevicePlacement(
            device_type=DeviceType.ARROW_BOARD,
            station_ft=taper_start_station,
            offset_ft=arrow_board_offset,
            label="RIGHT_ARROW",
        )
    )

    # 4. Buffer space — intentionally empty.

    # 5. CONSTRUCTION ZONE plaques (G20-5P) at half-mile intervals.
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

    # 6. Work-zone tangent (cones).  ``pick_device_count`` chooses the
    # interval count whose spacing best matches the on-tangent target,
    # preferring counts that land in the validator's ±10 % tolerance.
    n_tangent = pick_device_count(wz_len, device_spacing_on_tangent(speed), min_count=2)
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

    # 7. Downstream taper — short (2 cones) so the merging taper upstream
    # is unambiguously the longest monotonic-offset run.
    ds_taper_len = downstream_taper_length(1)
    n_ds_cones = 2
    for k in range(n_ds_cones):
        t = (k + 1) / n_ds_cones
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

    # 9. BEGIN ROAD WORK sign (G20-1) at the upstream end of the work
    # zone, just past the buffer.  Pairs with G20-2 per MUTCD §6F.55.
    begin_sign_station = wz_start_station + 100.0
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=begin_sign_station,
            offset_ft=sign_offset_right,
            label="G20-1",
        )
    )

    # 10. Fines Double envelope (V1-Wide Item 3 — CO Supplement §2B.13 +
    # S-630-1 Sheet 12).  Emits only when the work-zone posted speed is
    # reduced below the nominal posted speed.  Single-side emission on
    # undivided roads — no mirror requirement under §6C.04(A).
    if params.work_zone_speed_mph is not None and params.work_zone_speed_mph < params.speed_mph:
        r2_10_station = wz_start_station + 500.0
        r2_11_station = wz_end_station - 500.0
        downstream_r2_1_station = wz_end_station - 1000.0
        envelope_len = r2_10_station - r2_11_station
        n_envelope_assemblies = max(1, math.ceil(envelope_len / 2640.0))

        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, r2_10_station, sign_offset_right, label="R2-10"
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, r2_11_station, sign_offset_right, label="R2-11"
            )
        )
        for k in range(n_envelope_assemblies):
            station = r2_11_station + (k + 0.5) * envelope_len / n_envelope_assemblies
            placements.append(
                DevicePlacement(DeviceType.SIGN_GENERIC, station, sign_offset_right, label="G20-5P")
            )
            placements.append(
                DevicePlacement(DeviceType.SIGN_GENERIC, station, sign_offset_right, label="R2-6P")
            )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, downstream_r2_1_station, sign_offset_right, label="R2-1"
            )
        )
        # Entrance R2-1 (V1-Wide G4 — CO Supplement §2B.13(A)).  Single
        # side on undivided per CO §6C.04(A); anchored to the upstream-
        # most §6C.06(A) plaque, matching the divided generator pattern.
        entrance_r2_1_station = (n_plaques - 0.5) * wz_len / n_plaques
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                entrance_r2_1_station,
                sign_offset_right,
                label="R2-1",
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
    buf_len = buffer_space(speed, jurisdiction=params.jurisdiction)

    wz_end_station = 0.0
    wz_start_station = wz_len
    taper_end_station = wz_start_station + buf_len
    taper_start_station = taper_end_station + taper_len

    spacing_abc = advance_warning_spacing(speed, params.road_type)
    a_dist, b_dist, c_dist = spacing_abc["A"], spacing_abc["B"], spacing_abc["C"]

    sign_a_station = taper_start_station + a_dist
    sign_b_station = sign_a_station + b_dist
    sign_c_station = sign_b_station + c_dist

    placements: list[DevicePlacement] = []

    # 1. Advance warning signs — lane closure series.  Mirrored on both
    # sides of the divided roadway per CO Supplement §6C.04(A) so drivers
    # in either lane see the same advance cues.
    advance_signs = (
        ("W4-2R", sign_a_station),  # RIGHT LANE ENDS (merge arrow)
        ("W20-5R", sign_b_station),  # RIGHT LANE CLOSED AHEAD
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
    n_taper_devices = pick_device_count(taper_len, in_taper_spacing, min_count=2)
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

    # 5. CONSTRUCTION ZONE plaques (G20-5P) at half-mile intervals,
    # mirrored on both sides per CO Supplement §6C.04(A).
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
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=sign_offset_left,
                label="G20-5P",
            )
        )

    # 6. Work-zone tangent (cones) — along the lane line between the
    # open left lane and the closed right lane.  ``pick_device_count``
    # chooses the interval count whose spacing best matches target.
    n_tangent = pick_device_count(wz_len, device_spacing_on_tangent(speed), min_count=2)
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

    # 8. END ROAD WORK sign (G20-2) past the downstream taper, mirrored
    # on both sides per CO Supplement §6C.04(A).
    end_sign_station = (wz_end_station - ds_taper_len) - 100.0
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=end_sign_station,
            offset_ft=sign_offset_right,
            label="G20-2",
        )
    )
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=end_sign_station,
            offset_ft=sign_offset_left,
            label="G20-2",
        )
    )

    # 9. BEGIN ROAD WORK sign (G20-1) at the upstream end of the work
    # zone, just past the buffer.  Pairs with G20-2 as bookends per
    # MUTCD §6F.55.  Mirrored on both sides per CO Supplement §6C.04(A).
    begin_sign_station = wz_start_station + 100.0
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=begin_sign_station,
            offset_ft=sign_offset_right,
            label="G20-1",
        )
    )
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=begin_sign_station,
            offset_ft=sign_offset_left,
            label="G20-1",
        )
    )

    # 10. Fines Double envelope (V1-Wide Item 3 — CO Supplement §2B.13 +
    # S-630-1 Sheet 12).  Emits only when the work-zone posted speed is
    # reduced below the nominal posted speed.  Mirrored on both sides
    # per CO Supplement §6C.04(A).
    if params.work_zone_speed_mph is not None and params.work_zone_speed_mph < params.speed_mph:
        r2_10_station = wz_start_station + 500.0
        r2_11_station = wz_end_station - 500.0
        downstream_r2_1_station = wz_end_station - 1000.0
        envelope_len = r2_10_station - r2_11_station
        n_envelope_assemblies = max(1, math.ceil(envelope_len / 2640.0))

        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, r2_10_station, sign_offset_right, label="R2-10"
            )
        )
        placements.append(
            DevicePlacement(DeviceType.SIGN_GENERIC, r2_10_station, sign_offset_left, label="R2-10")
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, r2_11_station, sign_offset_right, label="R2-11"
            )
        )
        placements.append(
            DevicePlacement(DeviceType.SIGN_GENERIC, r2_11_station, sign_offset_left, label="R2-11")
        )
        for k in range(n_envelope_assemblies):
            station = r2_11_station + (k + 0.5) * envelope_len / n_envelope_assemblies
            placements.append(
                DevicePlacement(DeviceType.SIGN_GENERIC, station, sign_offset_right, label="G20-5P")
            )
            placements.append(
                DevicePlacement(DeviceType.SIGN_GENERIC, station, sign_offset_right, label="R2-6P")
            )
            placements.append(
                DevicePlacement(DeviceType.SIGN_GENERIC, station, sign_offset_left, label="G20-5P")
            )
            placements.append(
                DevicePlacement(DeviceType.SIGN_GENERIC, station, sign_offset_left, label="R2-6P")
            )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, downstream_r2_1_station, sign_offset_right, label="R2-1"
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, downstream_r2_1_station, sign_offset_left, label="R2-1"
            )
        )
        # Entrance R2-1 (V1-Wide G4 — CO Supplement §2B.13(A)).  Same
        # upstream-most-§6C.06(A)-plaque anchor as the shoulder
        # generators; mirrored per CO §6C.04(A).
        entrance_r2_1_station = (n_plaques - 0.5) * wz_len / n_plaques
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                entrance_r2_1_station,
                sign_offset_right,
                label="R2-1",
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                entrance_r2_1_station,
                sign_offset_left,
                label="R2-1",
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
    *,
    afad: bool = False,
    pilot_car: bool = False,
    pedestrian_access: bool = False,
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

    Optional flags:
      ``afad``: substitute Automated Flagger Assistance Devices
        (TEMPORARY_SIGNAL with label "AFAD") for the human flagger
        stations and swap the W20-7 advance signs for W20-7a.
      ``pilot_car``: add G20-4 ("PILOT CAR FOLLOW ME") at each flagger
        station; the pilot vehicle itself is field equipment listed in
        the narrative, not a placed device.
      ``pedestrian_access``: add R9-9 ("SIDEWALK CLOSED — USE OTHER
        SIDE") at the upstream and downstream ends of the work zone on
        the work-side shoulder.

    Standards: MUTCD 11th Ed. Part 6 TA-10 is the federal standard for
    flagger-controlled alternating one-way traffic on a 2-lane undivided
    highway. CDOT S-630-1 has no general case for this scenario; Case 17
    (lane closure at a curve) is the closest CDOT analog but is curve-
    specialized. (Cases 6 and 7 in the 19-page set are LANE #2 and LANE
    #3 CLOSURES on multi-lane freeway, not flagger operations — the
    prior TODO citation was incorrect.)
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
    pedestrian_sign_offset = lane_edge_right + shoulder_width_ft  # outer shoulder edge

    # AFAD substitution: same DeviceType used for portable signals; the
    # "AFAD" label distinguishes it for the renderer and the validator.
    flagger_device = DeviceType.TEMPORARY_SIGNAL if afad else DeviceType.FLAGGER_STATION
    flagger_ahead_label = "W20-7a" if afad else "W20-7"
    flagger_label_1 = "AFAD_1" if afad else "FLAGGER_1"
    flagger_label_2 = "AFAD_2" if afad else "FLAGGER_2"

    # Longitudinal landmarks: full merging taper L (this is a travel-lane
    # closure, not a shoulder closure) per MUTCD §6C.08.
    taper_len = taper_length(speed, params.lane_width_ft)
    buf_len = buffer_space(speed, jurisdiction=params.jurisdiction)
    ds_taper_len = downstream_taper_length(1)

    wz_end_station = 0.0
    wz_start_station = wz_len
    taper_end_station = wz_start_station + buf_len
    taper_start_station = taper_end_station + taper_len

    spacing_abc = advance_warning_spacing(speed, params.road_type)
    a_dist, b_dist, c_dist = spacing_abc["A"], spacing_abc["B"], spacing_abc["C"]

    placements: list[DevicePlacement] = []

    # 1. Right-direction (upstream-approach) advance warning signs.
    # MUTCD §6E.05 / TA-10: drivers encounter ROAD WORK AHEAD (C) first,
    # then BE PREPARED TO STOP (B), then FLAGGER (A) closest to the flagger
    # station so the most specific cue is the freshest in mind at the stop.
    # Note W3-4 (not W20-4 = ONE LANE ROAD AHEAD) is the BE PREPARED TO STOP code.
    sign_a_station_r = taper_start_station + a_dist
    sign_b_station_r = sign_a_station_r + b_dist
    sign_c_station_r = sign_b_station_r + c_dist
    advance_signs_right = (
        (flagger_ahead_label, sign_a_station_r),  # FLAGGER AHEAD or AFAD AHEAD
        ("W3-4", sign_b_station_r),  # BE PREPARED TO STOP
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
    flagger_1_station = taper_start_station + 30.0
    placements.append(
        DevicePlacement(
            device_type=flagger_device,
            station_ft=flagger_1_station,
            offset_ft=flagger_offset_right,
            label=flagger_label_1,
        )
    )
    if pilot_car:
        # G20-4 "PILOT CAR FOLLOW ME" co-located with the flagger so
        # drivers see the requirement at the stop point.  G-series guide
        # sign, not a W-series warning sign — earlier code emitted the
        # spurious "W20-1A".
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=flagger_1_station,
                offset_ft=sign_offset_right,
                label="G20-4",
            )
        )

    # 3. Merging taper drums — push right-lane traffic across the
    # centerline into the opposing lane.  Offset transitions from the
    # right lane edge (+lane_width) to the centerline (0).
    in_taper_spacing = device_spacing_in_taper(speed)
    n_taper_devices = pick_device_count(taper_len, in_taper_spacing, min_count=2)
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
    # ``pick_device_count`` chooses the interval count whose spacing
    # best matches target; min_count=3 floors the cone count so the
    # centerline is unambiguously delineated even on short work zones.
    n_tangent = pick_device_count(wz_len, device_spacing_on_tangent(speed), min_count=3)
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
        (flagger_ahead_label, sign_a_station_l),  # FLAGGER AHEAD closest to flagger #2
        ("W3-4", sign_b_station_l),  # BE PREPARED TO STOP
        ("W20-1", sign_c_station_l),  # ROAD WORK AHEAD
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
    flagger_2_station = -ds_taper_len - 30.0
    placements.append(
        DevicePlacement(
            device_type=flagger_device,
            station_ft=flagger_2_station,
            offset_ft=flagger_offset_left,
            label=flagger_label_2,
        )
    )
    if pilot_car:
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=flagger_2_station,
                offset_ft=sign_offset_left,
                label="G20-4",
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

    # 10a. BEGIN ROAD WORK signs (G20-1) — one per direction, paired with
    # G20-2 per MUTCD §6F.55.  Right-direction sees BEGIN at the upstream
    # end of the work zone; opposing direction sees it at the downstream end.
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=wz_start_station + 100.0,
            offset_ft=sign_offset_right,
            label="G20-1",
        )
    )
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=-ds_taper_len - 100.0,
            offset_ft=sign_offset_left,
            label="G20-1",
        )
    )

    # 11. Pedestrian access signs — R9-9 "SIDEWALK CLOSED — USE OTHER
    # SIDE" at the upstream and downstream ends of the work zone, on
    # the work-side shoulder.  v1 does not emit detour-routing signs
    # (R9-11a etc.) — those need sidewalk geometry the form does not
    # capture yet.
    if pedestrian_access:
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=wz_start_station,
                offset_ft=pedestrian_sign_offset,
                label="R9-9",
            )
        )
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=wz_end_station,
                offset_ft=pedestrian_sign_offset,
                label="R9-9",
            )
        )

    return placements


def generate_work_beyond_shoulder(
    params: ScenarioParams,
    shoulder_width_ft: float = 10.0,
) -> list[DevicePlacement]:
    """Generate a TA-1 'Work Beyond the Shoulder' layout.

    Per MUTCD § 6G.04, work occurring outside the roadway shoulder
    requires only minimal advance signing — typically a single
    W21-5 SHOULDER WORK sign upstream, plus G20-2 END ROAD WORK
    downstream for long-duration work.  No taper, no buffer, no
    channelizing devices on the road itself.

    Coordinates: ``station_ft = 0`` at the downstream end of the work
    area; positive upstream against traffic.  Single-direction layout
    (no mirroring) since shoulder/setback work doesn't affect
    opposing traffic.
    """
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft

    lane_edge_offset = params.lane_width_ft
    sign_offset_right = lane_edge_offset + shoulder_width_ft + 4.0

    spacing_abc = advance_warning_spacing(speed, params.road_type)
    a_dist = spacing_abc["A"]

    wz_end_station = 0.0
    wz_start_station = wz_len
    sign_a_station = wz_start_station + a_dist

    placements: list[DevicePlacement] = [
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=sign_a_station,
            offset_ft=sign_offset_right,
            label="W21-5",  # SHOULDER WORK
        ),
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=wz_end_station - 100.0,
            offset_ft=sign_offset_right,
            label="G20-2",  # END ROAD WORK
        ),
    ]

    return placements


def generate_mobile_op_2lane(
    params: ScenarioParams,
    shoulder_width_ft: float = 8.0,
    *,
    arrow_board_on_shadow: bool = True,
) -> list[DevicePlacement]:
    """Generate a TA-35 'Mobile Operation on a Two-Lane Road' layout.

    Slow-moving operations (sweeping, striping, mowing, patching) where
    the protection moves with the work.  A shadow vehicle trails the
    work truck at ~100 ft, optionally equipped with a TMA + arrow board
    in caution mode.  Per MUTCD § 6G.05.

    Placements represent a snapshot at the current position; the work
    truck is at station 0, shadow upstream of it.  No fixed devices on
    the road — the layout is short-lived and follows the truck.
    """
    _ = shoulder_width_ft  # parameter kept for signature parity; mobile ops don't use shoulder
    lane_edge_right = params.lane_width_ft
    sign_offset = lane_edge_right + 4.0
    truck_offset = lane_edge_right / 2.0  # mid-lane

    # MUTCD §6G.05 typical: shadow trails the work truck at ~100 ft on
    # 2-lane roads — close enough for drivers to read the pair as one
    # moving group, far enough to absorb a rear-end impact.  This is
    # independent of ``params.work_zone_length_ft``, which is a fixed-area
    # concept that doesn't apply to mobile operations.
    shadow_trailing = 100.0
    work_truck_station = 0.0
    shadow_station = work_truck_station + shadow_trailing

    # Two advance warning signs upstream of the shadow vehicle, scaled
    # to posted speed via Table 6B-1.  W21-1a WORKERS sits closest to the
    # moving operation; W20-1 ROAD WORK AHEAD goes further upstream so
    # drivers see general context first.
    spacing_abc = advance_warning_spacing(params.speed_mph, params.road_type)
    a_dist = spacing_abc["A"]
    b_dist = spacing_abc["B"]
    workers_sign_station = shadow_station + a_dist
    roadwork_sign_station = workers_sign_station + b_dist

    placements: list[DevicePlacement] = [
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=roadwork_sign_station,
            offset_ft=sign_offset,
            label="W20-1",  # ROAD WORK AHEAD
        ),
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=workers_sign_station,
            offset_ft=sign_offset,
            label="W21-1a",  # WORKERS — MUTCD lowercase suffix convention
        ),
        DevicePlacement(
            device_type=DeviceType.TRUCK_MOUNTED_ATTENUATOR,
            station_ft=work_truck_station,
            offset_ft=truck_offset,
            label="WORK_TRUCK",
        ),
        DevicePlacement(
            device_type=DeviceType.TRUCK_MOUNTED_ATTENUATOR,
            station_ft=shadow_station,
            offset_ft=truck_offset,
            label="SHADOW_TMA",
        ),
    ]

    if arrow_board_on_shadow:
        placements.append(
            DevicePlacement(
                device_type=DeviceType.ARROW_BOARD,
                station_ft=shadow_station,
                offset_ft=truck_offset + 3.0,
                label="CAUTION",  # 4-corner flash, not directional arrow
            )
        )

    return placements


def generate_mobile_op_multilane(
    params: ScenarioParams,
    shoulder_width_ft: float = 10.0,
    *,
    second_tma: bool = False,
) -> list[DevicePlacement]:
    """Generate a TA-26 'Mobile Operation on a Multi-Lane Road' layout.

    Slow-moving operations on freeways and divided highways.  Shadow
    vehicle with TMA + arrow board (mandatory at multi-lane speeds)
    trails the work truck; a second TMA may be deployed further upstream
    at posted speeds ≥ 55 mph or when crash worthiness is critical.
    Per MUTCD § 6G.06.

    Geometry assumes a 2-lane-per-direction work-side carriageway with
    the right lane occupied by the moving operation.
    """
    lane_line_offset = params.lane_width_ft
    closed_lane_center = 1.5 * params.lane_width_ft
    sign_offset = 2.0 * params.lane_width_ft + 4.0

    work_truck_station = 0.0
    shadow_trailing = max(150.0, params.work_zone_length_ft)
    shadow_station = work_truck_station + shadow_trailing
    second_tma_station = shadow_station + 1000.0

    placements: list[DevicePlacement] = [
        DevicePlacement(
            device_type=DeviceType.TRUCK_MOUNTED_ATTENUATOR,
            station_ft=work_truck_station,
            offset_ft=closed_lane_center,
            label="WORK_TRUCK",
        ),
        DevicePlacement(
            device_type=DeviceType.TRUCK_MOUNTED_ATTENUATOR,
            station_ft=shadow_station,
            offset_ft=closed_lane_center,
            label="SHADOW_TMA",
        ),
        DevicePlacement(
            device_type=DeviceType.ARROW_BOARD,
            station_ft=shadow_station,
            offset_ft=closed_lane_center + 2.0,
            label="LEFT_ARROW",
        ),
    ]

    if second_tma:
        placements.append(
            DevicePlacement(
                device_type=DeviceType.TRUCK_MOUNTED_ATTENUATOR,
                station_ft=second_tma_station,
                offset_ft=closed_lane_center,
                label="UPSTREAM_TMA",
            )
        )

    # ``lane_line_offset`` and ``sign_offset`` are computed for layout
    # legibility but mobile ops don't place advance roadside signs
    # (the shadow's arrow board + TMA are the active warning).
    _ = lane_line_offset
    _ = sign_offset

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
        road_type="freeway",
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
        road_type="freeway",
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
