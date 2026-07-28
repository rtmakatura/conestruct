"""Flagger multi-lane eligibility gate (issue #86).

TA-10 eligibility is geometric, not classificational (#86 ruling,
2026-07-27): the flagger typical applies where one through lane runs in
each direction, and no source draws a flagger-alternating typical for a
road with two or more lanes per direction — MUTCD §6N.11 routes those
roads to the merge-taper closure family.  A TA-10 plan on a detected
four-lane road is the wrong template, and its "2-Lane Undivided" title a
false road description on a field document (rule 10) — the #136 defect
in the opposite direction, so the #136 gate becomes two-sided here.

The ceiling (one definition: ``flagger_lane_ineligible_high`` in
src/api/schemas.py): total >= 4 refused unconditionally; total == 3
eligible only as a consistently decomposed TWLTL (1 forward + 1 backward
+ 1 both_ways); bare and inconsistent 3s refused.  Flagger only —
shoulder work on a multi-lane road is valid.

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


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


def _flagger_body(**relays) -> dict:
    return {**copy.deepcopy(FLAGGER_BODY), **relays}


# ---------------------------------------------------------------------------
# The block fires — above the ceiling
# ---------------------------------------------------------------------------


def test_flagger_four_lane_detection_blocked_400(client: TestClient) -> None:
    body = _flagger_body(detectedLanesTotal=4)
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert "more lanes than a flagger operation covers" in detail
    # The remedy names the recovery control that actually exists on the
    # flagger form (issue #86 affordance).
    assert "Road has one through lane in each direction" in detail


def test_flagger_four_lane_blocks_device_breakdown_too(client: TestClient) -> None:
    """The StatusBar path (/render/device-breakdown) blocks identically —
    the gate lives at the shared chokepoint, not one endpoint."""
    body = _flagger_body(detectedLanesTotal=4)
    resp = client.post("/render/device-breakdown", json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text
    assert "more lanes than a flagger operation covers" in resp.json()["detail"]


def test_flagger_bare_three_blocked(client: TestClient) -> None:
    """A bare total of 3 (no directional tags) cannot be told apart from a
    2+1 directional split — refused, with the confirm as the recovery."""
    body = _flagger_body(detectedLanesTotal=3)
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text
    assert "more lanes than a flagger operation covers" in resp.json()["detail"]


def test_flagger_directional_three_blocked(client: TestClient) -> None:
    """A 2+1 directional split has two through lanes one way — outside
    6P-10's shape."""
    body = _flagger_body(
        detectedLanesTotal=3,
        detectedLanesForward=2,
        detectedLanesBackward=1,
    )
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text


def test_flagger_inconsistent_three_blocked(client: TestClient) -> None:
    """1+1 with no both_ways term does not decompose to the total — the
    tags dispute themselves, so the TWLTL carve-out does not apply."""
    body = _flagger_body(
        detectedLanesTotal=3,
        detectedLanesForward=1,
        detectedLanesBackward=1,
    )
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text


# ---------------------------------------------------------------------------
# The block does NOT fire — the cases it must not catch
# ---------------------------------------------------------------------------


def test_flagger_twltl_three_renders(client: TestClient) -> None:
    """The one eligible 3: a consistently decomposed center-turn-lane road
    (1 forward + 1 backward + 1 both_ways).  The through movement is one
    lane per direction — within 6P-10's shape (#86 ruling)."""
    body = _flagger_body(
        detectedLanesTotal=3,
        detectedLanesForward=1,
        detectedLanesBackward=1,
        detectedLanesBothWays=1,
    )
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_flagger_detected_two_renders(client: TestClient) -> None:
    """The classic 2-lane two-way road stays eligible — the ceiling never
    touches total <= 2 (the low side of the gate is #136's, unchanged)."""
    body = _flagger_body(detectedLanesTotal=2)
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_flagger_omitted_relays_render(client: TestClient) -> None:
    """No detection signal never blocks — direct API callers and manual
    entry are unaffected (the #136/#158 principle)."""
    body = _flagger_body()
    assert "detectedLanesTotal" not in body
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_shoulder_four_lane_not_blocked(client: TestClient) -> None:
    """The high side is flagger-only — shoulder work on a multi-lane road
    is valid and keeps rendering."""
    body = {**copy.deepcopy(SHOULDER_BODY), "detectedLanesTotal": 4}
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text
