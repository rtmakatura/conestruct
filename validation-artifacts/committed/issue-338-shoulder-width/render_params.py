"""#338 evidence: page 1 PARAMETERS crop for an undivided and a divided shoulder plan."""
import os, sys
sys.path.insert(0, os.getcwd())
os.environ["RENDER_API_SECRET"] = "t"
import pypdfium2 as pdfium
from fastapi.testclient import TestClient
from src.api.render_api import app
from tests.s630._harness import CASE_11_GENERAL_BODY as D
c = TestClient(app); H = {"Authorization": "Bearer t"}
out = "validation-artifacts/committed/issue-338-shoulder-width"
S = 200 / 72
for name, b in {"undivided-25": {**D, "roadType": "urban_arterial", "speed": 25, "divided": False, "workLen": 50}, "divided-55": D}.items():
    r = c.post("/render/pdf", json=b, headers=H); assert r.status_code == 200, r.text[:200]
    pg = pdfium.PdfDocument(r.content)[0]
    tp = pg.get_textpage()
    s = tp.search("PARAMETERS"); i, n = s.get_next()
    l, bt, rt, t = tp.get_charbox(i)
    h = pg.get_height()
    img = pg.render(scale=S).to_pil()
    img.crop((int((l - 12) * S), int((h - t - 10) * S), int((l + 440) * S), int((h - t + 48) * S))).save(f"{out}/{name}-params.png")
    print(name, [x for x in tp.get_text_range().splitlines() if "Shoulder" in x])
