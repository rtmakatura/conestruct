"""#451 repro: render the issue's plan through /render/audit-pdf and extract
page 1 and the "Not checked yet" section as text (plus a PNG of each page).

    uv run --extra dev python <this file> <outdir> <label>

Plan: 1600 E Colfax Ave, Denver, Shoulder, One-way (confirmed), schedule
"Not set" -- the payload of tests/test_pdf_not_checked_count_451.py
``colfax()``.  Local TestClient, no network (no site scan is requested).
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))
os.environ["RENDER_API_SECRET"] = "repro"

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from tests.test_pdf_not_checked_count_451 import colfax  # noqa: E402

out, label = Path(sys.argv[1]), sys.argv[2]
out.mkdir(parents=True, exist_ok=True)
r = TestClient(app).post(
    "/render/audit-pdf", json=colfax(), headers={"Authorization": "Bearer repro"}
)
assert r.status_code == 200, r.text[:300]
pdf = out / f"{label}-audit.pdf"
pdf.write_bytes(r.content)
doc = pdfium.PdfDocument(str(pdf))
try:
    texts = [page.get_textpage().get_text_bounded() for page in doc]
    sec = next(
        i for i, t in enumerate(texts) if "Not checked yet\r\n" in t or "Not checked yet\n" in t
    )
    (out / f"{label}-page-1.txt").write_text(texts[0], encoding="utf-8")
    lines = texts[sec].splitlines()
    start = next(i for i, ln in enumerate(lines) if ln.strip() == "Not checked yet")
    (out / f"{label}-section.txt").write_text("\n".join(lines[start:]) + "\n", encoding="utf-8")
    for i in sorted({0, sec}):
        doc[i].render(scale=110 / 72).to_pil().save(out / f"{label}-page-{i + 1}.png")
    print(f"{label}: pages {len(doc)}, section on page {sec + 1}")
finally:
    doc.close()
pdf.unlink()
