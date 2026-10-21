"""#363: the Fines Double engineer note names its cause and carries no link.

R2 (Ryan): the note names the 350 ft sign spacing, the 250 ft clearance
(S-630-1 Sheet 12 Note 4) and Sheet 2 Note 4's engineer clause, and drops
the #360 tracking link.  R3: the spacing comes from the Table 6B-1 lookup.
R4: an item with no link prints no empty link in the audit PDF.  Rulings:
``validation-artifacts/committed/issue-363-fines-double-urban-high/rulings.md``.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from ._harness import _common
from .test_cross_surface import _pdf_text, _post, api  # noqa: F401  (``api`` is a fixture)


def _body(road_type: str, speed: int, wz: int, work_len: float, divided: bool) -> dict[str, Any]:
    return {**_common(speed, wz), "roadType": road_type, "divided": divided, "workLen": work_len}


# The issue's instance: urban_arterial 55 -> 45, 1,000 ft of work.
URBAN = _body("urban_arterial", 55, 45, 1000.0, False)


def _note(audit: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        i
        for i in (audit["pending_verification"].get("items") or [])
        if i["kind"] == "fines_double_spacing"
    ]


def test_urban_high_note_names_spacing_clearance_and_engineer(api: TestClient) -> None:  # noqa: F811
    audit = _post(api, "/render/audit", URBAN).json()
    env = audit["sections"]["fines_double"]["envelope"]
    assert env["plaque_long_gaps_sign_spacing_ft"] == [350.0, 350.0, 350.0]
    (item,) = _note(audit)
    label = item["label"]
    assert "station 3,192 to 500 (2,692 ft)" in label
    assert (
        "Between the speed limit group and the taper the signs are 350 ft apart "
        "(MUTCD 11th Ed. Table 6B-1, p. 773)." in label
    )
    assert "A plaque needs 250 ft from every other sign (S-630-1 Sheet 12 Note 4)" in label
    assert '"The spacing of these signs may be changed as directed by the Engineer."' in label
    assert item["tracking_issue"] is None
    assert "/issues/360" not in str(audit["pending_verification"])


@pytest.mark.parametrize(
    ("road", "speed", "wz", "divided"),
    [
        ("rural_undivided", 55, 45, False),
        ("rural_divided", 75, 65, True),
        ("freeway", 65, 55, True),
    ],
)
def test_other_roads_carry_no_spacing_field_or_note(
    api: TestClient,  # noqa: F811
    road: str,
    speed: int,
    wz: int,
    divided: bool,
) -> None:
    audit = _post(api, "/render/audit", _body(road, speed, wz, 1000.0, divided)).json()
    env = audit["sections"]["fines_double"]["envelope"]
    assert "plaque_long_gaps_sign_spacing_ft" not in env
    assert "plaque_long_gaps_ft" not in env
    assert _note(audit) == []


def test_audit_pdf_prints_the_note_with_no_empty_link(api: TestClient) -> None:  # noqa: F811
    text = " ".join(
        " ".join(page.split()) for page in _pdf_text(_post(api, "/render/audit-pdf", URBAN).content)
    )
    assert "[fines_double_spacing] Engineer's direction needed" in text
    assert "Table 6B-1, p. 773)" in text
    assert 'Engineer." ()' not in text
    assert 'Engineer."()' not in text
    # The plan's one pending item is this note, so the summary line has no link.
    assert "Tracking:" not in text


def test_unequal_abc_says_at_most_the_widest(
    api: TestClient,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R3's other branch: when A, B and C differ, the note says "at most"."""
    import src.api.audit as audit_mod

    real = audit_mod.advance_warning_spacing

    def uneven(speed: int, road_type: str | None = None) -> dict[str, float]:
        return {**real(speed, road_type), "A": 300.0}

    monkeypatch.setattr(audit_mod, "advance_warning_spacing", uneven)
    (item,) = _note(_post(api, "/render/audit", URBAN).json())
    assert "the signs are at most 350 ft apart (MUTCD 11th Ed. Table 6B-1" in item["label"]


def test_pdf_item_line_keeps_a_link_and_drops_an_empty_one() -> None:
    """R4: a linked item prints the same bytes as before; a null link prints none."""
    from src.rendering.audit_blocks import _pending_blocks

    blocks = _pending_blocks(
        {
            "count": 2,
            "note": "n",
            "tracking_issue": "https://example.test/1",
            "items": [
                {"kind": "k1", "label": "L1", "tracking_issue": "https://example.test/1"},
                {"kind": "k2", "label": "L2", "tracking_issue": None},
            ],
        }
    )
    assert (
        blocks[1].text == "2 reference(s) pending verification. n  Tracking: https://example.test/1"
    )
    assert [i.text for i in blocks[2].items] == ["[k1] L1 (https://example.test/1)", "[k2] L2"]
