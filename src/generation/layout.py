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
from typing import Any

from src.rules.devices import DeviceType
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    co_construction_plaques,
    co_speed_reduction_signs,
    device_spacing_in_taper,
    device_spacing_on_tangent,
    downstream_taper_length,
    flagger_to_taper_distance,
    one_lane_two_way_device_spacing,
    one_lane_two_way_taper_length,
    opposing_flagger_standoff,
    pick_device_count,
    shoulder_taper_length,
    taper_length,
)
from src.rules.validators import ApproachParams, DevicePlacement, ScenarioParams


def _dedupe_placements(placements: list[DevicePlacement]) -> list[DevicePlacement]:
    """Drop exact-coincident duplicate devices, preserving order (keep first).

    Two devices sharing the same (device_type, label, station, offset)
    describe a single physical sign at one point — two identical glyphs
    there is never a real installation.  The known case: the Sheet-2-Note-4
    construction-zone plaque series (§5) and the Fines Double envelope
    assembly (§10) each emit a G20-5P, and for some work-zone lengths the
    single envelope assembly centres exactly on a Note-4 plaque station
    (e.g. wz_len = 1000 → n_plaques = 3 → middle plaque at 500 = envelope
    centre).  Keep-first preserves the Note-4 plaque (emitted earlier); the
    envelope's R2-6P (distinct label) is untouched, so the Fines Double
    G20-5P + R2-6P assembly stays intact.  Legitimate distinct-station
    coexistence and same-coordinate different-label stacks are preserved.

    Coordinates round to 0.1 ft so float wobble in the spacing math can't
    defeat the match.  Applied at every generator return so "no generator
    emits two identical devices at the same point" is a structural
    invariant that also guards future generators.

    ``approach_id`` is part of the identity: equal coordinates in
    different approach frames are different physical points (two
    cross-street legs get identical sign sets at identical approach-frame
    stations — Option C increment 2).  All-mainline lists (every other
    generator) are unaffected: the extra key element is constant there.
    """
    seen: set[tuple[DeviceType, str | None, float, float, str]] = set()
    out: list[DevicePlacement] = []
    for p in placements:
        key = (
            p.device_type,
            p.label,
            round(p.station_ft, 1),
            round(p.offset_ft, 1),
            p.approach_id,
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


def device_count_floors(params: ScenarioParams) -> tuple[int, int]:
    """``(taper_min, tangent_min)`` device-count floors the V1 generators apply.

    Single source for the per-scenario ``min_count`` values so the
    audit trail and crew narrative recompute "required" counts with the
    same floors the generators deploy (audit fix B-07 — the previous
    hard-coded ``min_count=2`` recomputation under-reported on the
    paths that floor higher):

    * Undivided shoulder closures floor the taper at **4** drums so the
      upstream taper run is strictly longer than the 3-element
      downstream "taper + first tangent cone" run; otherwise
      ``validate_taper_length`` picks the wrong taper at low speeds
      with an 8-ft shoulder.
    * Flagger operations (single-lane closure on an undivided road)
      floor the tangent at **3** cones so the centerline is
      unambiguously delineated even on short work zones.
    * Everything else uses the ``pick_device_count`` default floor of 2.
    """
    is_lane = params.closure_type == "lane"
    taper_min = 4 if params.closure_type == "shoulder" and not params.is_divided else 2
    tangent_min = 3 if is_lane and not params.is_divided else 2
    return taper_min, tangent_min


def generate_shoulder_closure_divided(
    params: ScenarioParams,
    shoulder_width_ft: float | None = None,
) -> list[DevicePlacement]:
    """Generate a complete CDOT S-630-1 right-shoulder closure layout.

    Models a divided highway with a right-shoulder closure at posted
    speeds in the 45–65 mph range.  All longitudinal positions flow
    from the spacing functions in ``src.rules.spacing``, so the layout
    flexes with ``params.speed_mph``.  Lateral positions use
    ``params.num_lanes`` lanes per direction of ``params.lane_width_ft``
    plus an outer shoulder of ``shoulder_width_ft`` (defaults to
    ``params.shoulder_width_ft`` — the single source of truth; the
    kwarg remains as an explicit override only).

    Coordinates follow the project convention: ``station_ft = 0`` at
    the downstream end of the work zone, increasing upstream against
    traffic; ``offset_ft = 0`` at the road centerline, positive values
    to the right when facing upstream.
    """
    if shoulder_width_ft is None:
        shoulder_width_ft = params.shoulder_width_ft
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft

    # Lateral landmarks
    lane_edge_offset = params.num_lanes * params.lane_width_ft  # right edge of outer lane
    shoulder_edge_offset = lane_edge_offset + shoulder_width_ft
    arrow_board_offset = lane_edge_offset + shoulder_width_ft / 2.0
    sign_offset_right = lane_edge_offset + 4.0
    sign_offset_left = -sign_offset_right

    # Longitudinal landmarks
    taper_len = shoulder_taper_length(speed, shoulder_width_ft)
    buf_len = buffer_space(
        speed, jurisdiction=params.jurisdiction, work_zone_speed_mph=params.work_zone_speed_mph
    )

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
    # roadway per S-630-1 Sheet 2 General Note 8.  Each W-series sign is placed
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

    # 1a. W5-1 ROAD NARROWS (V1-Wide G2) per CDOT S-630-1 Sheet 7 Case 11,
    # position 7 — emitted 500 ft upstream of taper start on freeway
    # no-reduction shoulder closures.  Sheet 14 Cases 26/27 (reduced
    # work-zone speed) omit W5-1 per case_specific_notes; gate is the
    # inverse of the Fines Double / G4 / G5 predicate.  Mirrored per CDOT
    # S-630-1 Sheet 2, General Note 8.
    is_reduced = params.work_zone_speed_mph is not None and params.work_zone_speed_mph < speed
    if params.road_type == "freeway" and not is_reduced:
        w5_1_station = taper_start_station + 500.0
        placements.append(
            DevicePlacement(DeviceType.SIGN_GENERIC, w5_1_station, sign_offset_right, label="W5-1")
        )
        placements.append(
            DevicePlacement(DeviceType.SIGN_GENERIC, w5_1_station, sign_offset_left, label="W5-1")
        )

    # 1b. Second W21-5aR + W16-2a / W7-3a plaque pair (V1-Wide G1) per
    # CDOT S-630-1 Sheet 7 Case 11 positions 5/6 and Sheet 14 Cases
    # 26/27 positions 4/6.  Two W21-5aR signs are prescribed: the
    # upstream sign (already emitted at sign_a_station above) carries a
    # W16-2a "NEXT XXX FT" plaque; a second downstream sign sits between
    # the first W21-5aR and the taper carrying a W7-3a "NEXT X MILES"
    # plaque.  Emission gate matches W5-1's: freeway shoulder closures
    # only (Sheet 7/14 fixtures don't prescribe second W21-5aR off
    # freeway; lane closures and flagger are out of scope per
    # case_10/TA-10).  Applies on both no-reduction and reduced-speed
    # routings — fixture uniformity across Cases 11/11b/26/27.
    #
    # Geometry: second W21-5aR sits at the midpoint between the first
    # W21-5aR (sign_a_station) and the W5-1-would-be station
    # (taper_start_station + 500).  Using the would-be anchor regardless
    # of W5-1 emission preserves geometric consistency across reduced
    # vs no-reduction routings.  Plaques sit at identical
    # station + offset as their parent W21-5aR — separate DevicePlacement
    # rows per the G20-5P/R2-6P plaque-attachment precedent;
    # plan_sheet._deoverlap_signs_pairwise spreads them vertically at
    # render time.
    #
    # Mirrored per S-630-1 Sheet 2 General Note 8.
    if params.road_type == "freeway" and params.closure_type == "shoulder":
        w21_5aR_upstream_station = sign_a_station  # first W21-5aR (already placed above)
        w5_1_would_be_station = taper_start_station + 500.0
        w21_5aR_downstream_station = (w21_5aR_upstream_station + w5_1_would_be_station) / 2.0
        # Plaque labels follow the bare-code convention (parity with
        # R2-1 / W20-2 / G20-5P — parametric text lives in the audit
        # sign_table + crew narrative rows, not the placement label).
        # Second W21-5aR — mirrored
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                w21_5aR_downstream_station,
                sign_offset_right,
                label="W21-5aR",
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                w21_5aR_downstream_station,
                sign_offset_left,
                label="W21-5aR",
            )
        )
        # W16-2a plaque under first W21-5aR — mirrored, co-located
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                w21_5aR_upstream_station,
                sign_offset_right,
                label="W16-2a",
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                w21_5aR_upstream_station,
                sign_offset_left,
                label="W16-2a",
            )
        )
        # W7-3a plaque under second W21-5aR — mirrored, co-located
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                w21_5aR_downstream_station,
                sign_offset_right,
                label="W7-3a",
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                w21_5aR_downstream_station,
                sign_offset_left,
                label="W7-3a",
            )
        )

    # 2. Shoulder taper (drums).  Floors from device_count_floors —
    # the shared source the audit/narrative recomputations read.
    taper_min, tangent_min = device_count_floors(params)
    in_taper_spacing = device_spacing_in_taper(speed)
    n_taper_devices = pick_device_count(taper_len, in_taper_spacing, min_count=taper_min)
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
    # sides of the divided roadway per S-630-1 Sheet 2 General Note 8.
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
    n_tangent = pick_device_count(wz_len, device_spacing_on_tangent(speed), min_count=tangent_min)
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
    # on both sides per S-630-1 Sheet 2 General Note 8.
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
    # MUTCD §6H.35/§6H.36.  Mirrored on both sides per S-630-1 Sheet 2 General Note 8.
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

    # 10. Fines Double envelope (V1-Wide Item 3 — S-630-1 Sheet 12 Fines
    # Double Signing Notes).  Emits only when the work-zone posted speed is
    # reduced below the nominal posted speed.  Envelope spans
    # wz_start+500 (R2-10) to wz_end-500 (R2-11), with G20-5P/R2-6P
    # assemblies at 2640 ft intervals.  Downstream R2-1 restores posted
    # speed 500 ft past R2-11.  Mirrored on both sides per S-630-1 Sheet 2
    # General Note 8.  Case 11 generic 500 ft offsets used uniformly across
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
        # Entrance R2-1 (V1-Wide G4 — S-630-1 Sheet 2 General Note 3).  Posts
        # the reduced work-zone limit so drivers see a regulatory sign
        # carrying the actual number as they enter the zone, not just
        # the W3-5 advisory + Fines Double envelope.  Anchored to the
        # upstream-most Note-4 (G20-5P) plaque (the first G20-5P
        # drivers encounter); reuses an existing convention rather than
        # inventing a new station constant.  Mirrored per S-630-1 Sheet 2 Note 8.
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
        # W3-5 advisory speed sign(s) per S-630-1 Sheet 2 General Note 3
        # (V1-Wide G5). Single sign for Δ ≤ 15; stepped sequence for
        # Δ > 15 (max 15 mph per sign installation).  Rightmost (k=0,
        # closest to R2-10) carries the work-zone target speed; each
        # prior sign 530 ft further upstream steps the advisory 15 mph
        # closer to posted, rounded down to the nearest 5 mph, floored
        # at the target.  Anchored 530 ft upstream of R2-10 per Sheet 14
        # Cases 26/27 fixture geometry.  Mirrored per S-630-1 Sheet 2 Note 8.
        n_w3_5 = co_speed_reduction_signs(speed, params.work_zone_speed_mph)
        for k in range(n_w3_5):
            w3_5_speed = max(
                params.work_zone_speed_mph,
                ((speed - (n_w3_5 - k) * 15) // 5) * 5,
            )
            w3_5_station = r2_10_station + 530.0 + k * 530.0
            w3_5_label = f"W3-5({w3_5_speed})"
            placements.append(
                DevicePlacement(
                    DeviceType.SIGN_GENERIC, w3_5_station, sign_offset_right, label=w3_5_label
                )
            )
            placements.append(
                DevicePlacement(
                    DeviceType.SIGN_GENERIC, w3_5_station, sign_offset_left, label=w3_5_label
                )
            )

    return _dedupe_placements(placements)


def generate_shoulder_closure_undivided(
    params: ScenarioParams,
    shoulder_width_ft: float | None = None,
) -> list[DevicePlacement]:
    """Generate a CDOT S-630-1 right-shoulder closure on an undivided road.

    ``shoulder_width_ft`` defaults to ``params.shoulder_width_ft`` (the
    single source of truth); the kwarg remains as an explicit override.

    Models a two-way road with ``params.num_lanes`` lanes each direction
    (1 = the classic 2-lane road) and the right (work-side) shoulder
    closed.  Opposing traffic keeps its lanes and is not signed — MUTCD
    does not require both-sides advance warning for shoulder-only
    closures on undivided roads.

    Coordinates follow the project convention: ``station_ft = 0`` at the
    downstream end of the work zone, increasing upstream against
    traffic; ``offset_ft = 0`` at the road centerline, positive values
    to the right when facing upstream in the work direction.
    """
    if shoulder_width_ft is None:
        shoulder_width_ft = params.shoulder_width_ft
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft

    # Lateral landmarks — ``num_lanes`` lanes in the work direction
    lane_edge_offset = params.num_lanes * params.lane_width_ft  # right edge of outer lane
    shoulder_edge_offset = lane_edge_offset + shoulder_width_ft
    arrow_board_offset = lane_edge_offset + shoulder_width_ft / 2.0
    sign_offset_right = lane_edge_offset + 4.0

    # Longitudinal landmarks
    taper_len = shoulder_taper_length(speed, shoulder_width_ft)
    buf_len = buffer_space(
        speed, jurisdiction=params.jurisdiction, work_zone_speed_mph=params.work_zone_speed_mph
    )

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

    # 1a. W5-1 ROAD NARROWS (V1-Wide G2) per CDOT S-630-1 Sheet 7 Case 11,
    # position 7.  Single-side emission on undivided per S-630-1 Sheet 2 Note 8;
    # gate matches the divided generator (freeway + not is_reduced).
    is_reduced = params.work_zone_speed_mph is not None and params.work_zone_speed_mph < speed
    if params.road_type == "freeway" and not is_reduced:
        w5_1_station = taper_start_station + 500.0
        placements.append(
            DevicePlacement(DeviceType.SIGN_GENERIC, w5_1_station, sign_offset_right, label="W5-1")
        )

    # 1b. Second W21-5aR + W16-2a / W7-3a plaque pair (V1-Wide G1) per
    # CDOT S-630-1 Sheet 7 Case 11 positions 5/6.  Single-side on
    # undivided per S-630-1 Sheet 2 Note 8; geometry, gate, and label conventions
    # match the divided generator — see that copy for the design notes.
    if params.road_type == "freeway" and params.closure_type == "shoulder":
        w21_5aR_upstream_station = sign_a_station
        w5_1_would_be_station = taper_start_station + 500.0
        w21_5aR_downstream_station = (w21_5aR_upstream_station + w5_1_would_be_station) / 2.0
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                w21_5aR_downstream_station,
                sign_offset_right,
                label="W21-5aR",
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                w21_5aR_upstream_station,
                sign_offset_right,
                label="W16-2a",
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                w21_5aR_downstream_station,
                sign_offset_right,
                label="W7-3a",
            )
        )

    # 2. Shoulder taper (drums) — L/3 length per §6B.08.
    # Undivided floor is 4 drums (see device_count_floors): the upstream
    # taper run must be strictly longer than the 3-element downstream
    # "taper + first tangent cone" run; otherwise validate_taper_length
    # picks the wrong taper at low speeds with an 8-ft shoulder.
    taper_min, tangent_min = device_count_floors(params)
    in_taper_spacing = device_spacing_in_taper(speed)
    n_taper_devices = pick_device_count(taper_len, in_taper_spacing, min_count=taper_min)
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
    n_tangent = pick_device_count(wz_len, device_spacing_on_tangent(speed), min_count=tangent_min)
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
    # zone, just past the buffer.  Pairs with G20-2 per MUTCD §6H.35/§6H.36.
    begin_sign_station = wz_start_station + 100.0
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=begin_sign_station,
            offset_ft=sign_offset_right,
            label="G20-1",
        )
    )

    # 10. Fines Double envelope (V1-Wide Item 3 — S-630-1 Sheet 12 Fines
    # Double Signing Notes).  Emits only when the work-zone posted speed is
    # reduced below the nominal posted speed.  Single-side emission on
    # undivided roads — no mirror requirement under Sheet 2 Note 8.
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
        # Entrance R2-1 (V1-Wide G4 — S-630-1 Sheet 2 General Note 3).  Single
        # side on undivided per S-630-1 Sheet 2 Note 8; anchored to the upstream-
        # most Note-4 (G20-5P) plaque, matching the divided generator pattern.
        entrance_r2_1_station = (n_plaques - 0.5) * wz_len / n_plaques
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                entrance_r2_1_station,
                sign_offset_right,
                label="R2-1",
            )
        )
        # W3-5 advisory speed sign(s) per S-630-1 Sheet 2 General Note 3
        # (V1-Wide G5).  Single-side on undivided per S-630-1 Sheet 2 Note 8;
        # stepping + station formula match the divided generator.
        n_w3_5 = co_speed_reduction_signs(speed, params.work_zone_speed_mph)
        for k in range(n_w3_5):
            w3_5_speed = max(
                params.work_zone_speed_mph,
                ((speed - (n_w3_5 - k) * 15) // 5) * 5,
            )
            w3_5_station = r2_10_station + 530.0 + k * 530.0
            w3_5_label = f"W3-5({w3_5_speed})"
            placements.append(
                DevicePlacement(
                    DeviceType.SIGN_GENERIC, w3_5_station, sign_offset_right, label=w3_5_label
                )
            )

    return _dedupe_placements(placements)


def generate_lane_closure_divided(
    params: ScenarioParams,
    shoulder_width_ft: float | None = None,
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
    full taper length L (not L/3) is required by MUTCD §6B.08.

    TODO (V1.1): add a shifting taper upstream of the merging taper for
    cases where geometry requires drivers to first shift laterally before
    encountering the lane drop.  V1 places the merging taper directly.

    ``shoulder_width_ft`` defaults to ``params.shoulder_width_ft`` (the
    single source of truth); the kwarg remains as an explicit override.
    """
    if shoulder_width_ft is None:
        shoulder_width_ft = params.shoulder_width_ft
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
    buf_len = buffer_space(
        speed, jurisdiction=params.jurisdiction, work_zone_speed_mph=params.work_zone_speed_mph
    )

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
    # sides of the divided roadway per S-630-1 Sheet 2 General Note 8 so drivers
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

    # 2. Merging taper (drums) — full length L from lane edge to lane line.
    # Floors from device_count_floors (shared with the audit/narrative).
    taper_min, tangent_min = device_count_floors(params)
    in_taper_spacing = device_spacing_in_taper(speed)
    n_taper_devices = pick_device_count(taper_len, in_taper_spacing, min_count=taper_min)
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
    # mirrored on both sides per S-630-1 Sheet 2 General Note 8.
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
    n_tangent = pick_device_count(wz_len, device_spacing_on_tangent(speed), min_count=tangent_min)
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
    # on both sides per S-630-1 Sheet 2 General Note 8.
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
    # MUTCD §6H.35/§6H.36.  Mirrored on both sides per S-630-1 Sheet 2 General Note 8.
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

    # 10. Fines Double envelope (V1-Wide Item 3 — S-630-1 Sheet 12 Fines
    # Double Signing Notes).  Emits only when the work-zone posted speed is
    # reduced below the nominal posted speed.  Mirrored on both sides
    # per S-630-1 Sheet 2 General Note 8.
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
        # Entrance R2-1 (V1-Wide G4 — S-630-1 Sheet 2 General Note 3).  Same
        # upstream-most-Note-4-plaque anchor as the shoulder
        # generators; mirrored per S-630-1 Sheet 2 Note 8.
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
        # W3-5 advisory speed sign(s) per S-630-1 Sheet 2 General Note 3
        # (V1-Wide G5).  Stepping + station formula match the shoulder
        # generators; mirrored per S-630-1 Sheet 2 Note 8.
        n_w3_5 = co_speed_reduction_signs(speed, params.work_zone_speed_mph)
        for k in range(n_w3_5):
            w3_5_speed = max(
                params.work_zone_speed_mph,
                ((speed - (n_w3_5 - k) * 15) // 5) * 5,
            )
            w3_5_station = r2_10_station + 530.0 + k * 530.0
            w3_5_label = f"W3-5({w3_5_speed})"
            placements.append(
                DevicePlacement(
                    DeviceType.SIGN_GENERIC, w3_5_station, sign_offset_right, label=w3_5_label
                )
            )
            placements.append(
                DevicePlacement(
                    DeviceType.SIGN_GENERIC, w3_5_station, sign_offset_left, label=w3_5_label
                )
            )

    # ``shoulder_edge_offset`` is computed for completeness (notes/legend
    # may reference the road's overall lateral extent) but is not used
    # for any device placement in a lane-only closure.
    _ = shoulder_edge_offset

    return _dedupe_placements(placements)


# Longitudinal clearance between the merging taper's downstream end and
# the intersection's upstream curb line in the far-side geometry, per the
# 100-ft dimension S-630-1 Sheet 10 Cases 18/19 draw between the taper
# and the corner.
_INTERSECTION_TAPER_CLEARANCE_FT: float = 100.0
# Departure-side END DOUBLE FINES ZONE (R2-11) station in the approach
# frame, per the 100-ft dimension on Case 18's cross-street departure
# legs (and past the far curb on the mainline).
_INTERSECTION_R2_11_SETBACK_FT: float = 100.0


def near_intersection_stations(
    params: ScenarioParams,
    approaches: list[ApproachParams],
) -> dict[str, Any]:
    """Single-source station math for the near_intersection layout.

    Same pattern as ``flagger_chain_stations``: the generator, the
    (increment 3) audit sections, and the tests all read these landmarks
    from one place so they agree by construction.  Raises loud
    ``ValueError`` on geometry the kind cannot honestly lay out (rule 10)
    rather than emitting a degraded plan:

    * mainline ``num_lanes < 2`` — Cases 18/19 merge the closed lane's
      traffic into an adjacent same-direction lane; a 1-lane-per-direction
      mainline is the flagger/Case 19 shape, out of increment-2 scope.
    * approaches disagreeing on ``along_station_ft`` — two values means
      two cross streets (multi-road scope; the schema documents one
      shared value per cross street but cannot see across entries).
    * the intersection's curb-to-curb box overlapping the work zone —
      the schema rejects centerline crossings inside ``[0, workLen]``,
      but the box is ``along ± half_cross_width`` and the schema cannot
      know the cross street's width; work inside the box is
      in-intersection work (MUTCD Figures 6P-26/27), not supported.

    Near-side vs. far-side derives from the shared ``along_station_ft``
    sign (schema contract): ``< 0`` → intersection downstream of the
    work → near-side work handled as a midblock closure per §6N.12.08
    (p. 849), whose own text names Fig. 6P-21 as the near-side
    depiction.  Precision on that figure: it draws a CENTER-lane
    variant (W9-3L / W12-1, p. 901); the right-lane train emitted here
    is the one drawn in Fig. 6P-22's near-side approach (p. 903), per
    its note 3's "normal procedure" of closing the lane on the near
    side.  ``> workLen`` → far-side work, and the §6N.12.12 companion
    closure moves the merging taper upstream of the intersection so the
    lane is already closed where it crosses.
    """
    if params.num_lanes < 2:
        raise ValueError(
            f"near_intersection needs num_lanes >= 2 on the mainline "
            f"(got {params.num_lanes}): Cases 18/19 merge the closed "
            f"lane into an adjacent same-direction lane.  A 1-lane-per-"
            f"direction mainline is the flagger-controlled Case 19 "
            f"shape, which is out of scope."
        )
    if not approaches:
        raise ValueError("near_intersection requires at least one approach.")
    along_values = {a.along_station_ft for a in approaches}
    if len(along_values) != 1:
        raise ValueError(
            f"approaches disagree on along_station_ft ({sorted(along_values)!r}) "
            f"— both legs of the one supported cross street must carry the "
            f"same value; two values describe two cross streets (multi-road "
            f"scope, not supported)."
        )
    along = along_values.pop()
    wz_len = params.work_zone_length_ft

    # Curb-to-curb extent of the cross street on the mainline station
    # axis.  Derived, not an input: half-width = the widest approach's
    # lanes-per-direction x lane width, assuming a symmetric two-way
    # cross street.  Conservative (widest leg governs both sides).
    half_cross_ft = max(a.num_lanes * a.lane_width_ft for a in approaches)
    upstream_curb = along + half_cross_ft
    downstream_curb = along - half_cross_ft

    if along < 0.0:
        side = "near"
        if upstream_curb > 0.0:
            raise ValueError(
                f"the cross street's upstream curb line ({upstream_curb:g} ft) "
                f"reaches into the work zone (0..{wz_len:g}): work inside the "
                f"intersection's curb-to-curb box is in-intersection work "
                f"(MUTCD Figures 6P-26/27), not supported."
            )
    elif along > wz_len:
        side = "far"
        if downstream_curb < wz_len:
            raise ValueError(
                f"the cross street's downstream curb line ({downstream_curb:g} ft) "
                f"reaches into the work zone (0..{wz_len:g}): work inside the "
                f"intersection's curb-to-curb box is in-intersection work "
                f"(MUTCD Figures 6P-26/27), not supported."
            )
    else:
        # The schema rejects [0, workLen]; direct callers get the same
        # honesty here.
        raise ValueError(
            f"along_station_ft={along:g} lies inside the work zone "
            f"(0..{wz_len:g}) — in-intersection work is not supported."
        )

    speed = params.speed_mph
    taper_len = taper_length(speed, params.lane_width_ft)
    buf_len = buffer_space(
        speed, jurisdiction=params.jurisdiction, work_zone_speed_mph=params.work_zone_speed_mph
    )

    # Far side: §6N.12.12 — the closed lane must already be closed on
    # the near side of the intersection, so the taper completes at least
    # the plate's 100-ft clearance upstream of the upstream curb line.
    # The midblock anchoring (workLen + buffer) still applies when it is
    # the more upstream of the two.
    taper_end_station = wz_len + buf_len
    if side == "far":
        taper_end_station = max(taper_end_station, upstream_curb + _INTERSECTION_TAPER_CLEARANCE_FT)
    taper_start_station = taper_end_station + taper_len

    spacing_abc = advance_warning_spacing(speed, params.road_type)
    a_dist, b_dist, c_dist = spacing_abc["A"], spacing_abc["B"], spacing_abc["C"]
    sign_a_station = taper_start_station + a_dist
    sign_b_station = sign_a_station + b_dist
    sign_c_station = sign_b_station + c_dist
    # BEGIN DOUBLE FINES ZONE at 1/2 C inside the outermost sign, per the
    # 1/2C dimension Case 18 draws between W20-1 and W20-5(R).  Placed
    # unconditionally for this kind: a lane closure is a listed hazard
    # under Sheet 12's Fines Double signing notes (note 1), and the
    # plates star R2-10/R2-11 on every leg.  (The other generators gate
    # their fines envelope on a reduced work-zone speed — a deliberate,
    # plate-driven divergence for this kind.)
    r2_10_station = sign_c_station - c_dist / 2.0

    ds_taper_len = downstream_taper_length(1)
    if side == "near":
        # §6N.12.08: near-side work is handled as a midblock closure —
        # but only when the standard reopening hardware (downstream
        # taper + END signage) fits upstream of the intersection.  When
        # it does not, the closure runs to the corner instead, the
        # work-space-at-the-crosswalk shape Fig. 6P-21 draws (in its
        # center-lane variant) and Case 18 draws for this right-lane
        # train: channelizers continue to the upstream curb line and
        # the lane reopens beyond the intersection.
        far_gap = -along - half_cross_ft  # work-zone end to upstream curb
        extend_to_corner = far_gap < ds_taper_len + _INTERSECTION_R2_11_SETBACK_FT
        if extend_to_corner:
            r2_11_station = downstream_curb - _INTERSECTION_R2_11_SETBACK_FT
            g20_2_station = r2_11_station - 100.0
        else:
            g20_2_station = -ds_taper_len - 100.0
            r2_11_station = g20_2_station - 100.0
    else:
        extend_to_corner = False
        g20_2_station = -ds_taper_len - 100.0
        r2_11_station = g20_2_station - 100.0

    # BEGIN ROAD WORK: midblock convention (workLen + 100), pulled to the
    # midpoint between the work zone and the downstream curb when the
    # intersection box would otherwise swallow it (far side only).
    g20_1_station = wz_len + 100.0
    if side == "far" and g20_1_station >= downstream_curb:
        g20_1_station = (wz_len + downstream_curb) / 2.0

    approach_stations: dict[str, dict[str, float]] = {}
    for a in approaches:
        xa = advance_warning_spacing(a.speed_mph, a.road_type)["A"]
        approach_stations[a.id] = {
            # Sheet 10 key pattern (rural 500'/500', urban per key): the
            # fines companion at A back from the curb line, W20-1 at 2A,
            # END DOUBLE FINES at 100 ft on the departure side.
            "a_dist": xa,
            "r2_10": xa,
            "w20_1": 2.0 * xa,
            "r2_11": _INTERSECTION_R2_11_SETBACK_FT,
        }

    return {
        "side": side,
        "along_station_ft": along,
        "half_cross_ft": half_cross_ft,
        "upstream_curb": upstream_curb,
        "downstream_curb": downstream_curb,
        "wz_start": wz_len,
        "wz_end": 0.0,
        "taper_len": taper_len,
        "buffer_len": buf_len,
        "taper_end": taper_end_station,
        "taper_start": taper_start_station,
        "sign_a": sign_a_station,
        "sign_b": sign_b_station,
        "sign_c": sign_c_station,
        "r2_10": r2_10_station,
        "r2_11": r2_11_station,
        "g20_1": g20_1_station,
        "g20_2": g20_2_station,
        "ds_taper_len": ds_taper_len,
        "extend_to_corner": extend_to_corner,
        "approaches": approach_stations,
    }


def generate_near_intersection(
    params: ScenarioParams,
    shoulder_width_ft: float | None = None,
    *,
    approaches: list[ApproachParams],
) -> list[DevicePlacement]:
    """Generate the near_intersection lane-closure layout (GATED kind).

    S-630-1 Sheet 10 Case 18's shape: a right-lane closure on an
    undivided mainline near a cross street, plus a per-approach advance
    warning set on every cross-street leg (§6N.12.06).  Adapted from
    ``generate_lane_closure_divided`` with the S-630-1 Sheet 2 Note 8 median-side
    mirroring dropped (undivided → single-side signing, matching the
    undivided shoulder generator) and the lateral geometry generalized
    to ``params.num_lanes`` lanes per direction.

    Scope (increment 2, Refs #117): cross-street legs receive advance
    sets only — Case 18's plate typifies corner-quadrant work whose
    cross-street closure train this data model cannot express (approaches
    carry no work extent); Case 19's flagger one-lane-two-way variant is
    out entirely.  The opposing mainline direction is not signed, per the
    undivided house convention.  Signalized approaches receive the same
    set (flag-and-cite lands in the increment-3 audit).

    Mainline placements carry ``approach_id="mainline"`` (default);
    cross-street placements carry their approach's id with stations in
    the approach frame (0 = intersection curb line, increasing away).
    """
    if shoulder_width_ft is None:
        shoulder_width_ft = params.shoulder_width_ft
    st = near_intersection_stations(params, approaches)
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft

    # Lateral landmarks — closed lane is the rightmost of num_lanes.
    # Modeling assumption, not an MUTCD rule: no Chapter 6P figure or
    # section selects which lane gets closed (the work location does),
    # and this tool models right-side work only.  Issue #176 carries
    # the product question (document / refuse / model other lanes).
    lane_line_offset = (params.num_lanes - 1) * params.lane_width_ft
    lane_edge_offset = params.num_lanes * params.lane_width_ft
    arrow_board_offset = lane_line_offset + params.lane_width_ft / 2.0
    sign_offset = lane_edge_offset + 4.0

    placements: list[DevicePlacement] = []

    # 1. Advance warning signs — lane-closure series, single side
    # (undivided; S-630-1 Sheet 2 Note 8 mirroring applies to divided roads).
    for label, station in (
        ("W4-2R", st["sign_a"]),  # RIGHT LANE ENDS (merge arrow)
        ("W20-5R", st["sign_b"]),  # RIGHT LANE CLOSED AHEAD
        ("W20-1", st["sign_c"]),  # ROAD WORK AHEAD
        ("R2-10", st["r2_10"]),  # BEGIN DOUBLE FINES ZONE at 1/2 C (Case 18)
    ):
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=sign_offset,
                label=label,
            )
        )

    # 2. Merging taper (drums) — full L, lane edge down to lane line.
    taper_min, tangent_min = device_count_floors(params)
    n_taper_devices = pick_device_count(
        st["taper_len"], device_spacing_in_taper(speed), min_count=taper_min
    )
    n_taper_intervals = n_taper_devices - 1
    for k in range(n_taper_devices):
        t = k / n_taper_intervals
        placements.append(
            DevicePlacement(
                device_type=DeviceType.DRUM,
                station_ft=st["taper_start"] - t * st["taper_len"],
                offset_ft=lane_edge_offset - t * (lane_edge_offset - lane_line_offset),
            )
        )

    # 3. Arrow board at the taper start, LEFT arrow (merge left).
    placements.append(
        DevicePlacement(
            device_type=DeviceType.ARROW_BOARD,
            station_ft=st["taper_start"],
            offset_ft=arrow_board_offset,
            label="LEFT_ARROW",
        )
    )

    # 4. Far side only: the §6N.12.12 companion closure's tangent — the
    # closed lane stays delineated from the taper down to the work zone,
    # skipping the intersection's curb-to-curb box (no devices inside
    # the intersection).  Deliberate divergence from the midblock
    # "buffer is device-empty" convention: an undelineated closed lane
    # across an intersection is not an option.  The continuous-
    # channelizer shape (and the absence of the turn-bay conversion's
    # RIGHT LANE MUST TURN RIGHT signs) is Fig. 6P-22's own note 7
    # option (p. 903), verified by subject 2026-08-03: "If dimension
    # 'A' is not available to create a temporary right-turn lane,
    # continuous channelizers may be installed from the end of the
    # taper to the intersection and, as a result, the RIGHT LANE MUST
    # TURN RIGHT signs would not be installed."  The far-side citation
    # basis is therefore Fig. 6P-22 substance via note 7, not only the
    # §6N.12.12 prose (Refs #117, #108).
    tangent_spacing_target = device_spacing_on_tangent(speed)
    if st["side"] == "far":
        s = st["taper_end"] - tangent_spacing_target
        while s > st["upstream_curb"]:
            placements.append(
                DevicePlacement(DeviceType.CONE, station_ft=s, offset_ft=lane_line_offset)
            )
            s -= tangent_spacing_target
        placements.append(
            DevicePlacement(
                DeviceType.CONE, station_ft=st["upstream_curb"], offset_ft=lane_line_offset
            )
        )
        s = st["downstream_curb"]
        while s > st["wz_start"]:
            placements.append(
                DevicePlacement(DeviceType.CONE, station_ft=s, offset_ft=lane_line_offset)
            )
            s -= tangent_spacing_target

    # 5. CONSTRUCTION ZONE plaques (G20-5P), single side.
    total_zone_length = st["sign_c"]
    n_plaques = co_construction_plaques(total_zone_length)
    for k in range(n_plaques):
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=(k + 0.5) * wz_len / n_plaques,
                offset_ft=sign_offset,
                label="G20-5P",
            )
        )

    # 6. Work-zone tangent (cones) along the lane line.
    n_tangent = pick_device_count(wz_len, tangent_spacing_target, min_count=tangent_min)
    n_tangent_intervals = n_tangent - 1
    tangent_spacing = wz_len / n_tangent_intervals
    for k in range(n_tangent):
        placements.append(
            DevicePlacement(
                device_type=DeviceType.CONE,
                station_ft=k * tangent_spacing,
                offset_ft=lane_line_offset,
            )
        )

    # 7. Downstream end.  Midblock branches reopen the lane with the
    # standard short taper; the extend-to-corner branch (near side,
    # intersection immediately downstream — the work-space-at-the-
    # crosswalk shape drawn by Fig. 6P-21 in its center-lane variant
    # and by Case 18 for this right-lane train) runs the closure to
    # the upstream curb line instead, and the lane reopens beyond the
    # intersection with no devices in the box.
    if st["extend_to_corner"]:
        placements.append(
            DevicePlacement(
                DeviceType.CONE, station_ft=st["upstream_curb"], offset_ft=lane_line_offset
            )
        )
        s = st["upstream_curb"] + tangent_spacing_target
        while s < 0.0:
            placements.append(
                DevicePlacement(DeviceType.CONE, station_ft=s, offset_ft=lane_line_offset)
            )
            s += tangent_spacing_target
    else:
        for k in range(2):
            t = (k + 1) / 2
            placements.append(
                DevicePlacement(
                    device_type=DeviceType.CONE,
                    station_ft=-t * st["ds_taper_len"],
                    offset_ft=lane_line_offset + t * (lane_edge_offset - lane_line_offset),
                )
            )

    # 8/9. Road-work bookends (G20-1 / G20-2, §6H.35/§6H.36) and the mainline
    # END DOUBLE FINES ZONE (R2-11), single side.
    for label, station in (
        ("G20-1", st["g20_1"]),
        ("G20-2", st["g20_2"]),
        ("R2-11", st["r2_11"]),
    ):
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=sign_offset,
                label=label,
            )
        )

    # 10. Cross-street advance sets, one per approach (§6N.12.06 /
    # Sheet 10 Case 18): W20-1 outermost, R2-10 inside it on the
    # approach side; R2-11 on the departure side.  Stations are in the
    # APPROACH frame (0 = curb line, increasing away from the
    # intersection); offsets from the approach's own centerline —
    # positive = the approaching direction's roadside, negative = the
    # departing direction's.  Only static-legend codes: parametric signs
    # (W20-2, W16-2a, G20-1) and R2-1 compute mainline-frame values and
    # must never be emitted off-mainline.
    for a in approaches:
        a_st = st["approaches"][a.id]
        a_sign_offset = a.num_lanes * a.lane_width_ft + 4.0
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                station_ft=a_st["w20_1"],
                offset_ft=a_sign_offset,
                label="W20-1",
                approach_id=a.id,
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                station_ft=a_st["r2_10"],
                offset_ft=a_sign_offset,
                label="R2-10",
                approach_id=a.id,
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC,
                station_ft=a_st["r2_11"],
                offset_ft=-a_sign_offset,
                label="R2-11",
                approach_id=a.id,
            )
        )

    # Every placement must resolve to a declared frame (increment-1
    # plan's post-generation assert): structural invariant, loud.
    declared = {"mainline"} | {a.id for a in approaches}
    for p in placements:
        if p.approach_id not in declared:
            raise AssertionError(
                f"generator emitted approach_id={p.approach_id!r}, not in {sorted(declared)!r}"
            )

    _ = shoulder_width_ft  # lane-only closure: shoulder width places no device
    return _dedupe_placements(placements)


def flagger_chain_stations(params: ScenarioParams) -> dict[str, Any]:
    """Single-source station math for the TA-10 flagger layout.

    Consumed by ``generate_flagger_alternating_2lane`` (placements),
    ``src.api.audit.build_audit_trail`` (advance anchors + fines_double
    envelope geometry), and ``src.narrative.crew_narrative`` (schedule
    rows) so the four surfaces agree on every station by construction.

    Geometry (PR 2, fixtures: tests/fixtures/ta10_flagger/):
      * one-lane two-way taper 100 ft (§6B.08 ¶14 band max) + Table
        6B-2 buffer upstream of the work zone;
      * approach flagger at taper start + 100 ft (Fig. 6P-10 band max);
        opposing flagger at −300 ft (CDOT Case 17 "200' TO 300'" band
        max from the work-area end);
      * advance series anchored on each flagger (the stop point), gaps
        A / B / C / C nearest-first: W20-7, W3-4, W20-4, W20-1;
      * Fines Double envelope (reduced work-zone speed only), Case-42
        chain insertion: R2-10 at W20-4 + 260 ft with W20-1 pushed to
        R2-10 + C; W3-5 advisory set at R2-10 + 530·k per direction;
        exit per Case 17: downstream-taper end → 500 ft → R2-11 →
        500 ft → restoration R2-1 (right side), mirrored for the
        opposing direction past the upstream taper start; G20-5P/R2-6P
        assemblies at 2,640 ft intervals across the envelope, both
        sides; entrance R2-1 at the Note-4 (G20-5P) plaque anchor, both
        sides.  The Case-11 generic formula (wz_start + 500) is NOT
        used here — it would collide with the corrected flagger
        station and violate Sheet 12 note 4's 250 ft sign spacing.

    Returns a dict of stations (suffix ``_r`` = right/primary
    direction, ``_l`` = opposing).  Envelope keys are present only when
    the work-zone speed is reduced.
    """
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft

    taper_len = one_lane_two_way_taper_length()
    buf_len = buffer_space(
        speed, jurisdiction=params.jurisdiction, work_zone_speed_mph=params.work_zone_speed_mph
    )
    ds_taper_len = downstream_taper_length(1)
    taper_start = wz_len + buf_len + taper_len

    spacing_abc = advance_warning_spacing(speed, params.road_type)
    a_dist, b_dist, c_dist = spacing_abc["A"], spacing_abc["B"], spacing_abc["C"]

    flagger_1 = taper_start + flagger_to_taper_distance()
    flagger_2 = -opposing_flagger_standoff()

    is_reduced = params.work_zone_speed_mph is not None and (
        params.work_zone_speed_mph < params.speed_mph
    )

    st: dict[str, Any] = {
        "taper_start": taper_start,
        "taper_end": wz_len + buf_len,
        "ds_taper_len": ds_taper_len,
        "flagger_1": flagger_1,
        "flagger_2": flagger_2,
        "w20_7_r": flagger_1 + a_dist,
        "w20_7_l": flagger_2 - a_dist,
        "is_reduced": is_reduced,
    }
    st["w3_4_r"] = st["w20_7_r"] + b_dist
    st["w3_4_l"] = st["w20_7_l"] - b_dist
    st["w20_4_r"] = st["w3_4_r"] + c_dist
    st["w20_4_l"] = st["w3_4_l"] - c_dist

    if not is_reduced:
        st["w20_1_r"] = st["w20_4_r"] + c_dist
        st["w20_1_l"] = st["w20_4_l"] - c_dist
        return st

    # Fines Double envelope — Case-42 chain insertion (locked Q8).
    st["r2_10_r"] = st["w20_4_r"] + 260.0
    st["r2_10_l"] = st["w20_4_l"] - 260.0
    st["w20_1_r"] = st["r2_10_r"] + c_dist
    st["w20_1_l"] = st["r2_10_l"] - c_dist

    # Exit chain per Case 17: ds-taper end → 500 → R2-11 → 500 → R2-1.
    st["r2_11_r"] = -(ds_taper_len + 500.0)
    st["ds_r2_1_r"] = -(ds_taper_len + 1000.0)
    st["r2_11_l"] = taper_start + 500.0
    st["ds_r2_1_l"] = taper_start + 1000.0

    # W3-5 advisory set per direction (G5 stepped formula, 530 ft
    # intervals upstream of each direction's R2-10).
    assert params.work_zone_speed_mph is not None
    n_w3_5 = co_speed_reduction_signs(speed, params.work_zone_speed_mph)
    st["n_w3_5"] = n_w3_5
    st["w3_5_r"] = [st["r2_10_r"] + 530.0 * (k + 1) for k in range(n_w3_5)]
    st["w3_5_l"] = [st["r2_10_l"] - 530.0 * (k + 1) for k in range(n_w3_5)]

    # Envelope span (primary-direction R2-10 to primary-direction
    # R2-11) for assembly count; assemblies at the same stations both
    # sides, each facing its direction.
    envelope_len = st["r2_10_r"] - st["r2_11_r"]
    n_asm = max(1, math.ceil(envelope_len / 2640.0))
    st["envelope_length"] = envelope_len
    st["n_assemblies"] = n_asm
    st["assembly_stations"] = [
        st["r2_11_r"] + (k + 0.5) * envelope_len / n_asm for k in range(n_asm)
    ]

    # Entrance R2-1 (G4) — Note-4 (G20-5P) plaque anchor.  Plaque count is
    # derived from the full signed length (W20-1 station, reduced
    # chain), matching the generator's total_zone_length.
    n_plaques = co_construction_plaques(st["w20_1_r"])
    st["n_plaques"] = n_plaques
    st["entrance_r2_1"] = (n_plaques - 0.5) * wz_len / n_plaques
    return st


def generate_flagger_alternating_2lane(
    params: ScenarioParams,
    shoulder_width_ft: float | None = None,
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
    upstream of the one-lane two-way taper) and one for the opposing
    approach (negative offset, past the work zone).

    Optional flags:
      ``afad``: substitute Automated Flagger Assistance Devices
        (TEMPORARY_SIGNAL with label "AFAD") for the human flagger
        stations and swap the W20-7 advance signs for W20-7a.
      ``pilot_car``: the pilot vehicle and its vehicle-mounted G20-4
        ("PILOT CAR FOLLOW ME" — mounted on the rear of the pilot
        vehicle per S-630-1 Sheet 26, never a roadside placement) are
        field equipment listed in the narrative, not placed devices.
        The flag therefore adds no placements.
      ``pedestrian_access``: add R9-9 ("SIDEWALK CLOSED" — plain legend
        per §6G.10; R9-10's "USE OTHER SIDE" asserts an alternate side
        the tool cannot verify) at the upstream and downstream ends of
        the work zone on the work-side shoulder.

    Standards: MUTCD 11th Ed. Part 6 TA-10 (Fig. 6P-10) is the federal
    standard for flagger-controlled alternating one-way traffic on a
    2-lane undivided highway; the one-lane two-way taper is §6B.08 ¶14
    (50–100 ft, ~20 ft device spacing — NOT the merging taper L).
    CDOT S-630-1 has no general case for this scenario; Case 17 (lane
    closure at a curve, Sheet 9) and Case 42 (pilot car, Sheet 25)
    supply the CDOT overlay values. Dimensioned fixtures:
    tests/fixtures/ta10_flagger/.

    ``shoulder_width_ft`` defaults to ``params.shoulder_width_ft`` (the
    single source of truth); the kwarg remains as an explicit override.
    """
    if shoulder_width_ft is None:
        shoulder_width_ft = params.shoulder_width_ft
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

    # Longitudinal landmarks: one-lane, two-way traffic taper per MUTCD
    # §6B.08 ¶14 (50–100 ft; Conestruct uses the 100 ft maximum).  NOT
    # the merging taper L — this taper stages stopped traffic behind a
    # flagger rather than merging moving traffic, and CDOT Case 17
    # warns it "MUST BE SHORT ENOUGH TO NOT BE MISTAKEN FOR A
    # TRANSITION."  Buffer retained per Table 6B-2 (CDOT Sheet 2 note
    # 24 makes buffer optional/engineer-determined; Conestruct includes
    # it as a documented conservative policy).
    taper_len = one_lane_two_way_taper_length()
    ds_taper_len = downstream_taper_length(1)

    # All chain stations come from the shared helper (buffer included
    # there) so the layout, the audit, and the crew narrative agree by
    # construction.
    st = flagger_chain_stations(params)

    wz_end_station = 0.0
    wz_start_station = wz_len
    taper_start_station = st["taper_start"]

    placements: list[DevicePlacement] = []

    # 1. Flagger station #1 — 50–100 ft upstream of the taper start per
    # MUTCD Fig. 6P-10 (Conestruct uses the 100 ft maximum), on the
    # closed-lane side so approaching drivers stop before the taper.
    # Computed first: the advance series anchors on the stop point.
    flagger_1_station = st["flagger_1"]

    # 2. Right-direction (upstream-approach) advance warning signs.
    # MUTCD Fig. 6P-10 series (driver order): ROAD WORK (W20-1) → ONE
    # LANE ROAD (W20-4, the B-position sign — audit B-11 correction) →
    # BE PREPARED TO STOP (W3-4, optional addition per TA-10 note 4,
    # placed between W20-4 and W20-7 per note 8; emitted by default per
    # the locked OQ-2 decision — CDOT Case 42 includes it) → FLAGGER
    # (W20-7) closest to the flagger station.  The A gap is measured
    # from the flagger station (the stop point) — Fig. 6P-10 and Case
    # 42 both run W20-7 –A– flagger –50..100 ft– taper, so anchoring on
    # the taper would put W20-7 on top of the flagger wherever
    # A == flagger_to_taper_distance (urban ≤40: A = 100).  Gaps
    # A/B/C/C preserve every letter-coded minimum from the CDOT key;
    # matches Case 42's full-gap chain with the deferred R4-1 /
    # in-chain speed-assembly slots collapsed.  With reduced work-zone
    # speed, R2-10 inserts into the chain at W20-4 + 260 ft and W20-1
    # moves to R2-10 + C (Case-42 chain insertion; see
    # flagger_chain_stations).
    sign_c_station_r = st["w20_1_r"]  # total signed length (plaques)
    advance_signs_right = (
        (flagger_ahead_label, st["w20_7_r"]),  # FLAGGER AHEAD or AFAD AHEAD
        ("W3-4", st["w3_4_r"]),  # BE PREPARED TO STOP
        ("W20-4", st["w20_4_r"]),  # ONE LANE ROAD AHEAD
        ("W20-1", st["w20_1_r"]),  # ROAD WORK AHEAD
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

    placements.append(
        DevicePlacement(
            device_type=flagger_device,
            station_ft=flagger_1_station,
            offset_ft=flagger_offset_right,
            label=flagger_label_1,
        )
    )
    # pilot_car: no roadside G20-4 — the sign is mounted on the rear of
    # the pilot vehicle per S-630-1 Sheet 26 ("SHALL BE MOUNTED IN A
    # CONSPICUOUS POSITION ON THE REAR OF A VEHICLE") and is listed as
    # field equipment in the crew narrative.  Case 42's diagram shows
    # no roadside G20-4.

    # 3. One-lane two-way taper drums — guide right-lane traffic across
    # the centerline into the opposing lane behind the flagger.  Offset
    # transitions from the right lane edge (+lane_width) to the
    # centerline (0).  Device spacing ~20 ft per §6B.08 ¶14 (overrides
    # the speed-based §6K.01 spacing for this taper type).  Floors from
    # device_count_floors (shared with the audit/narrative).
    taper_min, tangent_min = device_count_floors(params)
    in_taper_spacing = one_lane_two_way_device_spacing()
    n_taper_devices = pick_device_count(taper_len, in_taper_spacing, min_count=taper_min)
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
    # best matches target; the flagger tangent floor of 3 (see
    # device_count_floors) keeps the centerline unambiguously
    # delineated even on short work zones.
    n_tangent = pick_device_count(wz_len, device_spacing_on_tangent(speed), min_count=tangent_min)
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

    # 7. Flagger station #2 — 200–300 ft past the work-area end per
    # CDOT Case 17 ("200' TO 300'"; Conestruct uses the 300 ft
    # maximum), facing opposing traffic before they enter the one-lane
    # section.  Case 42 reuses this standoff as the pilot-car
    # turnaround space.  No taper on this approach: the opposing lane
    # stays open — opposing traffic stops at the flagger and proceeds
    # in its own lane.
    flagger_2_station = st["flagger_2"]
    placements.append(
        DevicePlacement(
            device_type=flagger_device,
            station_ft=flagger_2_station,
            offset_ft=flagger_offset_left,
            label=flagger_label_2,
        )
    )

    # 8. Opposing-direction advance warning signs (negative stations,
    # left side of road — facing traffic approaching from downstream).
    # Same A/B/C/C series mirrored, anchored off flagger #2 (Case 17:
    # "SIGN SEQUENCE IS THE SAME FOR OPPOSITE DIRECTION"), with the
    # same R2-10 chain insertion when the work-zone speed is reduced.
    advance_signs_left = (
        (flagger_ahead_label, st["w20_7_l"]),  # FLAGGER AHEAD closest to flagger #2
        ("W3-4", st["w3_4_l"]),  # BE PREPARED TO STOP
        ("W20-4", st["w20_4_l"]),  # ONE LANE ROAD AHEAD
        ("W20-1", st["w20_1_l"]),  # ROAD WORK AHEAD
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

    # 9. Downstream taper cones — transition right-direction traffic from
    # the centerline back to the right lane edge after the work zone.
    # §6B.08 ¶12: 50–100 ft at ~20 ft device spacing (Case 17 annotates
    # the run "100' MAX.").
    n_ds_cones = pick_device_count(ds_taper_len, one_lane_two_way_device_spacing(), min_count=2)
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
    # G20-2 per MUTCD §6H.35/§6H.36.  Right-direction sees BEGIN at the upstream
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

    # 10b. Fines Double envelope (Item 3 retroactive correction PR 2 —
    # S-630-1 Sheet 12 Fines Double Signing Notes).  Sheet 12 carries no
    # road-class scoping and lists LANE CLOSURE as a qualifying hazard,
    # so a reduced-speed flagger closure gets the full envelope.
    # Geometry is the Case-42 chain insertion computed by
    # flagger_chain_stations (locked Q8) — per-direction mirrored sets,
    # NOT the same-station left/right pairs divided highways use:
    #   * R2-10 already sits in each approach chain (W20-4 + 260 ft);
    #     emitted here so the series block stays purely the warning
    #     series.
    #   * W3-5 advisory set per direction at R2-10 + 530·k (G5 stepped
    #     formula, same label math as the shoulder generators).
    #   * Exit per Case 17: downstream-taper end → 500 ft → R2-11 →
    #     500 ft → restoration R2-1; mirrored for the opposing
    #     direction past the upstream taper start.
    #   * G20-5P/R2-6P assemblies at 2,640 ft intervals across the
    #     envelope, both sides.
    #   * Entrance R2-1 at the Note-4 (G20-5P) plaque anchor, both sides
    #     (both directions enter the zone).
    if st["is_reduced"]:
        assert params.work_zone_speed_mph is not None
        # R2-10 BEGIN DOUBLE FINES ZONE — one per approach chain.
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, st["r2_10_r"], sign_offset_right, label="R2-10"
            )
        )
        placements.append(
            DevicePlacement(DeviceType.SIGN_GENERIC, st["r2_10_l"], sign_offset_left, label="R2-10")
        )
        # W3-5 advisory speed sign(s) per direction (S-630-1 Sheet 2 Note 3, G5).
        n_w3_5 = st["n_w3_5"]
        for k in range(n_w3_5):
            w3_5_speed = max(
                params.work_zone_speed_mph,
                ((speed - (n_w3_5 - k) * 15) // 5) * 5,
            )
            w3_5_label = f"W3-5({w3_5_speed})"
            placements.append(
                DevicePlacement(
                    DeviceType.SIGN_GENERIC, st["w3_5_r"][k], sign_offset_right, label=w3_5_label
                )
            )
            placements.append(
                DevicePlacement(
                    DeviceType.SIGN_GENERIC, st["w3_5_l"][k], sign_offset_left, label=w3_5_label
                )
            )
        # R2-11 END DOUBLE FINES ZONE + restoration R2-1 — per
        # direction at its exit.
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, st["r2_11_r"], sign_offset_right, label="R2-11"
            )
        )
        placements.append(
            DevicePlacement(DeviceType.SIGN_GENERIC, st["r2_11_l"], sign_offset_left, label="R2-11")
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, st["ds_r2_1_r"], sign_offset_right, label="R2-1"
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, st["ds_r2_1_l"], sign_offset_left, label="R2-1"
            )
        )
        # G20-5P / R2-6P assemblies — same stations both sides, each
        # facing its direction; plan_sheet._deoverlap_signs_pairwise
        # spreads the co-located pair at render time.
        for station in st["assembly_stations"]:
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
        # Entrance R2-1 (G4) — posts the reduced limit at the plaque
        # anchor, both sides.
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, st["entrance_r2_1"], sign_offset_right, label="R2-1"
            )
        )
        placements.append(
            DevicePlacement(
                DeviceType.SIGN_GENERIC, st["entrance_r2_1"], sign_offset_left, label="R2-1"
            )
        )

    # 11. Pedestrian access signs — R9-9 "SIDEWALK CLOSED" (plain legend
    # per §6G.10; "USE OTHER SIDE" is R9-10 and asserts an alternate
    # side the tool cannot verify) at the upstream and downstream ends
    # of the work zone, on the work-side shoulder.  v1 does not emit
    # detour-routing signs (R9-11a etc.) — those need sidewalk geometry
    # the form does not capture yet.
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

    return _dedupe_placements(placements)


def generate_work_beyond_shoulder(
    params: ScenarioParams,
    shoulder_width_ft: float | None = None,
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

    ``shoulder_width_ft`` defaults to ``params.shoulder_width_ft`` (the
    single source of truth); the kwarg remains as an explicit override.
    """
    if shoulder_width_ft is None:
        shoulder_width_ft = params.shoulder_width_ft
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

    return _dedupe_placements(placements)


def generate_mobile_op_2lane(
    params: ScenarioParams,
    shoulder_width_ft: float | None = None,
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

    return _dedupe_placements(placements)


def generate_mobile_op_multilane(
    params: ScenarioParams,
    shoulder_width_ft: float | None = None,
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

    return _dedupe_placements(placements)


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
        shoulder_width_ft=8.0,
        is_divided=False,
        is_night=False,
        jurisdiction="CDOT",
    )
    flagger_placements = generate_flagger_alternating_2lane(flagger_params)
    _print_smoke_test("Flagger Alternating 2-Lane Scenario", flagger_placements, flagger_params)
