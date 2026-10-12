"""#314 evidence: page 1 cropped at the taper start and the downstream taper,
for the four shoulder plans with and without a sidewalk (R136).

Renders page 1 through the API (TestClient, Overpass stubbed, no Mapbox
token), records the final device positions from ``_layout_device_positions``
(the renderer's own), and crops the page PNG around the first taper drum
(with the arrow board) and around the downstream taper's cones.
Usage: python crops_probe.py <repo-root> <out-dir>
"""

from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "probe"
AUTH = {"Authorization": "Bearer probe"}

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import src.rendering.plan_sheet as ps  # noqa: E402
from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from src.rules.validators import DeviceType  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]
os.environ.pop("MAPBOX_TOKEN", None)

rec: dict[str, Any] = {}
_orig_layout = ps._layout_device_positions


def _layout(placements, x_of, station_max_visible, params, shoulder_width_ft, site_flags=None):
    items, lights = _orig_layout(placements, x_of, station_max_visible, params, shoulder_width_ft, site_flags)
    rec["items"] = items
    rec["road"] = ps._road_y_extent(params, shoulder_width_ft)
    return items, lights


ps._layout_device_positions = _layout

FX = ROOT / "tests" / "fixtures"
bw = json.loads((FX / "corridor" / "broadway-sb.json").read_text(encoding="utf-8"))
m = bw["meta"]
cand = m["confirmedRoad"]["candidate"]
m["centerline"] = cand["geometry"]
m["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": cand["tags"]["oneway"]}
bw["carriageway"] = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None, "twinSearched": True}
bw["divided"] = False
bw_left = copy.deepcopy(bw)
bw_left["meta"]["work"] = {"side": "left", "travel": "with_geometry"}


def worst(name: str) -> dict[str, Any]:
    return json.loads((FX / "pdf_worst_case" / name).read_text(encoding="utf-8"))["scenario"]


CASES = {
    "broadway-right": bw,
    "broadway-left": bw_left,
    "two-way": worst("control-typical.json"),
    "divided": worst("adv-shoulder.json"),
}
SCALE = 3.0
client = TestClient(app)
for name, base in CASES.items():
    for ped in (False, True):
        body = copy.deepcopy(base)
        body["meta"]["siteConditions"] = {**(body["meta"].get("siteConditions") or {}), "pedestrian_facility": ped}
        rec.clear()
        r = client.post("/render/pdf", headers=AUTH, json=body)
        assert r.status_code == 200, (name, r.text[:200])
        page = pdfium.PdfDocument(r.content)[0]
        _w, h = page.get_size()
        img = page.render(scale=SCALE).to_pil()
        y_lo, y_hi = min(rec["road"]), max(rec["road"])
        drums = [(p, x, y) for p, x, y in rec["items"] if p.device_type == DeviceType.DRUM]
        cones = [(p, x, y) for p, x, y in rec["items"] if p.device_type == DeviceType.CONE and p.station_ft < 0]
        tag = f"{name}-{'sidewalk' if ped else 'no-sidewalk'}"
        for label, group in (("taper-start", drums), ("downstream", cones)):
            if not group:
                continue
            xs = [x for _, x, _ in group]
            # The work-side road edge the glyphs sit against, plus a margin
            # that takes in the band (21 pt) and the direction arrow.
            ys = [y for _, _, y in group]
            cx0, cx1 = min(xs) - 60, max(xs) + 60
            cy0, cy1 = min(min(ys), y_lo) - 45, max(max(ys), y_hi if abs(max(ys) - y_hi) < 60 else max(ys)) + 45
            box = (int(cx0 * SCALE), int((h - cy1) * SCALE), int(cx1 * SCALE), int((h - cy0) * SCALE))
            img.crop(box).save(OUT / f"{tag}-{label}.png")
        print(tag, "saved")
