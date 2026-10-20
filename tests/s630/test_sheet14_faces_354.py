"""#354 — the W20-1 and G20-5P faces match the sheets the plan cites.

S-630-1 Sheet 14 (PDF p. 162), Cases 26 and 27, draws the W20-1 as
"ROAD WORK ½ MILE" and the G20-5P plaque as "WORK ZONE".  Sheet 2 General
Note 4 (PDF p. 150) names the plaque "Work Zone (G20-5p)" with no case
scope, and MUTCD 11th Ed. §6G.08 ¶01 (p. 795) names it "WORK ZONE
(G20-5aP)", so every plan's G20-5P reads "WORK ZONE" (rulings S2).

Rule 11: page 1 off ``/render/pdf``, the crew sheet off ``/render/markdown``,
the results breakdown off ``/render/audit`` and the XLSX device list, all
through the real producers.
"""

from __future__ import annotations

import re
from typing import Any

import pytest
from fastapi.testclient import TestClient

from ._harness import CASE_11B_BODY, CASE_26_BODY, CASE_27_BODY, _common
from .test_cross_surface import (  # noqa: F401  (``api`` is a fixture)
    _pdf_text,
    _pipeline,
    _post,
    _xlsx_device_rows,
    api,
)

_SHEET_14_PLANS = [CASE_26_BODY, CASE_27_BODY, {**CASE_26_BODY, "divided": False}]
_SHEET_14_IDS = ["case-26", "case-27", "case-26-undivided"]
_OTHER_PLANS = [CASE_11B_BODY, {**_common(65, 60), "roadType": "rural_divided"}]
_OTHER_IDS = ["freeway-55-50-case-11", "rural-divided-65-60"]

_HALF_MILE = "ROAD WORK ½ MILE"


def _faces(client: TestClient, scenario: dict[str, Any]) -> dict[str, set[str]]:
    body = {**scenario, "include_breakdown": True}
    devices = _post(client, "/render/audit", body).json()["breakdown"]["devices"]
    faces: dict[str, set[str]] = {}
    for row in devices:
        faces.setdefault(row["code"], set()).add(row["device"])
    return faces


@pytest.mark.parametrize("scenario", _SHEET_14_PLANS, ids=_SHEET_14_IDS)
def test_sheet_14_plans_print_the_sheet_14_faces(
    scenario: dict[str, Any],
    api: TestClient,  # noqa: F811
    tmp_path: Any,
) -> None:
    faces = _faces(api, scenario)
    assert faces["W20-1"] == {_HALF_MILE}
    assert faces["G20-5P"] == {"WORK ZONE plaque"}

    page1 = " ".join(_pdf_text(_post(api, "/render/pdf", scenario).content)[0].split())
    # The text layer may run the code into its legend ("W20-1ROAD").
    assert re.search(r"W20-1 ?ROAD WORK ½ MILE 2640 ft", page1)
    assert re.search(r"G20-5P ?WORK ZONE plaque", page1)
    assert "ROAD WORK AHEAD" not in page1
    assert "CONSTRUCTION ZONE" not in page1

    crew = _post(api, "/render/markdown", scenario).text
    assert f"| W20-1 | {_HALF_MILE} | 2,640 ft upstream |" in crew
    assert "| G20-5P | WORK ZONE plaque | Within work zone |" in crew
    assert "ROAD WORK AHEAD" not in crew
    assert "CONSTRUCTION ZONE" not in crew

    placements, params = _pipeline(scenario)
    # The Device List writes a sign as "<code> <face>".
    xlsx = {str(r[2]) for r in _xlsx_device_rows(placements, params, tmp_path)}
    assert {d for d in xlsx if d.startswith(("W20-1 ", "G20-5P "))} == {
        f"W20-1 {_HALF_MILE}",
        "G20-5P WORK ZONE plaque",
    }, xlsx


@pytest.mark.parametrize("scenario", _OTHER_PLANS, ids=_OTHER_IDS)
def test_other_plans_keep_road_work_ahead_and_read_work_zone(
    scenario: dict[str, Any],
    api: TestClient,  # noqa: F811
) -> None:
    """S1 is Sheet 14's alone; S2's plaque face is every plan's."""
    faces = _faces(api, scenario)
    assert faces["W20-1"] == {"ROAD WORK AHEAD"}
    assert faces["G20-5P"] == {"WORK ZONE plaque"}
    crew = _post(api, "/render/markdown", scenario).text
    assert "½ MILE" not in crew
    assert "CONSTRUCTION ZONE" not in crew
