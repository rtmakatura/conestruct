"""R116 item 3 prototype: render page 1 for 5 plans on a scratch checkout, crop
the NOTES & SIGN SCHEDULE box, measure line rhythm / overflow / advance rows.

    python render_measure.py <checkout-root> <before|after> <out-dir>
"""
import copy, ctypes, io, json, os, re, sys, tempfile
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve(); TAG = sys.argv[2]; OUT = Path(sys.argv[3]).resolve()
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
os.environ["MAPBOX_TOKEN"] = ""
AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}

import pypdfium2 as pdfium
import pypdfium2.raw as pr
from fastapi.testclient import TestClient
from src.api.render_api import app
from src.rules import site_detection as sd
from src.rendering import plan_sheet as ps
sd._overpass_request_with_fallback = lambda *a, **k: ({"elements": []}, None)
assert Path(ps.__file__).resolve().is_relative_to(ROOT), ps.__file__

adv_total = []
_b = ps._build_advance_warning_table
def spy_b(*a, **k):
    r = _b(*a, **k); adv_total.append(len(r)); return r
ps._build_advance_warning_table = spy_b
layouts = []
_l = ps._notes_layout
def spy_l(s, a, *rest):
    r = _l(s, a, *rest); layouts.append((s, a, r)); return r
ps._notes_layout = spy_l

APPROACH = {"speed": 25, "roadType": "urban_arterial", "lanesPerDirection": 1, "laneWidth": 11.0, "signalized": True, "alongStationFt": -100.0}
BODY = {"kind": "near_intersection", "meta": {"project": "309 render", "address": "N Broadway SB at E 11th Ave", "lat": 39.73370, "lng": -104.98753, "bearingDeg": 0.0},
 "roadType": "urban_arterial", "speed": 30, "lanes": 4, "laneWidth": 10.5, "divided": False, "workType": "utility_cut", "duration": "short", "workLen": 500.0, "night": False,
 "approaches": [{"id": "e11_wb", **APPROACH}, {"id": "e11_eb", **APPROACH}]}
ONE_WAY = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None, "twinSearched": True, "confirmed": None}
SHOULDER = {"kind": "shoulder", "meta": {"project": "shoulder cmp", "address": "N Broadway SB at E 11th Ave", "lat": 39.73370, "lng": -104.98753, "bearingDeg": 0.0},
 "roadType": "urban_arterial", "speed": 30, "lanes": 4, "laneWidth": 10.5, "divided": False, "workType": "utility_locate", "duration": "short", "workLen": 500.0, "night": False}
WC_NI = json.loads((ROOT / "tests/fixtures/pdf_worst_case/adv-near-intersection.json").read_text(encoding="utf-8"))["scenario"]

client = TestClient(app)

def api_pdf(body):
    r = client.post("/render/pdf", headers=AUTH, json=copy.deepcopy(body))
    assert r.status_code == 200, (r.status_code, r.text[:500])
    return r.content

def case27_pdf():
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import ScenarioParams
    params = ScenarioParams(speed_mph=75, num_lanes=2, closure_type="shoulder", road_type="freeway",
        work_zone_length_ft=1000.0, lane_width_ft=12.0, shoulder_width_ft=10.0, is_divided=True,
        jurisdiction="CDOT", work_zone_speed_mph=40)
    placements = generate_shoulder_closure_divided(params)
    fd, path = tempfile.mkstemp(suffix=".pdf"); os.close(fd)
    try:
        ps.render_plan_sheet(placements, params, output_path=path, shoulder_width_ft=10.0)
        return Path(path).read_bytes()
    finally:
        os.unlink(path)

PLANS = {
    "ni_oneway": lambda: api_pdf({**BODY, "carriageway": ONE_WAY}),
    "ni_twoway": lambda: api_pdf(BODY),
    "shoulder": lambda: api_pdf(SHOULDER),
    "case27_stepped": case27_pdf,
    "ni_worstcase_thornton": lambda: api_pdf(WC_NI),
}

