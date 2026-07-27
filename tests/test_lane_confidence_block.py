"""Lane-count consistency gate + caution (issue #120, Ruling B).

OSM's ``lanes`` counts turn pockets at intersection approaches, so the
detected lane count is least trustworthy exactly where the
near_intersection kind works.  Detection relays the raw parsed lane tags
(``detectedLanesTotal`` / ``…Forward`` / ``…Backward`` / ``…BothWays``);
the ONE predicate — ``lanes_arithmetic_mismatch`` in schemas.py — fires
when total, forward, and backward all exist and
``total != forward + backward + both_ways``.  The both_ways term is
load-bearing: a correctly tagged center-turn-lane road (TWLTL) has
``lanes = forward + backward + lanes:both_ways``, and a Denver-metro
Overpass survey (2026-07-27) showed dropping the term would flag 13.3%
of fully-lane-tagged ways (almost all correct TWLTL tagging) vs 1.28%
genuine defects with it.

Ruling B splits the consequence by blast radius:

  * ``near_intersection`` approaches — honest 400 at the
    ``_placements_for`` chokepoint (the #136/#158 rails), recovery via
    the form's "Lane count is right" confirm, which clears the relays.
    The kind is still gated OFF (``ENABLED_SCENARIOS``); these tests
    monkeypatch it on, proving the gate is live the day the kind
    enables (implementation precedes enablement, per the ruling).
  * everywhere else — a NON-blocking "verify lane count" item on the
    audit's ``pending_verification`` rollup (single emission point in
    ``audit_projection``), flipping ``plan_flags.is_clean``.

Endpoint-level like test_oneway_flagger_block.py: 400s are proven on
the real mounted endpoints (a 422 is swallowed by the Next.js proxy to
a generic 502 and never shown).
"""

from __future__ import annotations

import copy

import pytest
from fastapi.testclient import TestClient

import src.api.render_api as render_api
from src.api.render_api import app
from src.api.schemas import lanes_arithmetic_mismatch
from tests.test_plan_sheet_device_summary import FLAGGER_BODY, SHOULDER_BODY

AUTH = {"Authorization": "Bearer test-secret"}

_META = {
    "project": "lane-confidence-120",
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
        "alongStationFt": -60.0,
    }
    return {**base, **overrides}


def _ni_body(**approach_overrides) -> dict:
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
        # Must clear the 540-ft merging taper at 45 mph — the geometry
        # validator runs at the same chokepoint as the gate.
        "workLen": 700.0,
        "night": False,
        "approaches": [_approach(**approach_overrides)],
    }


# The East Colfax defect from the Denver survey: lanes=2 but
# lanes:forward=1 + lanes:backward=2 — the map data disputes itself.
MISMATCH_RELAYS = {
    "detectedLanesTotal": 2,
    "detectedLanesForward": 1,
    "detectedLanesBackward": 2,
}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def ni_enabled(monkeypatch):
    """Enable the near_intersection kind so requests reach the gate.

    The kind is gated off in production (#117 enablement pending); the
    #120 gate must already be armed when the flag flips, so these tests
    run against the enabled state.
    """
    monkeypatch.setattr(
        render_api,
        "ENABLED_SCENARIOS",
        frozenset({"shoulder", "flagger_lane_closure", "near_intersection"}),
    )


# ---------------------------------------------------------------------------
# The predicate — one definition, exercised directly
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("total", "fwd", "bwd", "bw", "expected"),
    [
        # Genuine defects (all from the Denver survey residue).
        (2, 1, 2, None, True),  # East Colfax
        (8, 2, 4, None, True),  # Federal Blvd
        (7, 2, 3, 1, True),  # mismatch even after both_ways
        # Correct tagging never fires.
        (4, 2, 2, None, False),
        (3, 1, 1, 1, False),  # classic TWLTL — both_ways honored
        (5, 2, 2, 1, False),
        # Indeterminate (any of the three required tags absent) never
        # fires — the omitted-relay case (#136/#158 principle).
        (None, 1, 2, None, False),
        (3, None, 1, None, False),
        (3, 1, None, None, False),
        (None, None, None, None, False),
    ],
)
def test_lanes_arithmetic_mismatch(total, fwd, bwd, bw, expected) -> None:
    assert lanes_arithmetic_mismatch(total, fwd, bwd, bw) is expected


# ---------------------------------------------------------------------------
# The hard gate — near_intersection approaches (400)
# ---------------------------------------------------------------------------


