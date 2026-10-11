"""R123 Q2 (#301) -- a speed the operator chose from the road-class estimate.

Authority: validation-artifacts/committed/issue-301-picker-pieces/rulings.md.

R123 Q2: "Move the road-class speed estimate to WHAT's Speed row as a ⚠ line,
and keep a "Use N mph" button there. Nothing is prefilled; the operator's
click sets it, and the audit records the speed as estimated from the road
class and chosen by the operator."

The relay-fact pattern of R110 Q1 (tests/test_r108_guesses.py): the wire
carries the road's OSM ``highway`` tag (``speed_estimate``), the backend maps
it (``src/rules/speed_estimate.py``, mirrored by classify.ts and held equal
here), a stale record is an honest 400, and no record is byte-identical.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.rendering.audit_blocks import audit_to_blocks
from src.rules.speed_estimate import SPEED_BY_HIGHWAY, speed_estimate_from_highway

_TS = (
    Path(__file__).resolve().parent.parent
    / "conestruct"
    / "site"
    / "lib"
    / "road-detection"
    / "classify.ts"
)


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def _auth() -> dict[str, str]:
    return {"Authorization": "Bearer test-secret-do-not-deploy"}


def _body(**over: Any) -> dict[str, Any]:
    """An urban arterial shoulder plan with no pin: nothing leaves the process."""
    body: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "T", "address": ""},
        "roadType": "urban_arterial",
        "speed": 25,
        "lanes": 1,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
    }
    body.update(over)
    return body


def _estimated() -> dict[str, Any]:
    # residential estimates 25 mph; the operator pressed "Use 25 mph".
    return _body(speed=25, speed_estimate={"highwayClass": "residential"})


def test_the_frontend_table_mirrors_the_backend_table() -> None:
    m = re.search(
        r"const SPEED_BY_CLASS: Record<string, number> = \{(.*?)\};",
        _TS.read_text(encoding="utf-8"),
        re.S,
    )
    assert m, "SPEED_BY_CLASS not found in classify.ts"
    ts = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", m.group(1))}
    assert ts == SPEED_BY_HIGHWAY


def test_the_table_answers_by_class() -> None:
    assert speed_estimate_from_highway("residential") == 25
    assert speed_estimate_from_highway("primary") == 45
    assert speed_estimate_from_highway("footway") is None


def test_no_record_means_no_input_estimates_key(client: TestClient) -> None:
    res = client.post("/render/audit", json=_body(), headers=_auth())
    assert res.status_code == 200, res.text
    assert "input_estimates" not in res.json()
    assert "Estimated inputs" not in repr(audit_to_blocks(res.json()))


def test_the_audit_records_the_estimate_and_the_operators_choice(client: TestClient) -> None:
    res = client.post("/render/audit", json=_estimated(), headers=_auth())
    assert res.status_code == 200, res.text
    assert res.json()["input_estimates"] == [
        {
            "field": "speed",
            "value": 25,
            "label": "25 mph",
            "source": "road_class",
            "evidence": "OSM highway=residential; the road carries no posted speed",
            "operator_confirmed": True,
        }
    ]
    # A choice the operator made is no guess: the guesses key stays absent.
    assert "input_guesses" not in res.json()


def test_the_audit_pdf_prints_the_line(client: TestClient) -> None:
    projection = client.post("/render/audit", json=_estimated(), headers=_auth()).json()
    text = repr(audit_to_blocks(projection))
    assert "Estimated inputs" in text
    assert (
        "Speed limit: 25 mph. Estimated from the road class (OSM highway=residential; "
        "the road carries no posted speed). Chosen by the operator. "
        "Confirm the posted speed on site."
    ) in text


def _stale(res: Any) -> str:
    assert res.status_code == 400, res.text
    detail = res.json()["detail"]
    assert detail["error"] == "guess_stale"
    return detail["message"]


def test_a_speed_that_no_longer_matches_the_estimate_is_refused(client: TestClient) -> None:
    body = _estimated()
    body["speed"] = 35
    message = _stale(client.post("/render/audit", json=body, headers=_auth()))
    assert message.startswith(
        "Speed limit is marked as chosen from the road-class estimate, but the road class "
        "(highway=residential) estimates 25 mph"
    )


def test_a_class_with_no_estimate_is_refused(client: TestClient) -> None:
    body = _estimated()
    body["speed_estimate"] = {"highwayClass": "footway"}
    _stale(client.post("/render/audit", json=body, headers=_auth()))


@pytest.mark.parametrize(
    "path", ["/render/pdf", "/render/device-breakdown", "/render/xlsx", "/render/audit-pdf"]
)
def test_every_render_path_refuses_a_stale_estimate(client: TestClient, path: str) -> None:
    body = _estimated()
    body["speed"] = 30
    _stale(client.post(path, json=body, headers=_auth()))
