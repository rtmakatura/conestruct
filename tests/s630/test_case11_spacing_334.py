"""#334 — freeway shoulder plans place their signs at Case 11's distances.

S-630-1 Sheet 7 Case 11 (PDF p. 155; oracle O16) puts, from the start of
the shoulder taper: W5-1 at 500 ft, the second W21-5aR (W7-3a) at 1,000 ft,
the first W21-5aR (W16-2a) at 2,000 ft and W20-1 at 5,200 ft.  It shows no
W20-2 (ruling Q1).  The plans used Table 6B-1 plus a midpoint rule
(750 / 1,000 / 2,500 / 5,140 ft at 75 mph).  Case 26/27 plans keep that
layout until #344 builds Sheet 14's (ruling Q2).

Rule 11: page 1 off ``/render/pdf``, the audit off ``/render/audit``, the
crew sheet off ``/render/markdown``, all through the real API.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.generation.layout import generate_shoulder_closure_divided
from src.rules.devices import DeviceType
from src.rules.validators import (
    DevicePlacement,
    ScenarioParams,
    validate_advance_warning_signs,
)

from ._harness import CASE_26_BODY, _common
from .test_cross_surface import _pdf_text, _post, api  # noqa: F401  (``api`` is a fixture)

_DIVIDED_75 = _common(75, None)
_DIVIDED_55 = _common(55, None)
_UNDIVIDED_65 = {**_common(65, None), "divided": False}
# A reduction that isn't Case 26's 65 -> 60 still cites Case 11; W5-1 stays
# omitted on a reduced plan, as before #334.
_REDUCED_65_55 = _common(65, 55)

_CASE_11_PLANS = [_DIVIDED_75, _DIVIDED_55, _UNDIVIDED_65, _REDUCED_65_55]
_IDS = ["divided-75", "divided-55", "undivided-65", "reduced-65-55"]


def _distance(row: dict[str, str]) -> int:
    return int(row["Distance from Taper (ft)"].split()[0].replace(",", ""))


@pytest.mark.parametrize("scenario", _CASE_11_PLANS, ids=_IDS)
def test_audit_places_the_case_11_distances(
    scenario: dict[str, Any],
    api: TestClient,  # noqa: F811
) -> None:
    audit = _post(api, "/render/audit", scenario).json()
    advance = audit["sections"]["advance"]
    rows = {r["Position"]: r for r in advance["sign_table"]}
    assert _distance(rows["Furthest (Case 11)"]) == 5200
    assert rows["Furthest (Case 11)"]["Code"] == "W20-1"
    assert _distance(rows["First W21-5aR (Case 11)"]) == 2000
    assert _distance(rows["Second W21-5aR (Case 11)"]) == 1000
    if "workZoneSpeed" in scenario:
        assert "W5-1 (Case 11)" not in rows
    else:
        assert _distance(rows["W5-1 (Case 11)"]) == 500
    assert "W20-2" not in {r["Code"] for r in advance["sign_table"]}
    assert advance["source"] == "CDOT S-630-1 Sheet 7 Case 11"
    # The validator scores the plan on Case 11, so the typical it cites
    # raises no Table 6B-1 spacing warning.
    assert audit["plan_flags"]["validation_warnings"] == 0


@pytest.mark.parametrize("scenario", _CASE_11_PLANS, ids=_IDS)
def test_page1_and_crew_sheet_print_the_same_distances(
    scenario: dict[str, Any],
    api: TestClient,  # noqa: F811
) -> None:
    page1 = " ".join(_pdf_text(_post(api, "/render/pdf", scenario).content)[0].split())
    assert "W21-5aR RIGHT SHOULDER CLOSED AHEAD 1000 ft" in page1
    assert "W21-5aR RIGHT SHOULDER CLOSED AHEAD 2000 ft" in page1
    # The reduced plan's notes box cuts its last rows into the "+N MORE"
    # line (page 1's fit loop), so W20-1 is named there instead.
    assert "W20-1 ROAD WORK AHEAD 5200 ft" in page1 or (
        "MORE ADVANCE SIGNS (W16-2a, W20-1)" in page1
    )
    assert "W20-2" not in page1
    crew = _post(api, "/render/markdown", scenario).text
    assert "| W20-1 | ROAD WORK AHEAD | 5,200 ft upstream |" in crew
    assert "| W21-5aR | RIGHT SHOULDER CLOSED AHEAD | 2,000 ft upstream |" in crew
    assert "| W21-5aR | RIGHT SHOULDER CLOSED AHEAD | 1,000 ft upstream |" in crew
    assert "W20-2" not in crew


def test_case_26_plan_keeps_the_table_6b_1_series(
    api: TestClient,  # noqa: F811
) -> None:
    """Q2 = A: a Case 26 plan (CDOT 65 -> 60) is #344's, untouched here."""
    advance = _post(api, "/render/audit", CASE_26_BODY).json()["sections"]["advance"]
    rows = {r["Position"]: r for r in advance["sign_table"]}
    assert _distance(rows["A (nearest)"]) == 1000
    assert rows["B (middle)"]["Code"] == "W20-2"
    assert _distance(rows["C (furthest)"]) == 5140
    assert _distance(rows["A2 (second W21-5aR)"]) == 750


def test_validator_flags_a_case_11_sign_set_short() -> None:
    """S2: each sign at least its Case 11 distance; W20-1 at Table 6B-1's
    5,140 ft is 60 ft short of Case 11's 5,200 ft."""
    params = ScenarioParams(
        speed_mph=75,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1000,
        is_divided=True,
    )
    placements = generate_shoulder_closure_divided(params)
    assert validate_advance_warning_signs(placements, params) == []
    taper_start = max(p.station_ft for p in placements if p.device_type == DeviceType.DRUM)
    moved = [
        DevicePlacement(p.device_type, taper_start + 5140.0, p.offset_ft, label=p.label)
        if p.label == "W20-1"
        else p
        for p in placements
    ]
    violations = validate_advance_warning_signs(moved, params)
    assert [v.rule_id for v in violations] == ["ADVANCE_SIGN_SPACING_OFF"]
    assert "W20-1 is 5140 ft" in violations[0].message
    assert violations[0].mutcd_section == "CDOT S-630-1 Sheet 7 Case 11"
