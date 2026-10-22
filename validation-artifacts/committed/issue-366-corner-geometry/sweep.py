"""#366 byte-identity sweep: dump what the picker draws for every plan, offline.

Usage: python sweep.py <repo_root> <out.json>

Run once against the base tree and once against the branch, then diff the
two JSON files.  Each plan dumps the full ``/render/corridor-geometry``
answer and, for the ``work`` and ``laid_out`` stages, the Mapbox URL and
query ``/render/corridor-map`` would fetch (the band aerial's drawn
geometry).  Plans: the 13 ``pdf_worst_case`` fixtures, and near_intersection
plans under both pin models with the cross street at the corner, midblock
past the work, and before the work (far side).  Mapbox and Overpass go to
stubs; the network is never reached.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

root = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(root))
os.environ["RENDER_API_SECRET"] = "test-secret"
os.environ["MAPBOX_TOKEN"] = "test-token"

from fastapi.testclient import TestClient  # noqa: E402

import src  # noqa: E402
import src.api.render_api as render_api  # noqa: E402
from src.api import site_scan as ss  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from src.rules.corridor import _destination_point  # noqa: E402

assert Path(src.__file__).resolve().is_relative_to(root), src.__file__

ss.clear_memo()
sd._overpass_request_with_fallback = lambda *a, **k: ({"elements": []}, None)  # type: ignore[assignment]
render_api.ENABLED_SCENARIOS = frozenset({"shoulder", "flagger_lane_closure", "near_intersection"})
fetched: list[Any] = []
render_api._static_aerial.fetch_png = lambda url, query, token: (  # type: ignore[assignment]
    fetched.append([url, query]) or b"png"
)

AUTH = {"Authorization": "Bearer test-secret"}
client = TestClient(render_api.app)

PIN = (39.7400, -104.9600)


def at(bearing: float, feet: float) -> tuple[float, float]:
    return _destination_point(*PIN, bearing, feet * 0.3048)


def ni(meta: dict[str, Any], station: float | None, work_len: float = 500.0) -> dict[str, Any]:
    approach: dict[str, Any] = {
        "id": "cross_a",
        "speed": 30,
        "roadType": "urban_arterial",
        "lanesPerDirection": 1,
        "laneWidth": 12,
        "signalized": False,
    }
    if station is not None:
        approach["alongStationFt"] = station
    return {
        "kind": "near_intersection",
        "meta": {"project": "s366", "address": "", "lat": PIN[0], "lng": PIN[1], **meta},
        "roadType": "urban_arterial",
        "speed": 35,
        "lanes": 2,
        "laneWidth": 12,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": work_len,
        "night": False,
        "approaches": [approach],
    }


def ws(cross: tuple[float, float]) -> dict[str, Any]:
    return {
        "pinModel": "work_start",
        "work": {"side": "right", "heading": "N"},
        "intersection": {"lat": cross[0], "lng": cross[1], "name": "E 17th Ave"},
    }


plans: dict[str, dict[str, Any]] = {}
wc_dir = root / "tests" / "fixtures" / "pdf_worst_case"
for p in sorted(wc_dir.glob("*.json")):
    plans[f"worst_case/{p.stem}"] = json.loads(p.read_text(encoding="utf-8"))["scenario"]
CE = {"bearingDeg": 180.0}
plans["ni/corridor_end/corner_-60"] = ni(CE, -60.0)
plans["ni/corridor_end/corner_-100"] = ni(CE, -100.0)
plans["ni/corridor_end/midblock_-600"] = ni(CE, -600.0)
plans["ni/corridor_end/far_800"] = ni(CE, 800.0)
plans["ni/work_start/corner_560N"] = ni(ws(at(0.0, 560.0)), None)
plans["ni/work_start/midblock_700N"] = ni(ws(at(0.0, 700.0)), None)
plans["ni/work_start/far_300S"] = ni(ws(at(180.0, 300.0)), None)

out: dict[str, Any] = {}
for name, scenario in plans.items():
    g = client.post("/render/corridor-geometry", json=scenario, headers=AUTH)
    entry: dict[str, Any] = {"geometry": [g.status_code, g.json()]}
    for stage in ("work", "laid_out"):
        fetched.clear()
        m = client.post(
            "/render/corridor-map",
            json={"scenario": scenario, "stage": stage, "width": 640, "height": 400},
            headers=AUTH,
        )
        entry[f"map_{stage}"] = [m.status_code, fetched[:] or m.text]
    out[name] = entry

Path(sys.argv[2]).write_text(json.dumps(out, indent=1, sort_keys=True), encoding="utf-8")
print(f"{len(out)} plans -> {sys.argv[2]}")
