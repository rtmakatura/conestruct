"""#453: the calculation details read as sentences and labelled rows.

Ruling 1 (Ryan, 2026-11-06): every opened detail is one plain sentence,
label-value rows with only the values in mono, and a sentence-case Source
line; a backend sentence is fixed in the backend (Rule 3), so the audit PDF
prints the same sentence; no internal key or variable name reaches the page.
Ruling 4: the driveways short result.  Rule 11: on the payload the panel
reads and the PDF text a reader sees, across the kinds.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient

from src.api.audit import build_audit_trail
from src.api.render_api import app
from src.generation.layout import generate_lane_closure_divided
from src.rules.validators import ScenarioParams
from tests.test_formula_fields import _flagger, _near, _shoulder, _trail

HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}

# What a reader must never see in a calculation detail: an engine key, a
# code-style arrow or comparison, a formula letter labelling a row.
_RAW = re.compile(r"road_type|urban_low|urban_high|_\w+ =|->|>=|<=|\bx S\b|W x S")
_SENTENCE_KEYS = {
    "taper": ("formula_choice",),
    "buffer": ("lookup_text",),
    "spacing": ("in_taper_text", "on_tangent_text"),
    "advance": ("road_type_text", "spacing_text"),
}


def _lane() -> dict[str, Any]:
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
    )
    return build_audit_trail(generate_lane_closure_divided(params), params)


_TRAILS = {
    "shoulder-55": lambda: _trail(_shoulder()),
    "shoulder-30-urban": lambda: _trail(
        _shoulder(roadType="urban_arterial", speed=30, divided=False, workLen=1000.0)
    ),
    "flagger": lambda: _trail(_flagger()),
    "near-intersection": lambda: _trail(_near()),
    "lane": _lane,
}


@pytest.fixture(scope="module", autouse=True)
def _set_render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.mark.parametrize("name", list(_TRAILS))
def test_detail_sentences_are_plain_sentences(name: str) -> None:
    t = _TRAILS[name]()
    for section, keys in _SENTENCE_KEYS.items():
        for key in keys:
            text = t[section][key]
            assert not _RAW.search(text), (section, key, text)
            assert text[0].isupper(), (section, key, text)


@pytest.mark.parametrize("name", list(_TRAILS))
def test_formula_rows_carry_plain_labels(name: str) -> None:
    """X3: each panel row is "<plain label> = <value>"; no formula letter or
    engine arrow labels a row, and every row splits into label and value."""
    t = _TRAILS[name]()
    for section in ("taper", "spacing"):
        for line in t[section]["formula_text"]:
            label, sep, value = line.partition(" = ")
            assert sep, (section, line)
            assert label not in {"W", "L", "L/3", "B", "A", "C"}, (section, line)
            assert re.match(r"^[A-Z][a-z]", label), (section, line)
            assert "->" not in value and "max spacing" not in value, (section, line)


def test_the_shoulder_rows_keep_their_numbers() -> None:
    """X16: words only.  The urban 30 mph shoulder plan of the walk."""
    t = _TRAILS["shoulder-30-urban"]()
    assert t["taper"]["formula_text"] == [
        "Shoulder width = 8 ft (assumed)",
        "Full taper = 8 × 30^2 / 60 = 120 ft",
        "Shoulder taper, one third = 120 / 3 = 40 ft",
    ]
    sp = t["spacing"]
    assert sp["formula_text"] == [
        "Taper, 40 ft = 4 drums at 13.3 ft",
        "Tangent, 1,000 ft = 18 cones at 58.8 ft",
        "Buffer, 200 ft (S-630-1 Sheet 2 Note 18b) = 3 cones at 50.0 ft",
        "Downstream taper, 50 ft (MUTCD Sec 6B.08: 50-100 ft) = 2 cones at ~25 ft",
        "Cones in all (18 tangent, 3 buffer, 2 downstream) = 23",
    ]
    assert sp["in_taper_text"] == (
        "In the taper, devices are spaced 30 ft apart, the speed in feet at 30 mph "
        "(MUTCD Sec 6K.01)."
    )
    # The PDF's count lines are unchanged: the same numbers as the rows.
    assert (
        sp["taper_count_text"] == "L/3 = 40 ft / 30 ft max spacing -> 4 drums at 13.3 ft intervals"
    )


def test_advance_names_the_table_row_and_defines_its_letters() -> None:
    t = _TRAILS["shoulder-30-urban"]()["advance"]
    assert t["road_type_text"] == (
        "At 30 mph, the signs are spaced by MUTCD Table 6B-1's Urban (low speed) row."
    )
    # X4 (repair 1): each letter defined in Table 6B-1's own words (p. 773).
    assert t["spacing_text"] == (
        "Table 6B-1 spacing: A 100 ft (the distance from the transition or point of "
        "restriction to the first sign), B 100 ft (the distance between the first and "
        "second signs), C 100 ft (the distance between the second and third signs)."
    )


def test_an_unresolved_road_type_names_no_row(monkeypatch: pytest.MonkeyPatch) -> None:
    """Rule 10 (repair 1): with no Table 6B-1 row for the category, the
    sentence says so; it never names a default row."""
    import src.api.audit as audit

    monkeypatch.setattr(audit, "_TABLE_6B_1_ROW", {})
    t = _TRAILS["shoulder-30-urban"]()["advance"]
    assert t["road_type_text"] == (
        "At 30 mph, the road type wasn't resolved, so no Table 6B-1 row is named."
    )


def test_the_corridor_warning_says_the_road_class_in_words() -> None:
    """Repair 1: no OSM tag value in quotes, no slash list."""
    from src.rules.site_detection import validate_corridor_against_osm

    out = validate_corridor_against_osm(
        39.73978, -104.96825, 270.0, road_result={"highway": "residential", "bearing_deg": 270.0}
    )
    (w,) = [w for w in out["warnings"] if w["flag"] == "no_road_at_anchor"]
    assert w["message"] == (
        "No major road (motorway, trunk, primary or secondary) found within 50 m of the "
        "anchor (39.73978, -104.96825); the closest road within 50 m is a residential "
        "road.  Check that the coordinates match the actual work zone."
    )


@pytest.mark.parametrize("name", list(_TRAILS))
def test_source_footers_are_sentence_case(name: str) -> None:
    t = _TRAILS[name]()
    footers = [t[s]["citation"]["footer"] for s in ("taper", "buffer", "spacing", "advance")]
    if "sight_distance_citation" in t.get("flagger", {}):
        footers.append(t["flagger"]["sight_distance_citation"]["footer"])
    for f in footers:
        words = re.findall(r"\b[A-Za-z]{4,}\b", f)
        caps = [w for w in words if w.isupper() and w not in {"MUTCD", "CDOT"}]
        assert not caps, (f, caps)


def test_driveways_short_result_is_ruling_4() -> None:
    from src.rules.site_adjustments import apply_site_adjustments

    params = ScenarioParams(
        speed_mph=30,
        num_lanes=2,
        closure_type="shoulder",
        road_type="urban_low",
        work_zone_length_ft=500.0,
        lane_width_ft=12.0,
        shoulder_width_ft=8.0,
    )
    _, records = apply_site_adjustments([], params, flags={"driveways_present": True})
    rec = next(r for r in records if r["flag"] == "driveways_present")
    assert rec["short_result"] == "Advisory · keep access gaps, no devices across driveways"


def test_permit_tier_reason_is_a_sentence() -> None:
    from src.rules.jurisdiction import _suggest_tier

    reason = _suggest_tier({"name": "Denver", "permits": {"tiers": []}}, None)[1]  # type: ignore[arg-type]
    assert reason == "Denver publishes no permit tiers."


def test_scan_evidence_names_the_zone_in_words() -> None:
    """X10: the bucket's detail line says the zone; the classifier key never."""
    from src.rules import site_detection

    assert site_detection._ZONE_WORDS["work_zone"] == "in the work zone"
    src = Path(site_detection.__file__).read_text(encoding="utf-8")
    assert "{feature['zone']} @" not in src


def _pdf_text(client: TestClient, body: dict[str, Any], tmp_path: Path) -> str:
    r = client.post("/render/audit-pdf", json=body, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    p = tmp_path / "audit.pdf"
    p.write_bytes(r.content)
    doc = pdfium.PdfDocument(str(p))
    try:
        return " ".join(" ".join(pg.get_textpage().get_text_bounded().split()) for pg in doc)
    finally:
        doc.close()


def test_the_audit_pdf_prints_the_same_sentences(tmp_path: Path) -> None:
    """Rule 3: the page's sentence and the PDF's are one string."""
    client = TestClient(app)
    body = _shoulder(roadType="urban_arterial", speed=30, divided=False, workLen=1000.0)
    t = client.post("/render/audit", json=body, headers=HEADERS).json()["sections"]
    text = _pdf_text(client, body, tmp_path)
    for section, keys in _SENTENCE_KEYS.items():
        for key in keys:
            assert " ".join(t[section][key].split()) in text, (section, key)
    assert "road_type" not in text and "urban_low" not in text
