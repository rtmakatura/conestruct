"""#356 production check: the 52 ft refusals say "this plan can draw".

Runs against www.conestruct.com through the site proxy (gate bypass token from
the main checkout's conestruct/site/.env.local), with the four bodies of
tests/test_refusal_plan_can_draw.py.
Usage: python prodcheck356.py <main checkout root>
"""
import copy, json, os, sys, urllib.error, urllib.request

root = sys.argv[1]
tok = next(
    l.split("=", 1)[1].strip().strip('"')
    for l in open(os.path.join(root, "conestruct/site/.env.local"), encoding="utf-8")
    if l.startswith("GATE_BYPASS_TOKEN=")
)
base = "https://www.conestruct.com/api/render/"
I25 = os.path.join(
    root, "validation-artifacts/committed/audit-shoulder/runs/i25-r-65-night/request.json"
)
META = {"project": "T", "address": "", "lat": 0.0, "lng": 0.0}


def post(body):
    req = urllib.request.Request(
        base + "audit",
        data=json.dumps({"scenario": body}).encode(),
        method="POST",
        headers={"content-type": "application/json", "x-conestruct-gate": tok},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def i25(**over):
    s = copy.deepcopy(json.load(open(I25, encoding="utf-8"))["scenario"])
    s["meta"] = {k: s["meta"][k] for k in ("project", "address", "lat", "lng")}
    s.update(over)
    return s


SHOULDER = {
    "kind": "shoulder", "meta": META, "roadType": "rural_divided", "speed": 55,
    "lanes": 4, "laneWidth": 11.0, "divided": True, "workType": "utility_locate",
    "duration": "short", "workLen": 800.0, "night": False,
}
NI = {
    "kind": "near_intersection", "meta": {**META, "siteConditions": {}},
    "roadType": "urban_arterial", "speed": 45, "lanes": 4, "laneWidth": 14.0,
    "divided": False, "workType": "utility_cut", "duration": "short", "workLen": 500.0,
    "night": False,
    "approaches": [{
        "id": "cross_n", "speed": 30, "roadType": "urban_arterial",
        "lanesPerDirection": 1, "laneWidth": 12.0, "signalized": False,
        "bearingDeg": None, "alongStationFt": -60.0,
    }],
}
CASES = [
    ("shoulder off the freeway", SHOULDER,
     "4 lanes x 11.0 ft + 10 ft shoulder = 54.0 ft exceeds the 52 ft half-road this plan "
     "can draw. Use a lane width of 10.5 ft or less, or reduce the lane count."),
    ("shoulder on the freeway (I-25, 4 x 11 ft)", i25(laneWidth=11.0),
     "so this plan draws at most 3 lanes in this direction. Reduce the lane count to 3."),
    ("near_intersection", NI,
     "4 lanes x 14.0 ft + 8 ft shoulder = 64.0 ft exceeds the 52 ft half-road this plan "
     "can draw. Use a lane width of 11.0 ft or less, or reduce the lane count."),
    ("freeway lane width (I-25 form, 4 x 10.5 ft)", i25(),
     "At 11 ft this plan draws at most 3 lanes in this direction beside the 10 ft shoulder "
     "(the widest half-road it can draw is 52 ft). Set lanes per direction to 3 and lane "
     "width to 11 ft"),
]
passed = 0
for name, body, want in CASES:
    status, text = post(body)
    flat = text.replace('\\"', '"')
    ok = (status == 400 and want in flat and "plan sheet" not in flat
          and "the sheet draws" not in flat and "widest half-road is" not in flat)
    passed += ok
    print(f"{'PASS' if ok else 'FAIL'} {name}: HTTP {status}")
    print(f"  {flat[:600]}")
print(f"{passed}/{len(CASES)} passed")
