"""#235 surface D (R150, option B): page 1's lower band.

The sheet's legal trailer (the Reference line, the DRAFT line, "Verify all
dimensions before use.") prints once, at the title block's foot under
STATUS, text unchanged; NOTES keeps the plan-specific disclosures, so the
N Broadway SB plan lists all 5 advance signs.  The title block's rows step
their pitch down only when they would reach the trailer, so a title block
whose long values all wrap still clears it.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

from src.api.render_api import app  # noqa: E402
from src.rendering import plan_sheet as ps  # noqa: E402
from tests.test_pdf_containment import _words, measure_containment  # noqa: E402

HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}
FIXTURE = Path(__file__).parent / "fixtures" / "pdf_worst_case" / "broadway-left.json"
ADVANCE = ("W21-5aL", "W20-2", "R2-10", "W20-1", "W3-5")


def _scenario() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))["scenario"]


def _render(client: TestClient, tmp_path: Path, body: dict[str, Any], name: str) -> Path:
    r = client.post("/render/pdf", json=body, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    pdf = tmp_path / f"{name}.pdf"
    pdf.write_bytes(r.content)
    return pdf


def _in(box: tuple[float, float], w: tuple[float, float, float, float, str]) -> bool:
    return box[0] <= w[0] and w[2] <= box[0] + box[1]


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def test_the_trailer_prints_once_under_status_in_the_title_block(
    client: TestClient, tmp_path: Path
) -> None:
    words = _words(str(_render(client, tmp_path, _scenario(), "broadway")))
    g = ps._footer_geometry(include_device_summary=True)
    title, notes = (g.title_x, g.title_w), (g.notes_x, g.notes_w)
    status_y = next(w[1] for w in words if w[4] == "STATUS:" and _in(title, w))
    for first in ("Reference:", "GENERATED", "Verify"):
        hits = [w for w in words if w[4] == first]
        assert len(hits) == 1, first
        assert _in(title, hits[0]), first
        assert hits[0][1] < status_y, first
        assert not _in(notes, hits[0]), first


def test_the_broadway_plan_lists_all_five_advance_signs(client: TestClient, tmp_path: Path) -> None:
    pdf = _render(client, tmp_path, _scenario(), "broadway")
    words = _words(str(pdf))
    g = ps._footer_geometry(include_device_summary=True)
    notes = [w[4] for w in words if _in((g.notes_x, g.notes_w), w)]
    for code in ADVANCE:
        assert code in notes, code
    assert "MORE" not in notes
    counts = {k: len(v) for k, v in measure_containment(str(pdf)).items()}
    assert counts == {"edge": 0, "box_cross": 0, "collisions": 0}


def test_typical_title_blocks_keep_the_11pt_pitch() -> None:
    top = ps.FOOTER_BOX_Y + ps.FOOTER_BOX_H
    rule = ps.FOOTER_BOX_Y + ps.TITLE_BLOCK_PAD + ps.TITLE_BLOCK_TRAILER_PITCH * 4 + 10
    # broadway-left: 13 value lines; 14 with production's AERIAL row.
    assert ps._title_block_row_pitch(top, 13, 3, rule) == 11.0
    assert ps._title_block_row_pitch(top, 14, 3, rule) == 11.0
    # Every long value wrapped + ORIENTATION + AERIAL: 18 lines.
    assert ps._title_block_row_pitch(top, 18, 3, rule) == 8.5


def test_a_worst_case_title_block_clears_the_trailer(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Long project, location and MHT label, no bearing (ORIENTATION row)
    and an aerial page (AERIAL row): no title-block word straddles the
    trailer's hairline, and containment stays zero."""
    real = ps._draw_structured_title_block
    rules: list[float] = []

    def worst(*a: Any, **kw: Any) -> None:
        kw["bearing_deg"] = None
        kw["aerial_page"] = "2"
        rules.append(ps.FOOTER_BOX_Y + ps.TITLE_BLOCK_PAD + ps.TITLE_BLOCK_TRAILER_PITCH * 4 + 10)
        return real(*a, **kw)

    monkeypatch.setattr(ps, "_draw_structured_title_block", worst)
    body = _scenario()
    body["meta"] = {
        **body["meta"],
        "project": "Very Long Project Name " * 8,
        "address": "Very Long Location Description " * 8,
    }
    pdf = _render(client, tmp_path, body, "worst")
    g = ps._footer_geometry(include_device_summary=True)
    words = [w for w in _words(str(pdf)) if _in((g.title_x, g.title_w), w)]
    rule = rules[0]
    above = [w for w in words if w[3] > rule]
    below = [w for w in words if w[3] <= rule]
    assert above and below
    assert min(w[1] for w in above) >= rule + 1.0  # rows' descenders clear it
    assert max(w[3] for w in below) <= rule - 1.0
    counts = {k: len(v) for k, v in measure_containment(str(pdf)).items()}
    assert counts == {"edge": 0, "box_cross": 0, "collisions": 0}
