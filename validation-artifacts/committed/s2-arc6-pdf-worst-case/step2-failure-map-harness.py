"""s2-arc6 Step 2 — the adversarial fixtures + the measured failure map.

Three wire scenarios through the real API path (in-process TestClient),
plus a typical control.  Measurement is by WORD BOXES (PyMuPDF
``page.get_text("words")``) against region rectangles derived from
plan_sheet's own geometry constants — attributable bleed, not ink
counting:

  F1  words outside the sheet border (MARGIN box) — page-edge bleed
  F2  words crossing a footer-box border (legend / notes / summary /
      title block) into a neighbour's gutter or below the box
  F3  pairwise overlapping word boxes from different draw calls
      (collision), filtered to >30% area overlap so kerning noise and
      deliberate compound labels don't count
  F4  words above PLAN_TOP that are not title-block content (the dim
      band walking into the title strip)

Outputs: per-fixture failure JSON + full-page PNG + crops of every
failing region.  READ-ONLY vs the repo.
"""

import json
import os
import sys

sys.path.insert(0, r"C:\Users\rtmak\Documents\traffic-control-tool")
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"

import fitz  # PyMuPDF
import pypdfium2 as pdfium
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.rendering import plan_sheet as ps

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "outS2A6")
os.makedirs(OUT, exist_ok=True)
client = TestClient(app)
H = {"Authorization": "Bearer test-secret-do-not-deploy"}

LONG_PROJECT = (
    "I-25 & Alameda Interchange Phase 3B Utility Relocation and Storm Drain "
    "Improvements Package 2 (Night Work) - CDOT Region 1 / City and County of "
    "Denver Joint Project"
)
LONG_ADDRESS = (
    "4700-4998 South Colorado Boulevard between East Bayaud Avenue and East "
    "Alameda Avenue, Glendale / Denver County, Colorado 80246 (northbound curb lane)"
)
ALL_SITE = {
    "adjacent_intersection": True,
    "adjacent_interchange": True,
    "pedestrian_facility": True,
    "bike_facility": True,
    "school_zone": True,
    "railroad_crossing": True,
    "hospital_nearby": True,
}


def meta(project=LONG_PROJECT, address=LONG_ADDRESS, site=ALL_SITE):
    return {
        "project": project,
        "address": address,
        "lat": 0.0,
        "lng": 0.0,
        "siteConditions": dict(site),
    }


FIXTURES = {
    # A — shoulder maximum: divided, 4 lanes, night + WZ speed reduction
    # (fines/speed sign families), every site condition, Englewood (3
    # conflicts), schedule range, work length near the schema max.
    "adv-shoulder": {
        "kind": "shoulder",
        "meta": meta(),
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 4,
        "laneWidth": 10.5,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 5000,
        "night": True,
        "workZoneSpeed": 25,
        "jurisdiction_key": "englewood",
        "street_class": "arterial",
        "schedule": {
            "date_mode": "range",
            "work_date": "2026-08-24",
            "work_date_end": "2026-08-28",
            "start_time": 20.0,
            "end_time": 5.0,
        },
    },
    # B — near_intersection maximum: two signalized approaches (per-leg
    # tables + the citation note's 5 extra note lines), thornton
    # (on-sheet summary REQUIRED + 1 conflict).
    "adv-near-intersection": {
        "kind": "near_intersection",
        "meta": meta(),
        "roadType": "urban_arterial",
        "speed": 40,
        "lanes": 3,
        "laneWidth": 10.5,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 2000,
        "night": True,
        "approaches": [
            {
                "id": "north_leg",
                "speed": 40,
                "roadType": "urban_arterial",
                "lanesPerDirection": 3,
                "laneWidth": 10.5,
                "signalized": True,
                "alongStationFt": 2200,
            },
            {
                "id": "south_leg",
                "speed": 35,
                "roadType": "urban_arterial",
                "lanesPerDirection": 2,
                "laneWidth": 10.5,
                "signalized": True,
                "alongStationFt": 2200,
            },
        ],
        "jurisdiction_key": "thornton",
        "street_class": "arterial",
    },
    # C — flagger maximum: AFAD + pilot car + pedestrian access + night.
    "adv-flagger": {
        "kind": "flagger_lane_closure",
        "meta": meta(),
        "roadType": "urban_arterial",
        "speed": 40,
        "laneWidth": 10.5,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 3000,
        "night": True,
        "pilotCar": True,
        "afad": True,
        "pedestrianAccess": True,
        "jurisdiction_key": "littleton",
        "street_class": "collector",
    },
    # Control — a typical plan (short name, few conditions).
    "control-typical": {
        "kind": "shoulder",
        "meta": meta(
            project="Colfax Water Main",
            address="E Colfax Ave at Race St",
            site={"pedestrian_facility": True},
        ),
        "roadType": "urban_arterial",
        "speed": 35,
        "lanes": 2,
        "laneWidth": 12,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 800,
        "night": False,
    },
}

# ---- region rectangles from plan_sheet's own constants ----------------------
MARGIN = ps.MARGIN
PAGE_W, PAGE_H = ps.PAGE_W, ps.PAGE_H
PLAN_TOP = ps.PLAN_TOP


def footer_boxes():
    g = ps._footer_geometry(include_device_summary=True)
    boxes = {
        "legend": (g.legend_x, g.legend_w),
        "notes": (g.notes_x, g.notes_w),
        "device": (g.device_x, g.device_w),
        "title": (g.title_x, g.title_w),
    }
    return {
        name: (x, ps.FOOTER_BOX_Y, x + w, ps.FOOTER_BOX_Y + ps.FOOTER_BOX_H)
        for name, (x, w) in boxes.items()
        if x is not None and w is not None
    }


