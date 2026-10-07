"""#308 R94 — three page-1 defects from Ryan's browser check of N Broadway.

1. The ``pedestrian_facility`` adjustment's mirrored ``-offset`` barricade
   pair floated 154 pt above a one-way street: there is no far carriageway,
   and no left sidewalk is closed (the flag carries no side; the R9-9s, the
   hatch and the audit all put the closure at the work-side sidewalk).
2. The direction arrows sat outside the road; on a one-way street they sit
   in the travel lanes.
3. The banner's caps touched the top of its box.

Tested at the payload chokepoint (``render_api._placements_for``) and on
the rendered page (Rule 11).  Evidence: validation-artifacts/committed/
issue-308-oneway-read-as-divided/checkpoint.md, the R94 addendum.
"""

from __future__ import annotations

import os
from dataclasses import replace
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import pytest
from pydantic import TypeAdapter

from src.api import render_api
from src.api.schemas import Scenario
from src.generation.layout import generate_shoulder_closure_undivided
from src.rendering import plan_sheet as ps
from src.rules.devices import DeviceType
from src.rules.validators import ScenarioParams

ONE_WAY = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None, "twinSearched": True}
DIVIDED = {**ONE_WAY, "twinDistanceM": 14.8}


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


def _body(carriageway: dict[str, Any], **over: Any) -> dict[str, Any]:
    b: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {
            "project": "r94",
            "address": "",
            "lat": 0.0,
            "lng": 0.0,
            "siteConditions": {"pedestrian_facility": True},
        },
        "roadType": "urban_arterial",
        "speed": 30,
        "lanes": 4,
        "laneWidth": 10.5,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000.0,
        "night": False,
        "carriageway": carriageway,
    }
    b.update(over)
    return b


def _plan(b: dict[str, Any]):
    placements, params, site_records, *_ = render_api._placements_for(
        TypeAdapter(Scenario).validate_python(b)
    )
    return placements, params, next(r for r in site_records if r["flag"] == "pedestrian_facility")


def _barricades(placements) -> list:
    return [p for p in placements if p.device_type == DeviceType.BARRICADE_TYPE_III]


def test_a_one_way_street_barricades_only_the_work_side_sidewalk() -> None:
    placements, params, record = _plan(_body(ONE_WAY))
    assert params.one_way_street is True
    barricades = _barricades(placements)
    assert len(barricades) == 2
    assert all(p.offset_ft > 0 for p in barricades)
    assert record["devices_added"] == 4
    assert record["action"].startswith("Added 2 Type III barricades")


def test_its_barricades_land_on_the_drawn_sidewalk_band() -> None:
    placements, params, _ = _plan(_body(ONE_WAY))
    lo, hi = ps._strip_y_range(
        *ps._sidewalk_strip_ft(params, params.shoulder_width_ft), 1, params.is_divided
    )
    for p in _barricades(placements):
        assert lo <= ps._y_of(p.offset_ft, params.is_divided) <= hi


def test_a_divided_road_keeps_the_mirrored_pair() -> None:
    """Out of R94's scope (Ryan: the divided control is unchanged)."""
    placements, params, record = _plan(_body(DIVIDED, lanes=3, laneWidth=11.0))
    assert params.is_divided is True
    offsets = sorted(p.offset_ft for p in _barricades(placements))
    assert len(offsets) == 4 and offsets[0] == -offsets[-1]
    assert record["devices_added"] == 6
    assert record["action"].startswith("Added 4 Type III barricades")


def _params(**over: Any) -> ScenarioParams:
    base = ScenarioParams(
        speed_mph=30,
        num_lanes=4,
        closure_type="shoulder",
        road_type="urban_low",
        work_zone_length_ft=1000.0,
        lane_width_ft=10.5,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
        one_way_street=True,
    )
    return replace(base, **over)


def _arrow_ys(
    params: ScenarioParams, generator, out: Path, monkeypatch
) -> list[tuple[float, bool]]:
    drawn: list[tuple[float, bool]] = []
    real = ps._draw_lane_arrow

    def spy(c, x_left, x_right, y, pointing_right=True):
        drawn.append((y, pointing_right))
        real(c, x_left, x_right, y, pointing_right)

    monkeypatch.setattr(ps, "_draw_lane_arrow", spy)
    ps.render_plan_sheet(generator(params, shoulder_width_ft=8.0), params, str(out))
    return drawn


def _lane_band(params: ScenarioParams, lane: int) -> tuple[float, float]:
    """Page y of lane ``lane`` (1 = leftmost) on a one-way street."""
    h = params.lane_width_ft * ps.PTS_PER_OFFSET_FT
    return ps.PLAN_Y_CENTER - lane * h, ps.PLAN_Y_CENTER - (lane - 1) * h


def test_a_one_way_streets_arrows_sit_in_the_outer_open_lanes(tmp_path: Path, monkeypatch) -> None:
    params = _params()
    drawn = _arrow_ys(params, generate_shoulder_closure_undivided, tmp_path / "s.pdf", monkeypatch)
    assert [right for _, right in drawn] == [True, True]
    ys = sorted((y for y, _ in drawn), reverse=True)
    for y, lane in zip(ys, (1, 4), strict=True):
        lo, hi = _lane_band(params, lane)
        assert lo < y < hi


def test_a_lane_closure_keeps_its_arrows_out_of_the_closed_lane(
    tmp_path: Path, monkeypatch
) -> None:
    """``_draw_one_way_street`` paints the work-side lane closed for a lane
    closure; the arrow stays out of it.  No lane-closure scenario carries
    carriageway facts yet, so the shoulder layout stands in for placements."""
    params = _params(closure_type="lane")
    drawn = _arrow_ys(params, generate_shoulder_closure_undivided, tmp_path / "l.pdf", monkeypatch)
    ys = sorted((y for y, _ in drawn), reverse=True)
    assert len(ys) == 2
    for y, lane in zip(ys, (1, 3), strict=True):
        lo, hi = _lane_band(params, lane)
        assert lo < y < hi


def test_the_banner_title_is_centred_in_its_box(tmp_path: Path) -> None:
    """#308 R105 (Ryan's re-check on 73e7f4b): R94's 8 pt gap left the title
    "near the top edge of a tall empty box".  Centred vertically: the caps'
    gap to the top rule equals their gap to the bottom rule."""
    params = _params(one_way_street=False, num_lanes=2)
    out = tmp_path / "banner.pdf"
    ps.render_plan_sheet(
        generate_shoulder_closure_undivided(params, shoulder_width_ft=8.0), params, str(out)
    )
    page = pdfium.PdfDocument(str(out))[0]
    text = page.get_textpage()
    i = text.get_text_range().index("METHOD OF HANDLING TRAFFIC")
    boxes = [text.get_charbox(i + k) for k in range(6)]
    caps_top = max(b[3] for b in boxes)
    caps_bottom = min(b[1] for b in boxes)
    box_top = ps.PAGE_H - ps.MARGIN
    box_bottom = ps.PAGE_H - ps.TITLE_H
    assert abs((box_top - caps_top) - (caps_bottom - box_bottom)) <= 0.5
