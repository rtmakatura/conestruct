"""#308 — page 1 draws a one-way street as one: every lane one direction.

Before #308 a one-way street reached page 1 either as a divided highway
(a median and an opposing carriageway; North Broadway on prod,
2026-09-25) or as a two-way road (``num_lanes`` lanes each side of a
yellow centerline).  Tested on the drawing calls themselves (a canvas that
records what is stroked and filled) and on the rendered PDF's text
(Rule 11: rendered output, not the params).
"""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium

from src.generation.layout import generate_shoulder_closure_undivided
from src.rendering import plan_sheet as ps
from src.rules.validators import ScenarioParams


class Recorder:
    """Records every stroked line and filled rect with the colour in force."""

    def __init__(self) -> None:
        self.stroke: Any = None
        self.fill: Any = None
        self.lines: list[tuple[Any, tuple[float, float, float, float]]] = []
        self.rects: list[tuple[Any, tuple[float, float, float, float]]] = []

    def setStrokeColor(self, color: Any) -> None:  # noqa: N802 (reportlab API)
        self.stroke = color

    def setFillColor(self, color: Any) -> None:  # noqa: N802
        self.fill = color

    def line(self, x1: float, y1: float, x2: float, y2: float) -> None:
        self.lines.append((self.stroke, (x1, y1, x2, y2)))

    def rect(self, x: float, y: float, w: float, h: float, fill: int = 0, stroke: int = 1) -> None:
        if fill:
            self.rects.append((self.fill, (x, y, w, h)))

    def __getattr__(self, name: str) -> Any:
        return lambda *a, **k: None


def _params(**over: Any) -> ScenarioParams:
    base = ScenarioParams(
        speed_mph=30,
        num_lanes=4,
        closure_type="shoulder",
        road_type="urban_low",
        work_zone_length_ft=1000.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
        one_way_street=True,
    )
    return replace(base, **over)


def _road(params: ScenarioParams) -> Recorder:
    rec = Recorder()
    ps._draw_road(
        rec,
        params.lane_width_ft,
        params.shoulder_width_ft,
        closure_type=params.closure_type,
        is_divided=params.is_divided,
        num_lanes=params.num_lanes,
        one_way_street=params.one_way_street,
    )
    return rec


def _horizontal_ys(rec: Recorder, color: Any) -> list[float]:
    return sorted(y1 for c, (_x1, y1, _x2, y2) in rec.lines if c == color and y1 == y2)


def test_a_one_way_street_has_no_yellow_centerline_and_no_median() -> None:
    rec = _road(_params())
    assert ps.MEDIAN_EDGE not in [c for c, _ in rec.lines]
    assert ps.MEDIAN_FILL not in [c for c, _ in rec.rects]


def test_a_one_way_street_stripes_only_between_its_own_lanes() -> None:
    """4 lanes, one direction: 3 lane lines between them, all below center
    (the work side), plus the two lane edges and two curb lines."""
    rec = _road(_params())
    lane_h = 11.0 * ps.PTS_PER_OFFSET_FT
    ys = _horizontal_ys(rec, ps.EDGE_LINE)
    for i in range(1, 4):
        assert any(abs(y - (ps.PLAN_Y_CENTER - i * lane_h)) < 1e-6 for y in ys)
    # Nothing striped above the left curb strip: no opposing lanes exist.
    shoulder_h = 8.0 * ps.PTS_PER_OFFSET_FT
    assert max(ys) <= ps.PLAN_Y_CENTER + shoulder_h + 1e-6


def test_the_road_extent_is_one_carriageway() -> None:
    params = _params()
    top, bottom = ps._road_y_extent(params, params.shoulder_width_ft)
    shoulder_h = 8.0 * ps.PTS_PER_OFFSET_FT
    lane_h = 11.0 * ps.PTS_PER_OFFSET_FT
    assert top == ps.PLAN_Y_CENTER + shoulder_h
    assert bottom == ps.PLAN_Y_CENTER - (4 * lane_h + shoulder_h)


def test_a_two_way_road_still_draws_its_yellow_centerline() -> None:
    rec = _road(_params(one_way_street=False))
    assert ps.MEDIAN_EDGE in [c for c, _ in rec.lines]


def _pdf_text(params: ScenarioParams, out: Path) -> str:
    placements = generate_shoulder_closure_undivided(params, shoulder_width_ft=8.0)
    ps.render_plan_sheet(placements, params, str(out))
    doc = pdfium.PdfDocument(str(out))
    return doc[0].get_textpage().get_text_range()


def test_page_1_titles_a_one_way_street(tmp_path: Path) -> None:
    text = _pdf_text(_params(), tmp_path / "one-way.pdf")
    assert "ONE-WAY STREET" in text
    assert "UNDIVIDED" not in text
    assert "DIVIDED HIGHWAY" not in text
