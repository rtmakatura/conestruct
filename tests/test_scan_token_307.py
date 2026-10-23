"""#307 (R151): downloads send back a signed copy of their Generate's scan.

The Generate's audit (``include_scan_token``) returns ``site_scan_token``:
the memo's own tuple for the scan it answered from, HMAC-signed.  A
download carrying it, on a container that never scanned that corridor
(the memo cleared here), builds from it with no Overpass request; the
``x-site-scan-source`` header says so.  A bad token is an honest 400; a
valid token for another corridor is ignored and that request scans.
Payload-level, through the real app (Rule 11), Overpass stubbed with the
recorded Lakewood answer.
"""

from __future__ import annotations

import copy
import json
import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api import scan_token as st
from src.api import site_scan as ss
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
FIXTURE = Path(__file__).parent / "fixtures" / "site_scan" / "lakewood_overpass.json"


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


AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}


class Overpass:
    """The recorded Lakewood answer, counting every fetch."""

    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.calls = 0

    def __call__(self, *_a: Any, **_k: Any) -> tuple[dict[str, Any], None]:
        self.calls += 1
        return copy.deepcopy(self.payload), None


@pytest.fixture()
def overpass(monkeypatch: pytest.MonkeyPatch) -> Overpass:
    stub = Overpass(json.loads(FIXTURE.read_text(encoding="utf-8")))
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", stub)
    return stub


def scenario(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {
            "project": "t307",
            "address": "",
            "lat": 39.7113,
            "lng": -105.0815,
            "bearingDeg": 180.0,
        },
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
        "site_scan": {"proceed_if_unavailable": False},
    }
    base.update(over)
    return base


def generate_token(client: TestClient) -> str:
    res = client.post(
        "/render/audit", headers=AUTH, json={**scenario(), "include_scan_token": True}
    )
    assert res.status_code == 200, res.text[:300]
    assert res.headers["x-site-scan-source"] == "scan"
    token = res.json()["site_scan_token"]
    assert isinstance(token, str) and "." in token
    return token


def with_token(sc: dict[str, Any], token: str) -> dict[str, Any]:
    return {**sc, "site_scan": {"proceed_if_unavailable": False, "token": token}}


# --------------------------------------------------------------------------- #
# The token itself
# --------------------------------------------------------------------------- #


def test_sign_and_verify_round_trip() -> None:
    tok = st.sign_scan(
        "k1", {"sidewalks": {"detected": True, "count": 2}}, "2026-10-15T12:00:00+00:00", 3100
    )
    entry = st.verify_scan(tok)
    assert entry["key"] == "k1"
    assert entry["buckets"]["sidewalks"]["count"] == 2
    assert entry["duration_ms"] == 3100


def test_a_tampered_or_foreign_token_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    tok = st.sign_scan("k1", {"sidewalks": {"detected": True, "count": 2}}, "t", 1)
    body, mac = tok.split(".")
    flipped = body[:-1] + ("A" if body[-1] != "A" else "B")
    # Non-ASCII in either half is malformed (the verifier's repair: the body
    # half used to raise UnicodeEncodeError, a 500 at the endpoint).
    for bad in (f"{flipped}.{mac}", "no-dot", f"{body}.", "", "é.AAAA", f"{body}.é"):
        with pytest.raises(st.ScanTokenInvalid):
            st.verify_scan(bad)
    monkeypatch.setenv("RENDER_API_SECRET", "another-secret")
    with pytest.raises(st.ScanTokenInvalid):
        st.verify_scan(tok)


# --------------------------------------------------------------------------- #
# Through the app
# --------------------------------------------------------------------------- #


def test_audit_returns_a_token_only_when_asked(client: TestClient, overpass: Overpass) -> None:
    plain = client.post("/render/audit", headers=AUTH, json=scenario())
    assert plain.status_code == 200
    assert "site_scan_token" not in plain.json()
    # The plain audit warmed the memo; a fresh container answers by scanning.
    ss.clear_memo()
    assert generate_token(client)


@pytest.mark.parametrize(
    ("route", "wrap"),
    [
        ("/render/pdf", False),
        ("/render/xlsx", False),
        ("/render/markdown", False),
        ("/render/crew-pdf", False),
        ("/render/audit-pdf", False),
        ("/render/quote", True),
    ],
)
def test_a_download_with_the_token_never_rescans(
    client: TestClient, overpass: Overpass, route: str, wrap: bool
) -> None:
    token = generate_token(client)
    # A container that never scanned this corridor: the memo is empty and
    # every Overpass fetch is counted.
    ss.clear_memo()
    before = overpass.calls
    body: dict[str, Any] = with_token(scenario(), token)
    res = client.post(route, headers=AUTH, json={"scenario": body} if wrap else body)
    assert res.status_code == 200, res.text[:300]
    assert res.headers["x-site-scan-source"] == "token"
    assert overpass.calls == before


