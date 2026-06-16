"""Shared fixtures for the validation corpus: auth, client, and a network guard.

The guard fails loud on any *outbound* HTTP so an accidental Overpass call
(e.g. a case that forgot ``lat=lng=0``) is caught instead of silently making
the suite non-deterministic. It patches only httpx/requests module-level
convenience functions and ``requests.Session.request`` — NOT ``httpx.Client``
instance methods — so Starlette's in-process ``TestClient`` (which drives the
ASGI app through an in-memory transport) keeps working.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

_TEST_SECRET = "test-secret-do-not-deploy"


@pytest.fixture(scope="session", autouse=True)
def _render_secret() -> Iterator[None]:
    # The bearer-auth middleware fails closed if RENDER_API_SECRET is unset.
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture()
def client() -> TestClient:
    # Imported lazily so the secret above is set before the app is touched.
    from src.api.render_api import app

    return TestClient(app)


@pytest.fixture()
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_TEST_SECRET}"}


def _blocked(*_args: Any, **_kwargs: Any) -> Any:
    raise RuntimeError(
        "corpus tests must not touch the live network. A scenario reached for "
        "the wire (Overpass/geocoding?) — every case must pin meta.lat=lng=0 so "
        "the /render/audit path takes no corridor-OSM lookup."
    )


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    # Module-level convenience functions only. site_detection calls
    # ``httpx.post(...)``; geocoding helpers use the same surface. TestClient
    # uses ``httpx.Client(transport=ASGITransport(...))`` whose instance
    # methods are deliberately left untouched.
    for name in ("get", "post", "put", "patch", "delete", "head", "request", "stream"):
        monkeypatch.setattr(httpx, name, _blocked, raising=False)

    try:
        import requests
    except ImportError:
        return
    for name in ("get", "post", "put", "patch", "delete", "head", "request"):
        monkeypatch.setattr(requests, name, _blocked, raising=False)
    monkeypatch.setattr(requests.sessions.Session, "request", _blocked, raising=False)
