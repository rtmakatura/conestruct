"""Audit-trail PDF — single-source + valid-PDF proofs (#77, PR-3).

The audit trail's whole job is defensibility: every number traces to one
source.  These proofs pin that the PDF is a faithful re-presentation of
the projection ``/render/audit`` serializes — no value, citation, or case
ID dropped or altered in the projection → blocks step — without adding a
PDF-text-extraction dependency.

The projection is built through the real ``build_audit_trail`` →
``audit_projection`` path (the same functions ``_audit_projection_for``
calls in the endpoint), so the test exercises the production source.
"""

from __future__ import annotations

import html
import re
from typing import Any

from src.api.audit import audit_projection, build_audit_trail
from src.generation.layout import generate_shoulder_closure_divided
from src.rendering.audit_blocks import audit_to_blocks, normalize_glyphs, render_audit_pdf
from src.rendering.document import Body, Bullets, Heading, Ordered, Quote, Table_
from src.rules.validators import ScenarioParams

# Reduced-speed freeway shoulder closure (Case 26, 65 → 60): exercises the
# heaviest projection — the Colorado checks table, the divergent CDOT
# buffer, the advance sign table, the Fines Double envelope + operational
# notes, and the Trigger Condition (Quote).  It also carries the two
# non-WinAnsi glyphs (→, Δ) the render boundary normalizes.
_PARAMS = ScenarioParams(
    speed_mph=65,
    num_lanes=2,
    closure_type="shoulder",
    road_type="freeway",
    work_zone_length_ft=1000.0,
    is_divided=True,
    jurisdiction="CDOT",
    work_zone_speed_mph=60,
)

# ``formula_latex`` is a LaTeX duplicate of the human-readable
# ``formula_choice`` (e.g. ``L = W \times S``); it is intentionally not
# rendered (the prose form carries the same fact), so exclude it from the
# leaf sweep.
_SKIP_KEYS = frozenset({"formula_latex"})

_TAG_RE = re.compile(r"<[^>]+>")


def _projection() -> dict[str, Any]:
    placements = generate_shoulder_closure_divided(_PARAMS)
    audit = build_audit_trail(placements, _PARAMS)
    return audit_projection(audit, "shoulder", step_count=11)


def _strip(text: str) -> str:
    return html.unescape(_TAG_RE.sub("", text))


def _block_plaintext(blocks: list[object]) -> str:
    parts: list[str] = []
    for b in blocks:
        if isinstance(b, (Heading, Body, Quote)):
            parts.append(b.text)
        elif isinstance(b, (Bullets, Ordered)):
            for item in b.items:
                parts.append(item.text)
                parts.extend(child.text for child in item.children)
        elif isinstance(b, Table_):
            parts.extend(b.header)
            for row in b.rows:
                parts.extend(row)
    return _strip("\n".join(parts))


def _string_leaves(obj: Any) -> list[str]:
    """Every non-blank string leaf in the projection, minus skip keys."""
    out: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in _SKIP_KEYS:
                continue
            out += _string_leaves(v)
    elif isinstance(obj, list):
        for v in obj:
            out += _string_leaves(v)
    elif isinstance(obj, str) and obj.strip():
        out.append(obj)
    return out


def test_blocks_carry_every_projection_string() -> None:
    """No citation, source, value-sentence, table cell, or note is dropped
    or altered in the projection → blocks step (single-source proof)."""
    projection = _projection()
    text = normalize_glyphs(_block_plaintext(audit_to_blocks(projection)))
    missing = [leaf for leaf in _string_leaves(projection) if normalize_glyphs(leaf) not in text]
    assert not missing, f"projection strings absent from the PDF blocks: {missing}"


def test_blocks_cover_expected_constructs() -> None:
    """The audit yields headings, body prose, value tables, and — under a
    reduced work-zone speed — the Trigger Condition quote."""
    blocks = audit_to_blocks(_projection())
    kinds = {type(b) for b in blocks}
    assert {Heading, Body, Table_, Quote} <= kinds
    # The Colorado checks render as a 4-column weighted table.
    co = next(b for b in blocks if isinstance(b, Table_) and b.header[:1] == ["Check"])
    assert co.header == ["Check", "Result", "Citation", "Detail"]
    assert co.weights == [2, 1, 1, 3]
    assert len(co.rows) >= 3


def test_no_reduction_omits_quote_and_fines_double() -> None:
    """A plain (no-reduction) shoulder closure has no Trigger Condition
    quote and no Fines Double section — the projection omits them."""
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1000.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=None,
    )
    placements = generate_shoulder_closure_divided(params)
    projection = audit_projection(build_audit_trail(placements, params), "shoulder", 11)
    assert "fines_double" not in projection["sections"]
    blocks = audit_to_blocks(projection)
    assert not any(isinstance(b, Quote) for b in blocks)
    # The single-source guarantee still holds for the lighter projection.
    text = normalize_glyphs(_block_plaintext(blocks))
    missing = [leaf for leaf in _string_leaves(projection) if normalize_glyphs(leaf) not in text]
    assert not missing, f"projection strings absent: {missing}"


def test_render_audit_pdf_is_valid(tmp_path) -> None:
    """render_audit_pdf writes a structurally valid, non-trivial PDF."""
    out = tmp_path / "audit.pdf"
    returned = render_audit_pdf(_projection(), str(out))
    assert returned == str(out)
    data = out.read_bytes()
    assert data.startswith(b"%PDF-")
    assert data.rstrip().endswith(b"%%EOF")
    assert len(data) > 1500
