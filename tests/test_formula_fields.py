"""#286 (R144 Q1/Q5): the audit's calculation sections carry their own display lines.

The panel (``conestruct/site/components/AuditTrail.tsx``) used to write the
taper label ("L/3"/"L"), the "B =" label, the device total (``nDrums + nCones``),
the sign count, the advance-sign citation and the flagger sight-distance line
itself.  Rule 3: the backend owns that, so each section now sends
``result_text`` (and ``formula_text`` where there is a formula) and the panel
renders them as received.  These tests pin the strings per kind, built
through the same generator + ``build_audit_trail`` path the endpoint uses.
"""

from __future__ import annotations

from typing import Any

from pydantic import TypeAdapter

from src.api.audit import (
    _CITATION_ADVANCE,
    _SEC_ADVANCE,
    _TBL_ADVANCE,
    build_audit_trail,
)
from src.api.schemas import Scenario, scenario_to_call
from src.generation.layout import generate_lane_closure_divided
from src.rules.validators import ScenarioParams

_ADAPTER: TypeAdapter[Scenario] = TypeAdapter(Scenario)

_META = {"project": "t", "address": "", "lat": 0.0, "lng": 0.0, "siteConditions": {}}


def _trail(body: dict[str, Any]) -> dict[str, Any]:
    params, generator, kwargs = scenario_to_call(_ADAPTER.validate_python(body))
    placements = generator(params, **kwargs)
    return build_audit_trail(placements, params, approaches=kwargs.get("approaches"))


def _shoulder(**over: Any) -> dict[str, Any]:
    # test_audit_endpoint.py's _shoulder_scenario: divided, 55 mph, 800 ft.
    return {
        "kind": "shoulder",
        "meta": _META,
        "roadType": "rural_divided",
        "speed": 55,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 800.0,
        "night": False,
        **over,
    }


def _flagger() -> dict[str, Any]:
    # tests/corpus/manifest.py's _FLAGGER_GRID_BASE.
    return {
        "kind": "flagger_lane_closure",
        "meta": _META,
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 11.0,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 1000.0,
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
    }


def _near() -> dict[str, Any]:
    # tests/corpus/test_near_intersection.py's _body.
    return {
        "kind": "near_intersection",
        "meta": _META,
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 300.0,
        "night": False,
        "approaches": [
            {
                "id": "cross_n",
                "speed": 30,
                "roadType": "urban_arterial",
                "lanesPerDirection": 1,
                "laneWidth": 12.0,
                "signalized": False,
                "bearingDeg": None,
                "alongStationFt": -60.0,
            }
        ],
    }


def _common(t: dict[str, Any]) -> None:
    """What every kind carries: the four results, consistent with the numbers."""
    taper, buffer, spacing, advance = t["taper"], t["buffer"], t["spacing"], t["advance"]
    assert buffer["result_text"] == f"B = {buffer['buffer_ft']:g} ft"
    assert "formula_text" not in buffer  # a table lookup; lookup_text is its line
    total = (
        spacing["n_taper_drums_required"]
        + spacing["n_tangent_cones_required"]
        + spacing.get("n_buffer_cones", 0)  # #333: a shoulder plan's buffer cones
    )
    assert spacing["result_text"].startswith(f"{total} devices · ")
    assert spacing["result_text"].endswith(" ft o.c.")
    assert spacing["formula_text"][:2] == [
        spacing["taper_count_text"],
        spacing["tangent_count_text"],
    ]
    # #333: a shoulder plan's buffer line sits between the tangent and the
    # downstream lines.
    rest = [spacing[k] for k in ("buffer_count_text", "downstream_count_text") if k in spacing]
    assert spacing["formula_text"][2:] == rest
    assert advance["result_text"] == f"{len(advance['sign_table'])} signs"
    assert advance["citation"] == _CITATION_ADVANCE
    assert "formula_text" not in advance  # a table lookup
    for line in taper["formula_text"]:
        assert " x " not in line  # the display glyph is "×"


def test_shoulder_closure_lines() -> None:
    t = _trail(_shoulder())
    _common(t)
    taper = t["taper"]
    assert taper["result_text"] == "L/3 = 183 ft"
    assert taper["formula_text"] == [
        "W = 10 ft (assumed)",  # #338 (Q1 = B)
        "L = 10 × 55 = 550 ft",
        "L/3 = 550 / 3 = 183 ft",
    ]
    assert t["spacing"]["result_text"].endswith("· 55/110 ft o.c.")


def test_low_speed_shoulder_quadratic_line() -> None:
    # test_audit_endpoint.py's _shoulder_urban25: the W x S^2 / 60 branch.
    t = _trail(
        _shoulder(roadType="urban_arterial", speed=25, workLen=400.0, divided=False, lanes=1)
    )
    _common(t)
    assert t["taper"]["formula_text"] == [
        "W = 8 ft (assumed)",  # #338 (Q1 = B)
        "L = 8 × 25^2 / 60 = 83 ft",
        "L/3 = 83 / 3 = 28 ft",
    ]
    assert t["taper"]["result_text"] == "L/3 = 28 ft"


def test_lane_closure_lines() -> None:
    # The lane closure is a gated kind (Rule 8), so it is built from
    # ScenarioParams, the way the flagger snapshot test builds its audit.
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
    )
    t = build_audit_trail(generate_lane_closure_divided(params), params)
    _common(t)
    assert t["taper"]["result_text"] == "L = 660 ft"
    assert t["taper"]["formula_text"] == ["L = 12 × 55 = 660 ft"]


def test_near_intersection_lines() -> None:
    t = _trail(_near())
    _common(t)
    assert t["taper"]["result_text"] == "L = 540 ft"
    assert t["taper"]["formula_text"] == ["L = 12 × 45 = 540 ft"]


def test_flagger_lines_and_sight_distance() -> None:
    t = _trail(_flagger())
    _common(t)
    assert t["taper"]["result_text"] == "L = 100 ft"
    assert t["spacing"]["result_text"].endswith("· 20/90 ft o.c.")
    fl = t["flagger"]
    assert fl["sight_distance_result_text"] == f"{fl['sight_distance_ft']} ft"
    # R144 Q5: the line is at the audit's own speed.
    assert fl["sight_distance_formula_text"] == [f"SSD @ 45 mph = {fl['sight_distance_ft']} ft"]


def test_sight_distance_lines_only_on_flagger() -> None:
    fl = _trail(_shoulder())["flagger"]
    assert "sight_distance_result_text" not in fl
    assert "sight_distance_formula_text" not in fl


def test_advance_citation_is_the_verified_pair() -> None:
    """Citation defect 20: the footer used to read "MUTCD § 6B-1", a section
    that doesn't exist.  Table 6B-1 (printed p. 773) and §6H.02 (printed
    p. 798), verified by subject in
    validation-artifacts/committed/phase4-380-arc/issue-286/citations.md."""
    assert (_SEC_ADVANCE, _TBL_ADVANCE) == ("6H.02", "6B-1")
    assert _CITATION_ADVANCE == {
        "cite": "MUTCD TABLE 6B-1",
        "footer": "MUTCD § 6H.02 · TABLE 6B-1 · ADVANCE WARNING SIGN SPACING",
    }
    assert "§ 6B-1" not in str(_CITATION_ADVANCE)