geo = ps._footer_geometry(True)
NX0, NX1 = geo.notes_x, geo.notes_x + geo.notes_w
BY0, BY1 = ps.FOOTER_BOX_Y, ps.FOOTER_BOX_Y + ps.FOOTER_BOX_H
results = {}
OUT.mkdir(parents=True, exist_ok=True)
for name, fn in PLANS.items():
    adv_total.clear(); layouts.clear()
    pdf = fn()
    doc = pdfium.PdfDocument(io.BytesIO(pdf))
    pg = doc[0]; H = pg.get_height(); sc = 150 / 72
    img = pg.render(scale=sc).to_pil()
    img.crop((int(NX0 * sc) - 4, int((H - BY1) * sc) - 4, int(NX1 * sc) + 4, int((H - BY0) * sc) + 4)).save(OUT / f"{name}_{TAG}.png")
    tp = pg.get_textpage()
    chars = []
    for i in range(tp.count_chars()):
        ch = tp.get_text_range(i, 1)
        if not ch.strip():
            continue
        l, b, r, t = tp.get_charbox(i)
        ox, oy = ctypes.c_double(), ctypes.c_double()
        pr.FPDFText_GetCharOrigin(tp.raw, i, ctypes.byref(ox), ctypes.byref(oy))
        chars.append((l, b, r, t, ox.value, oy.value, ch))
    # chars whose origin starts inside the notes box (horizontally) and below the box top + margin
    inbox = [c for c in chars if NX0 <= c[4] < NX1 - 2 and BY0 - 30 <= c[5] <= BY1 + 5]
    groups = {}
    for c in inbox:
        groups.setdefault(round(c[5] * 4) / 4, []).append(c)
    lines = []
    for base in sorted(groups, reverse=True):
        cs = sorted(groups[base], key=lambda c: c[0])
        txt = ""; prev_r = None
        for c in cs:
            if prev_r is not None and c[0] - prev_r > 1.2:
                txt += " "
            txt += c[6]; prev_r = c[2]
        lines.append({"base": base, "top": max(c[3] for c in cs), "bot": min(c[1] for c in cs),
                      "left": min(c[0] for c in cs), "right": max(c[2] for c in cs), "text": txt})
    pitches = [a["base"] - b["base"] for a, b in zip(lines, lines[1:])]
    clear = [(a["bot"] - b["top"], a["text"][:40], b["text"][:40]) for a, b in zip(lines, lines[1:])]
    over = [ln["text"][:60] for ln in lines if ln["right"] > NX1 - 1 or ln["bot"] < BY0 + 1 or ln["top"] > BY1 - 1]
    # advance rows drawn: lines between the advance header and Reference with "NNN ft" distances
    try:
        i0 = next(k for k, ln in enumerate(lines) if ln["text"].startswith("ADVANCE WARNING") or "OFF-PAGE (" in ln["text"])
        i1 = next(k for k, ln in enumerate(lines) if ln["text"].startswith("Reference"))
        drawn = sum(len(re.findall(r"\d+ ft", ln["text"])) for ln in lines[i0 + 1:i1])
    except StopIteration:
        drawn = None
    lay = layouts[-1][2] if layouts else None
    tier = None if lay is None else ("tier0" if lay.footer_pads[0] == 4.0 else ("tier2" if lay.row_pitch == 8.0 else "tier1"))
    results[name] = {
        "layout_call": [layouts[-1][0], layouts[-1][1]] if layouts else None, "tier": tier,
        "two_col": None if lay is None else lay.two_col_advance,
        "min_baseline_pitch": round(min(pitches), 2), "min_ink_clearance": round(min(c[0] for c in clear), 2),
        "min_ink_pair": min(clear)[1:], "lines_outside_box": over,
        "advance_drawn": drawn, "advance_total": adv_total[-1] if adv_total else None,
        "lowest_baseline": lines[-1]["base"], "box_bottom": BY0,
        "lines": [f'{ln["base"]:7.2f} [{ln["bot"]:6.1f},{ln["top"]:6.1f}] {ln["text"]}' for ln in lines],
    }
(OUT / f"measure_{TAG}.json").write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8")
for k, v in results.items():
    print(f"{TAG} {k:24s} call={v['layout_call']} {v['tier']} 2col={v['two_col']} pitch>={v['min_baseline_pitch']} ink>={v['min_ink_clearance']} {v['min_ink_pair']} outside={len(v['lines_outside_box'])} adv {v['advance_drawn']}/{v['advance_total']} lowest={v['lowest_baseline']}")
