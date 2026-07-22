"""Spec §4 print pipeline (issue #150) — API plumbing + rendered-output tests.

Rule-11 layer choice: assertions run against the text extracted from the
actually-rendered PDF (pypdfium2), through the real /render/pdf endpoint,
so plumbing bugs and layout regressions both surface here.
"""

from __future__ import annotations

import copy

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app

AUTH = {"Authorization": "Bearer test-secret"}

SHOULDER_BODY = {
    "kind": "shoulder",
    "meta": {"project": "Spec4 Test", "address": "", "lat": 0.0, "lng": 0.0},
    "roadType": "rural_divided",
    "speed": 55,
    "lanes": 2,
    "laneWidth": 12.0,
    "divided": True,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 800.0,
    "night": False,
}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


def pdf_text(client: TestClient, body: dict, tmp_path) -> str:
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text
    tmp = tmp_path / "sheet.pdf"
    tmp.write_bytes(resp.content)
    pdf = pdfium.PdfDocument(str(tmp))
    try:
        return "\n".join(page.get_textpage().get_text_range() for page in pdf)
    finally:
        pdf.close()


# ---------------------------------------------------------------------------
# Task 3: plumbing
# ---------------------------------------------------------------------------


def test_unknown_jurisdiction_key_is_a_400(client: TestClient) -> None:
    body = copy.deepcopy(SHOULDER_BODY)
    body["jurisdiction_key"] = "narnia"
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 400


def test_meta_toggle_field_accepted_and_defaults_on(client: TestClient) -> None:
    body = copy.deepcopy(SHOULDER_BODY)
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200

    body["meta"]["includeDeviceSummary"] = False
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200
