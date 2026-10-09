import copy, json, os, sys, hashlib
ROOT = r"C:/Users/rtmak/Documents/traffic-control-tool"
sys.path.insert(0, ROOT)
os.environ["RENDER_API_SECRET"] = "t"
from fastapi.testclient import TestClient
from src.api.render_api import app
from src.rules import site_detection as sd
sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)
base = json.load(open(ROOT + "/tests/fixtures/corridor/broadway-sb.json", encoding="utf-8"))
m = base["meta"]; cand = m["confirmedRoad"]["candidate"]
m["centerline"] = cand["geometry"]
m["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": cand["tags"]["oneway"]}
m["work"] = {"side": "right", "travel": "with_geometry"}
base["carriageway"] = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None, "twinSearched": True}
base["roadType"] = "urban_arterial"
c = TestClient(app); H = {"Authorization": "Bearer t"}
out = {}
for d in (False, True):
    s = copy.deepcopy(base); s["divided"] = d
    r = c.post("/render/audit", json=s, headers=H)
    j = r.json()
    j2 = json.dumps(j, sort_keys=True)
    out[d] = j
    print(d, r.status_code, hashlib.sha1(j2.encode()).hexdigest()[:10], len(j2))
def diff(a, b, p=""):
    if type(a) != type(b): print("type", p); return
    if isinstance(a, dict):
        for k in set(a) | set(b):
            if k not in a or k not in b: print("key", p + "/" + k); continue
            diff(a[k], b[k], p + "/" + k)
    elif isinstance(a, list):
        if len(a) != len(b): print("len", p, len(a), len(b))
        for i, (x, y) in enumerate(zip(a, b)): diff(x, y, f"{p}[{i}]")
    elif a != b: print("val", p, repr(a)[:120], "->", repr(b)[:120])
diff(out[False], out[True])