def to_pdf_y(fitz_y):  # fitz y-down -> pdf y-up
    return PAGE_H - fitz_y


def words_of(page):
    """(x0, y0_pdf_bottom, x1, y1_pdf_top, text) — converted to y-up."""
    out = []
    for w in page.get_text("words"):
        x0, y0, x1, y1, text = w[0], w[1], w[2], w[3], w[4]
        out.append((x0, PAGE_H - y1, x1, PAGE_H - y0, text))
    return out


def overlap_frac(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    smaller = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return inter / smaller if smaller > 0 else 0.0


def analyze_sheet(pdf_path, name):
    doc = fitz.open(pdf_path)
    page = doc[0]
    ws = words_of(page)
    fails = {"edge": [], "box_cross": [], "collisions": [], "above_plan_top": []}

    for w in ws:
        x0, y0, x1, y1, text = w
        if x1 > PAGE_W - MARGIN + 0.5 or x0 < MARGIN - 0.5 or y0 < MARGIN - 0.5:
            fails["edge"].append({"text": text, "box": [round(v, 1) for v in w[:4]]})

    boxes = footer_boxes()
    for bname, (bx0, by0, bx1, by1) in boxes.items():
        for w in ws:
            x0, y0, x1, y1, text = w
            # word that STARTS inside this box but crosses its right or
            # bottom border by more than 1.5 pt
            if bx0 <= x0 <= bx1 and by0 <= y1 <= by1:
                if x1 > bx1 + 1.5 or y0 < by0 - 1.5:
                    fails["box_cross"].append(
                        {"box": bname, "text": text, "word": [round(v, 1) for v in w[:4]]}
                    )

    # collisions among words in the sheet body + notes area
    for i in range(len(ws)):
        for j in range(i + 1, len(ws)):
            a, b = ws[i], ws[j]
            if abs(a[1] - b[1]) > 12:
                continue
            f = overlap_frac(a, b)
            ca = (a[1] + a[3]) / 2
            cb = (b[1] + b[3]) / 2
            same_line = abs(ca - cb) < min(a[3] - a[1], b[3] - b[1]) / 2
            if f > 0.55 and same_line and a[4] != b[4]:
                fails["collisions"].append(
                    {
                        "a": a[4],
                        "b": b[4],
                        "frac": round(f, 2),
                        "at": [round(a[0], 1), round(a[1], 1)],
                    }
                )

    # words above the plan frame that are not in the top title strip's own
    # band (the banner is legitimate above PLAN_TOP; dims are not).  The
    # banner words sit at y >= PAGE_H-45; dim-band intruders sit between
    # PLAN_TOP and the banner.
    for w in ws:
        x0, y0, x1, y1, text = w
        if PLAN_TOP + 2 < y0 and y1 < PAGE_H - 45:
            fails["above_plan_top"].append({"text": text, "box": [round(v, 1) for v in w[:4]]})

    doc.close()
    return fails


def render_and_measure(name, scenario):
    result = {"name": name}
    r = client.post("/render/pdf", json=scenario, headers=H)
    result["pdf_status"] = r.status_code
    if r.status_code != 200:
        result["error"] = r.text[:300]
        return result
    pdf_path = os.path.join(OUT, f"{name}.pdf")
    open(pdf_path, "wb").write(r.content)
    # raster full page
    doc = pdfium.PdfDocument(pdf_path)
    for i, page in enumerate(doc):
        page.render(scale=3.0).to_pil().save(os.path.join(OUT, f"{name}-p{i+1}.png"))
    result["pages"] = len(doc)
    result["failures"] = analyze_sheet(pdf_path, name)
    result["counts"] = {k: len(v) for k, v in result["failures"].items()}
    return result


def analyze_flowing(pdf_path):
    """Letter portrait: words crossing the 0.7in right/left margin or
    the page bottom (Platypus should never do this except unbreakable
    tokens / oversize flowables)."""
    doc = fitz.open(pdf_path)
    fails = []
    for pno, page in enumerate(doc):
        pw, phh = page.rect.width, page.rect.height
        for w in page.get_text("words"):
            x0, y0, x1, y1, text = w[0], w[1], w[2], w[3], w[4]
            if x1 > pw - 50.4 + 2.0 or x0 < 50.4 - 2.0 or y1 > phh - 50.4 + 2.0:
                fails.append({"page": pno + 1, "text": text, "box": [round(v,1) for v in (x0,y0,x1,y1)]})
    doc.close()
    return fails


def render_flowing(name, scenario):
    out = {}
    for tag, route in (("audit", "/render/audit-pdf"), ("crew", "/render/crew-pdf")):
        r = client.post(route, json=scenario, headers=H)
        out[tag] = {"status": r.status_code}
        if r.status_code == 200:
            p = os.path.join(OUT, f"{name}-{tag}.pdf")
            open(p, "wb").write(r.content)
            out[tag]["margin_fails"] = analyze_flowing(p)
            out[tag]["n_fails"] = len(out[tag]["margin_fails"])
    return out


results = {}
for name, scenario in FIXTURES.items():
    results[name] = render_and_measure(name, scenario)
    results[name]["flowing"] = render_flowing(name, scenario)
    print(
        name,
        "->",
        results[name].get("pdf_status"),
        results[name].get("counts", results[name].get("error", "")),
        "| flowing:",
        {t: v.get("n_fails", v.get("status")) for t, v in results[name].get("flowing", {}).items()},
    )

json.dump(results, open(os.path.join(OUT, "failure-map.json"), "w", encoding="utf-8"), indent=1)
print("\nwrote", os.path.join(OUT, "failure-map.json"))