def test_mismatched_approach_blocked_400(client: TestClient, ni_enabled) -> None:
    """A self-contradicting approach lane relay is refused, and the
    remedy names the recovery control that actually exists on the form
    ("Lane count is right", NearIntersectionForm)."""
    resp = client.post("/render/pdf", json=_ni_body(**MISMATCH_RELAYS), headers=AUTH)
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert "contradict" in detail
    assert "Lane count is right" in detail


def test_mismatched_approach_blocks_device_breakdown_too(client: TestClient, ni_enabled) -> None:
    """The StatusBar path blocks identically — the gate lives at the
    shared _placements_for chokepoint, not one endpoint."""
    resp = client.post("/render/device-breakdown", json=_ni_body(**MISMATCH_RELAYS), headers=AUTH)
    assert resp.status_code == 400, resp.text
    assert "contradict" in resp.json()["detail"]


def test_second_approach_mismatch_also_blocked(client: TestClient, ni_enabled) -> None:
    """Every approach is checked, not just the first."""
    body = _ni_body()
    body["approaches"] = [
        _approach(id="cross_n", alongStationFt=900.0),
        _approach(id="cross_s", alongStationFt=900.0, **MISMATCH_RELAYS),
    ]
    resp = client.post("/render/device-breakdown", json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text


@pytest.mark.parametrize(
    "relays",
    [
        {},  # no detection signal — manual entry unaffected
        {  # consistent tagging
            "detectedLanesTotal": 4,
            "detectedLanesForward": 2,
            "detectedLanesBackward": 2,
        },
        {  # TWLTL: total = fwd + bwd + both_ways — must NOT block
            "detectedLanesTotal": 3,
            "detectedLanesForward": 1,
            "detectedLanesBackward": 1,
            "detectedLanesBothWays": 1,
        },
    ],
)
def test_consistent_or_omitted_relays_pass_the_gate(client: TestClient, ni_enabled, relays) -> None:
    resp = client.post("/render/device-breakdown", json=_ni_body(**relays), headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_gated_kind_400_still_first_without_enablement(
    client: TestClient,
) -> None:
    """Without the enablement patch the standard gated-kind 400 answers
    first — pinning that this file's other tests genuinely needed the
    monkeypatch to reach the confidence gate."""
    resp = client.post("/render/pdf", json=_ni_body(**MISMATCH_RELAYS), headers=AUTH)
    assert resp.status_code == 400, resp.text
    assert "not yet available" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# The caution — enabled kinds are NEVER blocked, the audit discloses
# ---------------------------------------------------------------------------


def _item_kinds(projection: dict) -> list[str]:
    return [i["kind"] for i in projection.get("pending_verification", {}).get("items", [])]


def test_shoulder_mismatch_renders_but_audit_cautions(
    client: TestClient,
) -> None:
    """The non-blocking half of Ruling B: same predicate, same relays —
    the plan still renders, and the audit says so out loud."""
    body = {**copy.deepcopy(SHOULDER_BODY), **MISMATCH_RELAYS}
    assert client.post("/render/pdf", json=body, headers=AUTH).status_code == 200

    audit = client.post("/render/audit", json=body, headers=AUTH)
    assert audit.status_code == 200, audit.text
    projection = audit.json()
    assert "lane_count_low_confidence" in _item_kinds(projection)
    assert projection["plan_flags"]["is_clean"] is False
    assert projection["plan_flags"]["v1_limitations"] >= 1


def test_flagger_mismatch_audit_cautions(client: TestClient) -> None:
    body = {**copy.deepcopy(FLAGGER_BODY), **MISMATCH_RELAYS}
    assert client.post("/render/pdf", json=body, headers=AUTH).status_code == 200
    audit = client.post("/render/audit", json=body, headers=AUTH)
    assert audit.status_code == 200, audit.text
    assert "lane_count_low_confidence" in _item_kinds(audit.json())


@pytest.mark.parametrize(
    "relays",
    [
        {},  # no relays — the pre-#120 baseline stays byte-identical
        {  # TWLTL-consistent — trustworthy tagging stays caution-free
            "detectedLanesTotal": 3,
            "detectedLanesForward": 1,
            "detectedLanesBackward": 1,
            "detectedLanesBothWays": 1,
        },
    ],
)
def test_no_caution_without_mismatch(client: TestClient, relays) -> None:
    body = {**copy.deepcopy(SHOULDER_BODY), **relays}
    audit = client.post("/render/audit", json=body, headers=AUTH)
    assert audit.status_code == 200, audit.text
    assert "lane_count_low_confidence" not in _item_kinds(audit.json())
