"""The frontend's SITE_ADJUSTMENT_DETAIL mirror of two backend actions.

``conestruct/site/components/AuditTrail.tsx`` keeps a hand copy of the
``action`` text ``src/rules/site_adjustments.py`` writes for the two
flags that add no devices (``adjacent_intersection`` and
``adjacent_interchange``), plus the chip citation the audit derives from
each record's ``rule``.  Nothing checked the pair before the R37 unslop
pass changed both sides; this pins it.

The backend side is read from ``apply_site_adjustments`` output, not a
literal, so a future backend edit fails here until the TSX follows.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from src.api.audit import _site_citation
from src.rules.site_adjustments import apply_site_adjustments
from src.rules.validators import ScenarioParams

_TSX = (
    Path(__file__).resolve().parent.parent / "conestruct" / "site" / "components" / "AuditTrail.tsx"
)

_FLAGS = ("adjacent_intersection", "adjacent_interchange")


def _backend_records() -> dict[str, dict]:
    params = ScenarioParams(
        speed_mph=45,
        num_lanes=1,
        lane_width_ft=12.0,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=500.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    _, records = apply_site_adjustments([], params, {f: True for f in _FLAGS})
    return {str(r["flag"]): r for r in records}


def _tsx_entry(flag: str) -> dict[str, str]:
    """The ``rule`` and ``action`` string literals of one TSX entry."""
    text = _TSX.read_text(encoding="utf-8")
    m = re.search(rf"\n\s*{flag}:\s*\{{(.*?)\n\s*\}},", text, flags=re.S)
    assert m, f"no SITE_ADJUSTMENT_DETAIL entry for {flag} in AuditTrail.tsx"
    body = m.group(1)
    out: dict[str, str] = {}
    for key in ("rule", "action"):
        km = re.search(rf'\b{key}:\s*"((?:[^"\\]|\\.)*)"', body, flags=re.S)
        assert km, f"{flag}: no {key} string literal in AuditTrail.tsx"
        out[key] = km.group(1)
    return out


def test_both_flags_fire_on_the_backend() -> None:
    assert set(_backend_records()) == set(_FLAGS)


@pytest.mark.parametrize("flag", _FLAGS)
def test_action_is_byte_identical_in_the_tsx(flag: str) -> None:
    action = str(_backend_records()[flag]["action"])
    # Verbatim somewhere in the file, and verbatim as this flag's entry.
    assert f'"{action}"' in _TSX.read_text(encoding="utf-8")
    assert _tsx_entry(flag)["action"] == action


@pytest.mark.parametrize("flag", _FLAGS)
def test_rule_chip_matches_the_audit_citation(flag: str) -> None:
    rule = str(_backend_records()[flag]["rule"])
    assert _tsx_entry(flag)["rule"] == _site_citation(rule)
