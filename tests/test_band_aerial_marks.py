"""#490 C11: the WHERE band's aerial is asked of Mapbox without its logo and
attribution (the page draws both on the frame, outside the picture it scales
to cover), and the NEEDS YOU map still carries them.

Rule 11: through the real routes; Mapbox (``httpx.get``) and Overpass are the
only fakes, so the query read here is the one that would go to Mapbox.
Authority: validation-artifacts/committed/missions/ux-columns-copy-maps/
issue-490/rulings.md (C11).
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from src.rendering import static_aerial as sa
from src.rules import site_detection as sd
from tests.test_needs_you_map import AUTH, PNG, _Png, ask, fixture, footway, pin

UNMARKED = {"logo": "false", "attribution": "false"}


@pytest.fixture(autouse=True)
def _secret(monkeypatch: pytest.MonkeyPatch) -> None:
    from tests.test_needs_you_map import _TEST_SECRET

    monkeypatch.setenv("RENDER_API_SECRET", _TEST_SECRET)


@pytest.fixture(autouse=True)
def _clean_memo() -> None:
    sd.clear_subject_memo()


@pytest.fixture()
def mapbox(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    requests: list[dict[str, Any]] = []
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")

    def get(url: str, params: dict[str, str] | None = None, **_kw: Any) -> _Png:
        requests.append({"url": url, "params": dict(params or {})})
        return _Png()

    monkeypatch.setattr(httpx, "get", get)
    return requests


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


def band(client: TestClient, scenario: dict[str, Any], stage: str = "pin", **kw: Any):
    body = {"scenario": scenario, "stage": stage, "width": 409, "height": 653, **kw}
    return client.post("/render/corridor-map", headers=AUTH, json=body)


def test_the_band_aerial_is_asked_for_without_mapboxs_marks(client, mapbox):
    resp = band(client, fixture())
    assert resp.status_code == 200, resp.text
    assert resp.content == PNG
    assert len(mapbox) == 1
    params = mapbox[0]["params"]
    assert {k: params.get(k) for k in UNMARKED} == UNMARKED
    # Only the two keys are added: the URL (framing, size, overlays) is
    # band_image_url's own, and so is the rest of its query.
    url, query = sa.band_image_url(*pin(fixture()), None, stage="pin", width=409, height=653)
    assert mapbox[0]["url"] == url
    assert {k: v for k, v in params.items() if k not in UNMARKED and k != "access_token"} == query


def test_band_image_url_itself_is_unchanged(client):
    # NEEDS YOU's pin picture is band_image_url's; its query has no marks key.
    _url, query = sa.band_image_url(*pin(fixture()), None, stage="pin", width=409, height=653)
    assert not set(query) & set(UNMARKED)


def test_the_needs_you_map_keeps_mapboxs_marks(client, mapbox, monkeypatch):
    lat, lng = pin(fixture())
    monkeypatch.setattr(
        sd,
        "_overpass_request_with_fallback",
        lambda *a, **k: ({"elements": [footway(lat, lng)]}, None),
    )
    resp = ask(client, fixture())
    assert resp.status_code == 200, resp.text
    assert mapbox, "the NEEDS YOU map asked Mapbox for nothing"
    for r in mapbox:
        assert not set(r["params"]) & set(UNMARKED), r["params"]
