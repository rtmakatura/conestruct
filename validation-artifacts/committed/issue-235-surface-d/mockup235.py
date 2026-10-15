"""#235 surface D (R150): page-1 mockups of the plan PDF's lower band.

    python validation-artifacts/committed/issue-235-surface-d/mockup235.py [variant ...]

Each variant is a list of exact (old, new) source substitutions applied to a
COPY of src/rendering/plan_sheet.py, exec'd into the live module so the real
/render/pdf path draws it.  The product code is never edited.  Every render
goes through the containment harness (tests/test_pdf_containment.py) and its
counts are written next to the PNGs.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rendering import plan_sheet as ps  # noqa: E402
from tests.test_pdf_containment import measure_containment  # noqa: E402
from variants235 import VARIANTS  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "pdf_worst_case" / "broadway-left.json"
SRC = (ROOT / "src" / "rendering" / "plan_sheet.py").read_text(encoding="utf-8")
DPI = 150  # print scale: the 11x17 sheet at 150 dpi
HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}


def load(name: str) -> None:
    src = SRC
    for old, new in VARIANTS[name]["patches"]:
        n = src.count(old)
        if n != 1:
            raise SystemExit(f"{name}: patch anchor found {n} times: {old[:80]!r}")
        src = src.replace(old, new)
    exec(compile(src, ps.__file__, "exec"), ps.__dict__)


def render(name: str, client: TestClient) -> dict:
    load(name)
    scenario = json.loads(FIXTURE.read_text(encoding="utf-8"))["scenario"]
    r = client.post("/render/pdf", json=scenario, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    pdf = HERE / f"{name}.pdf"
    pdf.write_bytes(r.content)
    fails = measure_containment(str(pdf))
    doc = pdfium.PdfDocument(str(pdf))
    img = doc[0].render(scale=DPI / 72).to_pil()
    doc.close()
    img.save(HERE / f"{name}-page1.png")
    s = DPI / 72
    band_top = int((ps.PAGE_H - ps.FOOTER_H - 4) * s)
    img.crop((0, band_top, img.width, img.height)).save(HERE / f"{name}-band.png")
    pdf.unlink()
    counts = {k: len(v) for k, v in fails.items()}
    return {"variant": name, "title": VARIANTS[name]["title"], "counts": counts, "fails": fails}


if __name__ == "__main__":
    names = sys.argv[1:] or list(VARIANTS)
    client = TestClient(app)
    rows = [render(n, client) for n in names]
    for row in rows:
        print(row["variant"], row["counts"])
    res = HERE / "containment.json"
    prev = json.loads(res.read_text(encoding="utf-8")) if res.exists() else {}
    prev.update(
        {r["variant"]: {"title": r["title"], "counts": r["counts"], "fails": r["fails"]} for r in rows}
    )
    res.write_text(json.dumps(prev, indent=1), encoding="utf-8")
