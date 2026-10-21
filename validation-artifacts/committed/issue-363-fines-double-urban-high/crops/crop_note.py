"""Crop the Fines Double note as it prints in the audit PDF (#363 R2).

Plan: urban_arterial 55 -> 45, 1,000 ft of work, undivided (the issue's
instance through the API).  Run from the worktree root:
PYTHONPATH=. uv run --extra dev python <this> <out.png>
"""
import os, sys
import pypdfium2 as pdfium
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
os.environ["MAPBOX_TOKEN"] = "test-token"
from fastapi.testclient import TestClient
from tests.s630 import test_cross_surface as tcs
from tests.s630._harness import _common
tcs._ps.httpx.get = lambda *a, **k: tcs._FakeTile()
tcs._ps._validate_corridor_bearing = lambda corridor: None
api = TestClient(tcs._render_app)
body = {**_common(55, 45), "roadType": "urban_arterial", "divided": False, "workLen": 1000}
pdf = pdfium.PdfDocument(api.post("/render/audit-pdf", json=body, headers=tcs._API_HEADERS).content)
scale = 2.5
def first(tp, needle):
    found = tp.search(needle)
    hit = found.get_next() if found else None
    return hit  # (char index, char count) or None


for i, page in enumerate(pdf):
    tp = page.get_textpage()
    head = first(tp, "Pending Verification")
    kind = first(tp, "fines_double_spacing")
    if not kind:
        continue
    lo_i = head[0] if head else kind[0]
    tail = first(tp, "directed by the Engineer")
    hi_i = tail[0] + tail[1] if tail and tail[0] > kind[0] else tp.count_chars()
    box = [tp.get_charbox(k) for k in range(lo_i, hi_i)]
    box = [b for b in box if b[2] > b[0]]
    w, h = page.get_size()
    left, right = 24, w - 24
    bottom = min(b[1] for b in box) - 10
    top = max(b[3] for b in box) + 10
    img = page.render(scale=scale).to_pil()
    img.crop((int(left * scale), int((h - top) * scale), int(right * scale), int((h - bottom) * scale))).save(sys.argv[1])
    print("page", i + 1, "crop", [round(v) for v in (left, bottom, right, top)])
    break
