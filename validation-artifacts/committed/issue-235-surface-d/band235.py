"""#235 (R150 B): a plan's page-1 lower band from a given checkout, rendered
the way production renders it: with the aerial page, so the title block
carries "SHEET: 1 OF 2" and the AERIAL row.

    python band235.py <repo root> <env file> <ni|broadway> <out.png>

<env file> supplies MAPBOX_TOKEN (loaded into this process only, never
printed).  ni: tests/test_r117_pdf_notes.py's near-intersection N Broadway
body (one-way).  broadway: tests/fixtures/pdf_worst_case/broadway-left.json.
Prints the AERIAL row's clearance above the trailer's hairline when the
checkout draws one.
"""

from __future__ import annotations

import io
import json
import os
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
ENV = Path(sys.argv[2]).resolve()
CASE = sys.argv[3]
OUT = Path(sys.argv[4]).resolve()
sys.dont_write_bytecode = True
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

from src._dotenv import load_dotenv  # noqa: E402

load_dotenv(ENV)

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rendering import plan_sheet as ps  # noqa: E402
from tests.test_pdf_containment import _words, measure_containment  # noqa: E402

if CASE == "ni":
    import tests.test_r117_pdf_notes as t

    pdf = t._pdf({**t.BROADWAY, "carriageway": t.ONE_WAY})
else:
    scenario = json.loads(
        (ROOT / "tests" / "fixtures" / "pdf_worst_case" / "broadway-left.json").read_text(
            encoding="utf-8"
        )
    )["scenario"]
    r = TestClient(app).post(
        "/render/pdf", json=scenario, headers={"Authorization": "Bearer test-secret-do-not-deploy"}
    )
    assert r.status_code == 200, r.text[:300]
    pdf = r.content

doc = pdfium.PdfDocument(io.BytesIO(pdf))
pages = len(doc)
img = doc[0].render(scale=150 / 72).to_pil()
doc.close()
top = int((ps.PAGE_H - ps.FOOTER_H - 4) * 150 / 72)
img.crop((0, top, img.width, img.height)).save(OUT)

tmp = OUT.with_suffix(".pdf")
tmp.write_bytes(pdf)
words = _words(str(tmp))
counts = {k: len(v) for k, v in measure_containment(str(tmp)).items()}
tmp.unlink()
print(f"{CASE}: pages={pages} containment={counts}")
aerial = [w for w in words if w[4] == "AERIAL:"]
if aerial and hasattr(ps, "TITLE_BLOCK_TRAILER_PITCH"):
    rule = ps.FOOTER_BOX_Y + ps.TITLE_BLOCK_PAD + ps.TITLE_BLOCK_TRAILER_PITCH * 4 + 10
    row = [w for w in words if abs(w[1] - aerial[0][1]) < 1.0]
    bottom = min(w[1] for w in row)
    print(f"  AERIAL row bottom {bottom:.1f} pt, trailer hairline {rule:.1f} pt, clear by {bottom - rule:.1f} pt")
    status = [w for w in words if w[4] == "STATUS:" and w[0] > ps.PAGE_W / 2]
    srow = [w for w in words if abs(w[1] - status[0][1]) < 1.0]
    sb = min(w[1] for w in srow)
    print(f"  STATUS row (last) bottom {sb:.1f} pt, clear of the hairline by {sb - rule:.1f} pt")
elif aerial:
    print("  AERIAL row present (this checkout has no title-block trailer)")
