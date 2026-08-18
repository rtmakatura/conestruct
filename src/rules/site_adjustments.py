"""
Apply site-condition adjustments to a generated device layout.

The generator in ``src.generation.layout`` produces a baseline MUTCD-compliant
layout from the scenario parameters alone. This module layers in modifications
driven by the user-checked site-condition flags from the sidebar — extra
intersection signing, sidewalk closures, school-zone signing, etc.

Each adjustment returns an audit record describing what changed and why, so
the verification expander in the UI can show its work. Crew narratives consume
the same records to render the "Site-Specific Notes" section.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from src.rules.devices import DeviceType
from src.rules.validators import DevicePlacement, ScenarioParams

# Advance-warning labels eligible for upstream relocation under
# limited_sight_distance. Pulled from the labels emitted by the layout
# generators (layout.py) plus the W-codes called out in the spec.
_ADVANCE_SIGN_LABELS: frozenset[str] = frozenset(
    {"W20-1", "W20-2", "W21-5aR", "W20-5R", "W4-2R", "W20-7", "W3-4"}
)


def _shoulder_width(params: ScenarioParams) -> float:
    return getattr(params, "shoulder_width_ft", 10.0)


def _ped_offset(params: ScenarioParams) -> float:
    """Lateral offset for sidewalk-closure barricades and R9-9 signs.

    Outside the lanes + shoulder by 2 ft, mirrored on each side. Matches the
    "lane_width + shoulder_width + 2 ft" formula in the spec, with the
    project's sign-of-offset convention (positive = right of centerline).
    """
    lane_edge = params.num_lanes * params.lane_width_ft
    return lane_edge + _shoulder_width(params) + 2.0


def _adjust_limited_sight_distance(
    placements: list[DevicePlacement],
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """Move advance warning signs 50% farther upstream from the taper."""
    out: list[DevicePlacement] = []
    moved = 0
    for p in placements:
        if (
            p.device_type == DeviceType.SIGN_GENERIC
            and p.label in _ADVANCE_SIGN_LABELS
            and p.station_ft > 0
        ):
            out.append(replace(p, station_ft=p.station_ft * 1.5))
            moved += 1
        else:
            out.append(p)
    record = {
        "flag": "limited_sight_distance",
        "action": (
            f"Moved {moved} advance warning sign(s) 50% farther upstream from "
            "the taper to compensate for limited sight distance."
        ),
        "devices_added": 0,
        "devices_modified": moved,
        "rule": "MUTCD §6B.04 — increased advance warning for limited sight distance",
    }
    return out, record


def _adjust_adjacent_intersection(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """Flag an adjacent at-grade intersection — no devices are added.

    The legacy gesture (a mirrored ``W20-1`` pair stamped at the
    work-zone midpoint) is retired (Refs #117): two signs facing a
    cross street the tool does not model bought no real control while
    inflating the device count and quote — the wrong-counts failure
    mode the Option C framing cares about.  The record still fires so
    the audit's ``intersection_layout_not_generated`` pending
    disclosure (keyed off this flag) keeps flipping the plan amber;
    real cross-street control is the gated ``near_intersection`` kind
    (#117; corner-quadrant work at #128).
    """
    _ = params  # geometry no longer drives any placement here
    record = {
        "flag": "adjacent_intersection",
        "action": (
            "No devices added — the cross-street approach layout is not "
            "generated; see the pending-verification disclosure."
        ),
        "devices_added": 0,
        # Cited by real title + printed page (#16; subject-verified,
        # 11th Ed.): the section governs work at/adjacent to
        # intersections but assigns no proximity distance — the
        # detection tolerances that decide when this flag auto-checks
        # are CHOSEN, recorded at site_detection._BUCKET_RELEVANCE_OVERRIDES.
        "rule": "MUTCD §6N.12 p. 848 — Work within the Traveled Way at an Intersection (11th Ed.)",
    }
    return placements, record


def _adjust_adjacent_interchange(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """Flag an adjacent interchange — no devices are added.

    The legacy gesture (one ``W20-3`` + one PCMS stamped single-side) is
    retired with the intersection stamp (Refs #117, same gesture class):
    the PCMS alone put a $175 phantom line on quotes for a per-ramp
    layout the tool does not generate, and the unmirrored sign created a
    false left/right-balance compliance failure on divided plans.  The
    record still fires so the audit's
    ``interchange_layout_not_generated`` pending disclosure (keyed off
    this flag) keeps flipping the plan amber; ramp-aware support tracks
    with the intersection work (#117).
    """
    _ = params  # geometry no longer drives any placement here
    record = {
        "flag": "adjacent_interchange",
        "action": (
            "No devices added — the per-ramp interchange layout is not "
            "generated; see the pending-verification disclosure."
        ),
        "devices_added": 0,
        # Cited by real title + printed page (#16; subject-verified,
        # 11th Ed.).  The former "+ Ch. 6H" rider is dropped: Ch. 6H is
        # "TTC Zone Warning Signs" generally, not an interchange-signing
        # chapter — §6N.16 carries the claim alone.
        "rule": "MUTCD §6N.16 p. 851 — Interchanges (11th Ed.)",
    }
    return placements, record


def _adjust_driveways_present() -> dict[str, Any]:
    """Advisory only — channelizer placement is hand-tuned in the field."""
    return {
        "flag": "driveways_present",
        "action": (
            "Driveways present within work zone — maintain access gaps in "
            "channelization. Do not place channelizing devices across "
            "driveway entrances."
        ),
        "devices_added": 0,
        "rule": "MUTCD §6K.01 — access management in work zones",
    }


def _adjust_pedestrian_facility(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """Type III barricades + R9-9 SIDEWALK CLOSED signs at each end."""
    offset = _ped_offset(params)
    upstream = params.work_zone_length_ft
    downstream = 0.0

    barricades = [
        DevicePlacement(DeviceType.BARRICADE_TYPE_III, upstream, offset),
        DevicePlacement(DeviceType.BARRICADE_TYPE_III, upstream, -offset),
        DevicePlacement(DeviceType.BARRICADE_TYPE_III, downstream, offset),
        DevicePlacement(DeviceType.BARRICADE_TYPE_III, downstream, -offset),
    ]
    signs = [
        DevicePlacement(DeviceType.SIGN_GENERIC, upstream, offset, label="R9-9"),
        DevicePlacement(DeviceType.SIGN_GENERIC, downstream, offset, label="R9-9"),
    ]
    record = {
        "flag": "pedestrian_facility",
        "action": (
            "Added 4 Type III barricades (sidewalk closure points) and 2 R9-9 "
            "SIDEWALK CLOSED signs at the upstream and downstream ends of "
            "the work zone."
        ),
        "devices_added": 6,
        "rule": "MUTCD §6C.02 — pedestrian considerations in work zones",
    }
    return placements + barricades + signs, record


def _adjust_bicycle_facility(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """M4-9a BIKE DETOUR signs at the upstream and downstream ends."""
    sign_offset = params.num_lanes * params.lane_width_ft + 4.0
    new_signs = [
        DevicePlacement(
            DeviceType.SIGN_GENERIC, params.work_zone_length_ft, sign_offset, label="M4-9a"
        ),
        DevicePlacement(DeviceType.SIGN_GENERIC, 0.0, sign_offset, label="M4-9a"),
    ]
    record = {
        "flag": "bicycle_facility",
        "action": "Added 2 M4-9a BIKE DETOUR signs at the upstream and downstream ends.",
        "devices_added": 2,
        "rule": "MUTCD §9C.101 — bicycle facility work zone signing",
    }
    return placements + new_signs, record


def _adjust_school_zone(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """S1-1 SCHOOL signs upstream of the existing advance warning signs."""
    sign_offset = params.num_lanes * params.lane_width_ft + 4.0
    farthest_sign = max(
        (
            p.station_ft
            for p in placements
            if p.device_type == DeviceType.SIGN_GENERIC and p.label in _ADVANCE_SIGN_LABELS
        ),
        default=params.work_zone_length_ft,
    )
    s1_station = farthest_sign + 500.0
    new_signs = [
        DevicePlacement(DeviceType.SIGN_GENERIC, s1_station, sign_offset, label="S1-1"),
        DevicePlacement(DeviceType.SIGN_GENERIC, s1_station, -sign_offset, label="S1-1"),
    ]
    record = {
        "flag": "school_zone",
        "action": (
            "Added 2 S1-1 SCHOOL signs upstream of the advance warning signs "
            f"(station {s1_station:,.0f} ft, both sides)."
        ),
        "devices_added": 2,
        "rule": "MUTCD §7B.08 — school zone signing in proximity to work zones",
    }
    return placements + new_signs, record


def apply_site_adjustments(
    placements: list[DevicePlacement],
    params: ScenarioParams,
    flags: dict[str, bool] | None = None,
) -> tuple[list[DevicePlacement], list[dict[str, Any]]]:
    """Apply checked site-condition flags to a baseline layout.

    Args:
        placements: Baseline layout from ``src.generation.layout``.
        params: Scenario parameters that drove the baseline.
        flags: Mapping of flag-name → bool. Unknown keys are ignored;
            missing keys are treated as False. ``None`` is equivalent
            to all-flags-off.

    Returns:
        ``(adjusted_placements, audit_records)``. The original list is
        not mutated; a copy is returned even when no flags are set.
    """
    flags = flags or {}
    out = list(placements)
    records: list[dict[str, Any]] = []

    if flags.get("limited_sight_distance"):
        out, rec = _adjust_limited_sight_distance(out)
        records.append(rec)

    if flags.get("adjacent_intersection"):
        out, rec = _adjust_adjacent_intersection(out, params)
        records.append(rec)

    if flags.get("adjacent_interchange"):
        out, rec = _adjust_adjacent_interchange(out, params)
        records.append(rec)

    if flags.get("driveways_present"):
        records.append(_adjust_driveways_present())

    if flags.get("pedestrian_facility"):
        out, rec = _adjust_pedestrian_facility(out, params)
        records.append(rec)

    if flags.get("bicycle_facility"):
        out, rec = _adjust_bicycle_facility(out, params)
        records.append(rec)

    if flags.get("school_zone"):
        out, rec = _adjust_school_zone(out, params)
        records.append(rec)

    return out, records
