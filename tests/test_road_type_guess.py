"""#291 (R148): the inferred road type is a guess, and the audit says so.

Urban/rural is read off nearby places, so a detected road type (every
class but motorway → freeway) is recorded in the audit as guessed, not
confirmed, on R108's pattern: the wire carries the raw facts, the backend
re-derives the road type from them, and a stale claim is a 400.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api import render_api
from src.api.schemas import road_type_from_facts
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


def shoulder(road_type: str, guess: dict[str, Any] | None) -> dict[str, Any]:
    b: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "s291", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": road_type,
        "speed": 25,
        "lanes": 1,
        "laneWidth": 11,
        "divided": road_type == "rural_divided",
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 500,
        "night": False,
    }
    if guess is not None:
        b["guesses"] = {"road_type": guess}
    return b


LOOKOUT = {"highwayClass": "tertiary", "urban": True, "divided": False}


def test_the_mapping() -> None:
    assert road_type_from_facts(True, False) == "urban_arterial"
    assert road_type_from_facts(True, True) == "urban_arterial"
    assert road_type_from_facts(False, True) == "rural_divided"
    assert road_type_from_facts(False, False) == "rural_undivided"


def test_lookout_mountains_urban_street_is_recorded_as_guessed(client: TestClient) -> None:
    out = client.post(
        "/render/audit", headers=AUTH, json=shoulder("urban_arterial", LOOKOUT)
    ).json()
    assert out["input_guesses"] == [
        {
            "field": "road_type",
            "value": "urban_arterial",
            "label": "Urban street",
            "source": "road_places",
            "evidence": "OSM highway=tertiary; urban, inferred from nearby places",
            "operator_confirmed": False,
        }
    ]


def test_a_road_type_that_no_longer_holds_the_guess_is_refused(client: TestClient) -> None:
    r = client.post("/render/audit", headers=AUTH, json=shoulder("rural_undivided", LOOKOUT))
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "guess_stale"
    assert "Road type is marked as guessed" in r.json()["detail"]["message"]


def test_no_guess_no_record(client: TestClient) -> None:
    out = client.post("/render/audit", headers=AUTH, json=shoulder("urban_arterial", None)).json()
    assert "input_guesses" not in out


def test_the_audit_pdf_line() -> None:
    blocks = repr(
        _input_guesses_blocks(
            [
                {
                    "field": "road_type",
                    "value": "urban_arterial",
                    "label": "Urban street",
                    "source": "road_places",
                    "evidence": "OSM highway=tertiary; urban, inferred from nearby places",
                    "operator_confirmed": False,
                }
            ]
        )
    )
    assert "Road type: Urban street. Guessed from the road and nearby places" in blocks
    assert "The operator did not confirm it." in blocks
    assert "Confirm on site whether the work is in an urban or rural setting." in blocks
