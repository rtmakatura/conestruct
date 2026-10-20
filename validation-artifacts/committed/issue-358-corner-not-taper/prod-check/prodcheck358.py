"""#358 production check: a near-side plan that runs to the corner says
"Corner extension", never "Downstream taper".

Runs against www.conestruct.com through the site proxy (gate bypass token from
the main checkout's conestruct/site/.env.local), with tests.test_lane_confidence_block._ni_body()
(near side, alongStationFt -60) and its midblock twin (alongStationFt -400).
Usage: python prodcheck358.py <main checkout root>
"""
import json, os, sys, urllib.request

root = sys.argv[1]
sys.path.insert(0, root)
from tests.test_lane_confidence_block import _ni_body  # noqa: E402

tok = next(
    l.split("=", 1)[1].strip().strip('"')
    for l in open(os.path.join(root, "conestruct/site/.env.local"), encoding="utf-8")
    if l.startswith("GATE_BYPASS_TOKEN=")
)
base = "https://www.conestruct.com/api/render/"


def post(path, payload):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"content-type": "application/json", "x-conestruct-gate": tok},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status, json.loads(r.read())


results = []


def check(name, ok, detail):
    results.append(ok)
    print(("PASS" if ok else "FAIL"), name, "--", detail)


corner = _ni_body()
st, a = post("audit", {"scenario": corner})
sp = a["sections"]["spacing"]
lines = sp["formula_text"]
check("1 corner audit 200, no Downstream taper line",
      st == 200 and not any("Downstream taper" in l for l in lines) and "downstream_count_text" not in sp,
      lines[-1])
check("2 corner line names 48 ft and 1 cone",
      sp.get("corner_count_text", "").startswith(
          "Corner extension: 48 ft past the work zone to the upstream curb line -> 1 cone "),
      f"n_corner_extension_cones={sp.get('n_corner_extension_cones')}")
st2, q = post("quote-breakdown", {"scenario": corner})
bill = sum(int(l["qty"]) for l in q["equipment_lines"] if l["device_type"] == "CONE")
check("3 total equals the bill", st2 == 200 and sp["n_cones_placed_total"] == bill,
      f"n_cones_placed_total={sp['n_cones_placed_total']} bill_cones={bill}")
mid = _ni_body()
mid["approaches"][0]["alongStationFt"] = -400.0
st3, b = post("audit", {"scenario": mid})
msp = b["sections"]["spacing"]
check("4 midblock near side keeps its downstream taper",
      st3 == 200 and "corner_count_text" not in msp
      and msp.get("downstream_count_text", "").startswith(
          "Downstream taper: 50 ft at ~25 ft spacing -> 2 cones "),
      msp.get("downstream_count_text", ""))
print(f"{sum(results)}/{len(results)} PASS")
