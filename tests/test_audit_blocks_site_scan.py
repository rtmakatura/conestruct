"""#224 phase 2 (s2-arc16) — the audit PDF prints the NOT-CHECKED disclosure.

A plan generated with ``proceed_if_unavailable`` after a failed site scan
carries ``sections.site_scan.disclosure`` (authored once, backend-side,
in ``src/api/site_scan.py``).  The PDF is the third of the three ruled
surfaces (panel, section 03, audit PDF); its block renders the string
VERBATIM — one voice — plus the scan's error line.  Every other scan
state prints nothing here this phase (ok-scan facts are phase 3's tier
rows; ``not_run`` is not a finding).

#224 phase 3 (s2-arc17, ruling e2): an ``ok`` scan now prints a Site
Conditions table — one row per rule-bearing condition (so the cover
ledger's counted scan facts all have a body row), reference rows for the
keyless buckets, evidence as the wire sent it.
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
from src.rendering.document import Body, Heading, Table_
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


def _ok(buckets: dict[str, Any]) -> dict[str, Any]:
    prov = ss.SiteScanProvenance(
        status="ok",
        mode="corridor",
        measured_at="2026-09-03T14:32:00+00:00",
        duration_ms=1234,
        buckets={k: ss.SiteScanBucket.model_validate(v) for k, v in buckets.items()},
        flags={},
    )
    return prov.model_dump(mode="json")


def _rows(blocks: list[Any]) -> list[list[str]]:
    tables = [b for b in blocks if isinstance(b, Table_)]
    assert len(tables) == 1
    return [list(row) for row in tables[0].rows]  # cells are rich-text strings


def test_ok_scan_prints_the_conditions_table_one_row_per_rule_bearing_condition() -> None:
    """#224 phase 3 (ruling e2): the cover ledger counts an absent key as
    checked, so the body names it; a detected key carries its evidence
    as the wire sent it (count, the ft twin, the first detail line)."""
    blocks = _site_scan_blocks(
        _ok(
            {
                "intersections": {
                    "detected": True,
                    "count": 26,
                    "nearest_distance_m": 10.4,
                    "details": ["unnamed at 39.7112, -105.0816 [downstream @ 46 ft]"],
                },
                "interchanges": {"detected": False, "count": 0},
                "sidewalks": {"detected": True, "count": 18, "nearest_distance_m": 14.2},
                "bike_facilities": {"detected": False, "count": 0},
                "schools": {"detected": False, "count": 0},
                "hospitals": {"detected": True, "count": 1, "nearest_distance_m": 300.0},
                "railroad_crossings": {"detected": False, "count": 0},
            }
        )
    )
    assert isinstance(blocks[0], Heading) and blocks[0].text == "Site Conditions"
    assert "2026-09-03T14:32:00+00:00" in _texts(blocks)
    rows = _rows(blocks)
    by_label = {r[0]: r for r in rows}
    assert [r[0] for r in rows[:5]] == [
        "Adjacent at-grade intersection",
        "Adjacent interchange (highway ramps)",
        "Pedestrian sidewalks",
        "Bike lane / cycleway",
        "School zone",
    ]
    assert by_label["Adjacent at-grade intersection"][1] == "DETECTED"
    assert (
        by_label["Adjacent at-grade intersection"][2] == "26 found · nearest 34.1 ft from anchor · "
        "unnamed at 39.7112, -105.0816 [downstream @ 46 ft]"
    )
    assert by_label["Pedestrian sidewalks"][2] == "18 found · nearest 46.6 ft from anchor"
    assert by_label["School zone"][1:] == ["None along the corridor", ""]
    # Keyless buckets: reference rows, present only when the wire carried them.
    assert by_label["Hospital"][1] == "Reference — detected, no rule"
    assert by_label["Railroad crossing"][1] == "Reference — none"
    assert "Road curvature" not in by_label


def test_ok_scan_with_a_bucket_missing_from_the_wire_says_not_reported() -> None:
    rows = _rows(_site_scan_blocks(_ok({"schools": {"detected": False, "count": 0}})))
    by_label = {r[0]: r for r in rows}
    assert by_label["School zone"][1] == "None along the corridor"
    assert by_label["Pedestrian sidewalks"][1] == "not reported"
    assert len(rows) == 5


def test_ok_scan_discloses_overridden_manual_values() -> None:
    scan = _ok({"schools": {"detected": False, "count": 0}})
    scan["manual_flags_discarded"] = {"school_zone": True}
    assert "Operator-set values the scan overrode: school_zone=True." in _texts(
        _site_scan_blocks(scan)
    )


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


def test_real_audit_pdf_on_an_ok_scan_names_every_condition_the_cover_counts(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Through the real route on the scanned-ok fixture with the recorded
    payload: the five condition labels are in the body, the two absent
    ones read as named passes, and the ledger's checked count includes
    them (parity between the cover line and the body — the #223 gap
    class, closed by construction)."""
    import json

    from src.api.render_api import app

    ss.clear_memo()
    payload = json.loads(
        (Path(__file__).parent / "fixtures" / "site_scan" / "lakewood_overpass.json").read_text(
            encoding="utf-8"
        )
    )
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda q, **_k: (payload, None))
    scenario = json.loads(
        (Path(__file__).parent / "fixtures" / "pdf_worst_case" / "scanned-ok.json").read_text(
            encoding="utf-8"
        )
    )["scenario"]
    r = TestClient(app).post("/render/audit-pdf", json=scenario, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    p = tmp_path / "audit.pdf"
    p.write_bytes(r.content)
    doc = pdfium.PdfDocument(str(p))
    try:
        text = " ".join(page.get_textpage().get_text_bounded() for page in doc)
    finally:
        doc.close()
    ss.clear_memo()
    # Wrap-safe fragments: pdfium breaks a cell's text at its column width.
    for label in (
        "Adjacent at-grade",
        "Adjacent interchange",
        "Pedestrian sidewalks",
        "Bike lane",
        "School zone",
    ):
        assert label in text, label
    assert "None along the corridor" in text
    assert "DETECTED" in text
    assert "found" in text and "ft from anchor" in text


# --------------------------------------------------------------------------- #
# #224 phase 4 (s2-arc18, commit 3) — operator corrections in the table
# --------------------------------------------------------------------------- #


def _correction(flag: str, action: str, status: str, reason: str | None = None) -> dict[str, Any]:
    return {
        "flag": flag,
        "action": action,
        "reason": reason,
        "note": None,
        "recorded_at": "2026-09-04T12:00:00+00:00",
        "status": status,
        "scan_detected": None,
        "disclosure": f"Sentence for {flag} {action} ({status}).",
    }


def test_applied_dismiss_rewrites_the_result_cell_and_keeps_the_evidence() -> None:
    scan = _ok(
        {
            "sidewalks": {"detected": True, "count": 18, "nearest_distance_m": 14.2},
            "schools": {"detected": False, "count": 0},
        }
    )
    scan["corrections"] = [_correction("pedestrian_facility", "dismiss", "applied", "fenced")]
    blocks = _site_scan_blocks(scan)
    by_label = {r[0]: r for r in _rows(blocks)}
    assert by_label["Pedestrian sidewalks"][1] == "DETECTED — dismissed by operator (fenced off)"
    assert by_label["Pedestrian sidewalks"][2] == "18 found · nearest 46.6 ft from anchor"
    assert by_label["School zone"][1] == "None along the corridor"
    texts = _texts(blocks)
    assert "Operator corrections to the site scan" in texts
    assert "Sentence for pedestrian_facility dismiss (applied)." in texts


def test_applied_assert_rewrites_the_result_cell_with_the_scan_verdict() -> None:
    scan = _ok({"schools": {"detected": False, "count": 0}})
    scan["corrections"] = [
        _correction("school_zone", "assert", "applied"),
        _correction("bicycle_facility", "assert", "applied"),  # bucket missing from the wire
    ]
    by_label = {r[0]: r for r in _rows(_site_scan_blocks(scan))}
    assert by_label["School zone"][1:] == ["ASSERTED by operator (scan: none)", ""]
    assert by_label["Bike lane / cycleway"][1:] == ["ASSERTED by operator (scan: not reported)", ""]


def test_moot_correction_leaves_the_row_and_is_still_disclosed() -> None:
    scan = _ok({"schools": {"detected": False, "count": 0}})
    scan["corrections"] = [_correction("school_zone", "dismiss", "moot", "removed")]
    blocks = _site_scan_blocks(scan)
    by_label = {r[0]: r for r in _rows(blocks)}
    assert by_label["School zone"][1] == "None along the corridor"
    assert "Sentence for school_zone dismiss (moot)." in _texts(blocks)


def test_proceeded_anyway_lists_the_corrections_after_the_disclosure() -> None:
    scan = _unavailable(True)
    scan["corrections"] = [_correction("school_zone", "assert", "applied")]
    texts = _texts(_site_scan_blocks(scan))
    assert ss.NOT_CHECKED_DISCLOSURE in texts
    assert texts.index("Sentence for school_zone assert (applied).") > texts.index(
        ss.NOT_CHECKED_DISCLOSURE
    )


@pytest.mark.parametrize(
    ("name", "fragment"),
    # Wrap-safe fragments: pdfium breaks a cell's text at its column width.
    [
        ("scanned-dismissed", "dismissed"),
        ("scanned-asserted", "ASSERTED"),
    ],
)
def test_real_audit_pdf_on_a_corrected_scan_carries_the_cover_line_and_the_result_cell(
    name: str, fragment: str, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Through the real route on the corrected fixtures: the Result cell
    names the correction, the correction sentence is in the body, and
    the cover's Plan status line equals the classifier over the served
    audit for the same scenario (parity by construction)."""
    import json

    from src.api.render_api import app
    from src.rendering.tier_ledger import ledger_line, tier_ledger

    payload = json.loads(
        (Path(__file__).parent / "fixtures" / "site_scan" / "lakewood_overpass.json").read_text(
            encoding="utf-8"
        )
    )
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda q, **_k: (payload, None))
    scenario = json.loads(
        (Path(__file__).parent / "fixtures" / "pdf_worst_case" / f"{name}.json").read_text(
            encoding="utf-8"
        )
    )["scenario"]
    client = TestClient(app)
    ss.clear_memo()
    audit = client.post("/render/audit", json=scenario, headers=HEADERS)
    assert audit.status_code == 200, audit.text[:300]
    ss.clear_memo()
    r = client.post("/render/audit-pdf", json=scenario, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    ss.clear_memo()
    p = tmp_path / "audit.pdf"
    p.write_bytes(r.content)
    doc = pdfium.PdfDocument(str(p))
    try:
        text = " ".join(page.get_textpage().get_text_bounded() for page in doc)
    finally:
        doc.close()
    assert fragment in text
    assert "Operator corrections to the site scan" in text
    assert ledger_line(tier_ledger(audit.json(), None)) in text
