"""Single-lane road eligibility gate (issue #136).

A genuinely single-lane road has no honest representation in the
per-direction ``lanes`` model (``lanes=1`` already means the classic
2-lane two-way road), so neither the flagger operation (TA-10 needs a lane
in each direction) nor the shoulder generator can draw or label it without
asserting a phantom second lane — a false statement on a field document
(rule 10).  Detection relays the raw OSM total via ``detectedLanesTotal``;
the backend refuses when that total is 1 on an undivided road.

These tests drive the real mounted endpoints (``/render/pdf`` and
``/render/device-breakdown`` — the latter is what backs the live StatusBar
"GENERATION BLOCKED") so the refusal is proven end to end, as a **400** (a
422 is swallowed by the Next.js proxy to a generic 502 and never shown).
"""

from __future__ import annotations

import copy

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from tests.test_plan_sheet_device_summary import FLAGGER_BODY, SHOULDER_BODY

AUTH = {"Authorization": "Bearer test-secret"}

# An undivided shoulder closure on the classic 2-lane two-way road
# (``lanes=1`` per direction) — the case the single-lane relay narrows.
UNDIVIDED_SHOULDER_BODY = {
    **copy.deepcopy(SHOULDER_BODY),
    "roadType": "rural_undivided",
    "divided": False,
    "lanes": 1,
    "laneWidth": 12.0,
}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# The block fires — flagger
# ---------------------------------------------------------------------------


def test_flagger_single_lane_detection_blocked_400(client: TestClient) -> None:
    body = copy.deepcopy(FLAGGER_BODY)
    body["detectedLanesTotal"] = 1
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert "single-lane road" in detail
    # The flagger remedy names the recovery control that actually exists on
    # the flagger form (issue #136 condition A/B) — never the lane-count
    # field the flagger form lacks.
    assert "lane in each direction" in detail
    assert "Road has one lane in each direction" in detail


def test_flagger_single_lane_blocks_device_breakdown_too(client: TestClient) -> None:
    """The StatusBar path (/render/device-breakdown) blocks identically —
    the gate lives at the shared chokepoint, not one endpoint."""
    body = copy.deepcopy(FLAGGER_BODY)
    body["detectedLanesTotal"] = 1
    resp = client.post("/render/device-breakdown", json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text
    assert "single-lane road" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# The block fires — shoulder (undivided)
# ---------------------------------------------------------------------------


def test_shoulder_undivided_single_lane_blocked_400(client: TestClient) -> None:
    body = copy.deepcopy(UNDIVIDED_SHOULDER_BODY)
    body["detectedLanesTotal"] = 1
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert "single-lane road" in detail
    # Shoulder remedy points at its existing "Lanes per direction" control.
    assert "set the lane count in the form" in detail


# ---------------------------------------------------------------------------
# The block does NOT fire — the cases it must not catch
# ---------------------------------------------------------------------------


def test_shoulder_divided_single_lane_not_blocked(client: TestClient) -> None:
    """On a divided road ``lanes`` is per-carriageway, so a detected total
    of 1 is a normal narrow divided road — never blocked."""
    body = copy.deepcopy(SHOULDER_BODY)  # divided=True
    body["detectedLanesTotal"] = 1
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_detected_two_lanes_renders(client: TestClient) -> None:
    """A genuine 2-lane road (detectedLanesTotal=2) renders normally."""
    body = copy.deepcopy(FLAGGER_BODY)
    body["detectedLanesTotal"] = 2
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_detected_lanes_omitted_renders(client: TestClient) -> None:
    """No detection signal (field omitted) never blocks — direct API
    callers and the pre-#136 wire are unaffected."""
    body = copy.deepcopy(FLAGGER_BODY)
    assert "detectedLanesTotal" not in body
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_manual_lane_count_lifts_block(client: TestClient) -> None:
    """The frontend clears detectedLanesTotal when the operator corrects
    the lane count.  A genuine 2-lane two-way road (lanes=1, no relay) must
    still render — the block keys on the relayed signal, never on lanes=1
    alone (which is the normal, valid 2-lane two-way road)."""
    body = copy.deepcopy(UNDIVIDED_SHOULDER_BODY)  # lanes=1, no detectedLanesTotal
    assert "detectedLanesTotal" not in body
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text
