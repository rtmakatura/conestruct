"""#290 — the scenario version field (``meta.pinModel``), tested at the wire.

The ruling (validation-artifacts/committed/issue-290-pin-work/rulings.md,
Ryan 2026-09-25): today's pin is ``corridor_end``, measured on prod
(ruling 1); the version field's old value is ``corridor_end`` (ruling 3);
pre-change plans and fixtures are never silently re-read (ruling 10).
#290's acceptance: "The version field exists and is read first."

PAYLOAD-level tests (Rule 11), through the HTTP endpoints with Overpass
stubbed, in the shape of tests/test_preview_flag.py: the defect this field
prevents lives at the seam, where a sender's meaning meets the corridor
math, not in a function.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api import site_scan as ss
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
LAT, LNG, BEARING = 39.7113, -105.0815, 180.0

# Every endpoint that takes a Scenario, in the body shape it takes.
BARE_PATHS = (
    "/render/pdf",
    "/render/xlsx",
    "/render/markdown",
    "/render/crew-pdf",
    "/render/device-breakdown",
    "/render/audit",
    "/render/audit-pdf",
)
WRAPPED_PATHS = ("/render/quote", "/render/quote-breakdown", "/render/replication-snapshot")


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _fresh_memo() -> Iterator[None]:
    ss.clear_memo()
    yield
    ss.clear_memo()


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


@pytest.fixture()
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {_TEST_SECRET}"}


@pytest.fixture(autouse=True)
def overpass(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    """No test here may reach the network; counts attempted round trips."""
    calls: list[int] = []

    def stub(*_a: Any, **_kw: Any) -> tuple[dict[str, Any], None]:
        calls.append(1)
        return {"elements": []}, None

    monkeypatch.setattr(sd, "_overpass_request_with_fallback", stub)
    return calls


def scenario(meta: dict[str, Any] | None = None, **over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "s290", "address": "", "lat": LAT, "lng": LNG, "bearingDeg": BEARING},
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }
    if meta is not None:
        base["meta"] = {**base["meta"], **meta}
    base.update(over)
    return base


# ---------------------------------------------------------------------------
# The schema
# ---------------------------------------------------------------------------


def test_absent_means_corridor_end() -> None:
    """Ruling 3.  Backend-first: the field must exist server-side before any
    sender stamps it (Pydantic drops unknown fields), and its absence must
    mean what every sender, saved plan and fixture to date meant."""
    from src.api.schemas import ScenarioMeta

    assert ScenarioMeta().pinModel == "corridor_end"
    assert ScenarioMeta.model_validate({"lat": LAT, "lng": LNG}).pinModel == "corridor_end"


def test_the_contract_names_both_values_and_nothing_else() -> None:
    """``work_start`` is declared (the contract exists before anything sends
    it); an unknown value is a 422, never coerced to a default."""
    from pydantic import ValidationError

    from src.api.schemas import ScenarioMeta

    assert ScenarioMeta(pinModel="work_start").pinModel == "work_start"
    with pytest.raises(ValidationError):
        ScenarioMeta.model_validate({"pinModel": "first_sign"})


# ---------------------------------------------------------------------------
# Read first: work_start is refused everywhere until it is built
# ---------------------------------------------------------------------------


def test_work_start_is_refused_on_every_scenario_endpoint(
    client: TestClient, auth: dict[str, str], overpass: list[int]
) -> None:
    """Computing a work_start pin as a corridor_end one would lay the
    corridor from the wrong point and call it the plan (Rule 10).  Every
    endpoint refuses it with an honest 400 naming the field, and the refusal
    comes BEFORE anything reads the pin: no Overpass round trip is attempted
    even when the scenario asks for a scan."""
    body = scenario({"pinModel": "work_start"}, site_scan={})
    for path in BARE_PATHS:
        res = client.post(path, headers=auth, json=body)
        assert res.status_code == 400, f"{path} returned {res.status_code}"
        assert "pinModel" in res.text, path
    for path in WRAPPED_PATHS:
        res = client.post(path, headers=auth, json={"scenario": body})
        assert res.status_code == 400, f"{path} returned {res.status_code}"
        assert "pinModel" in res.text, path
    assert overpass == [], "the refusal must precede every reader of the pin"


def test_work_start_is_refused_before_the_preview_gate(
    client: TestClient, auth: dict[str, str]
) -> None:
    """Read FIRST: a body that fails both gates is refused for its pin model,
    the question every later gate depends on."""
    body = scenario({"pinModel": "work_start"}, preview=True)
    res = client.post("/render/audit", headers=auth, json=body)
    assert res.status_code == 400
    assert "pinModel" in res.text
    assert "preview is a read" not in res.text


# ---------------------------------------------------------------------------
# corridor_end: byte-identical to today, and echoed where a pin exists
# ---------------------------------------------------------------------------


def test_explicit_corridor_end_is_byte_identical_to_absent(
    client: TestClient, auth: dict[str, str]
) -> None:
    """Stamping the old meaning explicitly (the frontend's next commit)
    changes nothing any consumer reads."""
    for path in ("/render/audit", "/render/device-breakdown"):
        absent = client.post(path, headers=auth, json=scenario())
        stamped = client.post(path, headers=auth, json=scenario({"pinModel": "corridor_end"}))
        assert absent.status_code == stamped.status_code == 200, path
        assert absent.json() == stamped.json(), path
    pdf_a = client.post("/render/markdown", headers=auth, json=scenario())
    pdf_b = client.post(
        "/render/markdown", headers=auth, json=scenario({"pinModel": "corridor_end"})
    )
    assert pdf_a.status_code == pdf_b.status_code == 200
    assert pdf_a.content == pdf_b.content


def test_the_audit_records_what_the_pin_meant(client: TestClient, auth: dict[str, str]) -> None:
    res = client.post("/render/audit", headers=auth, json=scenario())
    assert res.status_code == 200
    assert res.json()["pin"] == {"model": "corridor_end"}


def test_no_pin_no_echo(client: TestClient, auth: dict[str, str]) -> None:
    """A meaning with nothing to mean is absence (Rule 10) — and it keeps
    every coordinate-less audit, including the committed snapshots,
    byte-identical."""
    res = client.post("/render/audit", headers=auth, json=scenario({"lat": 0.0, "lng": 0.0}))
    assert res.status_code == 200
    assert "pin" not in res.json()


def test_the_replication_snapshot_carries_the_echo(
    client: TestClient, auth: dict[str, str]
) -> None:
    """The snapshot is built from the same audit projection, so the record a
    reproduction starts from says what the pin meant."""
    res = client.post("/render/replication-snapshot", headers=auth, json={"scenario": scenario()})
    assert res.status_code == 200, res.text[:300]
    assert '"model": "corridor_end"' in res.text
