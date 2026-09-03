"""#224 phase 2 (s2-arc16) — the audit PDF prints the NOT-CHECKED disclosure.

A plan generated with ``proceed_if_unavailable`` after a failed site scan
carries ``sections.site_scan.disclosure`` (authored once, backend-side,
in ``src/api/site_scan.py``).  The PDF is the third of the three ruled
surfaces (panel, section 03, audit PDF); its block renders the string
VERBATIM — one voice — plus the scan's error line.  Every other scan
state prints nothing here this phase (ok-scan facts are phase 3's tier
rows; ``not_run`` is not a finding).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient

from src.api import site_scan as ss
from src.rendering.audit_blocks import _site_scan_blocks, audit_to_blocks
from src.rendering.document import Body, Heading
from src.rules import site_detection as sd

os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")
HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}
FIXTURE = Path(__file__).parent / "fixtures" / "pdf_worst_case" / "scanned-not-checked.json"


def _texts(blocks: list[Any]) -> str:
    return " | ".join(b.text for b in blocks if isinstance(b, (Body, Heading)))


def _unavailable(proceeded: bool) -> dict[str, Any]:
    prov = ss.SiteScanProvenance(
        status="unavailable",
        error="scan budget exceeded (20 s)",
        mode="corridor",
        measured_at="2026-09-03T15:29:51+00:00",
        duration_ms=20525,
        budget_s=20.0,
        proceeded_anyway=proceeded,
        disclosure=ss.NOT_CHECKED_DISCLOSURE if proceeded else None,
    )
    return prov.model_dump(mode="json")


def test_proceeded_anyway_prints_the_disclosure_verbatim_and_the_error() -> None:
    blocks = _site_scan_blocks(_unavailable(proceeded=True))
    text = _texts(blocks)
    assert ss.NOT_CHECKED_DISCLOSURE in text
    assert "scan budget exceeded (20 s)" in text
    assert isinstance(blocks[0], Heading)


def test_ok_scan_prints_nothing_this_phase() -> None:
    prov = ss.SiteScanProvenance(
        status="ok", mode="corridor", measured_at="x", buckets={}, flags={}
    )
    assert _site_scan_blocks(prov.model_dump(mode="json")) == []


def test_not_run_and_empty_print_nothing() -> None:
    assert _site_scan_blocks(ss.not_run_provenance("not_requested").model_dump(mode="json")) == []
    assert _site_scan_blocks({}) == []


def test_refused_without_proceed_never_reaches_a_pdf_but_prints_nothing_if_it_did() -> None:
    assert _site_scan_blocks(_unavailable(proceeded=False)) == []


def test_audit_to_blocks_places_the_disclosure_after_corridor_before_site_adjustments() -> None:
    projection = {
        "summary": {},
        "sections": {
            "corridor_validation": {
                "checked": False,
                "warnings": [],
                "reason": "not_run_no_coords",
            },
            "site_scan": _unavailable(proceeded=True),
            "site_adjustments": [{"flag": "pedestrian_facility", "rule": "R", "action": "A"}],
        },
        "pending_verification": {},
    }
    headings = [b.text for b in audit_to_blocks(projection) if isinstance(b, Heading)]
    i_c, i_s, i_a = (
        headings.index("Corridor Validation"),
        headings.index("Site Conditions"),
        headings.index("Site Adjustments"),
    )
    assert i_c < i_s < i_a


def test_real_audit_pdf_carries_the_disclosure_text(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Through the real route: scan stub down + proceed → 200 whose PDF
    text contains the disclosure (the same fixture the containment test
    measures at zero)."""
    import json

    from src.api.render_api import app

    ss.clear_memo()
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda q, **_k: (None, "stub: mirrors down")
    )
    scenario = json.loads(FIXTURE.read_text(encoding="utf-8"))["scenario"]
    r = TestClient(app).post("/render/audit-pdf", json=scenario, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    p = tmp_path / "audit.pdf"
    p.write_bytes(r.content)
    doc = pdfium.PdfDocument(str(p))
    try:
        text = " ".join(page.get_textpage().get_text_bounded() for page in doc)
    finally:
        doc.close()
    # PDF text extraction normalises the em dash's surroundings; assert
    # the two halves the reader must see.
    assert "SITE CONDITIONS NOT CHECKED" in text
    assert "service unavailable at generation" in text
    ss.clear_memo()
