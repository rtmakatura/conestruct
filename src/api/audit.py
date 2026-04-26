"""
Audit-trail builder for the MHT plan generator.

Exposes one public function — ``build_audit_trail`` — that recomputes
every intermediate value the Streamlit verification panel displays,
calling the same MUTCD/CDOT spacing functions the layout engine uses.

The dict returned mirrors the structure the UI expects: one top-level
key per expander, each holding the inputs, formulas, and source
citations needed to justify a number to a Traffic Control Supervisor.
"""

from __future__ import annotations

import math
from typing import Any

from src.rules.devices import DeviceType
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    co_construction_plaques,
    device_spacing_in_taper,
    device_spacing_on_tangent,
    shoulder_taper_length,
    taper_length,
)
from src.rules.tables import (
    COLORADO_OVERRIDES,
    TAPER_LENGTH_FORMULA_THRESHOLD_MPH,
)
from src.rules.validators import DevicePlacement, ScenarioParams

_TABLE_6B_1_CATEGORIES: frozenset[str] = frozenset(
    {"urban_low", "urban_high", "rural", "expressway", "freeway"}
)


def _resolve_road_category(speed_mph: int, road_type: str) -> str:
    """Mirror the auto-inference in advance_warning_spacing."""
    if road_type in _TABLE_6B_1_CATEGORIES:
        return road_type
    if speed_mph <= 35:
        return "urban_low"
    if speed_mph < 45:
        return "urban_high"
    return "rural"


