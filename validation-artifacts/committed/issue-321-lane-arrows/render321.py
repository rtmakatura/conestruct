"""#321: page 1's plan strip for each road type and live kind, through /render/pdf.

python render321.py <worktree> <outdir>
Each case: a full page-1 PNG and a crop of the plan area (the road drawing),
where the direction arrows are.
"""
import copy
import io
import json
import os
import sys

W, OUT = sys.argv[1], sys.argv[2]
os.chdir(W)
sys.path.insert(0, W)
os.environ["RENDER_API_SECRET"] = "t"
os.environ["MAPBOX_TOKEN"] = ""
os.makedirs(OUT, exist_ok=True)

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_k: ({"elements": []}, None)
client = TestClient(app)
META = {"project": "T", "address": "", "lat": 0.0, "lng": 0.0}
SW = {"pedestrian_facility": True}

SHOULDER = {
    "kind": "shoulder",
    "roadType": "urban_arterial",
    "speed": 35,
    "lanes": 2,
    "laneWidth": 11.0,
    "divided": False,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 500.0,
    "night": False,
}
CASES = {
    "shoulder-two-way-sidewalk": {**SHOULDER, "meta": {**META, "siteConditions": SW}},
    "shoulder-divided-sidewalk": {
        **SHOULDER,
        "roadType": "rural_divided",
        "divided": True,
        "lanes": 3,
        "meta": {**META, "siteConditions": SW},
    },
    "shoulder-two-way-1lane": {**SHOULDER, "lanes": 1, "meta": META},
    "flagger": {
        "kind": "flagger_lane_closure",
        "meta": META,
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 11.0,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
    },
    "near-intersection": {
        "kind": "near_intersection",
        "meta": META,
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 600.0,
        "night": False,
        "approaches": [
            {
                "id": "cross_n",
                "speed": 30,
                "roadType": "urban_arterial",
                "lanesPerDirection": 1,
                "laneWidth": 12.0,
                "signalized": False,
                "bearingDeg": None,
                "alongStationFt": -60.0,
            }
        ],
    },
}
# One-way control: the committed Broadway SB fixture (one-way after #308).
fx = json.load(open("tests/fixtures/pdf_worst_case/broadway-left.json", encoding="utf-8"))
for k in ("scenario", "body", "request"):
    if isinstance(fx, dict) and k in fx:
        fx = fx[k]
        break
CASES["one-way-control"] = fx

for name, body in CASES.items():
    r = client.post("/render/pdf", headers={"Authorization": "Bearer t"}, json=copy.deepcopy(body))
    if r.status_code != 200:
        print(name, r.status_code, r.text[:300])
        continue
    page = pdfium.PdfDocument(io.BytesIO(r.content))[0]
    im = page.render(scale=2).to_pil()
    im.save(f"{OUT}/{name}.png")
    w, h = im.size
    im.crop((0, int(h * 0.05), w, int(h * 0.72))).save(f"{OUT}/{name}-plan.png")
    print(name, "ok", im.size)
