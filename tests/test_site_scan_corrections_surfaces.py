"""#224 phase 4 (s2-arc18, commit 2) — the operator's corrections on the
plan sheet and in the crew narrative.

Commit 1 put the corrections on the wire (``sections.site_scan.corrections``
with one backend-composed sentence each).  This commit adds the two
deliverables a crew carries: the plan sheet's notes box (one
fixed-obligation CORRECTED BY OPERATOR line before the DRAFT trailer,
applied corrections only — the box has room for a line) and the crew
narrative's ``## Site Conditions`` block (every correction's sentence,
applied and moot — rule 10: a moot correction is disclosed, never
dropped).

Rule 11 — test where the bug lives: every case goes through the REAL
render routes (TestClient) over the committed pdf_worst_case scenarios,
with the Overpass trip stubbed exactly as the containment harness stubs
it.  Two predicates in src/api/site_scan.py (``corrections_disclosure``,
``correction_sentences``) decide for every surface.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import pytest

os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

from fastapi.testclient import TestClient  # noqa: E402

from src.api import site_scan as ss  # noqa: E402
from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "pdf_worst_case"
SCAN_PAYLOAD = Path(__file__).parent / "fixtures" / "site_scan" / "lakewood_overpass.json"
HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}
AT = "2026-09-04T12:00:00+00:00"


def _scenario(name: str) -> dict[str, Any]:
    return json.loads((FIXTURE_DIR / f"{name}.json").read_text(encoding="utf-8"))["scenario"]


def _pdf_text(content: bytes, tmp_path: Path, name: str) -> str:
    p = tmp_path / name
    p.write_bytes(content)
    doc = pdfium.PdfDocument(str(p))
    try:
        return " ".join(page.get_textpage().get_text_bounded() for page in doc)
    finally:
        doc.close()


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def overpass(monkeypatch: pytest.MonkeyPatch) -> Iterator[dict[str, str]]:
    state = {"mode": "recorded"}
    payload = json.loads(SCAN_PAYLOAD.read_text(encoding="utf-8"))

    def fake(query: str, **_k):
        if state["mode"] == "down":
            return None, "stub: mirrors down"
        return payload, None

    monkeypatch.setattr(sd, "_overpass_request_with_fallback", fake)
    ss.clear_memo()
    yield state
    ss.clear_memo()


# --------------------------------------------------------------------------- #
# The predicates
# --------------------------------------------------------------------------- #


def _corr(flag: str, action: str, status: str, reason: str | None = None, note: str | None = None):
    return {
        "flag": flag,
        "action": action,
        "status": status,
        "reason": reason,
        "note": note,
        "disclosure": f"sentence for {flag} {action} {status}",
    }


def test_sheet_line_names_applied_corrections_only() -> None:
    scan = {
        "status": "ok",
        "corrections": [
            _corr("pedestrian_facility", "dismiss", "applied", "fenced"),
            _corr("school_zone", "assert", "applied"),
            _corr("bicycle_facility", "dismiss", "moot", "removed"),
        ],
    }
    assert ss.corrections_disclosure(scan) == (
        "SITE CONDITIONS CORRECTED BY OPERATOR — pedestrian sidewalks dismissed (fenced off); "
        "school zone asserted."
    )
    other = {
        "status": "ok",
        "corrections": [_corr("school_zone", "dismiss", "applied", "other", "x")],
    }
    assert ss.corrections_disclosure(other) == (
        "SITE CONDITIONS CORRECTED BY OPERATOR — school zone dismissed (x)."
    )
    for scan in (None, {}, {"status": "ok", "corrections": []}, {"status": "ok"}):
        assert ss.corrections_disclosure(scan) is None, scan
    assert (
        ss.corrections_disclosure({"corrections": [_corr("school_zone", "dismiss", "moot")]})
        is None
    )


def test_sentences_carry_every_correction_in_wire_order() -> None:
    scan = {
        "corrections": [
            _corr("school_zone", "assert", "moot"),
            _corr("pedestrian_facility", "dismiss", "applied", "fenced"),
        ]
    }
    assert ss.correction_sentences(scan) == [
        "sentence for school_zone assert moot",
        "sentence for pedestrian_facility dismiss applied",
    ]
    assert ss.correction_sentences(None) == []
    assert ss.correction_sentences({"corrections": [{"flag": "x"}]}) == []


# --------------------------------------------------------------------------- #
# The plan sheet (/render/pdf)
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("name", "halves"),
    [
        (
            "scanned-dismissed",
            ("CORRECTED BY OPERATOR", "pedestrian sidewalks dismissed (fenced off)"),
        ),
        ("scanned-asserted", ("CORRECTED BY OPERATOR", "school zone asserted")),
    ],
)
def test_plan_sheet_carries_the_corrections_line(
    name: str, halves: tuple[str, str], client: TestClient, overpass: dict[str, str], tmp_path: Path
) -> None:
    r = client.post("/render/pdf", json=_scenario(name), headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    text = _pdf_text(r.content, tmp_path, f"{name}.pdf")
    for half in halves:
        assert half in text
    assert "DRAFT FOR PE REVIEW" in text  # the trailer still renders after it


def test_plan_sheet_prints_nothing_without_corrections(
    client: TestClient, overpass: dict[str, str], tmp_path: Path
) -> None:
    ok = client.post("/render/pdf", json=_scenario("scanned-ok"), headers=HEADERS)
    assert ok.status_code == 200, ok.text[:300]
    assert "CORRECTED BY OPERATOR" not in _pdf_text(ok.content, tmp_path, "ok.pdf")


def test_plan_sheet_prints_nothing_for_a_moot_correction(
    client: TestClient, overpass: dict[str, str], tmp_path: Path
) -> None:
    sc = _scenario("scanned-ok")
    # The scan detects sidewalks here, so asserting them is moot.
    sc["meta"]["siteConditionOverrides"] = [
        {"flag": "pedestrian_facility", "action": "assert", "recorded_at": AT}
    ]
    r = client.post("/render/pdf", json=sc, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    assert "CORRECTED BY OPERATOR" not in _pdf_text(r.content, tmp_path, "moot.pdf")


# --------------------------------------------------------------------------- #
# The crew narrative (/render/markdown + /render/crew-pdf)
# --------------------------------------------------------------------------- #


def test_narrative_markdown_lists_applied_and_moot_corrections(
    client: TestClient, overpass: dict[str, str]
) -> None:
    sc = _scenario("scanned-dismissed")
    sc["meta"]["siteConditionOverrides"].append(
        {"flag": "school_zone", "action": "dismiss", "reason": "removed", "recorded_at": AT}
    )
    audit = client.post("/render/audit", json=sc, headers=HEADERS)
    assert audit.status_code == 200, audit.text[:300]
    sentences = ss.correction_sentences(audit.json()["sections"]["site_scan"])
    assert len(sentences) == 2  # one applied, one moot
    r = client.post("/render/markdown", json=sc, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    md = r.text
    assert "## Site Conditions" in md
    for s in sentences:
        assert md.count(s) == 1, s  # verbatim, once
    assert "NOT CHECKED" not in md
    assert md.index("## Site Conditions") < md.index("## Site-Specific Notes")


def test_narrative_pdf_carries_the_same_sentence(
    client: TestClient, overpass: dict[str, str], tmp_path: Path
) -> None:
    r = client.post("/render/crew-pdf", json=_scenario("scanned-asserted"), headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    text = _pdf_text(r.content, tmp_path, "crew.pdf")
    assert "Site Conditions" in text
    assert "Operator asserted school zone" in text


def test_narrative_block_carries_both_not_checked_and_corrections(
    client: TestClient, overpass: dict[str, str]
) -> None:
    overpass["mode"] = "down"
    sc = _scenario("scanned-not-checked")
    sc["meta"]["siteConditionOverrides"] = [
        {"flag": "school_zone", "action": "assert", "recorded_at": AT}
    ]
    r = client.post("/render/markdown", json=sc, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    md = r.text
    assert md.count("## Site Conditions") == 1
    assert ss.NOT_CHECKED_DISCLOSURE in md
    assert "Operator asserted school zone — the site scan did not complete." in md


def test_narrative_prints_nothing_without_corrections(
    client: TestClient, overpass: dict[str, str]
) -> None:
    r = client.post("/render/markdown", json=_scenario("scanned-ok"), headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    assert "## Site Conditions" not in r.text
    assert "Operator" not in r.text
