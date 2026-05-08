"""Render the four Work-Package-A scenarios to PDFs for visual review.

Outputs:
    test_pdf_i25_freeway.pdf       — 55 mph divided (existing baseline)
    test_pdf_us85_rural.pdf        — 65 mph rural divided
    test_pdf_25mph_urban.pdf       — 25 mph urban_low undivided
    test_pdf_45mph_rural.pdf       — 45 mph rural undivided

Run from project root:  uv run python scripts/render_test_pdfs.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.generation.layout import (
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
)
from src.rendering.plan_sheet import render_plan_sheet
from src.rules.validators import ScenarioParams

_SKIPPED: list[str] = []


def _safe_render(c_render, params, out_path: Path, **kwargs) -> str:
    """Write to ``out_path``.  When the target file is locked by a
    PDF viewer, log a clear note and skip the file so the rest of the
    batch still completes; the script's footer summary lists every
    skip so the user knows exactly which viewers to close before
    rerunning.  Avoids the prior ``_v2`` fallback so we don't leave
    phantom files in the project root.
    """
    try:
        c_render(params=params, output_path=str(out_path), **kwargs)
        return str(out_path)
    except PermissionError:
        print(
            f"  ! SKIPPED {out_path.name} — file is locked "
            "(probably open in a PDF viewer; close it and rerun)."
        )
        _SKIPPED.append(out_path.name)
        return ""


def render_divided(
    name: str,
    *,
    speed: int,
    num_lanes: int,
    road_type: str,
    wz_len: float,
    lane_w: float,
    shoulder_w: float,
    project_name: str = "Untitled Project",
    location_description: str = "",
    bearing_deg: float | None = None,
) -> str:
    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=num_lanes,
        closure_type="shoulder",
        road_type=road_type,
        work_zone_length_ft=wz_len,
        lane_width_ft=lane_w,
        is_divided=True,
        jurisdiction="CDOT",
        project_name=project_name,
        location_description=location_description,
        bearing_deg=bearing_deg,
    )
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=shoulder_w)
    out = _ROOT / f"test_pdf_{name}.pdf"

    def _do(params, output_path, **kwargs):
        return render_plan_sheet(placements, params, output_path=output_path, **kwargs)

    return _safe_render(_do, params, out, shoulder_width_ft=shoulder_w)


def render_undivided(
    name: str,
    *,
    speed: int,
    num_lanes: int,
    road_type: str,
    wz_len: float,
    lane_w: float,
    shoulder_w: float,
    project_name: str = "Untitled Project",
    location_description: str = "",
) -> str:
    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=num_lanes,
        closure_type="shoulder",
        road_type=road_type,
        work_zone_length_ft=wz_len,
        lane_width_ft=lane_w,
        is_divided=False,
        jurisdiction="CDOT",
        project_name=project_name,
        location_description=location_description,
    )
    placements = generate_shoulder_closure_undivided(params, shoulder_width_ft=shoulder_w)
    out = _ROOT / f"test_pdf_{name}.pdf"

    def _do(params, output_path, **kwargs):
        return render_plan_sheet(placements, params, output_path=output_path, **kwargs)

    return _safe_render(_do, params, out, shoulder_width_ft=shoulder_w)


def main() -> None:
    out_paths: list[str] = []

    out_paths.append(
        render_divided(
            "i25_freeway",
            speed=55,
            num_lanes=3,
            road_type="freeway",
            wz_len=1000.0,
            lane_w=12.0,
            shoulder_w=10.0,
            project_name="I-25 NB MP 144.5-146",
            location_description="Colorado Springs",
        )
    )

    out_paths.append(
        render_divided(
            "us85_rural",
            speed=65,
            num_lanes=2,
            road_type="rural",
            wz_len=1000.0,
            lane_w=12.0,
            shoulder_w=10.0,
            project_name="US-85 NB",
            location_description="North of Brighton, CO",
        )
    )

    out_paths.append(
        render_undivided(
            "25mph_urban",
            speed=25,
            num_lanes=1,
            road_type="urban_low",
            wz_len=300.0,
            lane_w=11.0,
            shoulder_w=6.0,
        )
    )

    out_paths.append(
        render_undivided(
            "45mph_rural",
            speed=45,
            num_lanes=1,
            road_type="rural",
            wz_len=600.0,
            lane_w=12.0,
            shoulder_w=8.0,
        )
    )

    print("Rendered PDFs:")
    for p in out_paths:
        if not p:
            continue
        size = Path(p).stat().st_size
        print(f"  {p}  ({size} bytes)")
    if _SKIPPED:
        print("\nSkipped (locked by viewer — close and rerun):")
        for name in _SKIPPED:
            print(f"  - {name}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
