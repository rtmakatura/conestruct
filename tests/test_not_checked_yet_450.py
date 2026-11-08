"""#450: one name for "Not checked yet", and each rule check's short result.

Ruling 1 (Ryan, 2026-11-06): "Not checked yet" is the section's name
everywhere, the PDF included.  Ruling 2: each rule check carries a short
result from the backend (``short_result``), so the page prints title plus
short result and moves the sentence into the detail without the frontend
cutting it (Rule 3).  Rule 11: through the real routes, on the payload and
the PDF text a reader sees.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app

HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}
_ALL_FLAGS = (
    "limited_sight_distance",
    "adjacent_intersection",
    "adjacent_interchange",
    "driveways_present",
    "pedestrian_facility",
    "bicycle_facility",
    "school_zone",
)
# The records that can be a passed row (no device added or moved).  Each
# short result keeps the record's gap or directive (repair round 1).
_ADVISORY = {
    "adjacent_intersection": "No devices added · cross-street layout not generated",
    "adjacent_interchange": "No devices added · ramp layout not generated",
    "driveways_present": "Advisory · keep access gaps, no devices across driveways",
}


@pytest.fixture(scope="module", autouse=True)
def _set_render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def _shoulder(**over: Any) -> dict[str, Any]:
    s: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "T", "address": "", "lat": 0.0, "lng": 0.0},
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
    s.update(over)
    return s


def _audit(client: TestClient, s: dict[str, Any]) -> dict[str, Any]:
    res = client.post("/render/audit", headers=HEADERS, json=s)
    assert res.status_code == 200, res.text[:300]
    return res.json()


def _numbers(text: str) -> list[str]:
    return re.findall(r"\d[\d,]*", text)


_SCENARIOS = {
    "divided-shoulder": _shoulder(),
    "reduced-45": _shoulder(workZoneSpeed=45),
    "reduced-30": _shoulder(workZoneSpeed=30),
    "night": _shoulder(night=True),
    "every-site-flag": _shoulder(
        meta={
            "project": "T",
            "address": "",
            "lat": 0.0,
            "lng": 0.0,
            "siteConditions": {f: True for f in _ALL_FLAGS},
        }
    ),
}


@pytest.mark.parametrize("name", list(_SCENARIOS))
def test_every_check_and_info_item_carries_an_honest_short_result(
    client: TestClient, name: str
) -> None:
    """Every Colorado check and info item has a non-empty short result, no
    longer than its sentence, and every number in it is in the sentence
    (the short result restates the check, never adds to it)."""
    co = _audit(client, _SCENARIOS[name])["sections"]["colorado"]
    rows = co["checks"] + co["info_items"]
    assert rows
    for c in rows:
        short = c.get("short_result")
        assert isinstance(short, str) and short.strip(), c["label"]
        assert len(short) < len(c["detail"]), (c["label"], short)
        for n in _numbers(short):
            assert n in _numbers(c["detail"]), (c["label"], short, c["detail"])


def test_both_sides_reads_like_the_ruling_example(client: TestClient) -> None:
    """Ruling 2's example: "Not required · 0 left, 10 right".  A divided
    shoulder closure is Note 8's one-shoulder exception."""
    co = _audit(client, _shoulder())["sections"]["colorado"]
    row = next(c for c in co["checks"] if c["label"].startswith("Signs on both sides"))
    m = re.search(r"Signs placed: (\d+) left, (\d+) right\.", row["detail"])
    assert m, row["detail"]
    assert row["short_result"] == f"Not required · {m.group(1)} left, {m.group(2)} right"


def test_short_results_on_the_other_checks(client: TestClient) -> None:
    co = _audit(client, _shoulder())["sections"]["colorado"]
    by = {c["label"]: c["short_result"] for c in co["checks"] + co["info_items"]}
    assert by["Speed reduction <= 15 mph per sign installation"] == (
        "No reduction · 55 mph throughout"
    )
    lighting = next(v for k, v in by.items() if k.startswith("Flagger station lighting"))
    assert lighting == "Not applicable · no flaggers"
    aadt = next(v for k, v in by.items() if k.startswith("AADT threshold"))
    assert aadt == "Not applicable · not a mobile operation"
    plaques = by["G20-5P Work Zone signs every 2,640 ft"]
    assert re.fullmatch(r"\d+ required · \d+ placed", plaques), plaques


