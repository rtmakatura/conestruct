"""#362 crop: page 1's advance table on freeway 75 -> 40, 1000 ft of work.

Run from a source root: PYTHONPATH=. uv run --extra dev python <this> <out.png>
Renders the plan PDF through /render/pdf (the byteid.py body) and crops the
notes box from the ADVANCE WARNING title to the box's foot, at 4x.
"""
import io, os, sys
import pypdfium2 as pdfium
from fastapi.testclient import TestClient
from tests.s630._harness import _common
from tests.s630 import test_cross_surface as tcs
from tests.test_r117_pdf_notes import _notes_lines
from src.rendering import plan_sheet as ps

os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
os.environ["MAPBOX_TOKEN"] = "test-token"
tcs._ps.httpx.get = lambda *a, **k: tcs._FakeTile()
tcs._ps._validate_corridor_bearing = lambda corridor: None
api = TestClient(tcs._render_app)
body = {**_common(75, 40), "roadType": "freeway", "divided": True, "workLen": 1000}
pdf = api.post("/render/pdf", json=body, headers=tcs._API_HEADERS).content
title = next(ln for ln in _notes_lines(pdf) if ln["text"].startswith("ADVANCE WARNING"))
geo = ps._footer_geometry(True)
page = pdfium.PdfDocument(io.BytesIO(pdf))[0]
S = 4
img = page.render(scale=S).to_pil()
H = page.get_height()
box = (int((geo.notes_x - 2) * S), int((H - title["top"] - 6) * S),
       int((geo.notes_x + geo.notes_w + 2) * S), int((H - ps.FOOTER_BOX_Y + 2) * S))
img.crop(box).save(sys.argv[1])
print(sys.argv[1], img.crop(box).size)
