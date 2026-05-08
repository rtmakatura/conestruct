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

from src.rules.devices import DeviceType
from src.rules.sign_codes import description_for
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    device_spacing_in_taper,
    device_spacing_on_tangent,
    pick_device_count,
    shoulder_taper_length,
)
from src.rules.validators import DevicePlacement, ScenarioParams

_TEMPLATES_DIR: Path = Path(__file__).parent / "templates"
_BASE_TEMPLATE: str = "base.md.j2"

_TABLE_6B_1_CATEGORIES: frozenset[str] = frozenset(
    {"urban_low", "urban_high", "rural", "expressway", "freeway"}
)

# Sign labels emitted by the Phase 3 layout.  Plaques and END ROAD WORK
# get their own rows in the schedule and are excluded from the
# advance-warning sign list.
_PLAQUE_AND_END_LABELS: frozenset[str] = frozenset({"G20-5P", "G20-2", "R2-6P"})

_DEVICE_HUMAN_NAMES: dict[DeviceType, str] = {
    DeviceType.CONE: "Traffic Cone (36-inch)",
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
}

_ROAD_TYPE_HUMAN: dict[str, str] = {
    "urban_low": "Urban (low-speed)",
    "urban_high": "Urban (high-speed)",
    "rural": "Rural two-lane",
    "expressway": "Expressway",
    "freeway": "Freeway",
}


def _device_summary(placements: list[DevicePlacement]) -> list[dict[str, Any]]:
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
        rows.append(
            {
                "label": _DEVICE_HUMAN_NAMES.get(dt, dt.value),
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
    buf_len = buffer_space(speed)

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
    device_summary = _device_summary(placements)

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
    context = build_narrative_context(placements, params, site_adjustments=site_adjustments)
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
