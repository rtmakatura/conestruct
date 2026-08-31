"""#213 V4 — the audit PDF's corridor-validation copy is honest per cause.

``_corridor_blocks`` used to print "Corridor check not run (no site
coordinates supplied)." for every ``checked:False`` dict — including an
Overpass outage on a plan that HAS coordinates.  The ``reason`` split
(``not_run_no_coords`` vs ``check_unavailable``) gives each cause its
own true sentence; these tests pin the mapping at the block level (the
same blocks ``/render/audit-pdf`` draws).
"""

from __future__ import annotations

from typing import Any

from src.rendering.audit_blocks import _corridor_blocks
from src.rendering.document import Body, Heading


def _texts(blocks: list[Any]) -> str:
    return " | ".join(b.text for b in blocks if isinstance(b, (Body, Heading)))


def test_unavailable_reason_prints_unavailable_never_the_no_coords_claim() -> None:
    blocks = _corridor_blocks(
        {
            "checked": False,
            "warnings": [],
            "reason": "check_unavailable",
            "error": "overpass-api.de: ConnectError: connection refused",
        }
    )
    text = _texts(blocks)
    assert "unavailable" in text
    assert "not evaluated" in text
    # The lie this replaces: asserting missing coordinates for a
    # network failure.
    assert "no site coordinates" not in text


def test_not_run_reason_prints_the_inputs_sentence() -> None:
    blocks = _corridor_blocks({"checked": False, "warnings": [], "reason": "not_run_no_coords"})
    text = _texts(blocks)
    assert "no site coordinates or bearing supplied" in text
    assert "unavailable" not in text


def test_reasonless_not_checked_falls_back_to_the_inputs_sentence() -> None:
    """A legacy dict without ``reason`` reads as not-run — the fallback
    must never claim unavailability it cannot know about."""
    blocks = _corridor_blocks({"checked": False, "warnings": []})
    text = _texts(blocks)
    assert "no site coordinates or bearing supplied" in text
    assert "unavailable" not in text


def test_checked_with_warnings_unchanged() -> None:
    blocks = _corridor_blocks(
        {
            "checked": True,
            "warnings": [
                {
                    "flag": "bearing_conflict",
                    "level": "warning",
                    "message": "Corridor bearing 10.0 conflicts with detected 95.0.",
                }
            ],
        }
    )
    text = _texts(blocks)
    assert "produced warnings" in text


def test_empty_dict_renders_nothing() -> None:
    assert _corridor_blocks({}) == []
