"""Option C increment 1 — the near_intersection data model (Refs #117).

Three contracts pinned here, all schema/data-layer (the kind is GATED:
no renderer, narrative, audit, or frontend work exists; the generator
landed in increment 2 and is covered by test_near_intersection_generator
and the corpus tier):

  * ``NearIntersectionScenario`` validates with the documented bounds
    and rejects out-of-scope inputs with clean 422s (rule 10): work
    inside the intersection, divided mainlines, duplicate or reserved
    approach ids, out-of-grid speeds.
  * The render API answers a schema-valid near_intersection body with
    the standard gated-kind 400.  Since increment 2 the kind has a
    generator bridge — ``scenario_to_call`` returns it (pinned below);
    unbridged kinds still fail loudly in the bridge's final guard.
  * ``DevicePlacement.approach_id`` defaults to ``"mainline"`` and the
    taper extraction partitions on it: cross-street channelizers can
    never stitch into (or be mistaken for) the mainline merging taper,
    and for all-mainline lists the partition is the identity.
"""

from __future__ import annotations

import dataclasses

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError

from src.api.schemas import (
    WORK_LEN_MAX_FT,
    NearIntersectionScenario,
    Scenario,
    scenario_to_call,
)
from src.generation.layout import generate_near_intersection, generate_shoulder_closure_undivided
from src.rules.devices import DeviceType
from src.rules.validators import (
    DevicePlacement,
    ScenarioParams,
    _extract_taper_indices,
)

_SECRET = "test-secret-do-not-deploy"

_ADAPTER: TypeAdapter[Scenario] = TypeAdapter(Scenario)

_META = {
    "project": "near-intersection-inc1",
    "address": "",
    "lat": 0.0,
    "lng": 0.0,
    "siteConditions": {},
}


def _approach(**overrides) -> dict:
    base = {
        "id": "cross_n",
        "speed": 30,
        "roadType": "urban_arterial",
        "lanesPerDirection": 1,
        "laneWidth": 12.0,
        "signalized": False,
        "bearingDeg": None,
        # Downstream of the work zone → near-side work (Fig. 6P-21).
        "alongStationFt": -60.0,
    }
    return {**base, **overrides}


def _body(**overrides) -> dict:
    base = {
        "kind": "near_intersection",
        "meta": _META,
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "approaches": [_approach()],
    }
    return {**base, **overrides}


# ---------------------------------------------------------------------------
# Schema: accepts
# ---------------------------------------------------------------------------


def test_valid_near_side_body_parses() -> None:
    scenario = _ADAPTER.validate_python(_body())
    assert isinstance(scenario, NearIntersectionScenario)
    assert scenario.kind == "near_intersection"
    assert scenario.approaches[0].id == "cross_n"


def test_valid_far_side_and_two_approaches_parse() -> None:
    # Intersection upstream of the work zone (> workLen) → far-side
    # work; both legs of one cross street share alongStationFt.
    scenario = _ADAPTER.validate_python(
        _body(
            approaches=[
                _approach(id="cross_n", alongStationFt=700.0),
                _approach(id="cross_s", alongStationFt=700.0, speed=20),
            ]
        )
    )
    assert isinstance(scenario, NearIntersectionScenario)
    assert [a.id for a in scenario.approaches] == ["cross_n", "cross_s"]


# ---------------------------------------------------------------------------
# Schema: clean 422s (rule 10)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("overrides", "match"),
    [
        ({"speed": 60}, "less_than_equal"),
        ({"speed": 80}, "less_than_equal"),
        ({"lanes": 5}, "less_than_equal"),
        ({"workLen": WORK_LEN_MAX_FT + 0.1}, "less_than_equal"),
        ({"roadType": "freeway"}, "literal_error"),
    ],
    ids=["speed-60", "speed-80", "lanes-5", "worklen-cap", "freeway"],
)
def test_mainline_bounds_reject(overrides: dict, match: str) -> None:
    with pytest.raises(ValidationError) as exc_info:
        _ADAPTER.validate_python(_body(**overrides))
    assert any(e["type"] == match for e in exc_info.value.errors())


