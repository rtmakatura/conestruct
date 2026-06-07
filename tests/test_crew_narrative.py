"""Crew narrative rendering — Trigger Condition section (G6).

First narrative-side pytest coverage in the project. Verifies the
verbatim-or-nothing symmetry between audit, AuditTrail UI, and crew
narrative for the Sheet 14 Cases 26/27 trigger language: present at
65/75 mph with reduction, silent otherwise.
"""

from __future__ import annotations

from src.generation.layout import generate_shoulder_closure_divided
from src.narrative.crew_narrative import _render_template, build_narrative_context
from src.rules.validators import ScenarioParams

_TRIGGER_HEADER = "## Trigger Condition"
_TRIGGER_8FT = (
    "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 8 FT OF TRAVEL WAY"
)
_TRIGGER_10FT = (
    "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 10 FT OF TRAVEL WAY"
)


def _render(params: ScenarioParams) -> str:
    placements = generate_shoulder_closure_divided(params)
    context = build_narrative_context(placements, params)
    return _render_template(context)


def test_crew_narrative_65mph_reduction_includes_trigger_section() -> None:
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=60,
    )
    markdown = _render(params)
    assert _TRIGGER_HEADER in markdown
    assert f"> {_TRIGGER_8FT}" in markdown
    assert "The engineer of record determines activation" in markdown


def test_crew_narrative_75mph_reduction_includes_trigger_section() -> None:
    params = ScenarioParams(
        speed_mph=75,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=65,
    )
    markdown = _render(params)
    assert _TRIGGER_HEADER in markdown
    assert f"> {_TRIGGER_10FT}" in markdown


def test_crew_narrative_no_reduction_omits_trigger_section() -> None:
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=None,
    )
    markdown = _render(params)
    assert _TRIGGER_HEADER not in markdown
    assert _TRIGGER_8FT not in markdown
    assert _TRIGGER_10FT not in markdown


def test_crew_narrative_55mph_reduction_omits_trigger_section() -> None:
    # Case 11 variant — reduction is in effect but Sheet 14 does not
    # tabulate trigger text at 55 mph. Verbatim-or-nothing: stay silent
    # in the narrative just as audit.trigger_condition stays None.
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=45,
    )
    markdown = _render(params)
    assert _TRIGGER_HEADER not in markdown
    assert _TRIGGER_8FT not in markdown
    assert _TRIGGER_10FT not in markdown
