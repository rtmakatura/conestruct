"""Crew narrative PDF — block-fidelity + valid-PDF proofs (#76, PR-2).

Two proofs that the new PDF path is render-only:

1. The refactor that extracted ``render_crew_narrative_markdown`` leaves
   ``generate_crew_narrative`` byte-identical (the Markdown content path
   is untouched — the existing ``test_crew_narrative.py`` substring
   assertions stay green by construction; this pins the equality
   directly).
2. The Markdown → block-model parse preserves the narrative's wording and
   citations (no content is dropped or mangled), and
   ``generate_crew_narrative_pdf`` emits a structurally valid PDF.

The block-text check is the cheap stand-in for PDF text extraction: it
proves the same strings reach the renderer without adding a PDF-parsing
test dependency.
"""

from __future__ import annotations

import html
import re

from src.generation.layout import generate_shoulder_closure_divided
from src.narrative.crew_narrative import (
    generate_crew_narrative,
    generate_crew_narrative_pdf,
    render_crew_narrative_markdown,
)
from src.rendering.document import (
    Body,
    Bullets,
    Heading,
    Ordered,
    Quote,
    Table_,
)
from src.rendering.markdown_blocks import markdown_to_blocks
from src.rules.validators import ScenarioParams

# Reduced-speed freeway shoulder closure — exercises every construct:
# headings, bold body lines, the nested equipment bullets, the sign
# schedule table (W3-5 / R2-1 / R2-10 / R2-11 rows under reduction), the
# Setup/Takedown ordered lists with sub-bullets, the safety bullets, and
# the Trigger Condition block quote.
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

_TAG_RE = re.compile(r"<[^>]+>")


def _markdown() -> str:
    placements = generate_shoulder_closure_divided(_PARAMS)
    return render_crew_narrative_markdown(placements, _PARAMS)


def _strip(text: str) -> str:
    """Drop ReportLab ``<b>``/``<i>`` markup and unescape entities."""
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


def test_markdown_helper_matches_written_file(tmp_path) -> None:
    """The string helper returns exactly what generate_crew_narrative writes."""
    placements = generate_shoulder_closure_divided(_PARAMS)
    out = tmp_path / "crew.md"
    generate_crew_narrative(placements, _PARAMS, output_path=str(out))
    written = out.read_text(encoding="utf-8")
    assert render_crew_narrative_markdown(placements, _PARAMS) == written


def test_blocks_preserve_narrative_content() -> None:
    """Every key heading, body line, table cell, and the trigger quote
    survives the Markdown → block-model parse."""
    blocks = markdown_to_blocks(_markdown())
    text = _block_plaintext(blocks)

    # Title + a section heading.
    assert "Method of Handling Traffic — Crew Instructions" in text
    assert "Sign Placement Schedule" in text
    # Bold body line (markup stripped).
    assert "Set up from downstream to upstream" in text
    # Table cells, including the reduced-speed envelope rows.
    assert "RIGHT SHOULDER CLOSED AHEAD" in text
    assert "SPEED LIMIT 60 (work-zone speed posting)" in text
    assert "SPEED LIMIT 65 (posted-speed restoration)" in text
    # Block quote (Trigger Condition).
    assert (
        "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) "
        "ARE WITHIN 8 FT OF TRAVEL WAY" in text
    )
    # Safety bullet.
    assert "ANSI Class 2" in text


def test_blocks_cover_every_construct() -> None:
    """The representative narrative yields each block type the renderer
    must handle — a guard that the parser didn't silently collapse a
    construct to a paragraph."""
    blocks = markdown_to_blocks(_markdown())
    kinds = {type(b) for b in blocks}
    assert {Heading, Body, Bullets, Ordered, Table_, Quote} <= kinds
    # The sign schedule is the one table; it must have a header and rows.
    table = next(b for b in blocks if isinstance(b, Table_))
    assert table.header[0] == "Sign Code"
    assert len(table.rows) >= 5
    # The equipment list nests sign rows one level deep.
    assert any(isinstance(b, Bullets) and any(item.children for item in b.items) for b in blocks)


def test_generate_crew_narrative_pdf_is_valid(tmp_path) -> None:
    """The PDF path writes a structurally valid, non-trivial PDF."""
    placements = generate_shoulder_closure_divided(_PARAMS)
    out = tmp_path / "crew.pdf"
    returned = generate_crew_narrative_pdf(placements, _PARAMS, output_path=str(out))
    assert returned == str(out)
    data = out.read_bytes()
    assert data.startswith(b"%PDF-")
    assert data.rstrip().endswith(b"%%EOF")
    assert len(data) > 1500
