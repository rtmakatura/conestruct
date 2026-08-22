"""#216 — the PDF containment test (the Arc-9 raster pattern, word-box edition).

Renders the committed worst-case fixtures (tests/fixtures/pdf_worst_case/)
through the REAL API path and measures layout failures from the produced
PDF's word bounding boxes — attributable measurement, not eyeballs:

  edge        words escaping the sheet border (MARGIN box)
  box_cross   words starting inside a footer box but crossing its right
              or bottom border
  collisions  same-baseline word pairs overlapping > 55% of the smaller
              box (the dim-label garble class; line-pitch adjacency is
              excluded by the same-baseline requirement)

Word boxes are built from pypdfium2 char boxes (the declared rendering
dependency) — no PyMuPDF needed.

Baseline pins (#216 commit 1): the adversarial fixtures assert TODAY'S
measured failure counts exactly, so the defects are on record and any
drift in either direction is loud.  The family commits (2-5) ratchet
these to zero; the control asserts zero from day one.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pypdfium2 as pdfium
import pytest

os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rendering import plan_sheet as ps  # noqa: E402

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "pdf_worst_case"
HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}

# Today's measured failure map (2026-08-22, the arc's red baseline).
# Commits 2-5 drive every adversarial count to zero.  pdfium reports
# true char boxes even past the page edge, so these counts run higher
# than a clipping extractor would report — adv-shoulder's edge:6 is the
# banner overflow in full ("Joint Project · 45 MPH" all off-page) plus
# the SCHOOL box; adv-near-intersection's edge:57 is the notes-box
# bottom blowout (the rightmost-lane legal note + NI fine print below
# the sheet border).
# Families 1 (notes-box fit-by-construction) and 2 (width guards)
# landed: NI edge 57 -> 1, banner overflow gone everywhere.  The
# residual edge:1 is the SCHOOL context box and the collisions are the
# dim-label garble — both Family 3 (geometry clamps).
BASELINE = {
    "adv-shoulder": {"edge": 1, "box_cross": 0, "collisions": 4},
    "adv-near-intersection": {"edge": 1, "box_cross": 0, "collisions": 0},
    "adv-flagger": {"edge": 1, "box_cross": 0, "collisions": 3},
    "control-typical": {"edge": 0, "box_cross": 0, "collisions": 0},
}


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


# --------------------------------------------------------------------------- #
# Word boxes from pypdfium2 char boxes.
# --------------------------------------------------------------------------- #


def _words(pdf_bytes_path: str) -> list[tuple[float, float, float, float, str]]:
    """(x0, y0, x1, y1, text) word boxes, PDF y-up coordinates, page 1."""
    doc = pdfium.PdfDocument(pdf_bytes_path)
    try:
        page = doc[0]
        tp = page.get_textpage()
        n = tp.count_chars()
        text = tp.get_text_range(0, n)
        words: list[tuple[float, float, float, float, str]] = []
        cur: list[int] = []

        def flush() -> None:
            if not cur:
                return
            boxes = [tp.get_charbox(i) for i in cur]
            x0 = min(b[0] for b in boxes)
            x1 = max(b[2] for b in boxes)
            y0 = min(b[1] for b in boxes)
            y1 = max(b[3] for b in boxes)
            words.append((x0, y0, x1, y1, "".join(text[i] for i in cur)))
            cur.clear()

        for i, ch in enumerate(text):
            if ch.isspace():
                flush()
            else:
                cur.append(i)
        flush()
        return words
    finally:
        doc.close()


def _footer_boxes() -> dict[str, tuple[float, float, float, float]]:
    g = ps._footer_geometry(include_device_summary=True)
    raw = {
        "legend": (g.legend_x, g.legend_w),
        "notes": (g.notes_x, g.notes_w),
        "device": (g.device_x, g.device_w),
        "title": (g.title_x, g.title_w),
    }
    return {
        name: (x, ps.FOOTER_BOX_Y, x + w, ps.FOOTER_BOX_Y + ps.FOOTER_BOX_H)
        for name, (x, w) in raw.items()
        if x is not None and w is not None
    }


def _overlap_frac(a, b) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    smaller = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return inter / smaller if smaller > 0 else 0.0


def measure_containment(pdf_path: str) -> dict[str, list]:
    """The three failure detectors over page 1's word boxes."""
    ws = _words(pdf_path)
    fails: dict[str, list] = {"edge": [], "box_cross": [], "collisions": []}

    for w in ws:
        x0, y0, x1, _y1, text = w
        if x1 > ps.PAGE_W - ps.MARGIN + 0.5 or x0 < ps.MARGIN - 0.5 or y0 < ps.MARGIN - 0.5:
            fails["edge"].append({"text": text, "box": [round(v, 1) for v in w[:4]]})

    for bname, (bx0, by0, bx1, by1) in _footer_boxes().items():
        for w in ws:
            x0, y0, x1, y1, text = w
            if bx0 <= x0 <= bx1 and by0 <= y1 <= by1 and (x1 > bx1 + 1.5 or y0 < by0 - 1.5):
                fails["box_cross"].append(
                    {"box": bname, "text": text, "word": [round(v, 1) for v in w[:4]]}
                )

    for i in range(len(ws)):
        for j in range(i + 1, len(ws)):
            a, b = ws[i], ws[j]
            if abs(a[1] - b[1]) > 12:
                continue
            ca = (a[1] + a[3]) / 2
            cb = (b[1] + b[3]) / 2
            if abs(ca - cb) >= min(a[3] - a[1], b[3] - b[1]) / 2:
                continue
            if a[4] != b[4] and _overlap_frac(a, b) > 0.55:
                fails["collisions"].append({"a": a[4], "b": b[4]})
    return fails


def _load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / f"{name}.json").read_text(encoding="utf-8"))["scenario"]


@pytest.mark.parametrize("name", sorted(BASELINE))
def test_plan_sheet_containment(name: str, client: TestClient, tmp_path: Path) -> None:
    scenario = _load_fixture(name)
    r = client.post("/render/pdf", json=scenario, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    pdf_path = tmp_path / f"{name}.pdf"
    pdf_path.write_bytes(r.content)
    fails = measure_containment(str(pdf_path))
    counts = {k: len(v) for k, v in fails.items()}
    assert counts == BASELINE[name], json.dumps(fails, indent=1)[:2000]


@pytest.mark.parametrize("name", sorted(BASELINE))
@pytest.mark.parametrize("route", ["/render/audit-pdf", "/render/crew-pdf"])
def test_flowing_pdfs_stay_inside_margins(
    name: str, route: str, client: TestClient, tmp_path: Path
) -> None:
    """The Platypus surfaces measured zero overflow at every maximum —
    pinned so an unbreakable-token regression (narrow cells) is loud."""
    scenario = _load_fixture(name)
    r = client.post(route, json=scenario, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    pdf_path = tmp_path / "doc.pdf"
    pdf_path.write_bytes(r.content)
    doc = pdfium.PdfDocument(str(pdf_path))
    try:
        margin = 0.7 * 72.0
        bad = []
        for page in doc:
            pw = page.get_width()
            tp = page.get_textpage()
            n = tp.count_chars()
            for i in range(n):
                box = tp.get_charbox(i)
                if box[2] > pw - margin + 2.0 or box[0] < margin - 2.0:
                    bad.append(box)
        assert not bad, f"{len(bad)} chars outside the margins"
    finally:
        doc.close()
