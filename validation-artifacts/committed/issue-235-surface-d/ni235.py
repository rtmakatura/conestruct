"""#235 (R150 B): the near-intersection N Broadway plan's lower band from a
given checkout, so the advance-section change can be seen before/after.

    python ni235.py <repo root> <out.png>

Uses tests/test_r117_pdf_notes.py's BROADWAY near-intersection body (one-way).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]).resolve()
sys.dont_write_bytecode = True
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

import pypdfium2 as pdfium  # noqa: E402

import tests.test_r117_pdf_notes as t  # noqa: E402
from src.rendering import plan_sheet as ps  # noqa: E402

pdf = t._pdf({**t.BROADWAY, "carriageway": t.ONE_WAY})
doc = pdfium.PdfDocument(pdf)
img = doc[0].render(scale=150 / 72).to_pil()
doc.close()
top = int((ps.PAGE_H - ps.FOOTER_H - 4) * 150 / 72)
img.crop((0, top, img.width, img.height)).save(OUT)
