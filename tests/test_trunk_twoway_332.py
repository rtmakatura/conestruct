"""#332: a two-lane trunk highway (one two-way OSM way) is planned
undivided.  Before #332 the site read every trunk as divided, and the plan
drew a median with signs in it.

The scenario is the one the shoulder-work audit sent production for US 24
near Hartsel (39.02175, -105.79286; validation-artifacts/committed/
audit-shoulder/runs/hartsel-r-65/request.json), with the proxy's wire-only
relay (centerline, roadDirection) applied as `withRelayedCenterline` does.
"""

from __future__ import annotations

import copy
import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api import render_api
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
REQ = (
    Path(__file__).parent.parent
    / "validation-artifacts/committed/audit-shoulder/runs/hartsel-r-65/request.json"
)
# What classify.ts relays for this way after #332: the raw tag (absent) and class.
TWO_WAY_TRUNK = {
    "oneway": None,
    "highwayClass": "trunk",
    "twinDistanceM": None,
    "twinSearched": False,
}


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *a, **k: ({"elements": []}, None)
    )


@pytest.fixture()
def client() -> TestClient:
    return TestClient(render_api.app)


def us24(**over: Any) -> dict[str, Any]:
    s = copy.deepcopy(json.loads(REQ.read_text(encoding="utf-8"))["scenario"])
    s.pop("site_scan", None)
    cand = s["meta"]["confirmedRoad"]["candidate"]
    assert cand["highway_class"] == "trunk" and cand["tags"].get("oneway") is None
    s["meta"]["centerline"] = cand["geometry"]
    s["meta"]["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": None}
    s.update(over)
    return s


def note8(audit: dict[str, Any]) -> dict[str, Any]:
    return next(c for c in audit["sections"]["colorado"]["checks"] if "both sides" in c["label"])


def test_the_two_way_trunk_relay_plans_undivided(client: TestClient) -> None:
    body = us24(divided=False, roadType="rural_undivided", carriageway=TWO_WAY_TRUNK)
    a = client.post("/render/audit", headers=AUTH, json=body).json()
    assert a["summary"]["case_id"] == "Case 11: Shoulder closure on undivided highway"
    assert note8(a)["detail"].startswith("Required: False. Signs placed: 0 left,")
    assert a["sections"]["taper"]["shoulder_width_ft"] == 8.0
    # 65 mph: L = W*S = 8*65 = 520; L/3 = 173 (was 217 at the divided 10 ft).
    assert a["sections"]["taper"]["L_required_ft"] == 173


def test_the_verdict_outranks_a_stale_divided_flag(client: TestClient) -> None:
    stale = us24(divided=True, roadType="rural_divided", carriageway=TWO_WAY_TRUNK)
    fresh = us24(divided=False, roadType="rural_undivided", carriageway=TWO_WAY_TRUNK)
    a = client.post("/render/audit", headers=AUTH, json=stale).json()
    b = client.post("/render/audit", headers=AUTH, json=fresh).json()
    assert note8(a)["detail"] == note8(b)["detail"]
    assert a["summary"]["case_id"] == b["summary"]["case_id"]


def test_no_relay_keeps_the_scenarios_own_divided(client: TestClient) -> None:
    # A client that relays no facts (every request before #332) is unchanged.
    old = us24()
    assert old["divided"] is True and "carriageway" not in old
    a = client.post("/render/audit", headers=AUTH, json=old).json()
    assert a["summary"]["case_id"] == "Case 11: Shoulder closure on divided highway"
