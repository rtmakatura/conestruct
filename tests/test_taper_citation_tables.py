"""#229 — the taper section cites each MUTCD table for the claim it holds.

MUTCD 11th Ed. §6B.08, printed p. 775, verified by subject:

  Table 6B-3 "Taper Length Criteria for Temporary Traffic Control Zones"
      Merging Taper .............. at least L
      Shoulder Taper ............. at least 0.33 L
      Note: Use Table 6B-4 to calculate L
  Table 6B-4 "Formulas for Determining Taper Length"
      40 mph or less ............. L = WS^2 / 60
      45 mph or more ............. L = WS

So the ratio claims (L/3 for a shoulder, full L for a lane closure) belong
to Table 6B-3 and the L formula itself belongs to Table 6B-4.  Before
#229 every non-flagger ``source`` sentence attributed both to 6B-3.

These tests read the served audit (HTTP path for the near-intersection
kind, ``build_audit_trail`` for the shoulder kind — the same call the
#98 single-source test uses) and pin the split.  The values are asserted
byte-identical against the canonical spacing helpers so the fix is
proven to be citation-only.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from src.api import audit as audit_module
from src.rules.spacing import shoulder_taper_length, taper_length
from tests.corpus.test_near_intersection import _approach, _body


@pytest.fixture()
def client() -> TestClient:
    # Same shape as tests/test_audit_endpoint.py: the bearer middleware
    # fails closed without RENDER_API_SECRET, so pin it before the app
    # is touched.
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
    from src.api.render_api import app

    return TestClient(app)


@pytest.fixture()
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-secret-do-not-deploy"}


def _shoulder_trail(speed: int) -> dict:
    from src.generation.layout import generate_shoulder_closure_undivided
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=2,
        closure_type="shoulder",
        road_type="urban_low",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    placements = generate_shoulder_closure_undivided(params, shoulder_width_ft=8.0)
    return audit_module.build_audit_trail(placements, params)


def test_shoulder_source_cites_6b4_for_L_and_6b3_for_the_third() -> None:
    """Lakewood-control shape: 35 mph shoulder, L = WS^2/60 (Table 6B-4),
    required run L/3 (Table 6B-3 "Shoulder Taper at least 0.33 L")."""
    trail = _shoulder_trail(35)
    taper = trail["taper"]
    src = taper["source"]
    assert "Table 6B-4 (taper length L)" in src, src
    assert "L/3 per Sec 6B.08 (Table 6B-3)" in src, src
    assert src.count("6B-3") == 1 and src.count("6B-4") == 1, src
    # Values byte-identical to the canonical helpers — citation-only fix.
    assert taper["L_full_ft"] == audit_module._ft(taper_length(35, 8.0))
    assert taper["L_required_ft"] == audit_module._ft(shoulder_taper_length(35, 8.0))
    assert taper["L_required_ft"] == 54
    # The panel chip still names the ratio table (the acceptance keeps 6B-3).
    assert taper["citation"]["footer"].endswith("TABLE 6B-3")


def test_near_intersection_source_cites_6b4_for_L_and_6b3_for_full_L(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """Lane closure near an intersection: full merging taper L (Table 6B-3
    "Merging Taper at least L"), L itself from Table 6B-4."""
    body = _body(
        "issue-229-ni",
        speed=50,
        workLen=1000.0,
        approaches=[_approach(speed=25, alongStationFt=1150.0)],
    )
    res = client.post("/render/audit", headers=auth_headers, json=body)
    assert res.status_code == 200, res.text
    taper = res.json()["sections"]["taper"]
    src = taper["source"]
    assert "Table 6B-4 (taper length L)" in src, src
    assert "full merging taper length L (Table 6B-3)" in src, src
    assert src.count("6B-3") == 1 and src.count("6B-4") == 1, src
    assert taper["L_required_ft"] == audit_module._ft(taper_length(50, 12.0)) == 600


def test_flagger_source_is_untouched_by_229() -> None:
    """The flagger branch cites the §6B.08 50-100 ft band, no table — #229
    must not touch it."""
    from src.generation.layout import generate_flagger_alternating_2lane
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=35,
        num_lanes=2,
        closure_type="lane",
        road_type="urban_low",
        work_zone_length_ft=500.0,
        lane_width_ft=12.0,
        shoulder_width_ft=4.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    placements = generate_flagger_alternating_2lane(params)
    trail = audit_module.build_audit_trail(placements, params)
    src = trail["taper"]["source"]
    assert "6B-4" not in src and "6B-3" not in src, src
    assert "one-lane, two-way traffic" in src
