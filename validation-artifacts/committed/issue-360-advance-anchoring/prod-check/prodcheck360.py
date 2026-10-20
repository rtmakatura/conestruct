"""#360 production check: reduced-speed shoulder speed signs sit upstream of the taper.

Runs against www.conestruct.com through the site proxy (gate bypass token from
the main checkout's conestruct/site/.env.local).
Usage: PYTHONPATH=<worktree> python prodcheck360.py <main checkout root>
"""
import json, os, sys, tempfile, urllib.error, urllib.request

import pypdfium2 as pdfium

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


results = []


def check(cond, text):
    print(f"   {'ok' if cond else 'FAIL'}: {text}")
    results.append(bool(cond))


def audit(body):
    status, raw = post("audit", body)
    return status, (json.loads(raw) if status == 200 else {})


def rows(a):
    return {r["Code"]: r for r in a["sections"]["advance"]["sign_table"]}


RURAL_75_70 = {**_common(75, 70), "roadType": "rural_divided", "workLen": 2000}
CASE_11_55_45 = _common(55, 45)
URBAN_55_45 = {**_common(55, 45), "roadType": "urban_arterial", "divided": False}

print("1. rural_divided 75 -> 70, 2,000 ft of work (the issue's repro), /render/audit")
s, a = audit(RURAL_75_70)
check(s == 200, f"status {s}")
r = rows(a)
for code, dist in (("W20-1", "3,030"), ("W3-5(70)", "2,530"), ("R2-10", "2,000"), ("R2-1", "1,500")):
    got = r.get(code, {}).get("Distance from Taper (ft)", "")
    check(got.startswith(dist), f"{code} listed, {got!r} (expect {dist} upstream)")
env = a["sections"]["fines_double"]["envelope"]
check(env["r2_10_station_ft"] - env["entrance_r2_1_station_ft"] == 500.0, "R2-10 500 ft before the group")

print("2. the same plan, /render/markdown")
s, md = post("markdown", RURAL_75_70)
md = md.decode()
check(s == 200, f"status {s}")
check("2,000 ft upstream of taper (500 ft before the speed limit group)" in md, "crew R2-10 row")
check("500 ft past R2-10, on its own G20-5P plaque" in md, "crew entrance R2-1 row")

print("3. freeway Case 11 55 -> 45, /render/audit")
s, a = audit(CASE_11_55_45)
check(s == 200, f"status {s}")
check(
    "speed limit group 3,000 ft, R2-10 3,500 ft, W20-1 5,200 ft" in a["sections"]["advance"]["spacing_text"],
    "spacing text names the group and R2-10",
)
check(rows(a)["R2-10"]["Position"] == "R2-10 (Case 11)", "R2-10 position (Case 11)")

print("4. urban_arterial 55 -> 45 (350 ft spacing), /render/audit")
s, a = audit(URBAN_55_45)
check(s == 200, f"status {s}")
items = [i for i in a["pending_verification"]["items"] if i["kind"] == "fines_double_spacing"]
check(len(items) == 1 and "as directed by the Engineer" in items[0]["label"], "engineer note present")

print("5. freeway Case 26 (65 -> 60), /render/audit -- unchanged")
s, a = audit(CASE_26_BODY)
check(s == 200, f"status {s}")
r = rows(a)
check(r["R2-10"]["Position"] == "R2-10 (Sheet 14)", "R2-10 still Sheet 14")
check(r["R2-10"]["Distance from Taper (ft)"].startswith("1,580"), "R2-10 at Sheet 14's 1,580 ft")
check("plaque_long_gaps_ft" not in a["sections"]["fines_double"]["envelope"], "no engineer-note key")


def page1(body):
    s, raw = post("pdf", body)
    f = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    f.write(raw)
    f.close()
    doc = pdfium.PdfDocument(f.name)
    tp = doc[0].get_textpage()
    n = tp.count_chars()
    text, boxes = tp.get_text_range(0, n), [tp.get_charbox(i) for i in range(n)]
    doc.close()
    os.unlink(f.name)
    return s, text, boxes


def span(text, boxes, needle, start=0):
    i = text.index(needle, start)
    bs = [boxes[k] for k in range(i, i + len(needle)) if not text[k].isspace()]
    return i, (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))


for n, (label, body) in enumerate((("Case 11 55 -> 45", CASE_11_55_45), ("Case 26", CASE_26_BODY)), 6):
    print(f"{n}. {label}, /render/pdf page 1 glyph gaps")
    s, text, boxes = page1(body)
    check(s == 200, f"status {s}")
    t0 = text.index("ADVANCE WARNING SIGNS")
    _, title = span(text, boxes, "(off-page upstream of taper)", t0)
    h, header = span(text, boxes, "DISTANCE", t0)
    check(title[1] - header[3] >= 1.0, f"title clears headers by {title[1] - header[3]:.2f} pt")
    gaps = []
    at = h
    while (at := text.find("W21-5aR", at + 1)) != -1:
        _, code = span(text, boxes, "W21-5aR", at)
        _, desc = span(text, boxes, "RIGHT SHOULDER CLOSED AHEAD", at)
        gaps.append(desc[0] - code[2])
    check(gaps and min(gaps) >= 2.0, f"W21-5aR to description gaps {[round(g, 2) for g in gaps]} pt")
    if label.startswith("Case 11"):
        flat = " ".join(text.split())
        check("R2-10 BEGIN DOUBLE FINES ZONE 3500 ft" in flat, "page 1 lists R2-10 at 3500 ft")
        check("MORE ADVANCE SIGNS" not in flat, "all 14 advance rows on page 1")

print(f"\n{'PASS' if all(results) else 'FAIL'} {sum(results)}/{len(results)}")