def test_the_reduced_speed_short_result_names_both_speeds(client: TestClient) -> None:
    co = _audit(client, _shoulder(workZoneSpeed=45))["sections"]["colorado"]
    row = next(c for c in co["checks"] if c["label"].startswith("Speed reduction"))
    assert re.fullmatch(r"55 → 45 mph · \d+ required · \d+ placed", row["short_result"])


def test_advisory_site_records_carry_a_short_result_and_the_rest_do_not(
    client: TestClient,
) -> None:
    """X7: only the records that can be a passed row get the field; the ▲
    records' wire stays as it was."""
    recs = _audit(client, _SCENARIOS["every-site-flag"])["sections"]["site_adjustments"]
    by = {r["flag"]: r for r in recs}
    for flag, short in _ADVISORY.items():
        assert by[flag]["short_result"] == short, flag
    for flag in ("pedestrian_facility", "bicycle_facility", "school_zone"):
        assert "short_result" not in by[flag], flag
    sight = by["limited_sight_distance"]
    if sight["devices_modified"] == 0:
        assert sight["short_result"] == (
            "No signs moved · Engineer sets locations · add signs where sight is blocked"
        )
    else:
        assert "short_result" not in sight


def test_a_sight_distance_record_with_no_move_keeps_the_engineer_note() -> None:
    """Repair round 1: the no-move short result keeps Notes 10 and 25's
    directives, and the sentence it stands for still carries the note."""
    from src.rules.site_adjustments import LIMITED_SIGHT_ENGINEER_NOTE, apply_site_adjustments
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=45,
        num_lanes=1,
        lane_width_ft=12.0,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=500.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    _, recs = apply_site_adjustments([], params, {"limited_sight_distance": True})
    rec = recs[0]
    assert rec["devices_modified"] == 0
    assert rec["short_result"] == (
        "No signs moved · Engineer sets locations · add signs where sight is blocked"
    )
    assert rec["action"].endswith(LIMITED_SIGHT_ENGINEER_NOTE)


def test_the_site_actions_name_not_checked_yet(client: TestClient) -> None:
    recs = _audit(client, _SCENARIOS["every-site-flag"])["sections"]["site_adjustments"]
    by = {r["flag"]: r["action"] for r in recs}
    for flag in ("adjacent_intersection", "adjacent_interchange"):
        assert by[flag].endswith("isn't generated. See Not checked yet."), by[flag]
    assert not any("pending" in a.lower() for a in by.values())


def _pdf_pages(client: TestClient, s: dict[str, Any], tmp_path: Path) -> list[str]:
    r = client.post("/render/audit-pdf", json=s, headers=HEADERS)
    assert r.status_code == 200, r.text[:300]
    p = tmp_path / "audit.pdf"
    p.write_bytes(r.content)
    doc = pdfium.PdfDocument(str(p))
    try:
        return [" ".join(page.get_textpage().get_text_bounded().split()) for page in doc]
    finally:
        doc.close()


def test_the_audit_pdf_says_not_checked_yet_and_never_pending(
    client: TestClient, tmp_path: Path
) -> None:
    """Page 1's cover line, the list's heading and first line, and the site
    actions all use the section's name; no "pending" is left in the PDF."""
    s = _shoulder(
        meta={
            "project": "T",
            "address": "",
            "lat": 0.0,
            "lng": 0.0,
            "siteConditions": {"adjacent_intersection": True, "adjacent_interchange": True},
        }
    )
    pages = _pdf_pages(client, s, tmp_path)
    assert re.search(r"\d+ not checked yet · reference", pages[0]), pages[0][:600]
    text = " ".join(pages)
    assert "Not checked yet" in text
    assert re.search(r"\d+ reference\(s\) not checked yet\.", text)
    assert text.count("See Not checked yet.") == 2
    assert "pending" not in text.lower()
