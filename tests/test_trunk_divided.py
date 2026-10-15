"""#322: a near-intersection plan on a divided trunk road is planned as one
carriageway of a divided highway (#312's plan, R134), and the shoulder
kind on the same road is unchanged.

The fixture is the scenario the site sent for S Santa Fe Dr's trunk stretch
(39.69322, -104.99425; capture322.cjs), with the cross street and side
added (gen322.py).  The proxy's wire-only relay (centerline, roadDirection)
is applied here the way `withRelayedCenterline` applies it.
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
FIX = Path(__file__).parent / "fixtures" / "trunk_divided" / "santa_fe_ni.json"


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


def relayed(s: dict[str, Any]) -> dict[str, Any]:
    s = copy.deepcopy(s)
    cand = s["meta"]["confirmedRoad"]["candidate"]
    s["meta"]["centerline"] = cand["geometry"]
    s["meta"]["roadDirection"] = {
        "osmBearingDeg": cand["bearing"] % 360,
        "oneway": cand["tags"]["oneway"],
    }
    return s


def santa_fe(carriageway: bool = True) -> dict[str, Any]:
    s = relayed(json.loads(FIX.read_text(encoding="utf-8"))["scenario"])
    if not carriageway:
        s.pop("carriageway", None)  # what the site sent before #322
    return s


def note8(audit: dict[str, Any]) -> dict[str, Any]:
    return next(c for c in audit["sections"]["colorado"]["checks"] if "both sides" in c["label"])


def test_the_trunk_relay_makes_the_plan_divided(client: TestClient) -> None:
    out = client.post("/render/audit", headers=AUTH, json=santa_fe()).json()
    row = note8(out)
    assert row["label"] == "Signs on both sides of divided highway"
    assert row["detail"].startswith("Required: True. Signs placed: 9 left, 9 right.")


def test_without_the_relay_it_was_undivided(client: TestClient) -> None:
    out = client.post("/render/audit", headers=AUTH, json=santa_fe(carriageway=False)).json()
    assert note8(out)["detail"].startswith("Required: False. Signs placed: 0 left, 9 right.")


def test_a_shoulder_plan_on_the_trunk_is_unchanged_by_the_relay(client: TestClient) -> None:
    # The shoulder kind already read the trunk as divided by class
    # (`divided: true`); the carriageway relay now says the same.
    base = santa_fe()
    shoulder = {
        "kind": "shoulder",
        "meta": {k: v for k, v in base["meta"].items() if k not in ("intersection",)},
        "roadType": "urban_arterial",
        "speed": 55,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }
    with_relay = dict(shoulder, carriageway=base["carriageway"])
    a = client.post("/render/audit", headers=AUTH, json=shoulder).json()
    b = client.post("/render/audit", headers=AUTH, json=with_relay).json()
    assert a == b
    pa = client.post("/render/device-breakdown", headers=AUTH, json=shoulder).json()
    pb = client.post("/render/device-breakdown", headers=AUTH, json=with_relay).json()
    assert pa == pb
