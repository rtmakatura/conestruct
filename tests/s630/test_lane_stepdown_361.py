"""#361 — a lane closure never takes Sheet 14's floor; the crew sheet's
trigger follows the audit's.

S-630-1 Sheet 14 (Cases 26/27) is titled "Shoulder Work - Freeway/Expressway",
so its 570/650 ft buffer floors belong to shoulder work on that road class.
A lane closure at 65 -> 60 / 75 -> 65 takes MUTCD Table 6B-2 at the posted
speed (645 / 820 ft) (rulings R1, R3).  The crew sheet prints Sheet 14's
trigger exactly when the audit sets ``trigger_condition`` (R2).

Rule 11: no live lane kind carries a work-zone speed (only ``shoulder`` has
``workZoneSpeed``), so the lane plan runs through the real generator, audit
and crew-sheet producers with the step-down set on its params.  The trigger
agreement runs through ``/render/audit`` and ``/render/markdown``.
"""

from __future__ import annotations

import dataclasses
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.audit import build_audit_trail
from src.api.schemas import LaneClosureDividedScenario, scenario_to_call
from src.narrative.crew_narrative import render_crew_narrative_markdown

from ._harness import _common
from .test_cross_surface import _post, api  # noqa: F401  (``api`` is a fixture)

_LANE_BODY: dict[str, Any] = {
    "kind": "lane_closure_divided",
    "roadType": "freeway",
    "speed": 65,
    "laneWidth": 12.0,
    "workType": "pavement_repair",
    "duration": "short",
    "workLen": 1000.0,
    "night": False,
    "truckMountedAttenuator": False,
}


def _lane_plan(speed: int, wz: int) -> tuple[Any, Any]:
    scenario = LaneClosureDividedScenario.model_validate({**_LANE_BODY, "speed": speed})
    params, generator, kwargs = scenario_to_call(scenario)
    params = dataclasses.replace(params, work_zone_speed_mph=wz)
    placements = generator(params, **kwargs)
    return placements, params


@pytest.mark.parametrize(("speed", "wz", "built_ft"), [(65, 60, 645.0), (75, 65, 820.0)])
def test_lane_closure_takes_the_federal_buffer(speed: int, wz: int, built_ft: float) -> None:
    placements, params = _lane_plan(speed, wz)
    audit = build_audit_trail(placements, params)
    buf = audit["buffer"]
    assert buf["buffer_ft"] == built_ft
    assert audit["corridor_spec"]["buffer_ft"] == built_ft
    assert "divergence" not in buf and "cdot_value_ft" not in buf
    assert "Table 6B-2" in buf["source"] and "Sheet 14" not in buf["source"]
    # R3: no Case 11 citation on a lane closure; Sheet 14 named only to say why.
    assert "Case 11" not in buf["source"] and "Case 11" not in buf["lookup_text"]
    assert "this plan closes a lane" in buf["lookup_text"]
    assert "trigger_condition" not in audit["case"]
    rules = {v.get("rule_id") for v in audit["geometry_validation"].get("violations", [])}
    assert "BUFFER_TOO_SHORT" not in rules
    crew = render_crew_narrative_markdown(placements, params)
    assert "## Trigger Condition" not in crew and "OF TRAVEL WAY" not in crew


def test_the_predicates_exclude_lane_closures() -> None:
    from src.rules.spacing import _is_cdot_minimum, buffer_space, off_class_stepdown

    for road in ("freeway", "expressway", "rural_divided", None):
        assert buffer_space(65, "CDOT", 60, road_type=road, closure_type="lane") == 645.0
        assert buffer_space(75, "CDOT", 65, road_type=road, closure_type="lane") == 820.0
        assert not _is_cdot_minimum("CDOT", 65, 60, road_type=road, closure_type="lane")
        assert off_class_stepdown("CDOT", 75, 65, road, "lane")
    # A direct table call with no scenario keeps the speed-only lookup.
    assert buffer_space(65, "CDOT", 60) == 570.0


_TRIGGER_PLANS = [
    pytest.param({**_common(speed, wz), **road}, id=f"{road['roadType']}-{speed}-{wz}")
    for road in ({"roadType": "freeway"}, {"roadType": "rural_divided"})
    for speed, wz in ((65, 60), (65, 55), (65, 45), (75, 65), (75, 70), (75, 60), (55, 45))
]


@pytest.mark.parametrize("scenario", _TRIGGER_PLANS)
def test_crew_trigger_matches_the_audit(
    api: TestClient,  # noqa: F811
    scenario: dict[str, Any],
) -> None:
    case = _post(api, "/render/audit", scenario).json()["sections"]["case"]
    crew = _post(api, "/render/markdown", scenario).text
    assert ("## Trigger Condition" in crew) == ("trigger_condition" in case)
    if "trigger_condition" in case:
        assert case["trigger_condition"] in crew
    else:
        assert "OF TRAVEL WAY" not in crew
