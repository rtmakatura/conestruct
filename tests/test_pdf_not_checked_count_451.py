"""#451: the audit PDF counts "Not checked yet" one way.

Ryan (cc-queue-ux.md item 5): "the "Not checked yet" section on the audit
PDF lists all 3 items, including work hours, so it matches the cover."
The cover's number is the tier ledger's ``pending``; the section lists the
same ledger facts (``tier_ledger.pending_fact_ids``), work hours included.
Rule 11: through ``/render/audit-pdf``, on the PDF text a reader sees.
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
from src.rendering.audit_blocks import Bullets, Heading, audit_to_blocks
from src.rendering.tier_ledger import tier_ledger

HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}
_COVER = re.compile(r"(\d+) not checked yet · reference")
_SECTION = re.compile(r"(\d+) (?:items?|reference\(s\)) not checked yet\.")
_NOT_SET = "Work hours not checked (schedule marked Not set: hours not evaluated)"


@pytest.fixture(scope="module", autouse=True)
def _set_render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def colfax(**over: Any) -> dict[str, Any]:
    """The issue's repro: 1600 E Colfax Ave, Denver, Shoulder, One-way,
    schedule "Not set"."""
    s: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {
            "project": "T",
            "address": "1600 E Colfax Ave, Denver, CO",
            "lat": 39.74003,
            "lng": -104.96753,
        },
        "roadType": "urban_arterial",
        "speed": 30,
        "lanes": 3,
        "laneWidth": 11.0,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 300.0,
        "night": False,
        "carriageway": {
            "oneway": "yes",
            "highwayClass": "primary",
            "confirmed": "one_way_street",
        },
        "jurisdiction_key": "denver",
        "street_class": "arterial",
        "schedule": {"date_mode": "tbd"},
    }
    s.update(over)
    return s


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


def _counts(pages: list[str]) -> tuple[int, int]:
    cover = _COVER.search(pages[0])
    section = _SECTION.search(" ".join(pages[1:]))
    assert cover and section, pages[0][:400]
    return int(cover.group(1)), int(section.group(1))


def test_cover_and_section_count_the_same_items_with_work_hours(
    client: TestClient, tmp_path: Path
) -> None:
    """The repro: page 1's number equals the section's, and the section
    names the unchecked work hours in the backend's words."""
    pages = _pdf_pages(client, colfax(), tmp_path)
    cover, section = _counts(pages)
    assert cover == section, (cover, section)
    text = " ".join(pages)
    assert _NOT_SET in text
    assert f"{section} item{'' if section == 1 else 's'} not checked yet." in text
    assert "reference(s)" not in text


@pytest.mark.parametrize(
    ("over", "hours"),
    [
        # The page reads an absent schedule as "Not set"; so does the PDF.
        ({"schedule": None}, _NOT_SET),
        # A date mode with no times: the backend's own reason, as on the page.
        (
            {"schedule": {"date_mode": "single", "work_date": "2026-11-10"}},
            "Work hours not checked (no work schedule provided)",
        ),
        (
            {
                "schedule": {
                    "date_mode": "single",
                    "work_date": "2026-11-10",
                    "start_time": 10.0,
                    "end_time": 14.0,
                }
            },
            None,
        ),
        ({"jurisdiction_key": None, "street_class": None, "schedule": None}, None),
    ],
    ids=["no-schedule", "date-without-times", "schedule-set", "no-jurisdiction"],
)
def test_section_matches_the_cover_in_every_hours_state(
    client: TestClient, tmp_path: Path, over: dict[str, Any], hours: str | None
) -> None:
    """The hours bullet appears exactly when the cover counts the hours,
    in that state's own words, and the two numbers stay equal."""
    pages = _pdf_pages(client, colfax(**over), tmp_path)
    cover, section = _counts(pages)
    assert cover == section, (cover, section)
    text = " ".join(pages)
    if hours is None:
        assert "Work hours not checked" not in text
    else:
        assert hours in text


