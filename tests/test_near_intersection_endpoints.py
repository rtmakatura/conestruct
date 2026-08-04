"""Every render endpoint serves the near_intersection kind (#117).

The increment-3 builders were built honest — render_plan_sheet,
generate_crew_narrative(_pdf), and build_audit_trail all REQUIRE the
ApproachParams list the generator got and raise rather than render a
partial document without it (rule 10).  The endpoint wiring was
deliberately deferred while the kind was gated, so before this fix
/render/pdf, /render/markdown, /render/crew-pdf, /render/audit, and
/render/audit-pdf all 500'd on a near_intersection scenario the moment
the gate opened.  ``_placements_for`` now returns the approaches
alongside the placements and every consumer threads them through.

Endpoint-level with the kind monkeypatched on, like
test_lane_confidence_block.py: proves the surfaces are live the day the
gate flips.
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


@pytest.mark.parametrize(
    ("endpoint", "content_type"),
    [
        ("/render/pdf", "application/pdf"),
        ("/render/markdown", "text/markdown"),
        ("/render/crew-pdf", "application/pdf"),
        ("/render/xlsx", "application/vnd"),
        ("/render/audit", "application/json"),
        ("/render/audit-pdf", "application/pdf"),
        ("/render/device-breakdown", "application/json"),
    ],
)
def test_endpoint_serves_near_intersection(client, endpoint, content_type):
    resp = client.post(endpoint, json=_ni_body(), headers=AUTH)
    assert resp.status_code == 200, (endpoint, resp.json() if resp.status_code != 200 else "")
    assert resp.headers["content-type"].startswith(content_type)


def test_quote_breakdown_serves_near_intersection(client):
    # Wrapped request model: {"scenario": ..., "settings"?: ...}.
    resp = client.post("/render/quote-breakdown", json={"scenario": _ni_body()}, headers=AUTH)
    assert resp.status_code == 200, resp.json() if resp.status_code != 200 else ""


def test_replication_snapshot_serves_near_intersection(client):
    resp = client.post("/render/replication-snapshot", json={"scenario": _ni_body()}, headers=AUTH)
    assert resp.status_code == 200, resp.text if resp.status_code != 200 else ""
    assert "Cross-Street Signs" in resp.text


def test_audit_carries_the_approaches_section(client):
    """The served audit includes the per-approach section — the builder
    got the real ApproachParams, not a silently-omitted None."""
    resp = client.post("/render/audit", json=_ni_body(), headers=AUTH)
    assert resp.status_code == 200
    audit = resp.json()
    assert "approaches" in audit["sections"]
    assert audit["sections"]["approaches"]["approaches"], "per-approach rows must be present"


def test_crew_narrative_carries_the_cross_street_section(client):
    """The served narrative renders the per-approach cross-street signs."""
    resp = client.post("/render/markdown", json=_ni_body(), headers=AUTH)
    assert resp.status_code == 200
    text = resp.text
    assert "Cross-Street Signs" in text
