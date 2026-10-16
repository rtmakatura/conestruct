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
from src.rules.spacing import advance_warning_spacing, limited_sight_nearest_sign
from src.rules.validators import DevicePlacement, ScenarioParams

# Advance-warning labels: the school-zone S1-1 goes 500 ft beyond the
# farthest of these.  Pulled from the labels emitted by the layout
# generators (layout.py) plus the W-codes called out in the spec.
_ADVANCE_SIGN_LABELS: frozenset[str] = frozenset(
    # #325: W21-5aL, the left shoulder's (#300).
    {"W20-1", "W20-2", "W21-5aR", "W21-5aL", "W20-5R", "W4-2R", "W20-5L", "W4-2L", "W20-7", "W3-4"}
)


def _shoulder_width(params: ScenarioParams) -> float:
    return getattr(params, "shoulder_width_ft", 10.0)


def _ped_offset(params: ScenarioParams) -> float:
    """Lateral offset for sidewalk-closure barricades and R9-9 signs.

    Outside the lanes + shoulder by 2 ft, on the work side (positive
    offset). Matches the "lane_width + shoulder_width + 2 ft" formula in
    the spec, with the project's sign-of-offset convention (positive =
    right of centerline).  Never mirrored (#311 R113).
    """
    lane_edge = params.num_lanes * params.lane_width_ft
    return lane_edge + _shoulder_width(params) + 2.0


# Each approach's nearest advance sign: the sign Table 6B-1's A distance
# places (layout.py).  Shoulder plans: the SHOULDER CLOSED sign (#300,
# #325 the left one); lane and near-intersection plans: the LANE ENDS
# sign (#323 the left one); flagger plans: FLAGGER AHEAD (or AFAD AHEAD).
_NEAREST_SIGN_LABELS: frozenset[str] = frozenset(
    {"W21-5aR", "W21-5aL", "W4-2R", "W4-2L", "W20-7", "W20-7a"}
)

# CDOT S-630-1 Sheet 2 General Notes 10 and 25, the note every plan with the
# flag carries (R155).  The crew sheet prints it in the record's sentence and
# page 1 prints it in capitals (plan_sheet._draw_notes).
LIMITED_SIGHT_ENGINEER_NOTE = (
    "The Engineer sets the final sign locations (CDOT S-630-1 Sheet 2 Note 10). "
    "Add advance warning signs where the line of sight to them is obstructed (Note 25)."
)


def limited_sight_page_note(params: ScenarioParams) -> str:
    """Page 1's NOTES line for a plan with limited sight distance (R155).

    One line: page 1's notes box has no room for more without cutting the
    advance-sign rows it exists to show (#331's prod check: a scanned
    sidewalk's R9-9 row plus a three-line note cut W20-2 and W20-1 on N
    Broadway).  The distances are the advance table's; the full sentence is
    the audit's and the crew sheet's.
    """
    a_ft = advance_warning_spacing(params.speed_mph, params.road_type)["A"]
    top = limited_sight_nearest_sign(params.speed_mph, params.road_type)
    if top is not None and top[0] > a_ft:
        lead = f"NEAREST SIGN {top[1]} × SPEED (MUTCD §6B.04)"
    else:
        lead = "TABLE 6B-1 SPACING KEPT"
    return f"LIMITED SIGHT: {lead}. SIGNS PER ENGINEER (S-630-1 NOTES 10, 25)."


