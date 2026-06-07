"""Generate setup/takedown crew narratives.

Two modes:

* ``use_llm=False`` (V1 default) — Pure Jinja2 template rendering against a
  context dict built from the placement list and scenario parameters.  No
  network calls, no API key required.
* ``use_llm=True`` (V1.1 plumbing) — Calls Claude Haiku via the ``anthropic``
  SDK to refine the prose sections of the template-rendered draft.
  Requires ``ANTHROPIC_API_KEY`` in the environment.

Authoritative sources:
  - MUTCD 11th Edition, Part 6 (Temporary Traffic Control)
  - CDOT M&S Standard Plan S-630-1 (Right Shoulder Closure)
  - Colorado Supplement to MUTCD (effective 2026-01-18)
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from src.rules.devices import DeviceType, cone_display_name
from src.rules.sign_codes import description_for
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    co_speed_reduction_signs,
    device_spacing_in_taper,
    device_spacing_on_tangent,
    pick_device_count,
    shoulder_taper_length,
)
from src.rules.validators import DevicePlacement, ScenarioParams, _is_flagger_scenario

_TEMPLATES_DIR: Path = Path(__file__).parent / "templates"
_BASE_TEMPLATE: str = "base.md.j2"

_TABLE_6B_1_CATEGORIES: frozenset[str] = frozenset(
    {"urban_low", "urban_high", "rural", "expressway", "freeway"}
)

# Sign labels emitted by the Phase 3 layout.  Plaques and END ROAD WORK
# get their own rows in the schedule and are excluded from the
# advance-warning sign list.  Fines Double envelope signs (R2-10, R2-11,
# R2-1) are also excluded since they have their own schedule rows when
# the envelope is emitted (V1-Wide Item 3).
_PLAQUE_AND_END_LABELS: frozenset[str] = frozenset(
    {"G20-5P", "G20-2", "R2-6P", "R2-10", "R2-11", "R2-1"}
)


def _is_w3_5_label(label: str | None) -> bool:
    """True for any W3-5 label, including speed-encoded ``W3-5(60)``."""
    return (label or "").upper().startswith("W3-5")


_DEVICE_HUMAN_NAMES: dict[DeviceType, str] = {
    DeviceType.DRUM: "Channelizing Drum (36-inch)",
    DeviceType.TUBULAR_MARKER: "Tubular Marker (36-inch)",
    DeviceType.BARRICADE_TYPE_II: "Type II Barricade",
    DeviceType.BARRICADE_TYPE_III: "Type III Barricade",
    DeviceType.LONGITUDINAL_CHANNELIZER: "Longitudinal Channelizer",
    DeviceType.ARROW_BOARD: "Arrow Board",
    DeviceType.PCMS: "Portable Changeable Message Sign",
    DeviceType.TRUCK_MOUNTED_ATTENUATOR: "Truck-Mounted Attenuator (TMA)",
    DeviceType.TEMPORARY_BARRIER: "Temporary Concrete Barrier",
    DeviceType.FLAGGER_STATION: "Flagger Station",
    DeviceType.TEMPORARY_SIGNAL: "Temporary Traffic Signal",
    DeviceType.DETOUR_MARKER: "Detour Marker",
    DeviceType.CHANNELIZER_OPTIONAL: "Optional Channelizer",
    DeviceType.WARNING_LIGHT_TYPE_C: "Type C Steady-Burn Warning Light",
    DeviceType.PORTABLE_LIGHT_PLANT: "Portable Light Plant",
}

_ROAD_TYPE_HUMAN: dict[str, str] = {
    "urban_low": "Urban (low-speed)",
    "urban_high": "Urban (high-speed)",
    "rural": "Rural two-lane",
    "expressway": "Expressway",
    "freeway": "Freeway",
}


def _device_summary(placements: list[DevicePlacement], speed_mph: float) -> list[dict[str, Any]]:
    """Bullet-list aggregation: non-signs at top level, signs nested beneath one parent."""
    non_sign_counts: Counter[DeviceType] = Counter()
    sign_counts: Counter[str] = Counter()
    for p in placements:
        if p.device_type == DeviceType.SIGN_GENERIC:
            sign_counts[p.label or "(unlabeled)"] += 1
        else:
            non_sign_counts[p.device_type] += 1

    rows: list[dict[str, Any]] = []
    for dt, n in sorted(non_sign_counts.items(), key=lambda kv: kv[0].value):
        label = (
            cone_display_name(speed_mph)
            if dt == DeviceType.CONE
            else _DEVICE_HUMAN_NAMES.get(dt, dt.value)
        )
        rows.append(
            {
                "label": label,
                "count": n,
                "children": [],
            }
        )

    if sign_counts:
        sign_rows = []
        for code, n in sorted(sign_counts.items()):
            human = description_for(code)
            label = f"{code} {human}".strip() if human != code else code
            sign_rows.append(
                {
                    "label": label,
                    "count": n,
                }
            )
        rows.append(
            {
                "label": "Construction/Warning Sign (see sign list below)",
                "count": sum(sign_counts.values()),
                "children": sign_rows,
            }
        )
    return rows


def _format_equipment_bullets(rows: list[dict[str, Any]]) -> str:
    """Render the device summary as a Markdown bullet list with one-level nesting."""
    lines: list[str] = []
    for row in rows:
        lines.append(f"- {row['count']}× {row['label']}")
        for child in row.get("children", []):
            lines.append(f"  - {child['count']}× {child['label']}")
    return "\n".join(lines)


def _format_advance_signs_bullets(advance_signs_setup_order: list[dict[str, Any]]) -> str:
    """Render the setup step-6 sub-bullets (one line per advance sign)."""
    lines: list[str] = []
    for s in advance_signs_setup_order:
        lines.append(
            f"   - {s['code']} at {s['distance_ft']:,.0f} ft upstream of "
            f"taper start (station {s['station_ft']:,.0f} ft), right side."
        )
    return "\n".join(lines)


def _format_takedown_sign_sequence(advance_signs_takedown_order: list[dict[str, Any]]) -> str:
    """Render the inline takedown order — e.g., ``W20-1 first, then W20-2, then W21-5aR``."""
    if not advance_signs_takedown_order:
        return "(none)"
    pieces: list[str] = []
    for i, s in enumerate(advance_signs_takedown_order):
        if i == 0:
            pieces.append(f"{s['code']} first")
        else:
            pieces.append(f"then {s['code']}")
    return ", ".join(pieces)


def _advance_signs_from_placements(
    placements: list[DevicePlacement],
    taper_start_station: float,
) -> list[dict[str, Any]]:
    """Right-side advance warning signs upstream of the taper, sorted by distance.

    Restricting to ``offset_ft > 0`` collapses divided-highway mirror pairs
    to the right-side representative; the template emits a "place matching
    sign on left side" instruction when ``is_divided`` is true.
    """
    out: list[dict[str, Any]] = []
    for p in placements:
        if (
            p.device_type == DeviceType.SIGN_GENERIC
            and p.label
            and p.label not in _PLAQUE_AND_END_LABELS
            and not _is_w3_5_label(p.label)
            and p.offset_ft > 0
            and p.station_ft > taper_start_station
        ):
            human = description_for(p.label)
            out.append(
                {
                    "code": p.label,
                    "description": "" if human == p.label else human,
                    "distance_ft": p.station_ft - taper_start_station,
                    "station_ft": p.station_ft,
                }
            )
    out.sort(key=lambda d: d["distance_ft"])
    return out


def _format_distance(distance_ft: float) -> str:
    return f"{distance_ft:,.0f} ft upstream"


def build_narrative_context(
    placements: list[DevicePlacement],
    params: ScenarioParams,
    site_adjustments: list[dict[str, Any]] | None = None,
    night_adjustments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Extract everything the template needs from placements + params.

    Mirrors the geometry math in ``src.generation.layout`` so the
    narrative text matches the layout it describes.  Pure data extraction
    — no string formatting beyond the small helpers above; the template
    handles presentation.
    """
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft
    shoulder_width = params.shoulder_width_ft

    lane_edge_offset = 2.0 * params.lane_width_ft
    shoulder_edge_offset = lane_edge_offset + shoulder_width
    sign_offset_right = lane_edge_offset + 4.0

    taper_len = shoulder_taper_length(speed, shoulder_width)
    buf_len = buffer_space(speed, jurisdiction=params.jurisdiction)

    taper_end_station = wz_len + buf_len
    taper_start_station = taper_end_station + taper_len

    rt = params.road_type if params.road_type in _TABLE_6B_1_CATEGORIES else None
    spacing_abc = advance_warning_spacing(speed, rt)

    in_taper_spacing = device_spacing_in_taper(speed)
    n_taper_devices = pick_device_count(taper_len, in_taper_spacing, min_count=2)
    actual_taper_spacing = taper_len / (n_taper_devices - 1)

    n_tangent = pick_device_count(wz_len, device_spacing_on_tangent(speed), min_count=2)
    tangent_spacing = wz_len / (n_tangent - 1)

    # Extracted directly from the placement list so counts always match the
    # workbook export and the plan-sheet PDF.
    n_taper_drums = sum(1 for p in placements if p.device_type == DeviceType.DRUM)
    n_tangent_cones = sum(
        1 for p in placements if p.device_type == DeviceType.CONE and 0.0 <= p.station_ft <= wz_len
    )
    n_plaques_right = sum(
        1
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC and p.label == "G20-5P" and p.offset_ft > 0
    )
    plaque_interval = wz_len / n_plaques_right if n_plaques_right > 0 else wz_len

    advance_signs = _advance_signs_from_placements(placements, taper_start_station)
    # G1 — parametric descriptions for the W21-5aR-pair plaques.
    # ``description_for("W16-2a")`` / ``description_for("W7-3a")`` return
    # the generic ``NEXT XXX FT plaque`` / ``NEXT XX MILES plaque`` templates;
    # the schedule row substitutes the values the layout actually computes
    # so the crew narrative reads "NEXT 1500 FT" / "NEXT 1 MILES" rather
    # than the placeholder text.  Geometry mirrors the layout +
    # audit.sign_table — second W21-5aR sits midway between sign_a_station
    # and the W5-1-would-be station; W16-2a distance is from the first
    # W21-5aR to wz_start; W7-3a miles is the deterministic V1 default.
    if params.road_type == "freeway" and params.closure_type == "shoulder":
        rt_for_lookup = params.road_type if params.road_type in _TABLE_6B_1_CATEGORIES else None
        a_dist_ft = advance_warning_spacing(speed, rt_for_lookup)["A"]
        sign_a_station = taper_start_station + a_dist_ft
        w16_2a_distance_ft = int(round(sign_a_station - wz_len))
        w7_3a_miles = max(1, round(wz_len / 5280.0))
        w16_2a_text = f"NEXT {w16_2a_distance_ft:,} FT (under upstream W21-5aR)"
        w7_3a_text = (
            f"NEXT {w7_3a_miles} "
            f"{'MILE' if w7_3a_miles == 1 else 'MILES'} (under downstream W21-5aR)"
        )
        for s in advance_signs:
            if s["code"] == "W16-2a":
                s["description"] = w16_2a_text
            elif s["code"] == "W7-3a":
                s["description"] = w7_3a_text
    # Schedule table: farthest-upstream first (the order a motorist
    # encounters the signs) plus the in-zone plaque and end-zone signs.
    sign_schedule: list[dict[str, str]] = []
    for s in sorted(advance_signs, key=lambda d: -d["distance_ft"]):
        sign_schedule.append(
            {
                "code": s["code"],
                "description": s["description"],
                "distance": _format_distance(s["distance_ft"]),
            }
        )
    sign_schedule.append(
        {
            "code": "G20-5P",
            "description": description_for("G20-5P"),
            "distance": "Within work zone",
        }
    )
    sign_schedule.append(
        {
            "code": "G20-2",
            "description": description_for("G20-2"),
            "distance": "Downstream of work zone",
        }
    )

    # Fines Double envelope schedule rows (V1-Wide Item 3) — emitted
    # when work-zone speed is reduced AND scenario isn't a flagger
    # operation (Sheet 12 scope is freeway/expressway).  Mirrors the
    # ``fines_double`` audit section logic so the narrative and the
    # audit trail agree on when the envelope ships.
    fines_double_applicable = (
        params.work_zone_speed_mph is not None
        and params.work_zone_speed_mph < params.speed_mph
        and not _is_flagger_scenario(params)
    )

    # G6: Sheet 14 trigger-condition language for the reduced-speed
    # shoulder routing (Cases 26/27). Verbatim from the case fixtures;
    # only tabulated at 65/75 mph — silent otherwise to preserve the
    # verbatim-or-nothing symmetry the audit already enforces (S1).
    trigger_condition: str | None = None
    if fines_double_applicable:
        if params.speed_mph == 65:
            trigger_condition = (
                "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) "
                "ARE WITHIN 8 FT OF TRAVEL WAY"
            )
        elif params.speed_mph == 75:
            trigger_condition = (
                "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) "
                "ARE WITHIN 10 FT OF TRAVEL WAY"
            )

    if fines_double_applicable:
        # G5: W3-5 advisory-speed row(s) above the envelope, driver-
        # encounter order (most-upstream first).  Single row for
        # Δ ≤ 15; stepped sequence (N rows) for Δ > 15 — each row
        # carries its intermediate posted speed from the same formula
        # the layout uses.  Stations match ``layout.py``: rightmost
        # (closest to R2-10) at 530 ft upstream of R2-10; each prior
        # row +530 ft further upstream.
        n_w3_5 = co_speed_reduction_signs(params.speed_mph, params.work_zone_speed_mph)
        w3_5_rows: list[dict[str, str]] = []
        for k in range(n_w3_5 - 1, -1, -1):
            sp = max(
                params.work_zone_speed_mph,
                ((params.speed_mph - (n_w3_5 - k) * 15) // 5) * 5,
            )
            distance_ft = (k + 1) * 530.0
            w3_5_rows.append(
                {
                    "code": f"W3-5({sp})",
                    "description": f"ADVISORY SPEED {sp}",
                    "distance": f"{distance_ft:,.0f} ft upstream of R2-10",
                }
            )
        sign_schedule.extend(w3_5_rows)
        sign_schedule.extend(
            [
                {
                    "code": "R2-1",
                    "description": (
                        f"SPEED LIMIT {params.work_zone_speed_mph} (work-zone speed posting)"
                    ),
                    "distance": "Within work zone (paired with G20-5P plaque)",
                },
                {
                    "code": "R2-10",
                    "description": description_for("R2-10"),
                    "distance": "500 ft upstream of work zone",
                },
                {
                    "code": "R2-11",
                    "description": description_for("R2-11"),
                    "distance": "500 ft downstream of work zone",
                },
                {
                    "code": "G20-5P / R2-6P",
                    "description": "WORK ZONE / FINES DOUBLE assembly",
                    "distance": "2,640 ft assemblies between R2-10 and R2-11",
                },
                {
                    "code": "R2-1",
                    "description": f"SPEED LIMIT {params.speed_mph} (posted-speed restoration)",
                    "distance": "1,000 ft downstream of work zone",
                },
            ]
        )

    # Sheet 12 operational rules — surfaced in a Safety Notes block in
    # the template when the envelope is emitted.  Skipped on flagger
    # scenarios per the audit-trail carve-out; estimator-facing
    # "doesn't apply" lives in the audit, not the crew narrative.
    fines_double_notes: list[dict[str, str]] = []
    if fines_double_applicable:
        fines_double_notes = [
            {
                "citation": "S-630-1 Sheet 12, Note 1",
                "action": (
                    "Install Fines Double signs no more than 4 hours before "
                    "the start of the work day. Do not leave signs up "
                    "overnight when work is not active."
                ),
            },
            {
                "citation": "S-630-1 Sheet 12, Note 2",
                "action": (
                    "Remove or cover Fines Double signs when work concludes; "
                    "doubled fines apply only when workers or work activity "
                    "are present in the zone."
                ),
            },
            {
                "citation": "S-630-1 Sheet 12, Note 3",
                "action": (
                    "Relocate the R2-10/R2-11 envelope to follow the actual "
                    "work area as the project progresses; do not leave "
                    "Fines Double signs in place beyond the active work zone."
                ),
            },
            {
                "citation": "S-630-1 Sheet 12, Note 4",
                "action": (
                    "Maintain a 250 ft minimum spacing between Fines Double "
                    "signs (R2-10, R2-11, G20-5P/R2-6P assemblies) and "
                    "other warning or regulatory signs. Engineer may adjust "
                    "placement to satisfy this minimum."
                ),
            },
        ]

    end_sign_station = next(
        (
            p.station_ft
            for p in placements
            if p.device_type == DeviceType.SIGN_GENERIC and p.label == "G20-2"
        ),
        0.0,
    )

    # Setup runs downstream→upstream, so the crew encounters the
    # nearest-to-taper sign (A) first; takedown runs upstream→downstream
    # and pulls the farthest sign (C) first.
    setup_order = sorted(advance_signs, key=lambda d: d["distance_ft"])
    takedown_order = sorted(advance_signs, key=lambda d: -d["distance_ft"])
    device_summary = _device_summary(placements, params.speed_mph)

    return {
        "params": params,
        "road_type_human": _ROAD_TYPE_HUMAN.get(params.road_type, params.road_type),
        "device_summary": device_summary,
        "equipment_bullets": _format_equipment_bullets(device_summary),
        "sign_schedule": sign_schedule,
        "advance_signs_setup_order": setup_order,
        "advance_signs_takedown_order": takedown_order,
        "advance_signs_setup_bullets": _format_advance_signs_bullets(setup_order),
        "takedown_sign_sequence": _format_takedown_sign_sequence(takedown_order),
        "taper_start_station": taper_start_station,
        "taper_end_station": taper_end_station,
        "taper_len_ft": taper_len,
        "taper_spacing_ft": actual_taper_spacing,
        "tangent_spacing_ft": tangent_spacing,
        "num_taper_drums": n_taper_drums,
        "num_tangent_cones": n_tangent_cones,
        "buffer_space_ft": buf_len,
        "plaque_interval_ft": plaque_interval,
        "lane_edge_offset_ft": lane_edge_offset,
        "shoulder_edge_offset_ft": shoulder_edge_offset,
        "sign_offset_ft": sign_offset_right,
        "end_sign_station_ft": end_sign_station,
        "advance_spacing_abc": spacing_abc,
        "is_night": params.is_night,
        "is_divided": params.is_divided,
        "site_adjustments": site_adjustments or [],
        "night_adjustments": night_adjustments or [],
        "fines_double_notes": fines_double_notes,
        "trigger_condition": trigger_condition,
        "generation_date": datetime.now().strftime("%Y-%m-%d"),
    }


def _render_template(context: dict[str, Any]) -> str:
    """Render the base Jinja2 template against ``context``."""
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(disabled_extensions=("md", "j2", "md.j2")),
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )
    template = env.get_template(_BASE_TEMPLATE)
    return template.render(**context)


