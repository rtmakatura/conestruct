"""#317 investigation probe: what the reads and the deliverables answer for a
work-start near-intersection plan with no crossing marked, today, and what the
two reads would build if the crossing check let them through.

TestClient on the given checkout, Overpass and the aerial fetch stubbed, no
network. No product code changes. "Proposed read" is simulated by sending the
same scenario with a placeholder ``meta.intersection``: both reads build with
``place_cross_street=False`` (render_api.py), so they never read the crossing,
and the placeholder only gets the body past the model validator.

Usage: python no_crossing_probe.py <repo-root>
"""

from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "probe"
os.environ["MAPBOX_TOKEN"] = "probe"
AUTH = {"Authorization": "Bearer probe"}

from fastapi.testclient import TestClient  # noqa: E402

import src.api.render_api as _ra  # noqa: E402
from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]
_ra._static_aerial.fetch_png = lambda *_a, **_kw: b"\x89PNG-probe"  # type: ignore[assignment]

bw = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))
m = copy.deepcopy(bw["meta"])
cand = m["confirmedRoad"]["candidate"]
m["centerline"] = cand["geometry"]
m["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": cand["tags"]["oneway"]}
m["pinModel"] = "work_start"
m.pop("work", None)
m.pop("intersection", None)
m.pop("bearingDeg", None)

base = {
    "kind": "near_intersection",
    "meta": m,
    "roadType": "urban_arterial",
    "speed": 30,
    "lanes": 2,
    "laneWidth": 12,
    "divided": False,
    "workType": "utility_cut",
    "duration": "short",
    "workLen": 500,
    "night": False,
    "approaches": [
        {"id": "cross_a", "speed": 30, "roadType": "urban_arterial",
         "lanesPerDirection": 1, "laneWidth": 12, "signalized": False}
    ],
}
cases = {"no side, no crossing (the repro)": copy.deepcopy(base)}
right = copy.deepcopy(base)
right["meta"]["work"] = {"side": "right", "travel": "with_geometry"}
cases["right side stored, no crossing"] = right

client = TestClient(app)


def short(r) -> str:
    ct = r.headers.get("content-type", "")
    if "json" in ct:
        return f"{r.status_code} {json.dumps(r.json())[:260]}"
    return f"{r.status_code} {ct.split(';')[0]}"


def reads(label: str, body: dict) -> None:
    r = client.post("/render/corridor-geometry", headers=AUTH, json=body)
    if r.status_code == 200:
        j = r.json()
        print(f"  {label} geometry: 200 status={j['status']} side_options="
              f"{[(o['work']['side'], o['label']) for o in j['side_options']]}")
    else:
        print(f"  {label} geometry: {short(r)}")
    for stage in ("pin", "work"):
        rm = client.post("/render/corridor-map", headers=AUTH,
                         json={"scenario": body, "stage": stage, "width": 600, "height": 300})
        print(f"  {label} corridor-map stage={stage}: {short(rm)}")


for label, body in cases.items():
    print(f"== {label}")
    reads("today", body)
    for path in ("/render/audit", "/render/pdf"):
        print(f"  today {path}: {short(client.post(path, headers=AUTH, json=body))}")
    placeholder = copy.deepcopy(body)
    placeholder["meta"]["intersection"] = {"lat": m["lat"], "lng": m["lng"], "name": None}
    reads("proposed read (crossing never read)", placeholder)