def _adjust_limited_sight_distance(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """Move each approach's advance warning signs out to §6B.04's range top.

    R155 (Ryan, 2026-10-16, clarified at #331's checkpoint): the top of
    MUTCD §6B.04's range (8 × speed urban, 12 × speed rural) takes Table
    6B-1's A distance's place, and each approach's whole advance series
    moves upstream together, so every gap behind the nearest sign keeps its
    Table 6B-1 value.  A is measured from the taper on shoulder and
    near-intersection plans and from the flagger station on flagger plans
    (Fig. 6P-10), so the nearest sign lands at the range top from that same
    anchor.  Never closer than A; expressways and freeways keep Table 6B-1;
    cross-street approaches stay (their frame is the curb line) and the
    Engineer note covers them.
    """
    from src.rules.validators import _is_flagger_scenario

    a_ft = advance_warning_spacing(params.speed_mph, params.road_type)["A"]
    top = limited_sight_nearest_sign(params.speed_mph, params.road_type)
    shift = 0.0 if top is None else max(0.0, top[0] - a_ft)

    mainline = [p for p in placements if p.approach_id == "mainline"]
    nearest = [p.station_ft for p in mainline if p.label in _NEAREST_SIGN_LABELS]
    upstream = min((s for s in nearest if s > 0), default=None)
    # Only a flagger plan signs the opposing approach (negative stations).
    downstream = max((s for s in nearest if s < 0), default=None)

    out: list[DevicePlacement] = []
    moved = 0
    for p in placements:
        if shift and p.approach_id == "mainline":
            if upstream is not None and p.station_ft >= upstream:
                out.append(replace(p, station_ft=p.station_ft + shift))
                moved += 1
                continue
            if downstream is not None and p.station_ft <= downstream:
                out.append(replace(p, station_ft=p.station_ft - shift))
                moved += 1
                continue
        out.append(p)

    anchor = "each flagger station" if _is_flagger_scenario(params) else "the taper"
    if top is None:
        moved_text = (
            f"No signs moved: MUTCD §6B.04's placement ranges cover urban streets "
            f"and rural roads, so this {params.road_type}'s Table 6B-1 spacing stands."
        )
    elif not moved and shift:
        moved_text = "No signs moved: this plan has no advance warning series to move."
    elif not moved:
        moved_text = (
            f"No signs moved: Table 6B-1 already puts the nearest sign {a_ft:,.0f} ft "
            f"from {anchor}, beyond the top of MUTCD §6B.04's {top[2]} range "
            f"({top[1]} × {params.speed_mph} mph = {top[0]:,.0f} ft)."
        )
    else:
        moved_text = (
            f"Moved {moved} advance warning sign(s) {shift:,.0f} ft farther upstream. "
            f"The nearest sign now sits {top[0]:,.0f} ft from {anchor} "
            f"({top[1]} × {params.speed_mph} mph, the top of MUTCD §6B.04's {top[2]} "
            f"range) instead of Table 6B-1's {a_ft:,.0f} ft, and the signs behind it "
            "keep Table 6B-1's spacing."
        )
    record = {
        "flag": "limited_sight_distance",
        "action": f"{moved_text} {LIMITED_SIGHT_ENGINEER_NOTE}",
        "devices_added": 0,
        "devices_modified": moved,
        "rule": (
            # The chip is the prefix before ": " (audit._site_citation), kept
            # "MUTCD § 6B.04" to match the frontend's static table.
            "MUTCD §6B.04: limited sight distance puts the nearest warning sign "
            "at the top of ¶04's urban or ¶06's rural range (p. 771)"
        ),
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
            "No devices added: the cross-street approach layout isn't "
            "generated. See the pending-verification disclosure."
        ),
        "devices_added": 0,
        # Cited by real title + printed page (#16; subject-verified,
        # 11th Ed.): the section governs work at/adjacent to
        # intersections but assigns no proximity distance — the
        # detection tolerances that decide when this flag auto-checks
        # are CHOSEN, recorded at site_detection._BUCKET_RELEVANCE_OVERRIDES.
        "rule": "MUTCD §6N.12 p. 848: Work within the Traveled Way at an Intersection (11th Ed.)",
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
            "No devices added: the per-ramp interchange layout isn't "
            "generated. See the pending-verification disclosure."
        ),
        "devices_added": 0,
        # Cited by real title + printed page (#16; subject-verified,
        # 11th Ed.).  The former "+ Ch. 6H" rider is dropped: Ch. 6H is
        # "TTC Zone Warning Signs" generally, not an interchange-signing
        # chapter — §6N.16 carries the claim alone.
        "rule": "MUTCD §6N.16 p. 851: Interchanges (11th Ed.)",
    }
    return placements, record


def _adjust_driveways_present() -> dict[str, Any]:
    """Advisory only — channelizer placement is hand-tuned in the field."""
    return {
        "flag": "driveways_present",
        "action": (
            "Driveways present within the work zone. Maintain access gaps in "
            "channelization. Do not place channelizing devices across "
            "driveway entrances."
        ),
        "devices_added": 0,
        "rule": "MUTCD §6K.01: access management in work zones",
    }


def _adjust_pedestrian_facility(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """Type III barricades + R9-9 SIDEWALK CLOSED signs at each end.

    The work-side pair only, on every road (#311 R113: "Option (a):
    work-side pair only, on every road, same reasoning as R94").  The flag
    carries no side, and the R9-9s, the page-1 hatch (side +1 only) and
    the audit all put the closure at the work-side sidewalk, so a
    ``-offset`` pair barricaded a sidewalk nothing in the plan closes: on a
    one-way street it floated above the road (#308 R94), on a two-way road
    it sat past the opposing shoulder where no band is drawn, and on a
    divided road it stood on the opposing band with no hatch and no R9-9.
    The mirrored pair (``aa40c4f``) rested on the spec formula, never on
    MUTCD text.
    """
    offset = _ped_offset(params)
    upstream = params.work_zone_length_ft
    downstream = 0.0
    sides = (offset,)

    barricades = [
        DevicePlacement(DeviceType.BARRICADE_TYPE_III, station, side)
        for station in (upstream, downstream)
        for side in sides
    ]
    signs = [
        DevicePlacement(DeviceType.SIGN_GENERIC, upstream, offset, label="R9-9"),
        DevicePlacement(DeviceType.SIGN_GENERIC, downstream, offset, label="R9-9"),
    ]
    record = {
        "flag": "pedestrian_facility",
        "action": (
            f"Added {len(barricades)} Type III barricades (sidewalk closure points) "
            f"and {len(signs)} R9-9 SIDEWALK CLOSED signs at the upstream and "
            "downstream ends of the work zone."
        ),
        "devices_added": len(barricades) + len(signs),
        "rule": "MUTCD §6C.02: pedestrian considerations in work zones",
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
        "rule": "MUTCD §9C.101: bicycle facility work zone signing",
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
        "rule": "MUTCD §7B.08: school zone signing in proximity to work zones",
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
        out, rec = _adjust_limited_sight_distance(out, params)
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
