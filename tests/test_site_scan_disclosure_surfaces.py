"""#224 phase 3 (s2-arc17, commit 2) — the NOT-CHECKED disclosure on the
plan sheet and in the crew narrative.

Phase 2 put the backend-authored sentence (``site_scan.NOT_CHECKED_DISCLOSURE``)
on the panel, in section 03 and in the audit PDF.  This commit adds the two
remaining deliverables a crew actually carries: the plan sheet's notes box
(a fixed-obligation line before the DRAFT trailer, never cut) and the crew
narrative's ``## Site Conditions`` block (Markdown and the phone PDF).

Rule 11 — test where the bug lives: every case here goes through the REAL
render routes (TestClient) over the committed scanned fixtures, with the
Overpass trip stubbed exactly as the containment harness stubs it.  One
predicate (``not_checked_disclosure``) decides for every surface, so the
grid is: proceeded-after-outage prints the sentence verbatim on all three
surfaces; an ok scan, a not_run scan and a refusal print nothing.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path

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

# The reader must see both halves; PDF text extraction normalises the
# em dash's surroundings (the audit-PDF test's finding).
HALVES = ("SITE CONDITIONS NOT CHECKED", "service unavailable at generation")


def _scenario(name: str) -> dict:
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
    """``state["mode"]`` selects the stub: ``recorded`` or ``down``."""
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
# The predicate
# --------------------------------------------------------------------------- #


def test_not_checked_disclosure_prints_for_exactly_one_state() -> None:
    proceeded = {
        "status": "unavailable",
        "proceeded_anyway": True,
        "disclosure": ss.NOT_CHECKED_DISCLOSURE,
    }
    assert ss.not_checked_disclosure(proceeded) == ss.NOT_CHECKED_DISCLOSURE
    for scan in (
        None,
        {},
        {"status": "ok", "buckets": {}},
        {"status": "not_run", "reason": "not_requested"},
        {"status": "unavailable", "proceeded_anyway": False},
        # proceeded but the backend authored no sentence — nothing to print
        {"status": "unavailable", "proceeded_anyway": True, "disclosure": None},
    ):
        assert ss.not_checked_disclosure(scan) is None, scan


# --------------------------------------------------------------------------- #
# The plan sheet (/render/pdf)
# --------------------------------------------------------------------------- #


def test_plan_sheet_carries_the_disclosure_after_a_proceeded_outage(
    client: TestClient, overpass: dict[str, str], tmp_path: Path
) -> None:
    overpass["mode"] = "down"
    r = client.post("/render/pdf", json=_scenario("scanned-not-checked"), headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    text = _pdf_text(r.content, tmp_path, "sheet.pdf")
    for half in HALVES:
        assert half in text
    # The fixed-obligation trailer still renders after it (never cut).
    assert "DRAFT FOR PE REVIEW" in text


def test_plan_sheet_prints_nothing_for_an_ok_scan_or_no_scan(
    client: TestClient, overpass: dict[str, str], tmp_path: Path
) -> None:
    ok = client.post("/render/pdf", json=_scenario("scanned-ok"), headers=HEADERS)
    assert ok.status_code == 200, ok.text[:300]
    assert "NOT CHECKED" not in _pdf_text(ok.content, tmp_path, "ok.pdf")
    plain = client.post("/render/pdf", json=_scenario("control-typical"), headers=HEADERS)
    assert plain.status_code == 200, plain.text[:300]
    assert "NOT CHECKED" not in _pdf_text(plain.content, tmp_path, "plain.pdf")


# --------------------------------------------------------------------------- #
# The crew narrative (/render/markdown + /render/crew-pdf)
# --------------------------------------------------------------------------- #


def test_narrative_markdown_carries_the_site_conditions_block(
    client: TestClient, overpass: dict[str, str]
) -> None:
    overpass["mode"] = "down"
    r = client.post("/render/markdown", json=_scenario("scanned-not-checked"), headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    md = r.text
    assert "## Site Conditions" in md
    assert ss.NOT_CHECKED_DISCLOSURE in md  # verbatim, the one backend sentence
    assert md.count(ss.NOT_CHECKED_DISCLOSURE) == 1
    # The block sits before the operator-set site notes it qualifies.
    assert md.index("## Site Conditions") < md.index("## Site-Specific Notes")


def test_narrative_pdf_carries_the_same_sentence(
    client: TestClient, overpass: dict[str, str], tmp_path: Path
) -> None:
    overpass["mode"] = "down"
    r = client.post("/render/crew-pdf", json=_scenario("scanned-not-checked"), headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    text = _pdf_text(r.content, tmp_path, "crew.pdf")
    assert "Site Conditions" in text
    for half in HALVES:
        assert half in text


def test_narrative_prints_nothing_for_an_ok_scan_or_no_scan(
    client: TestClient, overpass: dict[str, str]
) -> None:
    for name in ("scanned-ok", "control-typical"):
        r = client.post("/render/markdown", json=_scenario(name), headers=HEADERS)
        assert r.status_code == 200, r.text[:300]
        assert "## Site Conditions" not in r.text
        assert "NOT CHECKED" not in r.text
