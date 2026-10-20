"""#355 — a non-freeway 65->60 / 75->65 shoulder plan doesn't cite Sheet 14.

S-630-1 Sheet 14 (PDF p. 162) is titled "Shoulder Work - Freeway/Expressway"
(Cases 26/27), so its 570/650 ft buffer floors belong to that road class.  A
shoulder plan on any other road takes MUTCD Table 6B-2 at the posted speed
(645 / 820 ft) and the Case 11 reduced-speed routing (rulings R1, R3).

Rule 11: the audit off ``/render/audit``, the crew sheet off
``/render/markdown`` and page 1 off ``/render/pdf``, through the real
producers; plus a sentinel that every scenario buffer call passes the road
class (R4).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from ._harness import CASE_26_BODY, CASE_27_BODY, _common
from .test_cross_surface import _pdf_text, _post, api  # noqa: F401  (``api`` is a fixture)

_ROADS = [
    {"roadType": "rural_divided", "divided": True},
    {"roadType": "rural_undivided", "divided": False},
    {"roadType": "urban_arterial", "divided": False},
]
_STEPDOWNS = [(65, 60, 645), (75, 65, 820)]
_PLANS = [
    pytest.param({**_common(speed, wz), **road}, built, id=f"{road['roadType']}-{speed}-{wz}")
    for road in _ROADS
    for speed, wz, built in _STEPDOWNS
]
_SHEET_14 = re.compile(r"Case 2[67]\b(?! step-down)|Sheet 14")


@pytest.mark.parametrize(("scenario", "built_ft"), _PLANS)
def test_audit_cites_no_sheet_14_case(
    api: TestClient,  # noqa: F811
    scenario: dict[str, Any],
    built_ft: int,
) -> None:
    sec = _post(api, "/render/audit", scenario).json()["sections"]
    buf = sec["buffer"]
    assert buf["buffer_ft"] == built_ft
    assert sec["corridor_spec"]["buffer_ft"] == built_ft
    assert "divergence" not in buf and "cdot_value_ft" not in buf
    assert "Table 6B-2" in buf["source"] and "Sheet 14" not in buf["source"]
    # The lookup names Sheet 14 only to say why it doesn't apply.
    assert "freeway or expressway and this road is neither" in buf["lookup_text"]
    for text in (sec["taper"]["cdot_reference"], sec["case"]["case"]):
        assert "Case 11" in text and not _SHEET_14.search(text), text
    assert "Sheet 14 draws Cases 26/27 for freeway/expressway only" in sec["case"]["narrative"]
    assert sec["case"]["narrative_2"].startswith(
        "CDOT S-630-1 draws no reduced-speed shoulder typical for this road."
    )
    assert "trigger_condition" not in sec["case"]
    rules = {v.get("rule_id") for v in sec["geometry_validation"].get("violations", [])}
    assert "BUFFER_TOO_SHORT" not in rules


@pytest.mark.parametrize(("scenario", "built_ft"), _PLANS)
def test_crew_sheet_and_page_one_cite_no_sheet_14_case(
    api: TestClient,  # noqa: F811
    scenario: dict[str, Any],
    built_ft: int,
) -> None:
    crew = _post(api, "/render/markdown", scenario).text
    assert "## Trigger Condition" not in crew
    assert "OF TRAVEL WAY" not in crew
    assert not _SHEET_14.search(crew)
    page_one = _pdf_text(_post(api, "/render/pdf", scenario).content)[0]
    assert not _SHEET_14.search(page_one)


@pytest.mark.parametrize(
    ("scenario", "built_ft"), [(CASE_26_BODY, 570), (CASE_27_BODY, 650)], ids=["case-26", "case-27"]
)
def test_freeway_step_down_keeps_sheet_14(
    api: TestClient,  # noqa: F811
    scenario: dict[str, Any],
    built_ft: int,
) -> None:
    sec = _post(api, "/render/audit", scenario).json()["sections"]
    assert sec["buffer"]["buffer_ft"] == built_ft
    assert "Sheet 14" in sec["buffer"]["source"]
    assert "trigger_condition" in sec["case"]
    assert "## Trigger Condition" in _post(api, "/render/markdown", scenario).text


def test_the_predicates_follow_the_road_class() -> None:
    from src.rules.spacing import _is_cdot_minimum, buffer_space, off_class_stepdown

    for road in ("rural", "urban_high", "urban_low"):
        assert buffer_space(65, "CDOT", 60, road_type=road, closure_type="shoulder") == 645.0
        assert buffer_space(75, "CDOT", 65, road_type=road, closure_type="shoulder") == 820.0
        assert not _is_cdot_minimum("CDOT", 65, 60, road_type=road, closure_type="shoulder")
        assert off_class_stepdown("CDOT", 65, 60, road, "shoulder")
        assert not off_class_stepdown("CDOT", 65, 55, road, "shoulder")
        assert not off_class_stepdown("federal", 65, 60, road, "shoulder")
        # R2: a lane closure keeps the speed-only lookup in this arc.
        assert buffer_space(65, "CDOT", 60, road_type=road, closure_type="lane") == 570.0
    for road in ("freeway", "expressway"):
        assert buffer_space(65, "CDOT", 60, road_type=road, closure_type="shoulder") == 570.0
        assert _is_cdot_minimum("CDOT", 75, 65, road_type=road, closure_type="shoulder")
        assert not off_class_stepdown("CDOT", 65, 60, road, "shoulder")


def test_every_scenario_buffer_call_passes_the_road_class() -> None:
    """R4 sentinel: a call that sizes a scenario's buffer (it passes the
    work-zone speed) must pass the road class too, or it borrows Sheet 14."""
    src = Path(__file__).resolve().parents[2] / "src"
    missing = []
    for path in src.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for m in re.finditer(r"(?<![\w.])(buffer_space|_is_cdot_minimum)\(", text):
            depth, i = 1, m.end()
            while depth:
                depth += {"(": 1, ")": -1}.get(text[i], 0)
                i += 1
            call = text[m.end() : i - 1]
            if "work_zone_speed" in call and not re.search(r"closure_type|\*\*_road_class", call):
                line = text.count("\n", 0, m.start()) + 1
                missing.append(f"{path.relative_to(src)}:{line}")
    assert missing == []
