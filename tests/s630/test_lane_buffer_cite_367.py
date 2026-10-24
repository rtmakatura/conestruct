"""#367 — a lane closure's buffer never cites Sheet 7 Case 11.

A CDOT lane closure at 65/75 mph without the Case 26/27 step-down took the
shoulder branch's "Sheet 7 Case 11 (buffer VARIES per General Note 24)" in
its buffer lookup and source.  Case 11 is a shoulder case.  The buffer is
MUTCD Table 6B-2 at the posted speed ("65 mph 645 feet", "75 mph 820 feet",
printed p. 775), which the lane plan cites alone, as #361 R3 does for the
step-down (rulings R1, R2).

Rule 11: no live lane kind reaches 65 mph (lane_closure_divided is gated),
so the lane plan runs through the real generator and audit producers.  The
shoulder plans run through ``/render/audit``.
"""

from __future__ import annotations

import dataclasses
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.audit import build_audit_trail
from src.api.schemas import LaneClosureDividedScenario, scenario_to_call

from ._harness import _common
from .test_cross_surface import _post, api  # noqa: F401  (``api`` is a fixture)
from .test_lane_stepdown_361 import _LANE_BODY

_TABLE_6B_2 = "MUTCD 11th Ed. Sec 6B.06, Table 6B-2 (stopping sight distance)."


def _lane_audit(speed: int, wz: int | None) -> dict[str, Any]:
    scenario = LaneClosureDividedScenario.model_validate({**_LANE_BODY, "speed": speed})
    params, generator, kwargs = scenario_to_call(scenario)
    params = dataclasses.replace(params, work_zone_speed_mph=wz)
    return build_audit_trail(generator(params, **kwargs), params)


@pytest.mark.parametrize(
    ("speed", "wz", "built_ft"),
    [(65, None, 645.0), (75, None, 820.0), (65, 55, 645.0), (75, 70, 820.0)],
)
def test_lane_buffer_cites_table_6b_2_alone(speed: int, wz: int | None, built_ft: float) -> None:
    buf = _lane_audit(speed, wz)["buffer"]
    assert buf["buffer_ft"] == built_ft
    assert buf["result_text"] == f"B = {built_ft:g} ft"
    assert buf["source"] == _TABLE_6B_2
    assert "Case 11" not in buf["lookup_text"]
    assert "General Note 24" not in buf["lookup_text"]
    assert buf["lookup_text"].startswith(f"MUTCD Table 6B-2: {built_ft:g} ft.")
    assert "this plan closes a lane" in buf["lookup_text"]


_SHOULDER_CASE_11 = "CDOT S-630-1 Sheet 7 Case 11 (buffer VARIES per General Note 24)."


@pytest.mark.parametrize(
    "scenario",
    [
        pytest.param(_common(65, None), id="freeway-65"),
        pytest.param(_common(75, None), id="freeway-75"),
        pytest.param(_common(75, 70), id="freeway-75-70"),
        pytest.param({**_common(65, None), "roadType": "rural_divided"}, id="rural-65"),
    ],
)
def test_shoulder_buffer_keeps_its_case_11_cite(
    api: TestClient,  # noqa: F811
    scenario: dict[str, Any],
) -> None:
    buf = _post(api, "/render/audit", scenario).json()["sections"]["buffer"]
    assert buf["source"].endswith(_SHOULDER_CASE_11)
    assert buf["lookup_text"].endswith("(Sheet 7 Case 11: buffer VARIES per General Note 24).")
    assert "this plan has no qualifying reduction" in buf["lookup_text"]
