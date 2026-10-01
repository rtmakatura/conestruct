"""#306 -- one Generate, one scan: /render/audit's opt-in ``include_breakdown``.

The site sent /render/device-breakdown and /render/audit at once on every
Generate; Modal serves one request per container, so the two halves ran on
two containers with two scan memos -- two scans, and either could refuse
alone (validation-artifacts/committed/issue-306-double-scan/checkpoint.md).
Rulings R64/R65: the audit request may ask for the breakdown too, built from
the placements the audit already holds; without the flag nothing changes.

The scenario is the recorded scanned-lakewood fixture, its scan served from
the recorded Overpass payload (the tier-ledger suite's stub), so no network.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api import render_api
from src.api import site_scan as ss
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
FIXTURES = Path(__file__).parent / "fixtures"
SCENARIO = json.loads((FIXTURES / "tiering" / "scanned-lakewood.json").read_text("utf-8"))[
    "scenario"
]
PAYLOAD = json.loads((FIXTURES / "site_scan" / "lakewood_overpass.json").read_text("utf-8"))


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _scans(monkeypatch: pytest.MonkeyPatch) -> Iterator[list[int]]:
    """Recorded Overpass answer; counts every scan the backend actually runs."""
    ss.clear_memo()
    calls: list[int] = []
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda q, **_k: (PAYLOAD, None))
    real = ss.detect_along_corridor

    def counting(*a: Any, **k: Any) -> Any:
        calls.append(1)
        return real(*a, **k)

    monkeypatch.setattr(ss, "detect_along_corridor", counting)
    yield calls
    ss.clear_memo()


@pytest.fixture()
def client() -> TestClient:
    return TestClient(render_api.app)


def test_the_audit_carries_the_breakdown_from_one_scan(
    client: TestClient, _scans: list[int]
) -> None:
    r = client.post("/render/audit", json={**SCENARIO, "include_breakdown": True}, headers=AUTH)
    assert r.status_code == 200, r.text[:300]
    assert _scans == [1], "one Generate, one scan"
    breakdown = r.json()["breakdown"]
    # The same object /render/device-breakdown answers for the same scenario.
    ss.clear_memo()
    alone = client.post("/render/device-breakdown", json=SCENARIO, headers=AUTH)
    assert alone.status_code == 200
    assert breakdown == alone.json()


def test_without_the_flag_the_audit_is_unchanged(client: TestClient) -> None:
    plain = client.post("/render/audit", json=SCENARIO, headers=AUTH).json()
    ss.clear_memo()
    flagged = client.post(
        "/render/audit", json={**SCENARIO, "include_breakdown": True}, headers=AUTH
    ).json()
    assert "breakdown" not in plain
    flagged.pop("breakdown")
    clock = ("measured_at", "duration_ms", "memo_hit")
    for doc in (plain, flagged):
        for k in clock:
            doc["sections"]["site_scan"].pop(k, None)
    assert flagged == plain


@pytest.mark.parametrize(
    "path", ["/render/device-breakdown", "/render/pdf", "/render/audit-pdf", "/render/xlsx"]
)
def test_every_other_path_refuses_the_flag_in_words(client: TestClient, path: str) -> None:
    r = client.post(path, json={**SCENARIO, "include_breakdown": True}, headers=AUTH)
    assert r.status_code == 400, r.text[:300]
    assert "include_breakdown is accepted only on /render/audit" in r.text


def test_a_refusal_is_one_refusal(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, _scans: list[int]
) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda q, **_k: (None, "stub: mirrors down")
    )
    r = client.post("/render/audit", json={**SCENARIO, "include_breakdown": True}, headers=AUTH)
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "site_scan_unavailable"
    assert _scans == [1]
