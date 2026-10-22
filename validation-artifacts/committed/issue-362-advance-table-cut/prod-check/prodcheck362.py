"""#362 production check: page 1's advance table cuts plaques before signs.

Runs against www.conestruct.com through the site proxy (gate bypass token from
the main checkout's conestruct/site/.env.local).
Usage: PYTHONPATH=<worktree> python prodcheck362.py <main checkout root> <crop.png>
"""
import io, json, os, sys, urllib.error, urllib.request

import pypdfium2 as pdfium

from src.rendering import plan_sheet as ps
from tests.s630._harness import _common
from tests.test_r117_pdf_notes import _notes_lines

root, crop_path = sys.argv[1], sys.argv[2]
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


def advance_text(pdf):
    text = "\n".join(ln["text"] for ln in _notes_lines(pdf))
    return text[text.index("ADVANCE WARNING") :]


def body(road, speed, wz, work_len, divided):
    return {**_common(speed, wz), "roadType": road, "divided": divided, "workLen": work_len}


for n, wl in ((1, 1000.0), (2, 5000.0)):
    print(f"{n}. freeway 75 -> 40, {wl:,.0f} ft of work, /render/pdf page 1")
    s, pdf = post("pdf", body("freeway", 75, 40, wl, True))
    check(s == 200 and pdf[:4] == b"%PDF", f"HTTP {s}, a PDF")
    if s != 200:
        continue
    t = advance_text(pdf)
    check("+3 MORE ADVANCE SIGNS (G20-5P, R2-6P)" in t, "the line reads +3 MORE ADVANCE SIGNS (G20-5P, R2-6P)")
    for desc in ("ROAD WORK AHEAD", "BEGIN DOUBLE FINES ZONE", "ADVISORY SPEED 40",
                 "ADVISORY SPEED 45", "ADVISORY SPEED 60"):
        check(desc in t, f"page 1 shows {desc}")
    check(t.count("WORK ZONE plaque") == 2 and t.count("FINES DOUBLE plaque") == 2,
          "two whole plaque pairs left (500 and 1500 ft)")
    if wl == 1000.0:
        title = next(ln for ln in _notes_lines(pdf) if ln["text"].startswith("ADVANCE WARNING"))
        geo = ps._footer_geometry(True)
        page = pdfium.PdfDocument(io.BytesIO(pdf))[0]
        S, H = 4, page.get_height()
        img = page.render(scale=S).to_pil()
        img.crop((int((geo.notes_x - 2) * S), int((H - title["top"] - 6) * S),
                  int((geo.notes_x + geo.notes_w + 2) * S),
                  int((H - ps.FOOTER_BOX_Y + 2) * S))).save(crop_path)
        print("   crop:", crop_path)

print("3. urban_arterial 55 -> 45, 1,000 ft of work (fits today), /render/pdf page 1")
s, pdf = post("pdf", body("urban_arterial", 55, 45, 1000.0, False))
check(s == 200, f"HTTP {s}")
if s == 200:
    check("MORE ADVANCE SIGNS" not in advance_text(pdf), "no cut line; the table fits as before")

print(f"PASS {sum(results)}/{len(results)}" if all(results) else f"FAIL {sum(results)}/{len(results)}")
