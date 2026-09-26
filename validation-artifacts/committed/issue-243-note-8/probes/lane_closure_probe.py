"""#243 investigate: a lane closure on a divided road where the scan finds a
sidewalk, on prod today (read-only).  Option (d) (Note 8's one-shoulder
exception) exempts shoulder plans only; this is the kind it leaves exposed.

The i25-urban request (note8_probe.py) as kind lane_closure_divided
(TA-19 / S-630-1 Case 10), 60 mph freeway, 12 ft lanes, pavement repair.

  .venv/Scripts/python.exe lane_closure_probe.py > lane-closure-probe.txt
"""

import json
import sys
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding="utf-8")

b = json.loads((HERE / "i25-urban-request.json").read_text("utf-8"))["scenario"]
for k in ("lanes", "divided", "detectedLanesTotal", "signalDistanceM"):
    b.pop(k, None)
b.update(
    kind="lane_closure_divided",
    roadType="freeway",
    speed=60,
    laneWidth=12,
    workType="pavement_repair",
    truckMountedAttenuator=False,
)
(HERE / "i25-urban-lane-closure-request.json").write_text(json.dumps({"scenario": b}), "utf-8")
print("healthz:", httpx.get("https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz", timeout=30).json())
for label, body in (("WITH site scan", b), ("WITHOUT site scan", {k: v for k, v in b.items() if k != "site_scan"})):
    r = httpx.post("https://www.conestruct.com/api/render/audit", json={"scenario": body}, timeout=180)
    print(f"-- {label}: HTTP {r.status_code}")
    a = r.json()
    if r.status_code != 200:
        print(json.dumps(a)[:600])
        continue
    n8 = a["sections"]["colorado"]["checks"][0]
    print(f"   Note 8: pass={n8['pass']} | {n8['detail']}")
    print(f"   plan_flags: {a['plan_flags']}")
    print(f"   site adjustments: {[x['flag'] for x in a['sections'].get('site_adjustments') or []]}")
