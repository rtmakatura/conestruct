"""#348: a plan names one MUTCD edition.

The results Reference row renders the jurisdiction chain's display names
verbatim (``conestruct/site/lib/reference-summary.ts``); the sheet, the crew
instructions and the Streamlit caption print ``REFERENCE_LINE``.  For Denver
the row said "MUTCD 2009 R2 (pinned)" while the sheet said "MUTCD 11th
Edition".  Under the ruling (rulings.md in
validation-artifacts/committed/issue-348-denver-edition/), the edition a
chain's first link governs by is the one right after "MUTCD"; a pinned
edition may follow as a fact about the jurisdiction.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.rules import site_detection as sd
from src.rules.references import REFERENCE_LINE

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "jurisdictions"
AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}

# The token after "MUTCD": "11th" in "MUTCD 11th Edition Part 6".  Tokens
# without a digit ("+", "(latest)", "(via") name no edition.
_EDITION = re.compile(r"MUTCD (\S+)")


def _edition(text: str) -> str | None:
    m = _EDITION.search(text)
    return m.group(1) if m and re.search(r"\d", m.group(1)) else None


SHEET_EDITION = _edition(REFERENCE_LINE)


@pytest.fixture(scope="module", autouse=True)
def _env() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(autouse=True)
def _no_overpass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


def _denver_scenario() -> dict[str, Any]:
    # The Broadway near-intersection scenario #117's suite already posts.
    approach = {
        "speed": 25,
        "roadType": "urban_arterial",
        "lanesPerDirection": 1,
        "laneWidth": 11.0,
        "signalized": True,
        "alongStationFt": -100.0,
    }
    return {
        "kind": "near_intersection",
        "meta": {"project": "348", "address": "", "lat": 39.7337, "lng": -104.98753},
        "roadType": "urban_arterial",
        "speed": 30,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "approaches": [{"id": "e11", **approach}],
        "jurisdiction_key": "denver",
        "street_class": "arterial",
    }


def test_the_sheet_names_the_11th() -> None:
    assert SHEET_EDITION == "11th"


def test_denver_results_row_and_sheet_name_the_same_edition() -> None:
    """Payload-level: the chain the Reference row renders for a Denver plan."""
    r = TestClient(app).post("/render/device-breakdown", headers=AUTH, json=_denver_scenario())
    assert r.status_code == 200, r.text
    first = r.json()["jurisdiction"]["chain"][0]["display_name"]
    assert _edition(first) == SHEET_EDITION
    # The pin survives as a fact about Denver, after the governing edition.
    assert "PT-116.1 pins 2009 R2" in first


@pytest.mark.parametrize("path", sorted(DATA_DIR.glob("*.json")), ids=lambda p: p.stem)
def test_no_chain_names_a_second_edition(path: Path) -> None:
    for link in json.loads(path.read_text(encoding="utf-8"))["chain"]:
        edition = _edition(link["display_name"])
        assert edition in (None, SHEET_EDITION), (path.stem, link["display_name"])
