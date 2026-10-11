import json, sys, urllib.request
sys.path.insert(0, r"C:/Users/rtmak/Documents/traffic-control-tool/scripts")
from gate import gate_headers
URL = "https://www.conestruct.com/api/render/audit"
body = {"kind": "shoulder", "meta": {"project": "T", "address": "", "lat": 0, "lng": 0}, "roadType": "urban_arterial",
        "speed": 25, "lanes": 1, "laneWidth": 12.0, "divided": False, "workType": "utility_locate", "duration": "short",
        "workLen": 500.0, "night": False, "speed_estimate": {"highwayClass": "residential"}}
for name, b in [("estimate", body), ("stale", {**body, "speed": 35})]:
    req = urllib.request.Request(URL, data=json.dumps({"scenario": b}).encode(), headers={"Content-Type": "application/json", **gate_headers(URL)}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            print(name, r.status, json.dumps(json.loads(r.read()).get("input_estimates")))
    except urllib.error.HTTPError as e:
        print(name, e.code, e.read().decode()[:300])
