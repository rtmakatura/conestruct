"""R116 item 3 build (R117 Q3a-c): page 1's NOTES & SIGN SCHEDULE box, before/after.

Renders page 1 on the checkout named on the command line (FastAPI TestClient
or render_plan_sheet directly; Overpass stubbed; MAPBOX_TOKEN empty, so both
runs draw the same one-page plan) and crops the notes box at 150 dpi.  For
each plan it measures, from the glyph boxes pypdfium2 reports:
  * min_clearance_pt -- the smallest gap between one text line's glyphs and
    the next line's (negative = touching);
  * outside -- lines that run past the box;
  * advance_rows -- advance-table rows drawn (distances printed);
  * the box's text, line by line.

    python render_notes.py <checkout-root> <before|after>

Writes notes_<plan>_<tag>.png and notes_<tag>.json beside itself.
"""

from __future__ import annotations

import copy
import ctypes
import io
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
TAG = sys.argv[2]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
os.environ["MAPBOX_TOKEN"] = ""
sys.stdout.reconfigure(encoding="utf-8")

import pypdfium2 as pdfium  # noqa: E402
import pypdfium2.raw as pr  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.generation.layout import generate_shoulder_closure_divided  # noqa: E402
from src.rendering import plan_sheet as ps  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from src.rules.validators import ScenarioParams  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]
AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}
APPROACH = {"speed": 25, "roadType": "urban_arterial", "lanesPerDirection": 1, "laneWidth": 11.0,
            "signalized": True, "alongStationFt": -100.0}
BROADWAY = {
    "kind": "near_intersection",
    "meta": {"project": "r117", "address": "N Broadway SB at E 11th Ave", "lat": 39.7337,
             "lng": -104.98753, "bearingDeg": 0.0},
    "roadType": "urban_arterial", "speed": 30, "lanes": 4, "laneWidth": 10.5, "divided": False,
    "workType": "utility_cut", "duration": "short", "workLen": 500.0, "night": False,
    "approaches": [{"id": "e11_wb", **APPROACH}, {"id": "e11_eb", **APPROACH}],
}
ONE_WAY = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None, "twinSearched": True,
           "confirmed": None}
SHOULDER = {**{k: v for k, v in BROADWAY.items() if k != "approaches"}, "kind": "shoulder",
            "workType": "utility_locate"}
client = TestClient(app)


def api(body: dict) -> bytes:
    r = client.post("/render/pdf", headers=AUTH, json=copy.deepcopy(body))
    assert r.status_code == 200, r.text[:300]
    return r.content


def case27() -> bytes:
    params = ScenarioParams(speed_mph=75, num_lanes=2, closure_type="shoulder", road_type="freeway",
                            work_zone_length_ft=1000.0, lane_width_ft=12.0, shoulder_width_ft=10.0,
                            is_divided=True, jurisdiction="CDOT", work_zone_speed_mph=40)
    placements = generate_shoulder_closure_divided(params)
    fd, path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    try:
        ps.render_plan_sheet(placements, params, output_path=path, shoulder_width_ft=10.0)
        return Path(path).read_bytes()
    finally:
        os.unlink(path)


PLANS = {
    "ni_oneway": lambda: api({**BROADWAY, "carriageway": ONE_WAY}),
    "ni_twoway": lambda: api(BROADWAY),
    "shoulder": lambda: api(SHOULDER),
    "case27": case27,
}

geo = ps._footer_geometry(True)
X0, X1 = geo.notes_x, geo.notes_x + geo.notes_w
Y0, Y1 = ps.FOOTER_BOX_Y, ps.FOOTER_BOX_Y + ps.FOOTER_BOX_H
sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
out: dict = {"head": sha, "tag": TAG, "plans": {}}
for name, fn in PLANS.items():
    pdf = fn()
    page = pdfium.PdfDocument(io.BytesIO(pdf))[0]
    h = page.get_height()
    sc = 150 / 72
    page.render(scale=sc).to_pil().crop(
        (int(X0 * sc) - 4, int((h - Y1) * sc) - 4, int(X1 * sc) + 4, int((h - Y0) * sc) + 4)
    ).save(HERE / f"notes_{name}_{TAG}.png")
    tp = page.get_textpage()
    groups: dict[float, list] = {}
    for i in range(tp.count_chars()):
        ch = tp.get_text_range(i, 1)
        if not ch.strip():
            continue
        left, bottom, right, top = tp.get_charbox(i)
        ox, oy = ctypes.c_double(), ctypes.c_double()
        pr.FPDFText_GetCharOrigin(tp.raw, i, ctypes.byref(ox), ctypes.byref(oy))
        if X0 <= ox.value < X1 - 2 and Y0 - 30 <= oy.value <= Y1 + 5:
            groups.setdefault(round(oy.value * 4) / 4, []).append((left, bottom, right, top, ch))
    lines = []
    for base in sorted(groups, reverse=True):
        cs = sorted(groups[base], key=lambda c: c[0])
        text, prev = "", None
        for c in cs:
            if prev is not None and c[0] - prev > 1.2:
                text += " "
            text += c[4]
            prev = c[2]
        lines.append({"base": base, "top": max(c[3] for c in cs), "bot": min(c[1] for c in cs),
                      "right": max(c[2] for c in cs), "text": text})
    texts = [ln["text"] for ln in lines]
    try:
        i0 = next(i for i, t in enumerate(texts) if t.startswith("ADVANCE WARNING") or "OFF-PAGE (" in t)
        i1 = next(i for i, t in enumerate(texts) if t.startswith("Reference"))
        adv = sum(len(re.findall(r"\d+ ft", t)) for t in texts[i0 + 1 : i1])
    except StopIteration:
        adv = None
    out["plans"][name] = {
        "min_clearance_pt": round(min(a["bot"] - b["top"] for a, b in zip(lines, lines[1:])), 2),
        "outside": [ln["text"][:60] for ln in lines if ln["right"] > X1 - 1 or ln["bot"] < Y0 + 1],
        "advance_rows": adv,
        "lines": texts,
    }
    p = out["plans"][name]
    print(f"{TAG} {name:10s} clearance {p['min_clearance_pt']:6.2f} pt  outside {len(p['outside'])}  advance rows {adv}")

(HERE / f"notes_{TAG}.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
