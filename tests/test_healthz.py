"""Tests for ``/healthz`` SHA stamping (INFRA-1, #94).

The SHA itself is environment-specific, so these assert *structure and
source*, not a literal value:

  * Read side (``render_api.healthz``): the endpoint returns
    ``status == "ok"`` plus a ``sha`` string; the value is sourced from
    the ``GIT_SHA`` env var; the honest sentinel ``"unknown"`` appears
    when unstamped.
  * Write side (``modal_app._git_sha``): returns a 40-hex SHA in this
    repo, or ``"unknown"`` if git is unavailable.

``/healthz`` is exempt from the bearer-auth middleware, so no secret is
needed here.
"""

from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app

_SHA_RE = re.compile(r"\A[0-9a-f]{40}\Z")


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_healthz_returns_ok_and_a_sha_string(client: TestClient) -> None:
    res = client.get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert isinstance(body["sha"], str)


def test_healthz_sha_is_sourced_from_git_sha_env(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("GIT_SHA", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef")
    assert client.get("/healthz").json()["sha"] == ("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef")


def test_healthz_sha_falls_back_to_unknown_when_unstamped(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("GIT_SHA", raising=False)
    assert client.get("/healthz").json()["sha"] == "unknown"


def test_git_sha_capture_returns_sha_or_unknown() -> None:
    # Importing modal_app runs the image-graph construction (and thus
    # _git_sha) but performs no deploy.
    from modal_app import _git_sha

    sha = _git_sha()
    assert _SHA_RE.match(sha) or sha == "unknown"