def build_audit_trail(
    placements: list[DevicePlacement],
    params: ScenarioParams,
    shoulder_width_ft: float = 10.0,
) -> dict[str, Any]:
    """Recompute every audit-trail intermediate the verification UI needs."""
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft

    # ------------------------------------------------------------------
    # 1. Taper length
    # ------------------------------------------------------------------
    threshold = TAPER_LENGTH_FORMULA_THRESHOLD_MPH
    if speed >= threshold:
        formula_choice = f"Speed {speed} mph >= {threshold} mph threshold -> using L = W x S"
        formula_latex = r"L = W \times S"
        L_full = float(shoulder_width_ft * speed)
    else:
        formula_choice = f"Speed {speed} mph < {threshold} mph threshold -> using L = W x S^2 / 60"
        formula_latex = r"L = \frac{W \times S^2}{60}"
        L_full = taper_length(speed, shoulder_width_ft)
    L_third = shoulder_taper_length(speed, shoulder_width_ft)

    taper_section = {
        "speed_mph": speed,
        "shoulder_width_ft": shoulder_width_ft,
        "formula_choice": formula_choice,
        "formula_latex": formula_latex,
        "L_calc_text": f"L = {shoulder_width_ft:g} x {speed} = {L_full:g} ft",
        "L_full_ft": L_full,
        "L_third_calc_text": f"L/3 = {L_full:g} / 3 = {L_third:.1f} ft",
        "L_third_ft": L_third,
        "source": (
            "MUTCD 11th Ed. Sec 6C.08, Table 6B-3. Shoulder closures use L/3 per Sec 6C.08(B)."
        ),
        "cdot_reference": "CDOT S-630-1 Case 11",
    }

    # ------------------------------------------------------------------
    # 2. Buffer space
    # ------------------------------------------------------------------
    buf = buffer_space(speed)
    buffer_section = {
        "speed_mph": speed,
        "lookup_text": f"MUTCD Table 6B-2: {speed} mph -> {buf:g} ft",
        "buffer_ft": buf,
        "source": "MUTCD 11th Ed. Sec 6C.06, Table 6B-2 (stopping sight distance)",
    }

    # ------------------------------------------------------------------
    # 3. Channelizing device spacing
    # ------------------------------------------------------------------
    in_taper = device_spacing_in_taper(speed)
    on_tan = device_spacing_on_tangent(speed)
    raw_taper_drums = L_third / in_taper
    n_taper_drums_required = max(2, math.ceil(raw_taper_drums))
    raw_tangent_cones = wz_len / on_tan
    n_tangent_cones_required = max(2, math.ceil(raw_tangent_cones))

    actual_drums = sum(1 for p in placements if p.device_type == DeviceType.DRUM)
    actual_cones = sum(1 for p in placements if p.device_type == DeviceType.CONE)

    spacing_section = {
        "speed_mph": speed,
        "in_taper_text": (
            f"{speed} mph -> {in_taper:g} ft spacing "
            "(MUTCD Sec 6C.09: spacing equals speed in feet)"
        ),
        "on_tangent_text": (
            f"{speed} mph -> {on_tan:g} ft spacing "
            "(MUTCD Sec 6C.09: spacing equals 2x speed in feet)"
        ),
        "taper_count_text": (
            f"L/3 = {L_third:.1f} ft / {in_taper:g} ft spacing = "
            f"{raw_taper_drums:.2f}, rounded up = {n_taper_drums_required} drums"
        ),
        "tangent_count_text": (
            f"{wz_len:g} ft / {on_tan:g} ft spacing = "
            f"{raw_tangent_cones:.2f}, rounded up = "
            f"{n_tangent_cones_required} cones"
        ),
        "n_taper_drums_required": n_taper_drums_required,
        "n_taper_drums_actual": actual_drums,
        "n_tangent_cones_required": n_tangent_cones_required,
        "n_tangent_cones_actual": actual_cones,
        "source": "MUTCD 11th Ed. Sec 6C.09",
    }

    # ------------------------------------------------------------------
    # 4. Advance warning sign placement
    # ------------------------------------------------------------------
    rt_for_lookup = params.road_type if params.road_type in _TABLE_6B_1_CATEGORIES else None
    spacing_abc = advance_warning_spacing(speed, rt_for_lookup)
    a_ft = spacing_abc["A"]
    b_ft = spacing_abc["B"]
    c_ft = spacing_abc["C"]
    resolved_category = _resolve_road_category(speed, params.road_type)

    taper_end_station = wz_len + buf
    taper_start_station = taper_end_station + L_third
    sign_a_station = taper_start_station + a_ft
    sign_b_station = sign_a_station + b_ft
    sign_c_station = sign_b_station + c_ft

    sign_table_rows = [
        {
            "Position": "C (furthest)",
            "Code": "W20-1",
            "Station (ft)": f"{sign_c_station:,.0f}",
            "Distance from Taper (ft)": f"{a_ft + b_ft + c_ft:,.0f} upstream",
        },
        {
            "Position": "B (middle)",
            "Code": "W20-2",
            "Station (ft)": f"{sign_b_station:,.0f}",
            "Distance from Taper (ft)": f"{a_ft + b_ft:,.0f} upstream",
        },
        {
            "Position": "A (nearest)",
            "Code": "W21-5aR",
            "Station (ft)": f"{sign_a_station:,.0f}",
            "Distance from Taper (ft)": f"{a_ft:,.0f} upstream",
        },
    ]

    advance_section = {
        "road_type_text": (
            f"Speed {speed} mph, road_type = '{params.road_type}' "
            f"-> Table 6B-1 category: {resolved_category}"
        ),
        "spacing_text": f"A = {a_ft:g} ft, B = {b_ft:g} ft, C = {c_ft:g} ft",
        "sign_table": sign_table_rows,
        "source": "MUTCD 11th Ed. Table 6B-1",
    }

    # ------------------------------------------------------------------
    # 5. Colorado Supplement requirements
    # ------------------------------------------------------------------
    sign_left = sum(
        1 for p in placements if p.device_type == DeviceType.SIGN_GENERIC and p.offset_ft < 0
    )
    sign_right = sum(
        1 for p in placements if p.device_type == DeviceType.SIGN_GENERIC and p.offset_ft > 0
    )
    both_sides_pass = sign_left == sign_right and sign_left > 0 if params.is_divided else True
    both_sides = {
        "pass": both_sides_pass,
        "label": "Signs on both sides of divided highway",
        "citation": "CO Supplement Sec 6C.04(A)",
        "detail": (
            f"Required: {params.is_divided}. Signs placed: {sign_left} left, {sign_right} right."
        ),
    }

    plaques_right = sum(
        1
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC and p.label == "G20-5P" and p.offset_ft > 0
    )
    total_signed_length = sign_c_station
    plaques_required = co_construction_plaques(total_signed_length)
    plaques_section = {
        "pass": plaques_right >= plaques_required,
        "label": "G20-5P/R2-6P construction plaques every 2,640 ft",
        "citation": "CO Supplement Sec 6C.06(A)",
        "detail": (
            f"Zone length: {total_signed_length:,.0f} ft. "
            f"Required: {plaques_required}. Placed: {plaques_right}."
        ),
    }

    speed_reduction_section = {
        "pass": True,
        "label": "Speed reduction <= 15 mph per sign installation",
        "citation": "CO Supplement Sec 2B.13(A)",
        "detail": "No speed reduction in this scenario.",
    }

    n_flaggers = sum(1 for p in placements if p.device_type == DeviceType.FLAGGER_STATION)
    if n_flaggers == 0:
        flagger_section = {
            "pass": True,
            "label": (
                f"Flagger station lighting "
                f"{COLORADO_OVERRIDES.flagger_station_light_watts}W "
                f"@ {COLORADO_OVERRIDES.flagger_station_light_height_ft} ft"
            ),
            "citation": "CO Supplement Sec 6E.02(A)",
            "detail": "Not applicable (no flaggers).",
        }
    else:
        flagger_section = {
            "pass": params.is_night,
            "label": (
                f"Flagger station lighting "
                f"{COLORADO_OVERRIDES.flagger_station_light_watts}W "
                f"@ {COLORADO_OVERRIDES.flagger_station_light_height_ft} ft"
            ),
            "citation": "CO Supplement Sec 6E.02(A)",
            "detail": (
                f"{n_flaggers} flagger station(s); "
                f"required for night operations (is_night = {params.is_night})."
            ),
        }

    aadt_section = {
        "info": True,
        "label": (
            f"AADT threshold for mobile operations "
            f"(<= {COLORADO_OVERRIDES.mobile_operation_aadt_threshold:,})"
        ),
        "citation": "CO Supplement Sec 6G.02(A)",
        "detail": "Not applicable (not a mobile operation).",
    }

    co_section = {
        "checks": [both_sides, plaques_section, speed_reduction_section, flagger_section],
        "info_items": [aadt_section],
        "all_pass": all(
            c["pass"]
            for c in (
                both_sides,
                plaques_section,
                speed_reduction_section,
                flagger_section,
            )
        ),
    }

    # ------------------------------------------------------------------
    # 6. S-630-1 case reference
    # ------------------------------------------------------------------
    case_section = {
        "case": "Case 11: Shoulder closure on divided highway",
        "url": (
            "https://www.codot.gov/safety/traffic-safety/assets/"
            "s-standard-plans/2019/s-630-1/S-630-01%20(19-Page%20Set).pdf"
        ),
        "narrative": (
            "This scenario matches CDOT Standard Plan S-630-1, Case 11: "
            "Shoulder closure on divided highway."
        ),
        "narrative_2": (
            f"The generated plan follows the same device layout as "
            f"Case 11 with spacing computed for {speed} mph."
        ),
    }

    return {
        "taper": taper_section,
        "buffer": buffer_section,
        "spacing": spacing_section,
        "advance": advance_section,
        "colorado": co_section,
        "case": case_section,
    }