@pytest.mark.parametrize(
    ("approach_overrides", "match"),
    [
        ({"speed": 15}, "greater_than_equal"),  # Table 6B-2 floor is 20
        ({"speed": 60}, "less_than_equal"),
        ({"speed": 42}, "multiple_of"),
        ({"lanesPerDirection": 5}, "less_than_equal"),
        ({"laneWidth": 8.0}, "greater_than_equal"),
        ({"id": "mainline"}, "value_error"),  # reserved, model validator
        ({"id": "Cross-1"}, "string_pattern_mismatch"),
        ({"alongStationFt": WORK_LEN_MAX_FT + 1}, "less_than_equal"),
        ({"alongStationFt": float("inf")}, "less_than_equal"),
        ({"alongStationFt": -WORK_LEN_MAX_FT - 1}, "greater_than_equal"),
        ({"roadType": "freeway"}, "literal_error"),
    ],
    ids=[
        "speed-15",
        "speed-60",
        "speed-off-grid",
        "lanes-5",
        "lanewidth-8",
        "id-mainline-reserved",
        "id-pattern",
        "alongstation-over-cap",
        "alongstation-infinity",
        "alongstation-under-cap",
        "roadtype-freeway",
    ],
)
def test_approach_bounds_reject(approach_overrides: dict, match: str) -> None:
    with pytest.raises(ValidationError) as exc_info:
        _ADAPTER.validate_python(_body(approaches=[_approach(**approach_overrides)]))
    assert any(e["type"] == match for e in exc_info.value.errors())


def test_zero_and_three_approaches_reject() -> None:
    with pytest.raises(ValidationError):
        _ADAPTER.validate_python(_body(approaches=[]))
    with pytest.raises(ValidationError):
        _ADAPTER.validate_python(
            _body(
                approaches=[
                    _approach(id="cross_a"),
                    _approach(id="cross_b"),
                    _approach(id="cross_c"),
                ]
            )
        )


def test_duplicate_approach_ids_reject() -> None:
    with pytest.raises(ValidationError, match="approach ids must be unique"):
        _ADAPTER.validate_python(
            _body(approaches=[_approach(id="cross_n"), _approach(id="cross_n")])
        )


def test_divided_mainline_rejects() -> None:
    with pytest.raises(ValidationError, match="divided intersections are not supported"):
        _ADAPTER.validate_python(_body(divided=True))


@pytest.mark.parametrize("along", [0.0, 250.0, 500.0], ids=["at-zero", "inside", "at-worklen"])
def test_intersection_inside_work_zone_rejects(along: float) -> None:
    # In-intersection work (Figures 6P-26/27) is out of Phase 1 scope:
    # a clean 422 naming the figures, never a silently-wrong plan.
    with pytest.raises(ValidationError, match="6P-26/27"):
        _ADAPTER.validate_python(_body(approaches=[_approach(alongStationFt=along)]))


def test_drawable_width_bound_applies_to_mainline_only() -> None:
    # 4 lanes x 14 ft + 8 ft shoulder = 64 ft > 52 ft drawable → reject.
    with pytest.raises(ValidationError, match="drawable half-road"):
        _ADAPTER.validate_python(_body(lanes=4, laneWidth=14.0))
    # The same widths on an approach are fine: the cross street is never
    # drawn under Option C (the sheet cites the plate).
    scenario = _ADAPTER.validate_python(
        _body(approaches=[_approach(lanesPerDirection=4, laneWidth=14.0)])
    )
    assert isinstance(scenario, NearIntersectionScenario)


# ---------------------------------------------------------------------------
# Gate + bridge
# ---------------------------------------------------------------------------


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("RENDER_API_SECRET", _SECRET)
    from src.api.render_api import app

    return TestClient(app, raise_server_exceptions=False)


