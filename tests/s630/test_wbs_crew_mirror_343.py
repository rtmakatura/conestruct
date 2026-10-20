"""#343 — the divided crew sheet mirrors only what the placements mirror.

``generate_work_beyond_shoulder`` signs the work side only: one W21-5 and
one G20-2, no plaques.  The crew sheet's left-side lines used to key on
``is_divided`` alone, so a divided work-beyond-shoulder sheet told the
crew to place matching signs and plaques the plan never has (Rule 10).
Its Note 8 line now reads like the audit's row ("Not required: one
shoulder closed"): work side only.  Divided shoulder and lane plans mirror
every sign and plaque, and their sheets keep the mirror lines.

Rule 11: the work-beyond-shoulder params come from the real scenario
bridge (``scenario_to_call``); the kind is gated over HTTP, so the sheet is
rendered from that call rather than ``/render/markdown``.
"""

from __future__ import annotations

from collections.abc import Callable

import pytest

from src.api.schemas import WorkBeyondShoulderScenario, scenario_to_call
from src.generation.layout import (
    generate_lane_closure_divided,
    generate_shoulder_closure_divided,
)
from src.narrative.crew_narrative import render_crew_narrative_markdown
from src.rules.validators import DevicePlacement, ScenarioParams

_MIRROR_TEXT = (
    "Place matching sign on left side.",
    "Place matching plaques on left side.",
    "Place matching signs on left side at each location.",
    "Remove both sides at each station.",
)
_WORK_SIDE_ONLY = (
    "- Divided highway: signs go on the right side only. CDOT S-630-1 Sheet 2 "
    "General Note 8 doesn't require both sides when only one shoulder is closed "
    "(Case 11 on Sheet 7)."
)


def _wbs_crew(road_type: str) -> tuple[str, list[float]]:
    scenario = WorkBeyondShoulderScenario(
        kind="work_beyond_shoulder",
        roadType=road_type,
        speed=55,
        laneWidth=12.0,
        workType="utility",
        duration="long",
        workLen=500.0,
        night=False,
    )
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    return (
        render_crew_narrative_markdown(placements, params),
        [p.offset_ft for p in placements],
    )


@pytest.mark.parametrize("road_type", ["freeway", "rural_divided"])
def test_divided_wbs_sheet_has_no_mirror(road_type: str) -> None:
    crew, offsets = _wbs_crew(road_type)
    assert offsets and all(o > 0 for o in offsets)
    for text in _MIRROR_TEXT:
        assert text not in crew
    assert "both sides of the roadway by choice" not in crew
    assert _WORK_SIDE_ONLY in crew


@pytest.mark.parametrize("road_type", ["rural_undivided", "urban_arterial"])
def test_undivided_wbs_sheet_has_no_divided_line(road_type: str) -> None:
    crew, _ = _wbs_crew(road_type)
    for text in _MIRROR_TEXT:
        assert text not in crew
    assert "- Divided highway:" not in crew


@pytest.mark.parametrize(
    ("closure_type", "generator"),
    [
        ("shoulder", generate_shoulder_closure_divided),
        ("lane", generate_lane_closure_divided),
    ],
    ids=["shoulder", "lane"],
)
def test_mirrored_divided_sheets_keep_mirror_lines(
    closure_type: str, generator: Callable[[ScenarioParams], list[DevicePlacement]]
) -> None:
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type=closure_type,
        road_type="freeway",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    crew = render_crew_narrative_markdown(generator(params), params)
    for text in _MIRROR_TEXT:
        assert text in crew
    assert _WORK_SIDE_ONLY not in crew
