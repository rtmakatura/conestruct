"""#323 R153: render page 1 of TA-23's left far-side plan (N Broadway SB,
E 14th Ave before the work, 300 ft of bay storage entered) and its right
far-side twin, for the eye, with the containment counts.

  python -B render_turn_bay.py <outDir>   (from the repo root)
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
from tests.test_left_lane_near_intersection import UPSTREAM, ni  # noqa: E402
from tests.test_left_side_oneway import parsed  # noqa: E402
from tests.test_pdf_containment import measure_containment  # noqa: E402

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
for side in ("left", "right"):
    body = ni(side, UPSTREAM)
    if side == "left":
        body["turnBayStorageFt"] = 300
    params, gen, kwargs = scenario_to_call(parsed(body))
    pdf = out / f"ni-{side}-far.pdf"
    render_plan_sheet(
        gen(params, **kwargs), params, output_path=str(pdf), approaches=kwargs["approaches"]
    )
    counts = {k: len(v) for k, v in measure_containment(str(pdf)).items()}
    doc = pdfium.PdfDocument(str(pdf))
    doc[0].render(scale=150 / 72).to_pil().save(out / f"ni-{side}-far-page1.png")
    doc.close()
    pdf.unlink()
    print(side, "containment", counts)
