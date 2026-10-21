"""#365 — a corner plan's corridor spec names its corner extension.

A near-side plan whose closure runs on to the upstream curb line
(``near_intersection_stations(...)["extend_to_corner"]``) places no
downstream taper.  The served audit's ``corridor_spec`` used to key that
48 ft run ``downstream_taper_ft``, and the plan sheet's CORRIDOR DETAILS
printed it as "Downstream".  Rule 10: the absent taper gets no key; the
same run reads "Corner extension".  Ryan's condition (R1): the corridor
geometry, the stations and every other plan stay byte-identical.  Rule
11: the tests read the served payloads and the rendered page text.
"""

from __future__ import annotations

import io
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient

import src.api.render_api as render_api
from src.api.render_api import app
from src.rendering import plan_sheet as ps
from tests.test_lane_confidence_block import _ni_body

AUTH = {"Authorization": "Bearer test-secret"}
# E Colfax (memory.md reference pin), eastbound.
PIN = {"lat": 39.73997, "lng": -104.96632, "bearingDeg": 90.0}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture(autouse=True)
def ni_enabled(monkeypatch):
    monkeypatch.setattr(
        render_api,
        "ENABLED_SCENARIOS",
        frozenset({"shoulder", "flagger_lane_closure", "near_intersection"}),
    )


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """Page 2's Mapbox fetch and the site scan's Overpass trip go to stubs."""
    from PIL import Image

    from src.api import site_scan as ss
    from src.rules import site_detection as sd

    class _Png:
        def __init__(self) -> None:
            buf = io.BytesIO()
            Image.new("RGB", (4, 4), (128, 128, 128)).save(buf, format="PNG")
            self.content = buf.getvalue()

        def raise_for_status(self) -> None:
            return None

    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")
    monkeypatch.setattr(ps.httpx, "get", lambda *_a, **_k: _Png())
    monkeypatch.setattr(ps, "_validate_corridor_bearing", lambda corridor: None)
    ss.clear_memo()
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda q, **_k: (None, "stub: mirrors down")
    )


@pytest.fixture()
def client():
    return TestClient(app)


def _pinned(**approach_overrides: Any) -> dict:
    body = _ni_body(**approach_overrides)
    return {**body, "meta": {**body["meta"], **PIN}}


def _spec(client: TestClient, body: dict) -> dict:
    resp = client.post("/render/audit", json=body, headers=AUTH)
    assert resp.status_code == 200
    return resp.json()["sections"]["corridor_spec"]


def _page_two(client: TestClient, body: dict) -> str:
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200
    pdf = pdfium.PdfDocument(resp.content)
    assert len(pdf) == 2, "a pinned plan with a bearing carries the aerial page"
    return pdf[1].get_textpage().get_text_range()


def test_corner_plan_spec_keys_the_corner_extension(client):
    # _ni_body(): near side, alongStationFt -60 -> the upstream curb is
    # 48 ft past the work zone; the layout runs the closure to it.
    spec = _spec(client, _ni_body())
    assert "downstream_taper_ft" not in spec
    assert spec["corner_extension_ft"] == 48


def test_corner_plan_sheet_row_reads_corner_extension(client):
    p2 = _page_two(client, _pinned())
    assert "Corner extension: 48 ft" in p2.replace("\r\n", " ").replace("\n", " ")
    assert "Downstream:" not in p2


def test_midblock_near_side_keeps_its_downstream_taper(client):
    # A cross street far enough past the work zone leaves room for the
    # standard reopening: the downstream taper stays, keyed as before.
    spec = _spec(client, _ni_body(alongStationFt=-600.0))
    assert "corner_extension_ft" not in spec
    assert spec["downstream_taper_ft"] == 50
    p2 = _page_two(client, _pinned(alongStationFt=-600.0))
    assert "Corner extension" not in p2
    assert "Downstream: 50 ft" in p2.replace("\r\n", " ").replace("\n", " ")