def _refine_with_llm(template_markdown: str) -> str:
    """Refine the template-rendered draft using Claude Haiku.

    The model is asked to improve the prose of the Setup/Takedown/Safety
    sections while preserving every numeric fact (stations, distances,
    counts, sign codes) and every section heading and table cell.  Any
    SDK failure or non-text response falls back to the template draft.
    """
    try:
        import anthropic
    except ImportError:
        return template_markdown

    try:
        client = anthropic.Anthropic()
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "You are editing a crew-instruction document for a "
                        "highway traffic-control plan. Below is a Markdown "
                        "draft generated from a template. Rewrite the prose "
                        "of the Setup Procedure, Takedown Procedure, and "
                        "Safety Notes sections so it reads naturally for a "
                        "field crew, while preserving every numeric value "
                        "(stations, distances, device counts, sign codes), "
                        "every section heading, and every table cell. Do "
                        "not invent new safety claims or remove any item. "
                        "Return only the revised Markdown.\n\n"
                        "---\n\n"
                        f"{template_markdown}"
                    ),
                }
            ],
        )
        block = response.content[0]
        if getattr(block, "type", None) == "text":
            return block.text
        return template_markdown
    except Exception:
        # Plumbing only — fall back silently when the SDK call fails so
        # the V1 default path is never blocked by V1.1 dependencies.
        return template_markdown


