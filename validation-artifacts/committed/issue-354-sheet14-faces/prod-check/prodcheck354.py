"""#354 production check: the W20-1 and G20-5P faces on www.conestruct.com.

A Case 26 plan prints W20-1 "ROAD WORK ½ MILE" and G20-5P "WORK ZONE plaque"
on page 1 and the crew sheet; a Case 11 plan keeps "ROAD WORK AHEAD" and
reads "WORK ZONE plaque".
Usage: PYTHONPATH=<worktree> python prodcheck354.py <main checkout root>
"""
import json, os, sys, urllib.error, urllib.request

import pypdfium2 as pdfium

from tests.s630._harness import CASE_11B_BODY, CASE_26_BODY

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


def check(label, text, present, absent):
    good = True
    for t in present:
        hit = t in text
        good &= hit
        print(f"   {'present' if hit else 'MISSING'}: {ascii(t)}")
    for t in absent:
        hit = t in text
        good &= not hit
        print(f"   {'PRESENT (wrong)' if hit else 'absent'}: {ascii(t)}")
    return good


ok = True
HALF = "ROAD WORK ½ MILE"

status, crew = post("markdown", CASE_26_BODY)
print(f"1. Case 26 (65 -> 60) /render/markdown -> {status}")
ok &= status == 200 and check(
    "crew", crew.decode("utf-8"),
    [f"| W20-1 | {HALF} | 2,640 ft upstream |", "| G20-5P | WORK ZONE plaque | Within work zone |"],
    ["ROAD WORK AHEAD", "CONSTRUCTION ZONE"],
)

status, pdf = post("pdf", CASE_26_BODY)
print(f"2. Case 26 (65 -> 60) /render/pdf -> {status}")
page1 = ""
if status == 200:
    page1 = " ".join(pdfium.PdfDocument(pdf)[0].get_textpage().get_text_range().split())
ok &= status == 200 and check(
    "page1", page1, [f"{HALF} 2640 ft", "WORK ZONE plaque"], ["ROAD WORK AHEAD", "CONSTRUCTION ZONE"]
)

status, crew = post("markdown", CASE_11B_BODY)
print(f"3. Case 11 (55 -> 50) /render/markdown -> {status}")
ok &= status == 200 and check(
    "crew", crew.decode("utf-8"),
    ["| W20-1 | ROAD WORK AHEAD |", "| G20-5P | WORK ZONE plaque |"],
    ["½ MILE", "CONSTRUCTION ZONE"],
)

print("PASS 3/3" if ok else "FAIL")
