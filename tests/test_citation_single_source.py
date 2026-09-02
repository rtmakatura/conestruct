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


def test_no_parallel_federal_section_literals_in_audit_source() -> None:
    """#98 — the federal taper/buffer/spacing section and table numbers
    (``_SEC_TAPER``/``_SEC_BUFFER``/``_SEC_SPACING``/``_TBL_TAPER``/
    ``_TBL_TAPER_L``/``_TBL_BUFFER``) have exactly one definition in ``audit.py``: their
    own assignments.  Every prose sentence and panel dict interpolates
    them, so no other *rendered* string literal may spell a section or
    table number out.  Docstrings are exempt (explanatory text, never
    rendered).  Value-agnostic: reads the tokens from the module rather
    than restating them, so a verified renumber moves everything
    together."""
    tokens = {
        audit_module._SEC_TAPER,
        audit_module._SEC_BUFFER,
        audit_module._SEC_SPACING,
        audit_module._TBL_TAPER,
        audit_module._TBL_TAPER_L,
        audit_module._TBL_BUFFER,
    }
    tree = ast.parse(_AUDIT_SOURCE)
    docstrings: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = node.body
            if (
                body
                and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)
            ):
                docstrings.add(id(body[0].value))
    offenders = [
        (node.lineno, node.value)
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and id(node) not in docstrings
        and node.value not in tokens  # the single-definition assignments
        and any(tok in node.value for tok in tokens)
    ]
    assert not offenders, (
        "federal section/table numbers spelled as literals outside the "
        f"_SEC_*/_TBL_* constants (#98): {offenders!r}"
    )


def test_rendered_federal_sources_derive_from_constants() -> None:
    """#98 positive half — the rendered taper/buffer/spacing ``source``
    prose and panel citations actually carry the constants' values."""
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    trail = audit_module.build_audit_trail(placements, params)

    sec = audit_module
    # #229 — the formula table for L, the criteria table for the ratio.
    assert f"Sec {sec._SEC_TAPER}, Table {sec._TBL_TAPER_L}" in trail["taper"]["source"]
    assert f"(Table {sec._TBL_TAPER})" in trail["taper"]["source"]
    assert f"Sec {sec._SEC_BUFFER}, Table {sec._TBL_BUFFER}" in trail["buffer"]["source"]
    assert trail["spacing"]["source"] == f"MUTCD 11th Ed. Sec {sec._SEC_SPACING}"
    assert trail["taper"]["citation"] == {
        "cite": f"MUTCD § {sec._SEC_TAPER}",
        "footer": f"MUTCD 2023 EDITION · CHAPTER 6B · TABLE {sec._TBL_TAPER}",
    }
    assert trail["buffer"]["citation"]["cite"] == f"MUTCD § {sec._SEC_BUFFER}"
    assert trail["spacing"]["citation"]["cite"] == f"MUTCD § {sec._SEC_SPACING}"


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