def generate_crew_narrative(
    placements: list[DevicePlacement],
    params: ScenarioParams,
    output_path: str = "crew_narrative.md",
    use_llm: bool = False,
    site_adjustments: list[dict[str, Any]] | None = None,
    night_adjustments: list[dict[str, Any]] | None = None,
) -> str:
    """Render a crew-instructions Markdown document and write it to disk.

    Args:
        placements: The device layout produced by ``src.generation.layout``.
        params: The scenario parameters that drove the layout.
        output_path: Destination file path (relative to CWD or absolute).
        use_llm: When True, refine the template draft with Claude Haiku.
            Default False — pure template rendering, no API calls.

    Returns:
        The output path that was written.
    """
    context = build_narrative_context(
        placements,
        params,
        site_adjustments=site_adjustments,
        night_adjustments=night_adjustments,
    )
    markdown = _render_template(context)
    if use_llm:
        markdown = _refine_with_llm(markdown)
    Path(output_path).write_text(markdown, encoding="utf-8")
    return output_path


if __name__ == "__main__":
    import os

    from src.generation.layout import generate_shoulder_closure_divided

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    placements = generate_shoulder_closure_divided(params)
    output = generate_crew_narrative(placements, params, "crew_narrative.md")

    size_bytes = os.path.getsize(output)
    print(f"Wrote {output} ({size_bytes} bytes)")
    print()

    with open(output, encoding="utf-8") as f:
        lines = f.readlines()
    print(f"--- First 30 lines of {output} ---")
    for line in lines[:30]:
        print(line.rstrip())
