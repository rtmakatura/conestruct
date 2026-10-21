"""#363 production check: the Fines Double note names its cause and has no link.

Runs against www.conestruct.com through the site proxy (gate bypass token from
the main checkout's conestruct/site/.env.local).
Usage: PYTHONPATH=<worktree> python prodcheck363.py <main checkout root>
"""
import json, os, sys, urllib.error, urllib.request

import pypdfium2 as pdfium

from tests.s630._harness import _common

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


results = []


def check(cond, text):
    print(f"   {'ok' if cond else 'FAIL'}: {text}")
    results.append(bool(cond))


def body(road, speed, wz, work_len, divided):
    return {**_common(speed, wz), "roadType": road, "divided": divided, "workLen": work_len}


def note(a):
    return [i for i in (a["pending_verification"].get("items") or []) if i["kind"] == "fines_double_spacing"]


URBAN = body("urban_arterial", 55, 45, 1000.0, False)

print("1. urban_arterial 55 -> 45, 1,000 ft of work, /render/audit")
s, raw = post("audit", URBAN)
a = json.loads(raw)
items = note(a)
check(s == 200 and len(items) == 1, f"HTTP {s}, one fines_double_spacing item")
label = items[0]["label"] if items else ""
print("   label:", label)
check("350 ft apart (MUTCD 11th Ed. Table 6B-1, p. 773)" in label, "names the 350 ft spacing")
check("A plaque needs 250 ft from every other sign (S-630-1 Sheet 12 Note 4)" in label, "names the 250 ft clearance")
check('"The spacing of these signs may be changed as directed by the Engineer."' in label, "quotes Sheet 2 Note 4")
check(items and items[0]["tracking_issue"] is None and "/issues/360" not in raw.decode(), "no tracking link, no #360")
check(a["sections"]["fines_double"]["envelope"].get("plaque_long_gaps_sign_spacing_ft") == [350.0, 350.0, 350.0], "envelope spacing [350, 350, 350]")

print("2. the same plan, /render/audit-pdf")
s, pdf = post("audit-pdf", URBAN)
doc = pdfium.PdfDocument(pdf)
text = " ".join(" ".join(p.get_textpage().get_text_range().split()) for p in doc)
check(s == 200 and "[fines_double_spacing] Engineer's direction needed" in text, f"HTTP {s}, the note prints")
check("Table 6B-1, p. 773)" in text and "Tracking:" not in text and 'Engineer." ()' not in text, "spacing printed, no empty link or Tracking: line")

print("3. rural_undivided 55 -> 45 and freeway 65 -> 55, /render/audit -- no note, no field")
for b in (body("rural_undivided", 55, 45, 1000.0, False), body("freeway", 65, 55, 1000.0, True)):
    s, raw = post("audit", b)
    a = json.loads(raw)
    env = a["sections"]["fines_double"]["envelope"]
    check(s == 200 and not note(a) and "plaque_long_gaps_sign_spacing_ft" not in env, f"{b['roadType']}: HTTP {s}, no note, no field")

print(f"\n{sum(results)}/{len(results)} PASS" if all(results) else f"\nFAIL {results.count(False)} of {len(results)}")
