"""s2-arc7 (Refs #220) — the tier ledger's backend proof set.

1. Cross-surface pin: ``tier_facts``/``tier_ledger`` over the recorded
   wire fixtures equal ``tests/fixtures/tiering/tiering-expectations.json``
   — the SAME file conestruct/site/lib/tiering.test.ts pins the TS
   classifier to, so the two mirrors cannot drift independently.
2. ``ledger_line`` renders byte-identically to tiering.ts ledgerLine.
3. The status→tier grid's ruled edges (flags a–k) on the Python mirror.
4. The audit PDF cover carries the line, live through the real API path
   (TestClient), with the jurisdiction facts counted when the scenario
   names one.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pypdfium2 as pdfium
import pytest

os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rendering.tier_ledger import ledger_line, tier_facts, tier_ledger  # noqa: E402

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "tiering"
HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}

EXPECTATIONS = json.loads((FIXTURE_DIR / "tiering-expectations.json").read_text(encoding="utf-8"))


def _fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / f"{name}.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


# --------------------------------------------------------------------------- #
# 1 · Cross-surface pin
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("name", ["control-lakewood", "adv-ni-denver"])
def test_recorded_fixtures_match_shared_expectation(name: str) -> None:
    fx = _fixture(name)
    facts = tier_facts(fx["audit"], fx["jurisdiction"])
    assert facts == EXPECTATIONS[name]["facts"]
    assert tier_ledger(fx["audit"], fx["jurisdiction"]) == EXPECTATIONS[name]["ledger"]


# --------------------------------------------------------------------------- #
# 2 · The line format (must equal tiering.ts ledgerLine byte-for-byte)
# --------------------------------------------------------------------------- #


def test_ledger_line_format() -> None:
    assert (
        ledger_line({"changed": 0, "attention": 0, "checked": 0, "pending": 0})
        == "0 changes · 0 needs attention · 0 checked · 0 pending · reference"
    )
    assert (
        ledger_line({"changed": 1, "attention": 2, "checked": 14, "pending": 2})
        == "1 change · 2 needs attention · 14 checked · 2 pending · reference"
    )


# --------------------------------------------------------------------------- #
# 3 · Ruled grid edges on the mirror
# --------------------------------------------------------------------------- #


def _jur(**over) -> dict:
    base = {
        "applied_deltas": [],
        "chips": {"personnel": [], "device": [], "hazard": []},
        "hours_eval": {"status": "unknown", "violations": []},
    }
    base.update(over)
    return base


def test_delta_grid() -> None:
    j = _jur(
        applied_deltas=[
            {"severity": "count", "status": "fires"},
            {"severity": "op", "status": "fires"},
            {"severity": "admin", "status": "fires"},
            {"severity": "count", "status": "conditional"},
            {"severity": "op", "status": "unknown"},
        ]
    )
    facts = tier_facts(None, j)
    assert facts["jur:delta:0"] == "changed"
    assert facts["jur:delta:1"] == "changed"  # flag a: method = plan change
    assert facts["jur:delta:2"] == "reference"  # flag g
    assert facts["jur:delta:3"] == "attention"
    assert facts["jur:delta:4"] == "attention"


def test_chips_and_hours_grid() -> None:
    j = _jur(
        chips={
            "personnel": [{"status": "fires"}],
            "device": [{"status": "conditional"}],
            "hazard": [{"status": "fires"}],
        },
        hours_eval={"status": "outside", "violations": []},
    )
    facts = tier_facts(None, j)
    assert facts["jur:personnel:0"] == "attention"  # flag b: obligation
    assert facts["jur:device:0"] == "attention"
    assert facts["jur:hazard:0"] == "reference"  # flag c
    assert facts["jur:hours"] == "attention"
    assert (
        tier_facts(None, _jur(hours_eval={"status": "inside", "violations": []}))["jur:hours"]
        == "checked"
    )
    assert tier_facts(None, _jur())["jur:hours"] == "pending"  # flag d


def test_audit_grid() -> None:
    projection = {
        "sections": {
            "taper": {},
            "buffer": {},
            "spacing": {},
            "advance": {},
            "case": {},
            "colorado": {"checks": [{"pass": True}, {"pass": False}], "info_items": [{}]},
            "flagger": {"sight_distance_ft": 305},
            "site_adjustments": [
                {"flag": "pedestrian_facility", "devices_added": 6},
                {"flag": "driveways_present", "devices_added": 0},
            ],
            "corridor_validation": {"checked": True, "warnings": []},
            "geometry_validation": {"violations": [{}]},
            "fines_double": {"applicable": True},
            "approaches": {"approaches": [{"signalized": True}]},
        },
        "pending_verification": {"count": 2, "items": [{}, {}]},
    }
    facts = tier_facts(projection, None)
    assert facts["audit:taper"] == "checked"
    assert facts["audit:colorado:check:0"] == "checked"
    assert facts["audit:colorado:check:1"] == "attention"  # flag i
    assert facts["audit:colorado:info:0"] == "checked"
    assert facts["audit:flagger_ssd"] == "checked"
    assert facts["audit:site:pedestrian_facility"] == "changed"
    assert facts["audit:site:driveways_present"] == "checked"
    assert facts["audit:corridor:clean"] == "checked"  # flag h
    assert facts["audit:geometry:0"] == "attention"
    assert facts["audit:fines_double"] == "changed"  # flag e
    assert facts["audit:approaches"] == "attention"
    assert facts["audit:pending:0"] == "pending"
    assert facts["audit:pending:1"] == "pending"
    # ◌-never-elsewhere + ledger-sums-to-all on the same input.
    counts = tier_ledger(projection, None)
    counted = [t for t in facts.values() if t != "reference"]
    assert sum(counts.values()) == len(counted)
    assert counts["pending"] == 2


def test_fines_carveout_and_quiet_approaches() -> None:
    projection = {
        "sections": {
            "fines_double": {"applicable": False},
            "approaches": {"approaches": [{"signalized": False}]},
        },
        "pending_verification": {"count": 0},
    }
    facts = tier_facts(projection, None)
    assert facts["audit:fines_double"] == "checked"
    assert facts["audit:approaches"] == "checked"


# --------------------------------------------------------------------------- #
# 4 · The cover line through the real API path
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("name", ["control-lakewood", "adv-ni-denver"])
def test_audit_pdf_cover_carries_the_screen_ledger(
    name: str, client: TestClient, tmp_path: Path
) -> None:
    fx = _fixture(name)
    expected_line = ledger_line({k: int(v) for k, v in EXPECTATIONS[name]["ledger"].items()})
    r = client.post("/render/audit-pdf", json=fx["scenario"], headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    pdf_path = tmp_path / "audit.pdf"
    pdf_path.write_bytes(r.content)
    doc = pdfium.PdfDocument(str(pdf_path))
    try:
        page = doc[0]
        tp = page.get_textpage()
        text = tp.get_text_range(0, tp.count_chars())
    finally:
        doc.close()
    assert "Plan status" in text
    assert expected_line in text
