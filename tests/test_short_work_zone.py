"""#382: a work zone shorter than its taper builds, for every plan kind.

``WORK_ZONE_SHORTER_THAN_TAPER`` refused these plans on a limit no MUTCD or
S-630-1 text states (#375 marked it CHOSEN), and the generators stack the
taper upstream of the buffer and work zone, so a short zone never overlaps
it.  R1 (Ryan, 2026-10-24) dropped the limit after a render check at 50 ft
(``validation-artifacts/committed/issue-382-short-work-zone/``).  Rule 11:
each case goes through the real ``/render/audit`` and ``/render/pdf``; the
``WORK_ZONE_SHORT_VS_BUFFER`` warning stays as the "did you mistype the
length?" signal.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from tests.test_plan_sheet_device_summary import FLAGGER_BODY, SHOULDER_BODY

AUTH = {"Authorization": "Bearer test-secret"}
NI_FIXTURE = Path(__file__).parent / "fixtures" / "pdf_worst_case" / "adv-near-intersection.json"


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


def _near_intersection(speed: int) -> dict[str, Any]:
    body: dict[str, Any] = json.loads(NI_FIXTURE.read_text(encoding="utf-8"))["scenario"]
    body["speed"] = speed
    return body


# (case, body, work zone ft, the taper the old limit compared against)
CASES = [
    ("flagger", FLAGGER_BODY, 50.0, 100),  # §6B.08 ¶14 one-lane, two-way taper
    ("near_intersection_45", _near_intersection(45), 50.0, 472),  # L = WS = 472.5, 10.5 ft lane
    ("near_intersection_55", _near_intersection(55), 50.0, 578),
    ("shoulder_55", SHOULDER_BODY, 50.0, 183),  # L/3, 10 ft shoulder
]


@pytest.mark.parametrize(("case", "base", "work_ft", "taper_ft"), CASES, ids=[c[0] for c in CASES])
def test_short_work_zone_builds(
    client: TestClient, case: str, base: dict, work_ft: float, taper_ft: int
) -> None:
    body = copy.deepcopy(base)
    body["workLen"] = work_ft
    audit = client.post("/render/audit", json=body, headers=AUTH)
    assert audit.status_code == 200, audit.text
    geo = audit.json()["sections"]["geometry_validation"]
    assert geo["work_zone_ft"] == work_ft
    assert geo["taper_ft"] == taper_ft
    assert geo["all_pass"] is True
    rule_ids = [v["rule_id"] for v in geo["violations"]]
    assert "WORK_ZONE_SHORTER_THAN_TAPER" not in rule_ids
    # The buffer warning still flags the short zone.
    assert rule_ids == ["WORK_ZONE_SHORT_VS_BUFFER"]
    pdf = client.post("/render/pdf", json=body, headers=AUTH)
    assert pdf.status_code == 200, pdf.text[:400]
    assert pdf.headers["content-type"] == "application/pdf"