def test_the_token_answers_like_the_generate(client: TestClient, overpass: Overpass) -> None:
    token = generate_token(client)
    first = client.post("/render/audit", headers=AUTH, json=scenario()).json()["sections"][
        "site_scan"
    ]
    ss.clear_memo()
    again = client.post("/render/audit", headers=AUTH, json=with_token(scenario(), token)).json()
    scan = again["sections"]["site_scan"]
    assert scan["memo_hit"] is True
    assert scan["flags"] == first["flags"]
    assert scan["measured_at"] == first["measured_at"]


def test_a_bad_token_is_an_honest_400(client: TestClient, overpass: Overpass) -> None:
    token = generate_token(client)
    res = client.post("/render/pdf", headers=AUTH, json=with_token(scenario(), token[:-2] + "xx"))
    assert res.status_code == 400
    assert res.json()["detail"]["error"] == "site_scan_token_invalid"
    assert "Generate the plan again" in res.json()["detail"]["message"]


def test_a_non_ascii_token_is_the_same_honest_400(client: TestClient, overpass: Overpass) -> None:
    res = client.post("/render/pdf", headers=AUTH, json=with_token(scenario(), "é.AAAA"))
    assert res.status_code == 400
    assert res.json()["detail"]["error"] == "site_scan_token_invalid"


def test_a_token_for_another_corridor_is_ignored_and_the_request_scans(
    client: TestClient, overpass: Overpass
) -> None:
    token = generate_token(client)
    ss.clear_memo()
    before = overpass.calls
    res = client.post("/render/pdf", headers=AUTH, json=with_token(scenario(workLen=1500), token))
    assert res.status_code == 200
    assert res.headers["x-site-scan-source"] == "scan"
    assert overpass.calls == before + 1


def test_include_scan_token_is_refused_off_the_audit(
    client: TestClient, overpass: Overpass
) -> None:
    res = client.post("/render/pdf", headers=AUTH, json={**scenario(), "include_scan_token": True})
    assert res.status_code == 400
    assert "include_scan_token is accepted only on /render/audit" in res.text


def test_no_scan_requested_sends_no_source_header(client: TestClient) -> None:
    sc = scenario()
    sc.pop("site_scan")
    res = client.post("/render/pdf", headers=AUTH, json=sc)
    assert res.status_code == 200
    assert "x-site-scan-source" not in res.headers


# --------------------------------------------------------------------------- #
# #371: the age limit
# --------------------------------------------------------------------------- #


def _aged(token: str, age_s: float) -> str:
    """The same scan re-signed as measured ``age_s`` seconds ago."""
    entry = st.verify_scan(token)
    measured = datetime.now(UTC) - timedelta(seconds=age_s)
    return st.sign_scan(
        entry["key"],
        entry["buckets"],
        measured.isoformat(timespec="seconds"),
        entry["duration_ms"],
    )


def test_a_token_past_the_age_limit_is_refused() -> None:
    now = datetime(2026, 10, 22, 12, 0, tzinfo=UTC)
    tok = st.sign_scan("k1", {}, "2026-10-22T00:00:00+00:00", 1)
    assert st.verify_current_scan(tok, now=now)["key"] == "k1"  # exactly 12 h
    with pytest.raises(st.ScanTokenExpired, match=r"12\.0 h old"):
        st.verify_current_scan(tok, now=now + timedelta(seconds=1))
    for bad_time in ("t", "2026-10-22T00:00:00"):
        with pytest.raises(st.ScanTokenInvalid):
            st.verify_current_scan(st.sign_scan("k1", {}, bad_time, 1), now=now)


def test_an_expired_token_is_an_honest_400_and_a_fresh_one_serves(
    client: TestClient, overpass: Overpass
) -> None:
    token = generate_token(client)
    ss.clear_memo()
    before = overpass.calls
    old = client.post(
        "/render/pdf", headers=AUTH, json=with_token(scenario(), _aged(token, 13 * 3600))
    )
    assert old.status_code == 400
    detail = old.json()["detail"]
    assert detail["error"] == "site_scan_token_invalid"
    assert detail["reason"].startswith("the scan is 13.0 h old")
    assert "more than 12 hours ago" in detail["message"]
    assert "Generate the plan again" in detail["message"]
    fresh = client.post("/render/pdf", headers=AUTH, json=with_token(scenario(), _aged(token, 60)))
    assert fresh.status_code == 200
    assert fresh.headers["x-site-scan-source"] == "token"
    assert overpass.calls == before
