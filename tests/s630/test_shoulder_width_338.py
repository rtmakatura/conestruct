"""#338 — every shoulder plan says which shoulder width its taper is built on.

There is no shoulder-width input: ``plan_shoulder_width_ft`` assumes 8 ft
on an undivided road and a one-way street, 10 ft on a divided highway.
The shoulder taper is L/3 of W·S²/60 or W·S (MUTCD Table 6B-4, "W = width
of offset in feet"), so W drives it.  Page 1 must print the width marked
as assumed, and the audit must disclose it for every road type: R88's
item on a one-way street (#308), #338's item everywhere else.

Rule 11: page 1 is read off ``/render/pdf`` and the audit off
``/render/audit`` through the real API.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from ._harness import CASE_11_GENERAL_BODY
from .test_cross_surface import _pdf_text, _post, api  # noqa: F401  (``api`` is a fixture)
from .test_ta10_flagger import FLAGGER_BASIC_BODY

_UNDIVIDED = {
    **CASE_11_GENERAL_BODY,
    "roadType": "urban_arterial",
    "speed": 25,
    "divided": False,
    "workLen": 50,
}
_ONE_WAY = {
    **CASE_11_GENERAL_BODY,
    "roadType": "urban_arterial",
    "speed": 30,
    "divided": False,
    "carriageway": {"oneway": "yes", "highwayClass": "primary", "twinSearched": True},
}


def _page1(api: TestClient, scenario: dict[str, Any]) -> str:  # noqa: F811
    return " ".join(_pdf_text(_post(api, "/render/pdf", scenario).content)[0].split())


def _pending_kinds(audit: dict[str, Any]) -> list[str]:
    return [i["kind"] for i in audit["pending_verification"].get("items", [])]


@pytest.mark.parametrize(
    ("scenario", "width", "road"),
    [
        (_UNDIVIDED, "8", "an undivided road"),
        (CASE_11_GENERAL_BODY, "10", "a divided highway"),
    ],
    ids=["undivided", "divided"],
)
def test_two_way_and_divided_plans_state_the_assumed_width(
    scenario: dict[str, Any],
    width: str,
    road: str,
    api: TestClient,  # noqa: F811
) -> None:
    assert f"Shoulder width: {width} ft (assumed)" in _page1(api, scenario)

    audit = _post(api, "/render/audit", scenario).json()
    assert audit["sections"]["taper"]["shoulder_width_ft"] == float(width)
    (item,) = [
        i for i in audit["pending_verification"]["items"] if i["kind"] == "shoulder_width_assumed"
    ]
    assert item["label"].startswith(f"On {road} the plan assumes a shoulder {width} ft wide.")
    assert item["tracking_issue"].endswith("/issues/338")
    assert "shoulder_width_assumed" not in audit["sections"]["case"]


def test_one_way_street_states_the_width_and_keeps_r88_item(
    api: TestClient,  # noqa: F811
) -> None:
    assert "Shoulder width: 8 ft (assumed)" in _page1(api, _ONE_WAY)
    kinds = _pending_kinds(_post(api, "/render/audit", _ONE_WAY).json())
    assert "one_way_street_widths_chosen" in kinds
    assert "shoulder_width_assumed" not in kinds


def test_lane_closure_prints_no_shoulder_width(api: TestClient) -> None:  # noqa: F811
    flagger = FLAGGER_BASIC_BODY
    assert "Shoulder width" not in _page1(api, flagger)
    assert "shoulder_width_assumed" not in _pending_kinds(
        _post(api, "/render/audit", flagger).json()
    )
