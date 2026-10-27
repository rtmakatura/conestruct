"""#409: a plan generated on the starting work-zone length says so in the audit.

The frontend relays ``guesses.work_length`` while the length is still the
session's start and the operator never entered one (``workLenIsDefault``).
The backend owns the start (``WORK_LEN_START_FT``, CHOSEN), checks the
claim against it and the plan's length, and records the length as
defaulted, not confirmed.  No relay, no record: byte-identical.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api import render_api
from src.api.schemas import WORK_LEN_START_FT
from src.rendering.audit_blocks import _input_guesses_blocks
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}


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


def shoulder(work_len: float, guesses: dict[str, Any] | None) -> dict[str, Any]:
    b: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "s409", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": "rural_divided",
        "speed": 65,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": work_len,
        "night": False,
    }
    if guesses is not None:
        b["guesses"] = guesses
    return b


DEFAULTED = {"work_length": {"startFt": 1000}}
RECORD = {
    "field": "work_length",
    "value": 1000.0,
    "label": "1,000 ft",
    "source": "default",
    "evidence": "nobody entered a length for this plan",
    "operator_confirmed": False,
}


def test_the_start_is_the_frontends() -> None:
    # The mirror: conestruct/site/lib/scenarios/index.ts DEFAULT_SHOULDER.workLen.
    assert WORK_LEN_START_FT == 1000.0


def test_a_defaulted_length_is_recorded_in_the_audit(client: TestClient) -> None:
    r = client.post("/render/audit", headers=AUTH, json=shoulder(1000, DEFAULTED))
    assert r.status_code == 200, r.text
    assert r.json()["input_guesses"] == [RECORD]


def test_an_entered_length_is_not_recorded(client: TestClient) -> None:
    # The operator entered 1,000 ft themselves: no relay, no record.
    out = client.post("/render/audit", headers=AUTH, json=shoulder(1000, None)).json()
    assert "input_guesses" not in out


def test_the_default_does_not_touch_the_rest_of_the_audit(client: TestClient) -> None:
    plain = client.post("/render/audit", headers=AUTH, json=shoulder(1000, None)).json()
    marked = client.post("/render/audit", headers=AUTH, json=shoulder(1000, DEFAULTED)).json()
    assert marked.pop("input_guesses") == [RECORD]
    assert marked == plain


def test_it_sits_after_the_guesses(client: TestClient) -> None:
    body = shoulder(
        1000, {**DEFAULTED, "road_type": {"highwayClass": "trunk", "urban": False, "divided": True}}
    )
    out = client.post("/render/audit", headers=AUTH, json=body).json()
    assert [g["field"] for g in out["input_guesses"]] == ["road_type", "work_length"]


def test_a_length_that_moved_is_refused(client: TestClient) -> None:
    r = client.post("/render/audit", headers=AUTH, json=shoulder(800, DEFAULTED))
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "guess_stale"
    assert r.json()["detail"]["message"] == (
        "The work zone length is marked as the starting length, but this plan "
        "carries another length. Enter the work zone length, then generate again."
    )


def test_a_start_the_backend_does_not_know_is_refused(client: TestClient) -> None:
    r = client.post(
        "/render/audit",
        headers=AUTH,
        json=shoulder(500, {"work_length": {"startFt": 500}}),
    )
    assert r.status_code == 400
    assert "isn't the tool's (1,000 ft)" in r.json()["detail"]["message"]


def test_the_audit_pdf_route_takes_it(client: TestClient) -> None:
    r = client.post("/render/audit-pdf", headers=AUTH, json=shoulder(1000, DEFAULTED))
    assert r.status_code == 200, r.text[:300]
    assert r.content[:4] == b"%PDF"


def test_the_audit_pdf_line() -> None:
    blocks = repr(_input_guesses_blocks([RECORD]))
    assert "Defaulted inputs" in blocks
    assert (
        "Work zone length: 1,000 ft. Defaulted to the tool's starting length "
        "(nobody entered a length for this plan). The operator did not confirm it. "
        "Confirm the work zone length on site." in blocks
    )
    assert "Guessed from" not in blocks


def test_the_heading_with_guesses_and_a_default() -> None:
    guess = {
        "field": "road_type",
        "value": "rural_divided",
        "label": "Rural, divided",
        "source": "road_places",
        "evidence": "OSM highway=trunk; rural, inferred from nearby places",
        "operator_confirmed": False,
    }
    both = repr(_input_guesses_blocks([guess, RECORD]))
    assert "Guessed and defaulted inputs" in both
    assert "Road type: Rural, divided. Guessed from the road and nearby places" in both
    only_guess = repr(_input_guesses_blocks([guess]))
    assert "Guessed inputs" in only_guess
    assert "efaulted" not in only_guess
