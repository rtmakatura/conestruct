"""#311 probe: run from a tree root (tree = d6d2a49, treeb = patched)."""
import copy, json, os, sys
from pathlib import Path

ROOT = Path.cwd()
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}

from fastapi.testclient import TestClient
from pydantic import TypeAdapter
from src.api import render_api
from src.api.render_api import app
from src.api.schemas import Scenario
from src.rules import site_detection as sd

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)

from tests.corpus.manifest import GRID_CASES, scenario_body, snapshot_path

client = TestClient(app)


def diff(a, b, path=""):
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            yield from diff(a.get(k), b.get(k), f"{path}/{k}")
    elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)):
            yield from diff(x, y, f"{path}[{i}]")
    elif a != b:
        yield path, a, b


case = next(c for c in GRID_CASES if c.id == "grid_site_pedestrian_facility")
live = client.post("/render/audit", headers=AUTH, json=scenario_body(case)).json()
snap = json.loads(snapshot_path(case.id).read_text(encoding="utf-8"))
print("== corpus grid_site_pedestrian_facility: snapshot vs live")
for p, a, b in diff(snap, live):
    print("  ", p, "|", a, "->", b)

broadway = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))


def base():
    b = copy.deepcopy(broadway)
    b["meta"]["siteConditions"] = {"pedestrian_facility": True}
    for k in ("confirmedRoad", "intersection", "work", "centerline", "roadDirection"):
        b["meta"].pop(k, None)
    b.pop("signalDistanceM", None)
    return b


def colorado():
    b = base()
    b.update(speed=35, lanes=3, laneWidth=11.0, divided=True, detectedLanesTotal=6)
    b["meta"].update(address="S Colorado Blvd at E Exposition Ave", lat=39.70900, lng=-104.94070)
    b["carriageway"] = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": 14.8,
                        "twinSearched": True, "confirmed": None}
    return b


def lafayette():
    b = base()
    b.update(speed=25, lanes=1, laneWidth=11.0, divided=False, roadType="urban_arterial")
    b.pop("detectedLanesTotal", None)
    b["meta"].update(address="Lafayette St (two-way control)", lat=39.74362, lng=-104.97070)
    b["carriageway"] = {"oneway": "no", "highwayClass": "residential", "twinDistanceM": None,
                        "twinSearched": True, "confirmed": None}
    return b


def broadway_oneway():
    b = copy.deepcopy(broadway)
    b["meta"]["siteConditions"] = {"pedestrian_facility": True}
    cand = b["meta"]["confirmedRoad"]["candidate"]
    b["meta"]["centerline"] = cand["geometry"]
    b["meta"]["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": "yes"}
    b["divided"] = False
    b["carriageway"] = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None,
                        "twinSearched": True, "confirmed": None}
    return b


for name, body in (("colorado", colorado()), ("lafayette", lafayette()), ("broadway", broadway_oneway())):
    sc = TypeAdapter(Scenario).validate_python(body)
    placements, params, recs, *_ = render_api._placements_for(sc)
    ped = next(r for r in recs if r["flag"] == "pedestrian_facility")
    t3 = sorted((p.station_ft, p.offset_ft) for p in placements if p.device_type.name == "BARRICADE_TYPE_III")
    bd = client.post("/render/device-breakdown", headers=AUTH, json=body)
    qty = None
    if bd.status_code == 200:
        qty = [d.get("qty") for d in bd.json().get("devices", []) if d.get("device") == "Type III Barricade"]
    print(f"== {name}: verdict={sc.carriageway_verdict()} divided={params.is_divided} one_way={params.one_way_street} "
          f"lanes={params.num_lanes} devices={len(placements)} breakdown_status={bd.status_code} TypeIII_qty={qty}")
    print("   type III (station, offset):", t3)
    print("   devices_added:", ped["devices_added"], "|", ped["action"])
