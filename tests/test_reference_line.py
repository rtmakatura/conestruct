"""#265: one producer for the reference line page 1 and the crew instructions print.

The two literals used to disagree: page 1 attached the effective date to MUTCD
Part 6, the crew header to the Colorado Supplement (the date is the
Supplement's).  Both now print ``REFERENCE_LINE``; tested on the rendered
outputs (Rule 11), and page 1's single drawn line still fits the notes box.
"""

from __future__ import annotations

import io
import os
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient
from reportlab.pdfbase.pdfmetrics import stringWidth

from src.api.render_api import app
from src.rendering import plan_sheet as ps
from src.rules import site_detection as sd
from src.rules.references import REFERENCE_LINE

_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_SECRET}"}
BODY: dict[str, Any] = {
    "kind": "shoulder",
    "meta": {"project": "T", "address": "", "lat": 0.0, "lng": 0.0},
    "roadType": "rural_divided",
    "speed": 55,
    "lanes": 2,
    "laneWidth": 12.0,
    "divided": True,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 800.0,
    "night": False,
}


@pytest.fixture(scope="module", autouse=True)
def _env() -> None:
    os.environ["RENDER_API_SECRET"] = _SECRET
    os.environ["MAPBOX_TOKEN"] = ""


@pytest.fixture(autouse=True)
def _no_overpass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


client = TestClient(app)


def test_the_line_attaches_the_date_to_the_supplement() -> None:
    assert REFERENCE_LINE == (
        "Reference: CDOT S-630-1, MUTCD 11th Edition Part 6, "
        "Colorado Supplement (effective January 18, 2026)."
    )


def test_page_one_prints_it_on_one_line_inside_the_notes_box(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    widths: list[float] = []
    real = ps._draw_notes

    def spy(*a: Any, **kw: Any) -> None:
        widths.append(kw["box_w"])
        return real(*a, **kw)

    monkeypatch.setattr(ps, "_draw_notes", spy)
    r = client.post("/render/pdf", headers=AUTH, json=BODY)
    assert r.status_code == 200, r.text[:300]
    page = pdfium.PdfDocument(io.BytesIO(r.content))[0]
    text = " ".join(page.get_textpage().get_text_range().split())
    assert REFERENCE_LINE in text
    assert "Part 6 (effective" not in text  # the misattribution is gone
    # Drawn with drawString (no wrap) at the box's own inset.
    assert stringWidth(REFERENCE_LINE, "Helvetica-Oblique", 6.5) <= widths[0] - 16.0


def test_the_crew_instructions_print_the_same_line() -> None:
    r = client.post("/render/markdown", headers=AUTH, json=BODY)
    assert r.status_code == 200, r.text[:300]
    assert f"- {REFERENCE_LINE}" in r.text
