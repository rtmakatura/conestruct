"""#323: render page 1 of the near-side left-lane plan (N Broadway SB,
E 6th Ave downstream) and its right-lane twin, for the eye.

  python -B render_left_lane.py <outDir>   (from the repo root)
"""

import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())
os.environ.pop("MAPBOX_TOKEN", None)

import pypdfium2 as pdfium  # noqa: E402

from src.api.schemas import scenario_to_call  # noqa: E402
from src.rendering.plan_sheet import render_plan_sheet  # noqa: E402
from tests.test_left_lane_near_intersection import ni  # noqa: E402
from tests.test_left_side_oneway import parsed  # noqa: E402

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
for side in ("left", "right"):
    params, gen, kwargs = scenario_to_call(parsed(ni(side)))
    pdf = out / f"ni-{side}-lane.pdf"
    render_plan_sheet(gen(params, **kwargs), params, output_path=str(pdf), approaches=kwargs["approaches"])
    doc = pdfium.PdfDocument(str(pdf))
    doc[0].render(scale=150 / 72).to_pil().save(out / f"ni-{side}-lane-page1.png")
    doc.close()
    pdf.unlink()
    print(side, "ok")
