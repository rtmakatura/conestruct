"""Render page 1 of the TA-23 left far-side plan at E 11th Ave (Ryan's check)
from the current checkout.   python -B render11th.py <out.png> [storage]"""

import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())
os.environ.pop("MAPBOX_TOKEN", None)
os.environ.setdefault("RENDER_API_SECRET", "x")

import pypdfium2 as pdfium  # noqa: E402

from src.api.schemas import scenario_to_call  # noqa: E402
from src.generation.layout import near_intersection_stations  # noqa: E402
from src.rendering.plan_sheet import render_plan_sheet  # noqa: E402
from tests.test_left_lane_near_intersection import ni  # noqa: E402
from tests.test_left_side_oneway import parsed  # noqa: E402
from tests.test_pdf_containment import measure_containment  # noqa: E402

E_11TH = {"lat": 39.73385, "lng": -104.98753, "name": "E 11th Ave"}
out = sys.argv[1]
body = ni("left", E_11TH)
body["workLen"] = 1000
body["turnBayStorageFt"] = float(sys.argv[2]) if len(sys.argv) > 2 else 300.0
params, gen, kwargs = scenario_to_call(parsed(body))
st = near_intersection_stations(params, kwargs["approaches"])
print(
    {
        k: st[k]
        for k in (
            "side",
            "upstream_curb",
            "downstream_curb",
            "taper_end",
            "taper_start",
            "buffer_len",
            "taper_len",
        )
    },
    st.get("turn_bay"),
)
pdf = out.replace(".png", ".pdf")
render_plan_sheet(gen(params, **kwargs), params, output_path=pdf, approaches=kwargs["approaches"])
print({k: len(v) for k, v in measure_containment(pdf).items()})
doc = pdfium.PdfDocument(pdf)
doc[0].render(scale=150 / 72).to_pil().save(out)
doc.close()
os.remove(pdf)
