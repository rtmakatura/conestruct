"""Engine-removal PR B — backend fields the frontend mirrors retire into.

Four additions, all additive to the audit projection:

  * ``sections.flagger.sight_distance_ft`` + ``sight_distance_citation``
    — the flagger station sight-distance value was 100% frontend-
    invented (AuditTrail.tsx carried its own copy of Table 6B-2 under a
    wrong-subject §6E.06 / nonexistent "Table 6E-1" citation).  Verified
    by SUBJECT against the local MUTCD 11th-ed PDF: §6D.06 "Flagger
    Stations" ¶03 (PDF p.22, MUTCD p.786) points to Table 6B-2 (PDF
    p.11, p.775).
  * ``sections.colorado.fail_count`` — the panel's "N of M FAIL" verdict
    was the last frontend-derived Colorado number.
  * ``sections.corridor_spec`` — the corridor-preview zone lengths.
  * ``POST /render/corridor-spec`` — the picker modal's preview source
    (D-full), gated-kind tolerant, explicit unmapped-road-type behavior.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from src.api.audit import build_audit_trail
from src.api.render_api import app
from src.generation.layout import generate_flagger_alternating_2lane
from src.rules.spacing import stopping_sight_distance_ft
from src.rules.tables import BUFFER_SPACE
from src.rules.validators import ScenarioParams


@pytest.fixture(scope="module", autouse=True)
def _set_render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def _auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-secret-do-not-deploy"}


def _shoulder_body(**overrides) -> dict:
    body = {
        "kind": "shoulder",
        "meta": {"project": "T", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": "rural_divided",
        "speed": 55,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 800.0,
        "night": False,
    }
    body.update(overrides)
    return body


def _flagger_params(**overrides) -> ScenarioParams:
    defaults = dict(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    defaults.update(overrides)
    return ScenarioParams(**defaults)


# ---------------------------------------------------------------------------
# stopping_sight_distance_ft — the single source the audit reads
# ---------------------------------------------------------------------------


def test_ssd_equals_table_6b2_across_the_full_speed_range() -> None:
    # Table 6B-2 (MUTCD 11th ed., PDF p.11): 115 @ 20 ... 820 @ 75.
    for row in BUFFER_SPACE:
        assert stopping_sight_distance_ft(row.speed_mph) == float(row.buffer_ft)


def test_ssd_rejects_off_table_speed() -> None:
    with pytest.raises(ValueError):
        stopping_sight_distance_ft(42)


# ---------------------------------------------------------------------------
# sections.flagger sight-distance fields
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("speed", [25, 35, 45, 55])
def test_flagger_section_carries_backend_sight_distance(speed: int) -> None:
    params = _flagger_params(speed_mph=speed)
    placements = generate_flagger_alternating_2lane(params)
    audit = build_audit_trail(placements, params)
    flagger = audit["flagger"]
    assert flagger["sight_distance_ft"] == stopping_sight_distance_ft(speed)
    assert flagger["sight_distance_citation"] == {
        "cite": "MUTCD § 6D.06",
        "footer": "MUTCD § 6D.06 · TABLE 6B-2 · STOPPING SIGHT DISTANCE",
    }


def test_flagger_citation_never_cites_the_retired_strings() -> None:
    # Edition guard, same posture as the #97 suite: §6E.06 is "Stop or
    # Yield Control Method" and "Table 6E-1" does not exist in the 11th
    # edition — neither may ever appear in these fields.
    params = _flagger_params()
    audit = build_audit_trail(generate_flagger_alternating_2lane(params), params)
    blob = str(audit["flagger"]["sight_distance_citation"])
    assert "6E.06" not in blob
    assert "6E-1" not in blob


def test_non_flagger_section_has_no_sight_distance_keys(client: TestClient) -> None:
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_body())
    assert res.status_code == 200
    flagger = res.json()["sections"]["flagger"]
    assert "sight_distance_ft" not in flagger
    assert "sight_distance_citation" not in flagger


# ---------------------------------------------------------------------------
# sections.colorado.fail_count
# ---------------------------------------------------------------------------


def test_colorado_fail_count_consistent_with_checks(client: TestClient) -> None:
    for body in (
        _shoulder_body(),
        _shoulder_body(workZoneSpeed=30),
        _shoulder_body(roadType="freeway", speed=75, workLen=1500.0),
    ):
        res = client.post("/render/audit", headers=_auth_headers(), json=body)
        assert res.status_code == 200
        co = res.json()["sections"]["colorado"]
        assert co["fail_count"] == sum(1 for c in co["checks"] if not c["pass"])
        assert co["all_pass"] == (co["fail_count"] == 0)


def test_colorado_fail_count_nonzero_when_a_check_fails() -> None:
    # A flagger scenario with a reduction but where the layout's W3-5
    # emission is what makes the check pass — instead force a fail via
    # the unit path: a divided shoulder scenario whose placements are
    # empty has 0 signs per side, failing the both-sides check.
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    audit = build_audit_trail([], params, shoulder_width_ft=10.0)
    co = audit["colorado"]
    assert co["fail_count"] >= 1
    assert co["fail_count"] == sum(1 for c in co["checks"] if not c["pass"])
    assert co["all_pass"] is False


# ---------------------------------------------------------------------------
# sections.corridor_spec
# ---------------------------------------------------------------------------


def test_corridor_spec_matches_the_audits_own_numbers(client: TestClient) -> None:
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_body())
    assert res.status_code == 200
    body = res.json()
    spec = body["sections"]["corridor_spec"]
    summary = body["summary"]
    # Single source: the spec's taper/buffer are the summary's values.
    assert spec["taper_ft"] == summary["taper_length_ft"]
    assert spec["buffer_ft"] == summary["buffer_space_ft"]
    # 55 mph rural_divided -> rural A/B/C = 500*3.
    assert spec["advance_warning_ft"] == 1500
    assert spec["road_category"] == "rural"
    assert spec["downstream_taper_ft"] > 0


def test_corridor_spec_present_for_flagger_with_100ft_taper() -> None:
    params = _flagger_params()
    audit = build_audit_trail(generate_flagger_alternating_2lane(params), params)
    spec = audit["corridor_spec"]
    assert spec["taper_ft"] == 100  # one-lane two-way taper, not L


# ---------------------------------------------------------------------------
# POST /render/corridor-spec
# ---------------------------------------------------------------------------


def test_corridor_spec_endpoint_shoulder(client: TestClient) -> None:
    res = client.post(
        "/render/corridor-spec",
        headers=_auth_headers(),
        json={"kind": "shoulder", "speed": 65, "shoulderWidth": 10.0, "roadType": "rural_divided"},
    )
    assert res.status_code == 200, res.text
    j = res.json()
    assert j["taper_ft"] == round(10.0 * 65 / 3)  # L/3 at >=45 mph
    assert j["buffer_ft"] == 645
    assert j["advance_warning_ft"] == 1500
    assert j["road_category"] == "rural"
    assert j["downstream_taper_ft"] == 100


def test_corridor_spec_endpoint_accepts_gated_kinds(client: TestClient) -> None:
    # Preview lengths, not a plan — the enablement gate deliberately
    # does not apply.
    res = client.post(
        "/render/corridor-spec",
        headers=_auth_headers(),
        json={"kind": "near_intersection", "speed": 35, "laneWidth": 12.0},
    )
    assert res.status_code == 200, res.text
    assert res.json()["taper_ft"] == round(12.0 * 35 * 35 / 60)  # full L, quadratic


def test_corridor_spec_endpoint_flagger_fixed_taper(client: TestClient) -> None:
    res = client.post(
        "/render/corridor-spec",
        headers=_auth_headers(),
        json={"kind": "flagger_lane_closure", "speed": 45},
    )
    assert res.status_code == 200
    assert res.json()["taper_ft"] == 100


def test_corridor_spec_endpoint_unmapped_road_type_degrades_explicitly(
    client: TestClient,
) -> None:
    # Unknown road type at 65 mph: category null, advance falls back to
    # the preview's documented "rural" guess — 200, never a 4xx/500
    # (the preview must not be more fragile than the plan).
    res = client.post(
        "/render/corridor-spec",
        headers=_auth_headers(),
        json={"kind": "shoulder", "speed": 65, "roadType": "cowpath"},
    )
    assert res.status_code == 200, res.text
    j = res.json()
    assert j["road_category"] is None
    assert j["advance_warning_ft"] == 1500  # rural fallback


def test_corridor_spec_endpoint_unknown_kind_422(client: TestClient) -> None:
    res = client.post(
        "/render/corridor-spec",
        headers=_auth_headers(),
        json={"kind": "hovercraft", "speed": 45},
    )
    assert res.status_code == 422


def test_corridor_spec_endpoint_requires_auth(client: TestClient) -> None:
    res = client.post("/render/corridor-spec", json={"kind": "shoulder", "speed": 45})
    assert res.status_code == 401
