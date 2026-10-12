"""#312 (R134 Q1): one-way and two-way near-intersection plans stay
byte-identical.  Prints a digest of every deliverable for those plans from
the given checkout; run it on main and on the branch and diff the outputs.

Audit JSON, crew markdown, device breakdown, quote: the bytes.  Plan PDF,
audit PDF, crew PDF: each page's text (the PDFs carry a creation time).
XLSX: every cell but the generated stamp.  TestClient, Overpass stubbed.
Usage: python identity_probe.py <repo-root>
"""

from __future__ import annotations

import copy
import datetime
import hashlib
import io
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "probe"
os.environ.pop("MAPBOX_TOKEN", None)
AUTH = {"Authorization": "Bearer probe"}

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from openpyxl import load_workbook  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]
# The main checkout loads a .env (with a Mapbox token) at import: clear it
# after import so both checkouts render the same pages (no aerial page 2).
os.environ.pop("MAPBOX_TOKEN", None)
client = TestClient(app)

leg = {"speed": 25, "roadType": "urban_arterial", "lanesPerDirection": 1, "laneWidth": 12,
       "signalized": True}
base: dict[str, Any] = {
    "kind": "near_intersection",
    "meta": {
        "project": "312 identity", "address": "S Colorado Blvd", "lat": 39.709,
        "lng": -104.9407, "pinModel": "work_start", "work": {"side": "right", "heading": "N"},
        "intersection": {"lat": 39.71092, "lng": -104.9407, "name": "E Exposition Ave"},
    },
    "roadType": "urban_arterial", "speed": 35, "lanes": 2, "laneWidth": 12, "divided": False,
    "workType": "utility_cut", "duration": "short", "workLen": 500, "night": False,
    "approaches": [{"id": "cross_a", **leg}, {"id": "cross_b", **leg}],
}
one_way = copy.deepcopy(base)
one_way["carriageway"] = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None,
                          "twinSearched": True, "confirmed": None}
cases = {"two-way": base, "one-way (#309)": one_way}


def h(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()[:16]


def pdf_text(content: bytes) -> bytes:
    doc = pdfium.PdfDocument(content)
    return "\f".join(doc[i].get_textpage().get_text_range() for i in range(len(doc))).encode()


def xlsx_cells(content: bytes) -> bytes:
    wb = load_workbook(io.BytesIO(content))
    cells = [(ws.title, c.coordinate, str(c.value)) for ws in wb for row in ws.iter_rows()
             for c in row if c.value is not None and not isinstance(c.value, datetime.datetime)]
    return repr(cells).encode()


for label, body in cases.items():
    out = {}
    for path in ("/render/audit", "/render/markdown", "/render/device-breakdown"):
        r = client.post(path, headers=AUTH, json=body)
        out[path] = h(r.content) if r.status_code == 200 else f"HTTP {r.status_code}"
    for path in ("/render/pdf", "/render/audit-pdf", "/render/crew-pdf"):
        r = client.post(path, headers=AUTH, json=body)
        out[path + " (text)"] = h(pdf_text(r.content)) if r.status_code == 200 else f"HTTP {r.status_code}"
    r = client.post("/render/xlsx", headers=AUTH, json=body)
    out["/render/xlsx (cells)"] = h(xlsx_cells(r.content)) if r.status_code == 200 else f"HTTP {r.status_code}"
    for k, v in out.items():
        print(f"{label:16} {k:28} {v}")
