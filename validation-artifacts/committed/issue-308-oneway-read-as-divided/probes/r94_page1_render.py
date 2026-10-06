"""#308 R94 -- render page 1 of Ryan's browser-check plan and a divided control.

Plans (no prod request; FastAPI TestClient on THIS checkout, Overpass stubbed):

  broadway  N Broadway SB, 39.73370, -104.98753 (tests/fixtures/corridor/
            broadway-sb.json, OSM way 131232822, primary, oneway=yes, no
            same-name twin within 100 m), Shoulder work, Utility locate,
            "Pedestrian sidewalks present" -- the inputs of Ryan's check on
            prod a748a7b (37 devices).
  colorado  Colorado Blvd, 39.70900, -104.94070 (twin_probe.txt colorado-blvd:
            way 16991616, primary, oneway=yes, 3 lanes; opposite same-name
            way 42241079 at 14.8 m -> divided), the same work and site
            condition, 35 mph (probe input, CHOSEN for the render only).

Run from the repo root:
    uv run --frozen --extra dev python validation-artifacts/committed/issue-308-oneway-read-as-divided/probes/r94_page1_render.py <tag>
It writes r94_<plan>_<tag>.png (page 1, 100 dpi) and r94_<tag>.txt beside
itself: the device count, each Type III barricade / R9-9 / arrow-relevant
placement with its offset and page y, and the drawn road's y extent.
"""

from __future__ import annotations

import copy
import io
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
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

TAG = sys.argv[1] if len(sys.argv) > 1 else "run"
HERE = Path(__file__).parent


def broadway() -> dict:
    base = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))
    meta = base["meta"]
    cand = meta["confirmedRoad"]["candidate"]
    meta["centerline"] = cand["geometry"]
    meta["roadDirection"] = {
        "osmBearingDeg": cand["bearing"] % 360,
        "oneway": (cand.get("tags") or {}).get("oneway"),
    }
    meta["siteConditions"] = {"pedestrian_facility": True}
    base["divided"] = False
    base["carriageway"] = {
        "oneway": "yes",
        "highwayClass": "primary",
        "twinDistanceM": None,
        "twinSearched": True,
        "confirmed": None,
    }
    return base


def colorado() -> dict:
    body = copy.deepcopy(broadway())
    body.update(speed=35, lanes=3, laneWidth=11.0, divided=True, detectedLanesTotal=6)
    body.pop("signalDistanceM", None)
    meta = body["meta"]
    meta.update(address="S Colorado Blvd at E Exposition Ave", lat=39.70900, lng=-104.94070)
    for k in ("confirmedRoad", "intersection", "work", "centerline", "roadDirection"):
        meta.pop(k, None)
    body["carriageway"] = {
        "oneway": "yes",
        "highwayClass": "primary",
        "twinDistanceM": 14.8,
        "twinSearched": True,
        "confirmed": None,
    }
    return body


client = TestClient(app)
sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
lines = [f"HEAD {sha}  tag {TAG}", ""]

for name, body in (("broadway", broadway()), ("colorado", colorado())):
    r = client.post("/render/pdf", headers=AUTH, json=body)
    lines.append(f"== {name}: POST /render/pdf -> {r.status_code}")
    if r.status_code != 200:
        lines.append("   " + r.text[:400])
        continue
    pdf = pdfium.PdfDocument(io.BytesIO(r.content))
    pdf[0].render(scale=100 / 72).to_pil().save(HERE / f"r94_{name}_{TAG}.png")

    scenario = TypeAdapter(Scenario).validate_python(body)
    placements, params, *_ = render_api._placements_for(scenario)
    sw = params.shoulder_width_ft
    top, bottom = ps._road_y_extent(params, sw)
    lines.append(
        f"   verdict={scenario.carriageway_verdict()}  is_divided={params.is_divided}  "
        f"one_way_street={params.one_way_street}  lanes={params.num_lanes}  "
        f"lane_w={params.lane_width_ft}  shoulder_w={sw}  devices={len(placements)}"
    )
    lines.append(f"   drawn road y: top {top:.1f}  bottom {bottom:.1f}  (PLAN_Y_CENTER {ps.PLAN_Y_CENTER:.1f})")
    # The sidewalk bands page 1 draws (_draw_site_context): the work side,
    # plus the opposing side on a divided road.
    inner, outer = ps._sidewalk_strip_ft(params, sw)
    bands = [ps._strip_y_range(inner, outer, s, params.is_divided) for s in ((1, -1) if params.is_divided else (1,))]
    lines.append("   drawn sidewalk bands y: " + ", ".join(f"{lo:.1f}..{hi:.1f}" for lo, hi in bands))
    for p in placements:
        if p.device_type.name == "BARRICADE_TYPE_III" or (p.label or "") == "R9-9":
            y = ps._y_of(p.offset_ft, params.is_divided)
            on_band = any(lo <= y <= hi for lo, hi in bands)
            lines.append(
                f"   {p.device_type.name:<20} {p.label or '':<6} station {p.station_ft:7.1f}  "
                f"offset {p.offset_ft:6.1f} ft  page y {y:6.1f}  "
                f"{'on a drawn sidewalk band' if on_band else 'ON NO DRAWN BAND (floats)'}"
            )
    lines.append("")

if TAG == "after":
    # Where page 1 changed: the bounding box of every differing pixel
    # between the committed "before" render (a748a7b) and this one.
    from PIL import Image, ImageChops

    for name in ("broadway", "colorado"):
        before, after = (HERE / f"r94_{name}_{t}.png" for t in ("before", "after"))
        if before.exists() and after.exists():
            box = ImageChops.difference(
                Image.open(before).convert("RGB"), Image.open(after).convert("RGB")
            ).getbbox()
            lines.append(f"pixel diff before -> after, {name}: changed bbox (x0, y0, x1, y1 px at 100 dpi) {box}")

out = HERE / f"r94_{TAG}.txt"
out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\r\n")
print("\n".join(lines))
