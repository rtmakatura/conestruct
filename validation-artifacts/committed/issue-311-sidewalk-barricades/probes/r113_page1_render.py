"""#311 R113 -- page 1 before/after: the work-side sidewalk pair only.

Adapted from issue-308-oneway-read-as-divided/probes/r94_page1_render.py.
FastAPI TestClient on the checkout named on the command line (no prod
request), Overpass stubbed, "Pedestrian sidewalks present" checked,
Shoulder work, Utility locate.  Plans:

  colorado   Colorado Blvd, 39.70900, -104.94070, divided by verdict (the
             14.8 m same-name twin, way 42241079; #308 twin_probe.txt),
             3 x 11 ft, 35 mph (CHOSEN for the render, as in R94).
  lafayette  Lafayette St, 39.74362, -104.97070, the two-way control (OSM
             way 581254411, residential, oneway=no, lanes=2; tests/fixtures/
             corridor/lafayette-flagger.json), 1 lane each way x 11 ft,
             25 mph, urban_arterial (CHOSEN for the render).
  broadway   N Broadway SB, 39.73370, -104.98753, one-way (R94): must not
             change.

Run with the main .venv python:
    python r113_page1_render.py <checkout-root> <before|after>
It writes r113_<plan>_<tag>.png (page 1, 100 dpi) and r113_<tag>.txt beside
itself: device count, Type III quantity on the device breakdown, each Type
III / R9-9 placement with its offset and page y, and whether it sits on the
band page 1 hatches closed.  On "after" it adds each page's pixel-diff box.
"""

from __future__ import annotations

import copy
import io
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
TAG = sys.argv[2]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
# Empty, not absent: src/_dotenv only fills keys that are unset, so this
# keeps a checkout's .env token out and both runs draw the same 1-page plan.
os.environ["MAPBOX_TOKEN"] = ""
AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pydantic import TypeAdapter  # noqa: E402

from src.api import render_api  # noqa: E402
from src.api.render_api import app  # noqa: E402
from src.api.schemas import Scenario  # noqa: E402
from src.rendering import plan_sheet as ps  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]


def broadway() -> dict:
    base = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))
    meta = base["meta"]
    cand = meta["confirmedRoad"]["candidate"]
    meta["centerline"] = cand["geometry"]
    meta["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": "yes"}
    meta["siteConditions"] = {"pedestrian_facility": True}
    base["divided"] = False
    base["carriageway"] = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None,
                           "twinSearched": True, "confirmed": None}
    return base


def _off_corridor(body: dict) -> dict:
    body.pop("signalDistanceM", None)
    for k in ("confirmedRoad", "intersection", "work", "centerline", "roadDirection"):
        body["meta"].pop(k, None)
    return body


def colorado() -> dict:
    body = _off_corridor(copy.deepcopy(broadway()))
    body.update(speed=35, lanes=3, laneWidth=11.0, divided=True, detectedLanesTotal=6)
    body["meta"].update(address="S Colorado Blvd at E Exposition Ave", lat=39.70900, lng=-104.94070)
    body["carriageway"] = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": 14.8,
                           "twinSearched": True, "confirmed": None}
    return body


def lafayette() -> dict:
    body = _off_corridor(copy.deepcopy(broadway()))
    body.update(speed=25, lanes=1, laneWidth=11.0, divided=False, roadType="urban_arterial")
    body.pop("detectedLanesTotal", None)
    body["meta"].update(address="Lafayette St (two-way control)", lat=39.74362, lng=-104.97070)
    body["carriageway"] = {"oneway": "no", "highwayClass": "residential", "twinDistanceM": None,
                           "twinSearched": True, "confirmed": None}
    return body


client = TestClient(app)
sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
lines = [f"HEAD {sha}  tag {TAG}  checkout {ROOT.name}", ""]
PLANS = (("colorado", colorado()), ("lafayette", lafayette()), ("broadway", broadway()))

for name, body in PLANS:
    r = client.post("/render/pdf", headers=AUTH, json=body)
    lines.append(f"== {name}: POST /render/pdf -> {r.status_code}")
    if r.status_code != 200:
        lines.append("   " + r.text[:400])
        continue
    pdf = pdfium.PdfDocument(io.BytesIO(r.content))
    pdf[0].render(scale=100 / 72).to_pil().save(HERE / f"r113_{name}_{TAG}.png")

    scenario = TypeAdapter(Scenario).validate_python(body)
    placements, params, *_ = render_api._placements_for(scenario)
    bd = client.post("/render/device-breakdown", headers=AUTH, json=body).json()
    qty = [d.get("qty") for d in bd.get("devices", []) if d.get("device") == "Type III Barricade"]
    sw = params.shoulder_width_ft
    lines.append(
        f"   verdict={scenario.carriageway_verdict()}  is_divided={params.is_divided}  "
        f"one_way_street={params.one_way_street}  lanes={params.num_lanes}  devices={len(placements)}  "
        f"breakdown Type III qty={qty}"
    )
    inner, outer = ps._sidewalk_strip_ft(params, sw)
    hatched = ps._strip_y_range(inner, outer, 1, params.is_divided)
    lines.append(f"   hatched (work-side) sidewalk band y: {hatched[0]:.1f}..{hatched[1]:.1f}")
    for p in placements:
        if p.device_type.name == "BARRICADE_TYPE_III" or (p.label or "") == "R9-9":
            y = ps._y_of(p.offset_ft, params.is_divided)
            where = "on the hatched band" if hatched[0] <= y <= hatched[1] else "OFF the hatched band"
            lines.append(
                f"   {p.device_type.name:<20} {p.label or '':<6} station {p.station_ft:7.1f}  "
                f"offset {p.offset_ft:6.1f} ft  page y {y:6.1f}  {where}"
            )
    lines.append("")

if TAG == "after":
    from PIL import Image, ImageChops

    for name, _ in PLANS:
        before, after = (HERE / f"r113_{name}_{t}.png" for t in ("before", "after"))
        if before.exists() and after.exists():
            box = ImageChops.difference(
                Image.open(before).convert("RGB"), Image.open(after).convert("RGB")
            ).getbbox()
            lines.append(f"pixel diff before -> after, {name}: changed bbox (x0, y0, x1, y1 px at 100 dpi) {box}")

out = HERE / f"r113_{TAG}.txt"
out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\r\n")
print("\n".join(lines))
