"""#355 production check: non-freeway 65->60 / 75->65 shoulder plans on www.conestruct.com.

A rural_divided step-down plan takes the federal buffer (645 / 820 ft), cites
Case 11 and no Sheet 14 case, and its crew sheet has no Sheet 14 trigger; a
freeway Case 26 plan keeps the 570 ft floor and its Sheet 14 citation.
Usage: PYTHONPATH=<worktree> python prodcheck355.py <main checkout root>
"""
import json, os, sys, urllib.error, urllib.request

from tests.s630._harness import CASE_26_BODY, _common

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


def check(cond, text):
    print(f"   {'ok' if cond else 'FAIL'}: {text}")
    return cond


def audit_sections(body):
    status, raw = post("audit", body)
    data = json.loads(raw) if status == 200 else {}
    return status, data.get("sections", data)


ok = True
n = 0
for speed, wz, built in ((65, 60, 645), (75, 65, 820)):
    n += 1
    body = {**_common(speed, wz), "roadType": "rural_divided"}
    status, sec = audit_sections(body)
    print(f"{n}. rural_divided {speed} -> {wz} /render/audit -> {status}")
    if status != 200:
        ok = False
        continue
    buf, case, taper = sec["buffer"], sec["case"], sec["taper"]
    ok &= check(buf["buffer_ft"] == built, f"buffer_ft = {buf['buffer_ft']} (want {built})")
    ok &= check("Sheet 14" not in buf["source"], f"buffer source: {buf['source']}")
    ok &= check("divergence" not in buf, "no divergence fields")
    ok &= check(
        "freeway or expressway and this road is neither" in buf["lookup_text"],
        "lookup_text says why Sheet 14 doesn't apply",
    )
    ok &= check(case["case"].startswith("Case 11"), f"case: {case['case']}")
    ok &= check("Case 11" in taper["cdot_reference"], f"taper: {taper['cdot_reference']}")
    ok &= check(
        case["narrative_2"].startswith("CDOT S-630-1 draws no reduced-speed shoulder typical"),
        f"narrative_2: {case['narrative_2']}",
    )
    ok &= check("trigger_condition" not in case, "no trigger_condition")
    n += 1
    status, crew = post("markdown", body)
    print(f"{n}. rural_divided {speed} -> {wz} /render/markdown -> {status}")
    text = crew.decode("utf-8")
    ok &= check(status == 200 and "## Trigger Condition" not in text, "no Trigger Condition section")
    ok &= check("Sheet 14" not in text, "no Sheet 14 in the crew sheet")

n += 1
status, sec = audit_sections(CASE_26_BODY)
print(f"{n}. Case 26 (freeway 65 -> 60) /render/audit -> {status}")
ok &= status == 200
if status == 200:
    ok &= check(sec["buffer"]["buffer_ft"] == 570, f"buffer_ft = {sec['buffer']['buffer_ft']} (want 570)")
    ok &= check("Sheet 14" in sec["buffer"]["source"], f"buffer source: {sec['buffer']['source']}")
    ok &= check(sec["case"]["case"].startswith("Case 26"), f"case: {sec['case']['case']}")

print(f"\nRESULT: {'PASS' if ok else 'FAIL'} ({n} requests)")
