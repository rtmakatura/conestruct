"""#309 probe: near_intersection on N Broadway SB (39.73370, -104.98753), payload level.

Run (any cwd; ROOT = the checkout to test):
    <repo>/.venv/Scripts/python.exe ni_broadway_probe.py <repo-root>
No network: Overpass is stubbed; no site_scan on the body, no MAPBOX_TOKEN.
"""

from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
os.environ.pop("MAPBOX_TOKEN", None)
AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}

from fastapi.testclient import TestClient  # noqa: E402
from pydantic import TypeAdapter  # noqa: E402

from src.api import render_api  # noqa: E402
from src.api.render_api import app  # noqa: E402
from src.api.schemas import Scenario  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from src.rules.validators import validate_layout  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]

base = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))
meta = base["meta"]
cand = meta["confirmedRoad"]["candidate"]

# corridor_end variant: the station rides the approach (no intersection pin needed).
body = {
    "kind": "near_intersection",
    "meta": {
        "project": "309 probe",
        "address": "N Broadway SB at E 11th Ave",
        "lat": 39.73370,
        "lng": -104.98753,
        "bearingDeg": 0.0,  # corridor_end: pin -> first sign (upstream = north for SB)
    },
    "roadType": "urban_arterial",
    "speed": 30,
    "lanes": 4,  # schema cap le=4; OSM lanes=5 (#310)
    "laneWidth": 10.5,
    "divided": False,
    "workType": "utility_cut",
    "duration": "short",
    "workLen": 500.0,
    "night": False,
    "approaches": [
        {"id": "e11_wb", "speed": 25, "roadType": "urban_arterial", "lanesPerDirection": 1,
         "laneWidth": 11.0, "signalized": True, "alongStationFt": -100.0},
        {"id": "e11_eb", "speed": 25, "roadType": "urban_arterial", "lanesPerDirection": 1,
         "laneWidth": 11.0, "signalized": True, "alongStationFt": -100.0},
    ],
    # #308's wire field, as the shoulder kind relays it for Broadway.
    "carriageway": {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None,
                    "twinSearched": True, "confirmed": None},
}

client = TestClient(app)
adapter = TypeAdapter(Scenario)
for name, b in (("with carriageway", body), ("without", {k: v for k, v in body.items() if k != "carriageway"})):
    print(f"===== {name}")
    sc = adapter.validate_python(copy.deepcopy(b))
    print("  parsed carriageway attr:", getattr(sc, "carriageway", "<no such field>"))
    placements, params, *_rest = render_api._placements_for(sc)
    print(f"  is_divided={params.is_divided} one_way_street={params.one_way_street} "
          f"near_intersection={params.near_intersection} devices={len(placements)}")
    for p in placements:
        if p.device_type.name == "SIGN_GENERIC":
            print(f"    {p.approach_id:<9} {p.label:<7} st {p.station_ft:8.1f}  off {p.offset_ft:+6.1f}")
    r = client.post("/render/audit", headers=AUTH, json=b)
    print("  /render/audit", r.status_code)
    if r.status_code == 200:
        a = r.json()
        sec = a.get("sections", a)
        co = sec.get("colorado") or {}
        for chk in co.get("checks", []) if isinstance(co, dict) else []:
            if "both sides" in (chk.get("label") or ""):
                print("  Note 8 row:", json.dumps(chk))
        case = sec.get("case") or {}
        print("  case narrative:", (case.get("narrative") or "")[:400])
    else:
        print("  ", r.text[:300])
    for path in ("/render/device-breakdown", "/render/pdf", "/render/xlsx"):
        rr = client.post(path, headers=AUTH, json=b)
        print(f"  {path} -> {rr.status_code} ({len(rr.content)} bytes)")
