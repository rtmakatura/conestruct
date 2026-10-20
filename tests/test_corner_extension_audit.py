"""#358 — a near-side plan that runs to the corner has no downstream taper.

When the standard reopening does not fit before the intersection, the
near-side layout runs the closure on to the upstream curb line
(``near_intersection_stations(...)["extend_to_corner"]``).  The served
audit used to call that corner cone a 48 ft "Downstream taper" with
"1 cones".  Rule 10: an absent taper renders as absent; Rule 11: the test
reads the served /render/audit payload.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import src.api.render_api as render_api
from src.api.render_api import app
from tests.test_lane_confidence_block import _ni_body

AUTH = {"Authorization": "Bearer test-secret"}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture(autouse=True)
def ni_enabled(monkeypatch):
    monkeypatch.setattr(
        render_api,
        "ENABLED_SCENARIOS",
        frozenset({"shoulder", "flagger_lane_closure", "near_intersection"}),
    )


@pytest.fixture()
def client():
    return TestClient(app)


def _spacing(client: TestClient, body: dict) -> dict:
    resp = client.post("/render/audit", json=body, headers=AUTH)
    assert resp.status_code == 200
    return resp.json()["sections"]["spacing"]


def _bill_cone_count(client: TestClient, body: dict) -> int:
    # The quote's equipment lines: the device bill the XLSX also prints.
    resp = client.post("/render/quote-breakdown", json={"scenario": body}, headers=AUTH)
    assert resp.status_code == 200
    return sum(
        int(line["qty"]) for line in resp.json()["equipment_lines"] if line["device_type"] == "CONE"
    )


def test_corner_extension_is_not_a_downstream_taper(client):
    # _ni_body(): near side, alongStationFt -60 -> the upstream curb is
    # 48 ft past the work zone, too short for the taper + END signs.
    sp = _spacing(client, _ni_body())
    lines = sp["formula_text"]
    assert not any("Downstream taper" in line for line in lines)
    assert "downstream_count_text" not in sp
    assert "n_downstream_taper_cones" not in sp
    assert sp["corner_count_text"] == lines[-1]
    assert sp["corner_count_text"].startswith(
        "Corner extension: 48 ft past the work zone to the upstream curb line -> 1 cone "
    )


def test_corner_line_total_equals_the_placed_cones(client):
    body = _ni_body()
    sp = _spacing(client, body)
    total = sp["n_cones_placed_total"]
    assert sp["corner_count_text"].endswith(f"= {total} cones total")
    assert sp["n_corner_extension_cones"] == 1
    assert total == _bill_cone_count(client, body)


def test_midblock_near_side_keeps_its_downstream_taper(client):
    # Far enough from the corner that the taper + END signs fit: the plan
    # draws the real 50 ft downstream taper and the line stays as it was.
    body = _ni_body()
    body["approaches"][0]["alongStationFt"] = -400.0
    sp = _spacing(client, body)
    assert "corner_count_text" not in sp
    assert sp["downstream_count_text"].startswith(
        "Downstream taper: 50 ft at ~25 ft spacing -> 2 cones "
    )
