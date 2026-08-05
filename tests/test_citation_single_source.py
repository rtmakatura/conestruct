"""Single-source pin for the Colorado citation strings (Refs #83).

The Colorado section numbers used to exist as two unlinked copies — the
enforced value's comment in ``tables.py`` and the rendered literal in
``audit.py`` — agreeing only by hand.  #83 single-sourced them onto
``CO_CITATIONS``.  These tests pin both halves of that migration:

  1. The rendered audit citations equal the ``CO_CITATIONS`` fields
     (the audit derives, it does not restate).
  2. No ``CO_CITATIONS`` value reappears as a parallel string literal in
     ``audit.py``'s source — the drift seam stays closed even if a
     future edit re-hardcodes a matching string.

Deliberately value-agnostic: when #70's verification rewrites the
citation text, these tests must keep passing unchanged.
"""

from __future__ import annotations

import ast
import dataclasses
from pathlib import Path

from src.api import audit as audit_module
from src.rules.tables import CO_CITATIONS

_AUDIT_SOURCE = Path(audit_module.__file__).read_text(encoding="utf-8")


def _citation_values() -> dict[str, str]:
    return {f.name: getattr(CO_CITATIONS, f.name) for f in dataclasses.fields(CO_CITATIONS)}


def test_no_parallel_citation_literals_in_audit_source() -> None:
    """No CO citation string is hardcoded in audit.py — all derive."""
    literals = {
        node.value
        for node in ast.walk(ast.parse(_AUDIT_SOURCE))
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }
    for name, value in _citation_values().items():
        assert value not in literals, (
            f"CO_CITATIONS.{name} ({value!r}) appears as a string literal in "
            "audit.py — citations must derive from the single source (#83)."
        )


def test_rendered_colorado_citations_derive_from_single_source() -> None:
    """The audit's Colorado checks render exactly the CO_CITATIONS values."""
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=60,
    )
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    trail = audit_module.build_audit_trail(placements, params)

    colorado = trail["colorado"]
    by_label = {c["label"]: c["citation"] for c in colorado["checks"]}
    assert by_label["Signs on both sides of divided highway"] == CO_CITATIONS.signs_both_sides
    assert (
        by_label["G20-5P Work Zone signs every 2,640 ft"] == CO_CITATIONS.construction_zone_plaques
    )
    assert (
        by_label["Speed reduction <= 15 mph per sign installation"] == CO_CITATIONS.speed_reduction
    )
    lighting = [
        cite for label, cite in by_label.items() if label.startswith("Flagger station lighting")
    ]
    assert lighting == [CO_CITATIONS.flagger_station_lighting]
    assert [i["citation"] for i in colorado["info_items"]] == [CO_CITATIONS.mobile_operation_aadt]
    assert trail["fines_double"]["citation"] == CO_CITATIONS.fines_double
