"""#338 — every shoulder plan's page 1 says which shoulder width its taper is built on.

There is no shoulder-width input: ``plan_shoulder_width_ft`` assumes 8 ft
on an undivided road and a one-way street, 10 ft on a divided highway.
The shoulder taper is L/3 of W·S²/60 or W·S (MUTCD Table 6B-4, "W = width
of offset in feet"), so W drives it.  Page 1 must print the width marked
as assumed, and the width it prints must be the one the audit's taper
section records (one producer).  How the audit marks it as assumed is
checkpoint Q1 (validation-artifacts/committed/issue-338-shoulder-width/).

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


@pytest.mark.parametrize(
    ("scenario", "width"),
    [(_UNDIVIDED, "8"), (CASE_11_GENERAL_BODY, "10"), (_ONE_WAY, "8")],
    ids=["undivided", "divided", "one-way"],
)
def test_page1_states_the_assumed_width_the_taper_uses(
    scenario: dict[str, Any],
    width: str,
    api: TestClient,  # noqa: F811
) -> None:
    assert f"Shoulder width: {width} ft (assumed)" in _page1(api, scenario)
    audit = _post(api, "/render/audit", scenario).json()
    assert audit["sections"]["taper"]["shoulder_width_ft"] == float(width)


def test_lane_closure_prints_no_shoulder_width(api: TestClient) -> None:  # noqa: F811
    assert "Shoulder width" not in _page1(api, FLAGGER_BASIC_BODY)
