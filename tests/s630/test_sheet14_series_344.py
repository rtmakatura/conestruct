"""#344 — Case 26/27 freeway shoulder plans place the Sheet 14 series.

S-630-1 Sheet 14 Cases 26/27 (PDF p. 162; ``case_26.json``, ``case_27.json``)
put, from the start of the shoulder taper: the second W21-5aR (W7-3a) at
530 ft, the G20-5P / R2-1 group at 1,060 ft, the first W21-5aR (W16-2a) at
1,320 ft, R2-10 at 1,580 ft, W3-5 at 2,110 ft and W20-1 at 2,640 ft, with
no W20-2.  The plans used Table 6B-1, a midpoint rule and R2-10 at the work
zone + 500 ft, downstream of the taper.

Rule 11: the audit off ``/render/audit``, page 1 off ``/render/pdf`` and the
crew sheet off ``/render/markdown``, all through the real API.
"""

from __future__ import annotations

import re
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.generation.layout import (
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
)
from src.rules.devices import DeviceType
from src.rules.validators import (
    DevicePlacement,
    ScenarioParams,
    validate_advance_warning_signs,
)

from ._harness import CASE_26_BODY, CASE_27_BODY, _common
from .test_cross_surface import _pdf_text, _post, api  # noqa: F401  (``api`` is a fixture)

_UNDIVIDED_26 = {**CASE_26_BODY, "divided": False}
_SHEET_14_PLANS = [CASE_26_BODY, CASE_27_BODY, _UNDIVIDED_26]
_IDS = ["case-26", "case-27", "case-26-undivided"]

# Sheet 14, from the taper start (the issue's table).
_SHEET_14 = {
    "Furthest (Sheet 14)": ("W20-1", 2640),
    "R2-10 (Sheet 14)": ("R2-10", 1580),
    "First W21-5aR (Sheet 14)": ("W21-5aR", 1320),
    "Second W21-5aR (Sheet 14)": ("W21-5aR", 530),
}


def _distance(row: dict[str, str]) -> int:
    return int(row["Distance from Taper (ft)"].split()[0].replace(",", ""))


@pytest.mark.parametrize("scenario", _SHEET_14_PLANS, ids=_IDS)
def test_audit_places_the_sheet_14_distances(
    scenario: dict[str, Any],
    api: TestClient,  # noqa: F811
) -> None:
    audit = _post(api, "/render/audit", scenario).json()
    advance = audit["sections"]["advance"]
    rows = {r["Position"]: r for r in advance["sign_table"]}
    for position, (code, ft) in _SHEET_14.items():
        assert rows[position]["Code"] == code
        assert _distance(rows[position]) == ft
    speed_group = {
        r["Code"]: _distance(r)
        for r in advance["sign_table"]
        if r["Position"] == "Speed limit group (Sheet 14)"
    }
    assert speed_group == {"G20-5P": 1060, "R2-1": 1060}
    w3_5 = [r for r in advance["sign_table"] if r["Code"].startswith("W3-5")]
    assert [_distance(r) for r in w3_5] == [2110]
    codes = {r["Code"] for r in advance["sign_table"]}
    assert "W20-2" not in codes
    assert "W5-1" not in codes
    case = "Case 26" if scenario["speed"] == 65 else "Case 27"
    assert advance["source"] == f"CDOT S-630-1 Sheet 14 {case}"
    # The validator scores the plan on Sheet 14, so the typical it cites
    # raises no Table 6B-1 spacing warning.
    assert audit["plan_flags"]["validation_warnings"] == 0
    # S3: the Fines Double envelope starts at Sheet 14's R2-10.
    env = audit["sections"]["fines_double"]["envelope"]
    w20_1_station = int(rows["Furthest (Sheet 14)"]["Station (ft)"].replace(",", ""))
    taper_start = w20_1_station - 2640
    assert abs(env["r2_10_station_ft"] - (taper_start + 1580)) <= 1
    assert abs(env["entrance_r2_1_station_ft"] - (taper_start + 1060)) <= 1


