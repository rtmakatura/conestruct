"""#235 surface D (R150 B, built): page 1 from the branch's own code.

    python validation-artifacts/committed/issue-235-surface-d/build235.py

Renders broadway-left (N Broadway SB, Denver) to built-page1.png and
built-band.png at 150 dpi, then measures containment on the 13 harness
fixtures and the usual plan sample (scripts/render_test_pdfs.py, 4 shoulder
plans).  Writes built-containment.json.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rendering import plan_sheet as ps  # noqa: E402
from tests.test_pdf_containment import BASELINE, FIXTURE_DIR, measure_containment  # noqa: E402

DPI = 150
HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}
SAMPLE = ["i25_freeway", "us85_rural", "25mph_urban", "45mph_rural"]


def counts(pdf: Path) -> dict[str, int]:
    return {k: len(v) for k, v in measure_containment(str(pdf)).items()}


def main() -> None:
    client = TestClient(app)
    out: dict[str, dict[str, int]] = {}
    for name in sorted(BASELINE):
        scenario = json.loads((FIXTURE_DIR / f"{name}.json").read_text(encoding="utf-8"))["scenario"]
        r = client.post("/render/pdf", json=scenario, headers=HEADERS)
        assert r.status_code == 200, r.text[:300]
        pdf = HERE / f"_{name}.pdf"
        pdf.write_bytes(r.content)
        out[f"harness/{name}"] = counts(pdf)
        if name == "broadway-left":
            doc = pdfium.PdfDocument(str(pdf))
            img = doc[0].render(scale=DPI / 72).to_pil()
            doc.close()
            img.save(HERE / "built-page1.png")
            top = int((ps.PAGE_H - ps.FOOTER_H - 4) * DPI / 72)
            img.crop((0, top, img.width, img.height)).save(HERE / "built-band.png")
        pdf.unlink()
    subprocess.run([sys.executable, str(ROOT / "scripts" / "render_test_pdfs.py")], check=True, cwd=ROOT)
    for name in SAMPLE:
        pdf = ROOT / f"test_pdf_{name}.pdf"
        out[f"sample/{name}"] = counts(pdf)
        pdf.unlink()
    for k, v in out.items():
        print(k, v)
    (HERE / "built-containment.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
