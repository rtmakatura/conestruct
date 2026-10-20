"""#360 evidence: page-1 renders of four reduced-speed shoulder plans.

Usage: PYTHONPATH=. uv run python <this file> <out_dir> <tag>
Calls the plan-sheet builder directly (expressway is not reachable from the
wire's road types), then rasterizes page 1 with pypdfium2.
"""

import sys
from pathlib import Path

import pypdfium2 as pdfium

from src.generation.layout import generate_shoulder_closure_divided
from src.rendering.plan_sheet import render_plan_sheet
from src.rules.validators import ScenarioParams

CASES = {
    "urban_high_55_45": ("urban_high", 55, 45),
    "rural_75_65": ("rural", 75, 65),
    "expressway_65_55": ("expressway", 65, 55),
    "freeway_case11_55_45": ("freeway", 55, 45),
}

out_dir, tag = Path(sys.argv[1]), sys.argv[2]
out_dir.mkdir(parents=True, exist_ok=True)
for name, (road_type, speed, wz_speed) in CASES.items():
    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=2,
        closure_type="shoulder",
        road_type=road_type,
        work_zone_length_ft=1000.0,
        is_divided=True,
        work_zone_speed_mph=wz_speed,
        project_name=f"#360 {name} ({tag})",
    )
    placements = generate_shoulder_closure_divided(params)
    pdf_path = out_dir / f"{name}-{tag}.pdf"
    render_plan_sheet(placements, params, output_path=str(pdf_path))
    doc = pdfium.PdfDocument(str(pdf_path))
    doc[0].render(scale=2).to_pil().save(out_dir / f"{name}-{tag}.png")
    doc.close()
    pdf_path.unlink()
    signs = sorted(
        {(round(p.station_ft), p.label) for p in placements if "SIGN" in p.device_type.name},
        reverse=True,
    )
    print(name, " ".join(f"{label}@{st}" for st, label in signs))
