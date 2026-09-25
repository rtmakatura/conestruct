"""#290 — the work-start wire: ``meta.work``, ``meta.roadDirection``, the gate.

Rulings (validation-artifacts/committed/issue-290-pin-work/rulings.md):
the direction is derived from the road and the side, never typed (8); the
four-way heading with no confirmed road, left / median named and not built
(open-points 1, 2); one-way roads honoured (8, #298); side unset is the
needs-you state, never a guess (10).  Payload-level where the refusal lives
(Rule 11); the derivation asserted on the params the readers receive.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api import site_scan as ss
from src.rules import site_detection as sd
from src.rules.corridor import _destination_point

_TEST_SECRET = "test-secret-do-not-deploy"
PIN = (39.7400, -104.9600)
# A north-south road through the pin, vertex order south -> north.
ROAD = [list(_destination_point(*PIN, 180.0, 800.0)), list(_destination_point(*PIN, 0.0, 800.0))]


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    calls: list[int] = []

    def stub(*_a: Any, **_kw: Any) -> tuple[dict[str, Any], None]:
        calls.append(1)
        return {"elements": []}, None

    monkeypatch.setattr(sd, "_overpass_request_with_fallback", stub)
    ss.clear_memo()
    return calls


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}


def scenario(meta: dict[str, Any], kind: str = "shoulder", **over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "kind": kind,
        "meta": {"project": "s290", "address": "", "lat": PIN[0], "lng": PIN[1], **meta},
        "roadType": "urban_arterial",
        "speed": 35,
        "lanes": 2,
        "laneWidth": 12,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }
    base.update(over)
    return base


def refusal(client: TestClient, body: dict[str, Any]) -> str:
    res = client.post("/render/device-breakdown", headers=AUTH, json=body)
    assert res.status_code == 400, res.text[:300]
    detail = res.json()["detail"]
    assert detail["error"] == "pin_model_input"
    return str(detail["message"])


# ---------------------------------------------------------------------------
# The gate
# ---------------------------------------------------------------------------


def test_corridor_end_never_carries_the_work_start_inputs(client: TestClient) -> None:
    msg = refusal(client, scenario({"bearingDeg": 180.0, "work": {"side": "right"}}))
    assert "work_start" in msg


def test_work_start_never_carries_a_typed_bearing(client: TestClient) -> None:
    body = scenario({"pinModel": "work_start", "bearingDeg": 0.0, "work": {"side": "right"}})
    assert "bearingDeg" in refusal(client, body)


@pytest.mark.parametrize("side", ["left", "median"])
def test_left_and_median_are_named_and_not_built(client: TestClient, side: str) -> None:
    body = scenario({"pinModel": "work_start", "work": {"side": side, "heading": "N"}})
    assert repr(side) in refusal(client, body)


@pytest.mark.parametrize(
    "work",
    [
        {"side": "right"},  # a confirmed road needs travel
        {"side": "right", "heading": "N"},  # heading is for no road
        {"side": "right", "travel": "with_geometry", "heading": "N"},  # both
    ],
)
def test_a_confirmed_road_decides_with_travel_only(client: TestClient, work: dict) -> None:
    body = scenario({"pinModel": "work_start", "centerline": ROAD, "work": work})
    assert "meta.work.travel" in refusal(client, body)


@pytest.mark.parametrize(
    "work",
    [
        {"side": "right"},  # no road needs heading
        {"side": "right", "travel": "with_geometry"},  # travel needs a road
    ],
)
def test_no_road_decides_with_the_heading_only(client: TestClient, work: dict) -> None:
    body = scenario({"pinModel": "work_start", "work": work})
    assert "meta.work.heading" in refusal(client, body)


def test_a_one_way_road_is_honoured(client: TestClient) -> None:
    """#298's shape: the road is one-way northbound (vertex order), and the
    choice says traffic runs against it."""
    body = scenario(
        {
            "pinModel": "work_start",
            "centerline": ROAD,
            "roadDirection": {"osmBearingDeg": 0.0, "oneway": "yes"},
            "work": {"side": "right", "travel": "against_geometry"},
        }
    )
    assert "one-way" in refusal(client, body)


def test_side_unset_is_the_needs_you_state_not_a_refusal(
    client: TestClient, _no_network: list[int]
) -> None:
    """Ruling 10: the counts still answer (no side moves them); nothing
    directional is laid; the scan the request asked for reports an honest
    not-run instead of scanning a guessed corridor."""
    body = scenario({"pinModel": "work_start"}, site_scan={})
    res = client.post("/render/device-breakdown", headers=AUTH, json=body)
    assert res.status_code == 200, res.text[:300]
    assert res.json()["total_devices"] > 0
    audit = client.post("/render/audit", headers=AUTH, json=body)
    assert audit.status_code == 200, audit.text[:300]
    assert audit.json()["sections"]["site_scan"]["status"] == "not_run"
    assert _no_network == []


# ---------------------------------------------------------------------------
# The derivation, on the params every reader receives
# ---------------------------------------------------------------------------


def _params(meta: dict[str, Any]) -> Any:
    from pydantic import TypeAdapter

    from src.api.schemas import Scenario, scenario_to_call

    parsed = TypeAdapter(Scenario).validate_python(scenario(meta))
    params, _gen, _kw = scenario_to_call(parsed)
    return params


def test_the_heading_sets_the_direction_with_no_road() -> None:
    p = _params({"pinModel": "work_start", "work": {"side": "right", "heading": "E"}})
    assert p.pin_model == "work_start"
    assert p.bearing_deg == 90.0


def test_the_road_and_the_travel_choice_set_it_with_one() -> None:
    w = _params(
        {
            "pinModel": "work_start",
            "centerline": ROAD,
            "work": {"side": "right", "travel": "with_geometry"},
        }
    )
    a = _params(
        {
            "pinModel": "work_start",
            "centerline": ROAD,
            "work": {"side": "right", "travel": "against_geometry"},
        }
    )
    assert abs(((w.bearing_deg - 0.0 + 540) % 360) - 180) < 0.01
    assert abs(((a.bearing_deg - 180.0 + 540) % 360) - 180) < 0.01


def test_side_unset_derives_nothing() -> None:
    p = _params({"pinModel": "work_start"})
    assert p.pin_model == "work_start"
    assert p.bearing_deg is None


def test_corridor_end_is_untouched() -> None:
    p = _params({"bearingDeg": 123.0})
    assert p.pin_model == "corridor_end"
    assert p.bearing_deg == 123.0