@pytest.mark.parametrize("scenario", _SHEET_14_PLANS, ids=_IDS)
def test_page1_and_crew_sheet_print_the_same_distances(
    scenario: dict[str, Any],
    api: TestClient,  # noqa: F811
) -> None:
    page1 = " ".join(_pdf_text(_post(api, "/render/pdf", scenario).content)[0].split())
    # The text layer may run the code into its legend ("W21-5aRRIGHT").
    assert re.search(r"W21-5aR ?RIGHT SHOULDER CLOSED AHEAD 530 ft", page1)
    assert re.search(r"W21-5aR ?RIGHT SHOULDER CLOSED AHEAD 1320 ft", page1)
    assert re.search(r"R2-10 ?BEGIN DOUBLE FINES ZONE 1580 ft", page1)
    assert "W20-2" not in page1
    crew = _post(api, "/render/markdown", scenario).text
    assert "| W20-1 | ROAD WORK AHEAD | 2,640 ft upstream |" in crew
    assert "| W21-5aR | RIGHT SHOULDER CLOSED AHEAD | 1,320 ft upstream |" in crew
    assert "| W21-5aR | RIGHT SHOULDER CLOSED AHEAD | 530 ft upstream |" in crew
    assert "W20-2" not in crew


@pytest.mark.parametrize(
    "generate", [generate_shoulder_closure_divided, generate_shoulder_closure_undivided]
)
def test_fines_double_assemblies_clear_sheet_12_note_4(generate: Any) -> None:
    """S6: the first G20-5P / R2-6P sits at 795 ft, 265 ft from the second
    W21-5aR and the G20-5P / R2-1 group; the rest are at most 2,640 ft
    apart down to R2-11."""
    params = ScenarioParams(
        speed_mph=65,
        work_zone_speed_mph=60,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=5000,
        is_divided=generate is generate_shoulder_closure_divided,
    )
    placements = generate(params)
    taper_start = max(p.station_ft for p in placements if p.device_type == DeviceType.DRUM)
    assemblies = sorted(
        {round(p.station_ft, 3) for p in placements if p.label == "R2-6P"}, reverse=True
    )
    assert round(assemblies[0] - taper_start) == 795
    r2_11 = min(p.station_ft for p in placements if p.label == "R2-11")
    gaps = [a - b for a, b in zip(assemblies, [*assemblies[1:], r2_11], strict=True)]
    assert max(gaps) <= 2640.0


def test_validator_flags_a_sheet_14_sign_short() -> None:
    """S4: each sign at least its Sheet 14 distance; an R2-10 back at the
    pre-#344 work zone + 500 ft is downstream of the taper, so missing."""
    params = ScenarioParams(
        speed_mph=75,
        work_zone_speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1000,
        is_divided=True,
    )
    placements = generate_shoulder_closure_divided(params)
    assert validate_advance_warning_signs(placements, params) == []
    taper_start = max(p.station_ft for p in placements if p.device_type == DeviceType.DRUM)

    def _move(p: DevicePlacement) -> DevicePlacement:
        if p.label == "W20-1":
            return DevicePlacement(p.device_type, taper_start + 2500.0, p.offset_ft, label=p.label)
        if p.label == "R2-10":
            return DevicePlacement(p.device_type, 1500.0, p.offset_ft, label=p.label)
        return p

    violations = validate_advance_warning_signs([_move(p) for p in placements], params)
    assert [(v.rule_id, v.mutcd_section) for v in violations] == [
        ("ADVANCE_SIGN_SPACING_OFF", "CDOT S-630-1 Sheet 14 Case 27"),
        ("MISSING_ADVANCE_SIGN", "CDOT S-630-1 Sheet 14 Case 27"),
    ]
    assert "W20-1 is 2500 ft" in violations[0].message
    assert "No R2-10 upstream of the taper" in violations[1].message


@pytest.mark.parametrize(
    "scenario",
    [_common(65, 55), {**_common(65, 60), "roadType": "rural_divided"}],
    ids=["freeway-65-55-case-11", "rural-divided-65-60"],
)
def test_plans_outside_sheet_14_keep_r2_10_at_the_work_zone(
    scenario: dict[str, Any],
    api: TestClient,  # noqa: F811
) -> None:
    """S3: only Sheet 14 plans move R2-10; others keep work zone + 500 ft."""
    audit = _post(api, "/render/audit", scenario).json()
    env = audit["sections"]["fines_double"]["envelope"]
    assert env["r2_10_station_ft"] == scenario["workLen"] + 500.0