def test_one_bullet_per_counted_fact() -> None:
    """Block level: one bullet per ledger ``pending`` fact, the hours last."""
    from src.rendering.tier_ledger import pending_fact_ids

    projection = {
        "pending_verification": {
            "count": 2,
            "note": "n",
            "tracking_issue": "https://example.test/1",
            "items": [
                {"kind": "k1", "label": "L1", "tracking_issue": "https://example.test/1"},
                {"kind": "k2", "label": "L2", "tracking_issue": None},
            ],
        }
    }
    jur = {"hours_eval": {"status": "unknown", "note": "no work schedule provided"}}
    blocks = audit_to_blocks(projection, jurisdiction=jur)
    i = next(
        n for n, b in enumerate(blocks) if isinstance(b, Heading) and b.text == "Not checked yet"
    )
    first, bullets = blocks[i + 1], blocks[i + 2]
    assert isinstance(bullets, Bullets)
    assert first.text == "3 items not checked yet."
    assert [b.text for b in bullets.items] == [
        "[k1] L1 (https://example.test/1)",
        "[k2] L2",
        "Work hours not checked (no work schedule provided)",
    ]
    assert len(pending_fact_ids(projection, jur)) == tier_ledger(projection, jur)["pending"] == 3


def test_nothing_pending_keeps_the_flat_note_and_link() -> None:
    """X5: with no bullet to carry them, the flat note and link print after
    the count as before (and a null link prints none, #363 R4)."""
    pv = {"count": 0, "note": "", "tracking_issue": "https://example.test/19"}
    blocks = audit_to_blocks({"pending_verification": pv})
    i = next(
        n for n, b in enumerate(blocks) if isinstance(b, Heading) and b.text == "Not checked yet"
    )
    assert blocks[i + 1].text == "0 items not checked yet.  Tracking: https://example.test/19"
    assert i + 2 == len(blocks)
    blocks = audit_to_blocks({"pending_verification": {**pv, "tracking_issue": None}})
    assert blocks[-1].text == "0 items not checked yet."


def _section(blocks: list[Any]) -> list[Any]:
    i = next(
        n for n, b in enumerate(blocks) if isinstance(b, Heading) and b.text == "Not checked yet"
    )
    return blocks[i + 1 :]


def test_hours_alone_print_no_general_tracking_link() -> None:
    """Repair 1: no pending item but unchecked hours -- the general tracker
    (the flat link when there are no items) must not sit above the hours
    bullet as if it tracked them."""
    pv = {"count": 0, "note": "", "tracking_issue": "https://example.test/19"}
    jur = {"hours_eval": {"status": "unknown", "note": "no work schedule provided"}}
    first, bullets = _section(audit_to_blocks({"pending_verification": pv}, jurisdiction=jur))
    assert first.text == "1 item not checked yet."
    assert [b.text for b in bullets.items] == ["Work hours not checked (no work schedule provided)"]
    blocks = audit_to_blocks({"pending_verification": pv}, jurisdiction=jur, schedule_not_set=True)
    assert "example.test/19" not in repr(blocks)
    assert [b.text for b in _section(blocks)[1].items] == [_NOT_SET]


def test_hours_without_a_pending_block_still_get_the_section() -> None:
    """Repair 1: the cover counts unchecked hours even when the projection
    has no ``pending_verification``; the section must stand to list them."""
    jur = {
        "hours_eval": {"status": "unknown", "note": "jurisdiction publishes no work-hour windows"}
    }
    first, bullets = _section(audit_to_blocks({}, jurisdiction=jur, schedule_not_set=True))
    assert first.text == "1 item not checked yet."
    # No windows outranks "Not set": the backend's own reason stays.
    assert [b.text for b in bullets.items] == [
        "Work hours not checked (jurisdiction publishes no work-hour windows)"
    ]
    assert tier_ledger({}, jur)["pending"] == 1
    assert not any(
        isinstance(b, Heading) and b.text == "Not checked yet" for b in audit_to_blocks({})
    )
