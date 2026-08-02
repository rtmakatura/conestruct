"""Crew-narrative jurisdiction header (#156) — rendered-output tests.

The header hard-coded "Jurisdiction: CDOT" for every plan because the
template read ``params.jurisdiction`` — the engine-math switch that
schemas.py sets to "CDOT" for all seven kinds (spacing.py raises on
anything else; those literals are deliberately untouched).

The fix threads the RESOLVED jurisdiction record's ``name`` into the
narrative through the render endpoints.  Per Rule 11 these tests assert
on the rendered Markdown THROUGH the endpoint seam — the bug lived in
what the document said, not in any pure function — and cover both arms:
a scenario naming a ``jurisdiction_key`` renders that record's name;
a scenario naming none renders CDOT.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client() -> TestClient:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
    from src.api.render_api import app

    return TestClient(app)


def _auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-secret-do-not-deploy"}


def _shoulder_body(jurisdiction_key: str | None = None) -> dict:
    body: dict = {
        "kind": "shoulder",
        "meta": {"project": "Header Test"},
        "roadType": "freeway",
        "speed": 55,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }
    if jurisdiction_key is not None:
        body["jurisdiction_key"] = jurisdiction_key
    return body


def _markdown(client: TestClient, body: dict) -> str:
    res = client.post("/render/markdown", headers=_auth_headers(), json=body)
    assert res.status_code == 200, res.text
    return res.text


def test_resolved_key_renders_record_name(client: TestClient) -> None:
    md = _markdown(client, _shoulder_body("lakewood"))
    assert "- **Jurisdiction:** Lakewood" in md
    assert "- **Jurisdiction:** CDOT" not in md


def test_newly_reachable_key_renders_record_name(client: TestClient) -> None:
    """#155's fix must reach the document: post-fix Greeley by name."""
    md = _markdown(client, _shoulder_body("greeley"))
    assert "- **Jurisdiction:** Greeley" in md


def test_null_key_falls_back_to_cdot(client: TestClient) -> None:
    md = _markdown(client, _shoulder_body())
    assert "- **Jurisdiction:** CDOT" in md


def test_bad_key_is_an_honest_400(client: TestClient) -> None:
    res = client.post(
        "/render/markdown",
        headers=_auth_headers(),
        json=_shoulder_body("gotham"),
    )
    assert res.status_code == 400
    assert "gotham" in res.json()["detail"]


def test_crew_pdf_takes_the_same_thread(client: TestClient) -> None:
    """/render/crew-pdf consumes the same Markdown string — it must accept
    the key and render (content parity with /render/markdown is already
    pinned by the shared render_crew_narrative_markdown path)."""
    res = client.post(
        "/render/crew-pdf",
        headers=_auth_headers(),
        json=_shoulder_body("lakewood"),
    )
    assert res.status_code == 200
    assert res.content[:5] == b"%PDF-"
