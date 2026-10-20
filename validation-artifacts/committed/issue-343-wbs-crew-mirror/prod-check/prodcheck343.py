"""#343 production check: divided crew sheets on www.conestruct.com.

The divided shoulder plan (Case 11, live) must keep its mirror lines and
#337's "by choice" line; the work-beyond-shoulder kind must stay gated.
Usage: PYTHONPATH=<worktree> python prodcheck343.py <main checkout root>
"""
import json, os, sys, urllib.error, urllib.request

from tests.s630._harness import CASE_11_GENERAL_BODY

root = sys.argv[1]
tok = next(
    l.split("=", 1)[1].strip().strip('"')
    for l in open(os.path.join(root, "conestruct/site/.env.local"), encoding="utf-8")
    if l.startswith("GATE_BYPASS_TOKEN=")
)
base = "https://www.conestruct.com/api/render/"


def post(kind, body):
    req = urllib.request.Request(
        base + kind,
        data=json.dumps({"scenario": body}).encode(),
        method="POST",
        headers={"content-type": "application/json", "x-conestruct-gate": tok},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


MIRROR = (
    "Place matching sign on left side.",
    "Place matching plaques on left side.",
    "Place matching signs on left side at each location.",
    "Remove both sides at each station.",
)
ok = True

status, crew = post("markdown", CASE_11_GENERAL_BODY)
crew = crew.decode("utf-8")
print(f"1. divided shoulder (Case 11, 55 mph) /render/markdown -> {status}")
for t in MIRROR + ("posts signs on both sides of the roadway by choice",):
    hit = t in crew
    ok &= hit
    print(f"   {'present' if hit else 'MISSING'}: {t}")
hit = "signs go on the right side only" in crew
ok &= not hit
print(f"   {'PRESENT (wrong)' if hit else 'absent'}: signs go on the right side only")

wbs = {
    "kind": "work_beyond_shoulder", "roadType": "freeway", "speed": 55, "laneWidth": 12.0,
    "workType": "utility", "duration": "long", "workLen": 500.0, "night": False,
    "meta": CASE_11_GENERAL_BODY.get("meta", {}),
}
status, body = post("markdown", wbs)
print(f"2. work beyond shoulder, divided freeway /render/markdown -> {status}: {body[:200].decode('utf-8', 'replace')}")
ok &= status != 200

print("PASS 2/2" if ok else "FAIL")