def test_render_pdf_near_intersection_is_gated_400(client: TestClient) -> None:
    res = client.post(
        "/render/pdf",
        headers={"Authorization": f"Bearer {_SECRET}"},
        json=_body(),
    )
    assert res.status_code == 400, res.text
    assert "not yet available" in res.json()["detail"]


def test_scenario_to_call_bridges_near_intersection() -> None:
    # Increment 2 (Refs #117): the kind now has a generator bridge —
    # mainline params carry near_intersection=True (so the flagger
    # predicate can never claim the undivided lane closure) and the
    # approaches ride kwargs as ApproachParams with road types mapped
    # to the Table 6B-1 vocabulary.  The HTTP gate still 400s the kind
    # (test above); this pins the internal call path.
    scenario = _ADAPTER.validate_python(_body())
    params, generator, kwargs = scenario_to_call(scenario)
    assert generator is generate_near_intersection
    assert params.closure_type == "lane"
    assert params.is_divided is False
    assert params.near_intersection is True
    assert params.road_type == "urban_high"  # 45 mph urban_arterial
    (ap,) = kwargs["approaches"]
    assert ap.id == "cross_n"
    assert ap.speed_mph == 30
    assert ap.road_type == "urban_low"  # 30 mph urban_arterial
    assert ap.along_station_ft == -60.0


# ---------------------------------------------------------------------------
# DevicePlacement.approach_id + taper partition
# ---------------------------------------------------------------------------


def test_device_placement_defaults_to_mainline() -> None:
    p = DevicePlacement(DeviceType.CONE, 100.0, 6.0, "test")
    assert p.approach_id == "mainline"


def _shoulder_placements() -> list[DevicePlacement]:
    params = ScenarioParams(
        speed_mph=45,
        num_lanes=1,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=8.0,
    )
    return generate_shoulder_closure_undivided(params)


def test_taper_extraction_identity_for_all_mainline_lists() -> None:
    # Every placement a current generator emits is mainline, so the
    # partition must be the identity: same indices as the unpartitioned
    # extraction would find (pinned by construction — a real taper run
    # exists and is found).
    placements = _shoulder_placements()
    assert all(p.approach_id == "mainline" for p in placements)
    taper = _extract_taper_indices(placements)
    assert taper, "expected a merging/shoulder taper run in generator output"
    # Same result when the mainline filter is applied externally —
    # proves the internal partition selects exactly this set.
    explicit = [p for p in placements if p.approach_id == "mainline"]
    assert [placements[i] for i in taper] == [explicit[i] for i in _extract_taper_indices(explicit)]


def test_cross_street_channelizers_cannot_stitch_into_mainline_taper() -> None:
    placements = _shoulder_placements()
    baseline = _extract_taper_indices(placements)
    baseline_devices = [placements[i] for i in baseline]

    # Inject a LONGER monotonic channelizer run in a cross-street frame,
    # interleaved through the mainline taper's station range.  Pre-
    # partition, station-sorting would mix the frames and either stitch
    # runs or prefer the longer foreign run; post-partition the mainline
    # result must be unchanged.
    lo = min(placements[i].station_ft for i in baseline)
    hi = max(placements[i].station_ft for i in baseline)
    span = hi - lo
    n_cross = len(baseline) + 4
    cross = [
        DevicePlacement(
            DeviceType.CONE,
            lo + span * (k + 0.5) / n_cross,
            2.0 * k,
            "cross-street cone",
            approach_id="cross_n",
        )
        for k in range(n_cross)
    ]
    injected = placements + cross
    result = _extract_taper_indices(injected)
    assert [injected[i] for i in result] == baseline_devices
    assert all(injected[i].approach_id == "mainline" for i in result)


def test_existing_positional_construction_unaffected() -> None:
    # The field is appended after ``label``: 4-arg positional
    # construction (every existing call site's widest form) and
    # dataclasses.replace both keep working.
    p = DevicePlacement(DeviceType.CONE, 50.0, 3.0, None)
    assert p.approach_id == "mainline"
    q = dataclasses.replace(p, approach_id="cross_n")
    assert (q.station_ft, q.approach_id) == (50.0, "cross_n")
