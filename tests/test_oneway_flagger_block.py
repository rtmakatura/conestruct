"""One-way flagger directionality gate (issue #158).

A flagger operation (TA-10) alternates traffic through a single open lane
between two OPPOSING directions.  On a one-way road there is no opposing
direction to hold, so the generated plan would station a flagger directing
traffic that isn't there — a wrong template on a field document (rule 10).
Detection folds the OSM ``oneway`` tag into ``divided``/``roadType`` for
classification, so the raw tag is relayed separately via ``scenario.oneway``;
the backend refuses the one-directional values (``yes``/``-1``/``reversible``).

The #136 lane gate (``detectedLanesTotal == 1``) only caught one-way roads
incidentally when they were also single-lane; a one-way MULTI-lane road (the
Broadway/Civic Center demo pin: ``lanes=5, oneway=yes``) sailed through and
rendered a full opposing-direction TA-10.  This gate closes that gap.

These tests drive the real mounted endpoints (``/render/pdf`` and
``/render/device-breakdown`` — the latter backs the live StatusBar
"GENERATION BLOCKED") so the refusal is proven end to end, as a **400** (a
422 is swallowed by the Next.js proxy to a generic 502 and never shown).
"""

from __future__ import annotations

import copy

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from tests.test_plan_sheet_device_summary import FLAGGER_BODY

AUTH = {"Authorization": "Bearer test-secret"}

# The Broadway/Civic Center demo pin (39.7389, -104.9862) as detection relays
# it: a 5-lane one-way arterial.  This is the exact config the standing
# BLOCKED.md caution barred from flagger demos until #158 shipped.
BROADWAY_ONEWAY_MULTILANE = {
    **copy.deepcopy(FLAGGER_BODY),
    "oneway": "yes",
    "detectedLanesTotal": 5,
}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# The block fires — one-way flagger
# ---------------------------------------------------------------------------


def test_oneway_multilane_flagger_blocked_400(client: TestClient) -> None:
    """The Broadway pin (5-lane one-way) is refused — the case #136's
    single-lane gate could never catch (detectedLanesTotal != 1)."""
    resp = client.post("/render/pdf", json=BROADWAY_ONEWAY_MULTILANE, headers=AUTH)
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert "one-way street" in detail
    # The remedy names the recovery control that actually exists on the
    # flagger form (issue #158 affordance a).
    assert "Road carries two-way traffic" in detail


def test_oneway_flagger_blocks_device_breakdown_too(client: TestClient) -> None:
    """The StatusBar path (/render/device-breakdown) blocks identically —
    the gate lives at the shared chokepoint, not one endpoint."""
    resp = client.post("/render/device-breakdown", json=BROADWAY_ONEWAY_MULTILANE, headers=AUTH)
    assert resp.status_code == 400, resp.text
    assert "one-way street" in resp.json()["detail"]


@pytest.mark.parametrize("tag", ["yes", "-1", "reversible"])
def test_all_one_directional_tags_blocked(client: TestClient, tag: str) -> None:
    """Every OSM value that means one-directional is refused: ``yes``,
    ``-1`` (digitized against travel direction), and ``reversible``
    (direction alternates by time of day — never a steady two-way road a
    flagger could hold)."""
    body = copy.deepcopy(FLAGGER_BODY)
    body["oneway"] = tag
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text
    assert "one-way street" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# The block does NOT fire — the cases it must not catch
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("tag", ["no", None])
def test_two_way_and_no_signal_render(client: TestClient, tag) -> None:
    """``no`` (explicitly two-way) and omitted (no detection signal) both
    render — direct API callers and manual entry are unaffected."""
    body = copy.deepcopy(FLAGGER_BODY)
    if tag is not None:
        body["oneway"] = tag
    else:
        assert "oneway" not in body
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_two_way_multilane_renders(client: TestClient) -> None:
    """A genuine two-way multi-lane road (the corrected-detection case)
    renders normally once oneway is cleared."""
    body = copy.deepcopy(FLAGGER_BODY)
    body["oneway"] = "no"
    body["detectedLanesTotal"] = 2
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_shoulder_oneway_not_blocked(client: TestClient) -> None:
    """Shoulder work on a one-way road is valid — it keeps traffic in its
    own lane and models no opposing-direction control, so the directionality
    gate never touches it (issue #158 scope decision)."""
    from tests.test_plan_sheet_device_summary import SHOULDER_BODY

    body = copy.deepcopy(SHOULDER_BODY)
    body["oneway"] = "yes"
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text
