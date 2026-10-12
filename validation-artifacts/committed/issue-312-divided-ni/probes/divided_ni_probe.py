"""#312 investigation probe: what a work-start near-intersection plan on a
divided road builds today, against the same plan on a one-way street (#309)
and on a two-way road.

Colorado Blvd at E Exposition Ave (39.70900, -104.94070): OSM way 16991616,
oneway=yes, a same-name twin carriageway 14.8 m away, so #308's verdict is
``divided``.  TestClient on the given checkout, Overpass stubbed, no network,
no product code changed.  Usage: python divided_ni_probe.py <repo-root>
"""

from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "probe"
AUTH = {"Authorization": "Bearer probe"}

from fastapi.testclient import TestClient  # noqa: E402
from pydantic import TypeAdapter  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.api.schemas import Scenario, scenario_to_call  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]

leg = {"speed": 25, "roadType": "urban_arterial", "lanesPerDirection": 1, "laneWidth": 12,
       "signalized": True}
base: dict[str, Any] = {
    "kind": "near_intersection",
    "meta": {
        "project": "312", "address": "", "lat": 39.709, "lng": -104.9407,
        "pinModel": "work_start", "work": {"side": "right", "heading": "N"},
        "intersection": {"lat": 39.71092, "lng": -104.9407, "name": "E Exposition Ave"},
    },
    "roadType": "urban_arterial", "speed": 35, "lanes": 2, "laneWidth": 12, "divided": False,
    "workType": "utility_cut", "duration": "short", "workLen": 500, "night": False,
    "approaches": [{"id": "cross_a", **leg}, {"id": "cross_b", **leg}],
}
cases: dict[str, dict[str, Any]] = {}
d = copy.deepcopy(base)
d["carriageway"] = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": 14.8,
                    "twinSearched": True, "confirmed": None}
cases["divided verdict (Colorado Blvd, the #312 repro)"] = d
o = copy.deepcopy(d)
o["carriageway"]["twinDistanceM"] = None
cases["one-way street (#309, the same road with no twin)"] = o
cases["two-way (no carriageway facts)"] = copy.deepcopy(base)
w = copy.deepcopy(base)
w["divided"] = True
cases["the wire's own divided: true"] = w

client = TestClient(app)
audits: dict[str, Any] = {}
for label, body in cases.items():
    print(f"== {label}")
    r = client.post("/render/audit", headers=AUTH, json=body)
    if r.status_code != 200:
        print(f"   /render/audit: {r.status_code} {json.dumps(r.json())[:220]}")
        continue
    audits[label] = r.json()
    params, gen, kwargs = scenario_to_call(TypeAdapter(Scenario).validate_python(body))
    print(f"   params: is_divided={params.is_divided} one_way_street={params.one_way_street}")
    placements = gen(params, **kwargs)
    main = [p for p in placements if getattr(p, "approach_id", "mainline") == "mainline"
            and p.device_type.name.startswith("SIGN")]
    right = sorted((p.label, p.station_ft) for p in main if p.offset_ft > 0)
    left = sorted((p.label, p.station_ft) for p in main if p.offset_ft < 0)
    print(f"   mainline signs right: {len(right)} {[lbl for lbl, _ in right]}")
    print(f"   mainline signs left (median side): {len(left)} {[lbl for lbl, _ in left]}")
    print(f"   total placements: {len(placements)}")
    text = json.dumps(r.json())
    for key in ("Signs on both sides of divided highway", "Signs on both sides of one-way street"):
        i = text.find(key)
        if i >= 0:
            print(f"   Note 8 row: {text[i - 20 : i + 160]}")
    print(f"   title: {r.json()['summary'].get('title') or r.json()['summary'].get('scenario')}")

a = audits.get("divided verdict (Colorado Blvd, the #312 repro)")
b = audits.get("two-way (no carriageway facts)")
if a is not None and b is not None:
    print("== divided-verdict audit byte-identical to the two-way audit:",
          json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True))
