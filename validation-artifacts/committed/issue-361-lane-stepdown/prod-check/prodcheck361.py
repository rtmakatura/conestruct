"""#361 production check: the crew sheet prints Sheet 14's trigger exactly
when the audit sets trigger_condition.

Runs against www.conestruct.com through the site proxy (gate bypass token from
the main checkout's conestruct/site/.env.local), with tests.s630._harness
._common bodies: freeway 65->55 and 75->70 and rural_divided 65->55 (the three
plans byte-identity-diff.txt shows losing the trigger), plus Case 26/27
(freeway 65->60, 75->65), which keep it.
Usage: python prodcheck361.py <main checkout root>
"""
import json, os, sys, urllib.request

root = sys.argv[1]
sys.path.insert(0, root)
from tests.s630._harness import _common  # noqa: E402

tok = next(
    l.split("=", 1)[1].strip().strip('"')
    for l in open(os.path.join(root, "conestruct/site/.env.local"), encoding="utf-8")
    if l.startswith("GATE_BYPASS_TOKEN=")
)
base = "https://www.conestruct.com/api/render/"


def post(path, payload):
    req = urllib.request.Request(
        base + path,
        data=json.dumps({"scenario": payload}).encode(),
        method="POST",
        headers={"content-type": "application/json", "x-conestruct-gate": tok},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.status, r.read()


PLANS = [
    ("freeway 65->55", _common(65, 55), False),
    ("freeway 75->70", _common(75, 70), False),
    ("rural_divided 65->55", {**_common(65, 55), "roadType": "rural_divided"}, False),
    ("Case 26 freeway 65->60", _common(65, 60), True),
    ("Case 27 freeway 75->65", _common(75, 65), True),
]
results = []
for i, (name, body, want) in enumerate(PLANS, 1):
    st_a, raw = post("audit", body)
    case = json.loads(raw)["sections"]["case"]
    st_m, md = post("markdown", body)
    crew = md.decode("utf-8")
    has_crew = "## Trigger Condition" in crew
    has_audit = "trigger_condition" in case
    ok = st_a == st_m == 200 and has_crew == has_audit == want
    if want:
        ok = ok and case["trigger_condition"] in crew
    results.append(ok)
    print(("PASS" if ok else "FAIL"), i, name, "--",
          f"audit {st_a} trigger={has_audit}; crew {st_m} trigger={has_crew}; want {want}")
print(f"{sum(results)}/{len(results)} PASS")
