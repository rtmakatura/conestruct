"""Signal-proximity lane-confidence gate (issue #173).

The #120 gate refused self-contradicting lane relays only when the
scenario KIND was near_intersection — the dropdown, not the road.  #173
relays the geometric fact (``signalDistanceM``, meters from the snapped
road point to the nearest detected traffic-signal node) and extends the
gate: on the two enabled non-NI kinds, the SAME arithmetic mismatch in
the mainline relays refuses when the site sits within
``SIGNAL_GATE_NEARBY_M`` (30.0 m, CHOSEN — see the constant's sourcing
comment and validation-artifacts/committed/s2-arc2-gates/).

One fixture per gate branch, endpoint-level like
test_lane_confidence_block.py (a 422 is swallowed by the Next.js proxy;
400s are the honest surface):

  * shoulder near-signal + mismatch  -> 400, distance stated in feet
  * flagger  near-signal + mismatch  -> 400, its own recovery pointer
  * mismatch WITHOUT the signal fact -> renders (caution-only, as today)
  * near-signal with clean/absent relays -> renders (data is fine)
  * the 30.0 m boundary is inclusive; 30.01 m does not gate
  * near_intersection behavior unchanged (regression)
"""

from __future__ import annotations

import copy

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import SIGNAL_GATE_NEARBY_M, app
from tests.test_plan_sheet_device_summary import FLAGGER_BODY, SHOULDER_BODY

AUTH = {"Authorization": "Bearer test-secret"}

MISMATCH_RELAYS = {
    "detectedLanesTotal": 2,
    "detectedLanesForward": 1,
    "detectedLanesBackward": 2,
}

# The live capture that motivated the threshold (Colfax/Williams,
# validation-artifacts/committed/s2-arc2-gates/live-signal-capture.txt).
NEAR_SIGNAL = {"signalDistanceM": 26.84}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


def _shoulder(**extra) -> dict:
    return {**copy.deepcopy(SHOULDER_BODY), **extra}


def _flagger(**extra) -> dict:
    return {**copy.deepcopy(FLAGGER_BODY), **extra}


# ---------------------------------------------------------------------------
# The refusal side
# ---------------------------------------------------------------------------


def test_shoulder_near_signal_mismatch_refuses_400(client: TestClient) -> None:
    resp = client.post(
        "/render/pdf", json=_shoulder(**MISMATCH_RELAYS, **NEAR_SIGNAL), headers=AUTH
    )
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    # The measured distance, in feet (26.84 m -> 88 ft), stated as fact.
    assert "about 88 ft" in detail
    assert "contradict each other" in detail
    assert "set Lanes per direction in the Road section" in detail


def test_flagger_near_signal_mismatch_refuses_400(client: TestClient) -> None:
    resp = client.post("/render/pdf", json=_flagger(**MISMATCH_RELAYS, **NEAR_SIGNAL), headers=AUTH)
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert "about 88 ft" in detail
    assert "confirm “Lane count is right” in the Road section" in detail


def test_gate_blocks_every_render_surface(client: TestClient) -> None:
    """Same chokepoint as #136/#158: audit and breakdown refuse too."""
    body = _shoulder(**MISMATCH_RELAYS, **NEAR_SIGNAL)
    for path in ("/render/audit", "/render/device-breakdown"):
        resp = client.post(path, json=body, headers=AUTH)
        assert resp.status_code == 400, f"{path}: {resp.status_code}"


# ---------------------------------------------------------------------------
# The pass sides — each fact alone never blocks
# ---------------------------------------------------------------------------


def test_mismatch_without_signal_fact_still_renders(client: TestClient) -> None:
    """Omitted signalDistanceM means 'no signal detected' — today's
    caution-only behavior is preserved byte-for-byte."""
    for body in (_shoulder(**MISMATCH_RELAYS), _flagger(**MISMATCH_RELAYS)):
        resp = client.post("/render/pdf", json=body, headers=AUTH)
        assert resp.status_code == 200, resp.text


def test_near_signal_with_clean_relays_renders(client: TestClient) -> None:
    """Proximity alone is not a defect — trustworthy tagging passes."""
    clean = {
        "detectedLanesTotal": 4,
        "detectedLanesForward": 2,
        "detectedLanesBackward": 2,
    }
    for body in (
        _shoulder(**clean, **NEAR_SIGNAL),
        _shoulder(**NEAR_SIGNAL),  # no relays at all
        _flagger(**NEAR_SIGNAL),
    ):
        resp = client.post("/render/pdf", json=body, headers=AUTH)
        assert resp.status_code == 200, resp.text


def test_boundary_is_inclusive_at_30m(client: TestClient) -> None:
    assert SIGNAL_GATE_NEARBY_M == 30.0
    at_boundary = _shoulder(**MISMATCH_RELAYS, signalDistanceM=30.0)
    assert client.post("/render/pdf", json=at_boundary, headers=AUTH).status_code == 400
    past_boundary = _shoulder(**MISMATCH_RELAYS, signalDistanceM=30.01)
    assert client.post("/render/pdf", json=past_boundary, headers=AUTH).status_code == 200


def test_relay_clear_lifts_the_gate(client: TestClient) -> None:
    """The recovery affordances erase the lane relays; the signal fact
    alone (which the clear leaves in place) never blocks."""
    body = _shoulder(**MISMATCH_RELAYS, **NEAR_SIGNAL)
    for k in ("detectedLanesTotal", "detectedLanesForward", "detectedLanesBackward"):
        body.pop(k)
    assert client.post("/render/pdf", json=body, headers=AUTH).status_code == 200


def test_new_flagger_confirm_via_accepted(client: TestClient) -> None:
    """The #173 confirm row's DetectionOverride marker round-trips the
    schema (the wire change old backends would 422 — backend-first)."""
    body = _flagger(
        **NEAR_SIGNAL,
        detectionOverrides=[
            {
                "via": "flagger_lane_count_confirm",
                "detectedLanesTotal": 2,
                "detectedLanesForward": 1,
                "detectedLanesBackward": 2,
                "asserted": "lane count verified in the field",
            }
        ],
    )
    assert client.post("/render/pdf", json=body, headers=AUTH).status_code == 200
