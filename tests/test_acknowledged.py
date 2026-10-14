"""#297: the operator's acknowledgements, recorded and listed by the audit.

Acknowledging records that the operator saw an item; it changes nothing
about the plan.  The audit resolves each stable id against the plan's own
jurisdiction evaluation and lists the rule's words and source, or says the
rule no longer applies.  Nothing acknowledged, no key.
"""

from __future__ import annotations

import copy
import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api import render_api
from src.rendering.audit_blocks import _acknowledged_blocks
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
FIX = Path(__file__).parent / "fixtures" / "tiering" / "control-lakewood.json"


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *a, **k: ({"elements": []}, None)
    )


@pytest.fixture()
def client() -> TestClient:
    return TestClient(render_api.app)


def scenario(acknowledged: list[str] | None = None) -> dict[str, Any]:
    s = copy.deepcopy(json.loads(FIX.read_text(encoding="utf-8"))["scenario"])
    if acknowledged is not None:
        s["meta"]["acknowledged"] = acknowledged
    return s


def fired_ids(client: TestClient) -> list[str]:
    body = client.post("/render/device-breakdown", headers=AUTH, json=scenario()).json()
    return [f"jur:delta:{d['key']}" for d in body["jurisdiction"]["applied_deltas"]]


def test_the_audit_lists_an_acknowledged_rule_in_its_own_words(client: TestClient) -> None:
    first = fired_ids(client)[0]
    out = client.post("/render/audit", headers=AUTH, json=scenario([first])).json()
    (entry,) = out["acknowledged"]
    assert entry["id"] == first
    assert entry["applies"] is True
    assert entry["rule"].startswith("Double posting of signs is required")
    assert entry["source"].endswith("§ note 6")


def test_an_acknowledgement_whose_rule_no_longer_fires_is_listed_as_such(
    client: TestClient,
) -> None:
    out = client.post(
        "/render/audit", headers=AUTH, json=scenario(["jur:delta:lakewood:0000000000"])
    ).json()
    assert out["acknowledged"] == [
        {"id": "jur:delta:lakewood:0000000000", "rule": None, "source": None, "applies": False}
    ]


def test_nothing_acknowledged_no_key(client: TestClient) -> None:
    assert "acknowledged" not in client.post("/render/audit", headers=AUTH, json=scenario()).json()
    assert (
        "acknowledged" not in client.post("/render/audit", headers=AUTH, json=scenario([])).json()
    )


def test_acknowledging_changes_nothing_about_the_plan(client: TestClient) -> None:
    ids = fired_ids(client)
    plain = client.post("/render/device-breakdown", headers=AUTH, json=scenario()).json()
    acked = client.post("/render/device-breakdown", headers=AUTH, json=scenario(ids)).json()
    assert acked == plain
    a = client.post("/render/audit", headers=AUTH, json=scenario()).json()
    b = client.post("/render/audit", headers=AUTH, json=scenario(ids)).json()
    b.pop("acknowledged")
    assert a == b


def test_the_field_is_bounded(client: TestClient) -> None:
    too_many = [f"jur:delta:lakewood:{i:010x}" for i in range(51)]
    assert client.post("/render/audit", headers=AUTH, json=scenario(too_many)).status_code == 422
    too_long = ["jur:delta:" + "x" * 120]
    assert client.post("/render/audit", headers=AUTH, json=scenario(too_long)).status_code == 422


def test_the_audit_pdf_block() -> None:
    blocks = repr(
        _acknowledged_blocks(
            [
                {
                    "id": "a",
                    "rule": "Arrow board is required.",
                    "source": "Sheet § note 7",
                    "applies": True,
                },
                {"id": "jur:delta:x:1", "rule": None, "source": None, "applies": False},
            ]
        )
    )
    assert "Acknowledged by the operator" in blocks
    assert "Arrow board is required. (Sheet § note 7)" in blocks
    assert "jur:delta:x:1 (no longer applies to this plan)" in blocks
    assert _acknowledged_blocks(None) == []
