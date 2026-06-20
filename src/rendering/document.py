"""Shared structured-document → PDF renderer (ReportLab Platypus).

A small, neutral block model plus a single ``render_document_pdf`` entry
point.  Consumers build a list of blocks and hand it to the renderer;
the renderer owns the stylesheet, page geometry, and the flowable
mapping.  This is the document-rendering counterpart to
``plan_sheet.py`` (which is canvas-coordinate CAD drawing for the plan
sheet — a different shape from a flowing document, so it is deliberately
not reused here).

First consumer: the crew narrative PDF (parsed from Markdown via
``markdown_blocks.py``).  The audit-trail PDF (a later PR) is the second
consumer — it builds the same blocks directly from the audit projection,
with no Markdown step, which is why the seam is the block model and not a
Markdown string.

Platypus ships inside ``reportlab`` (already in the Modal image), so this
adds no new dependency.

Inline emphasis: text fields carry ReportLab "mini-HTML" markup —
``<b>``/``<i>`` are honoured, and ``&``/``<``/``>`` must already be
escaped.  Use :func:`rich_text` to turn plain text into a markup-safe
string; the Markdown parser does this for the narrative, and the audit
consumer will do the same for its plain strings.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from xml.sax.saxutils import escape as _xml_escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, StyleSheet1
from reportlab.lib.units import inch
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# --------------------------------------------------------------------------- #
# Block model — the neutral seam shared across document consumers.
# --------------------------------------------------------------------------- #


@dataclass
class ListItem:
    """One list entry; ``children`` are rendered as a nested bullet level."""

    text: str
    children: list[ListItem] = field(default_factory=list)


@dataclass
class Heading:
    """A section heading; ``level`` 1 = document title, 2+ = sections."""

    level: int
    text: str


@dataclass
class Body:
    """A body paragraph (may contain ``<b>``/``<i>`` inline markup)."""

    text: str


@dataclass
class Bullets:
    """An unordered (bulleted) list."""

    items: list[ListItem]


@dataclass
class Ordered:
    """An ordered (numbered) list."""

    items: list[ListItem]


@dataclass
class Table_:
    """A table with a header row and body rows (cells are rich text)."""

    header: list[str]
    rows: list[list[str]]


@dataclass
class Quote:
    """A block quote, rendered indented with a left rule."""

    text: str


# A renderable block is any of the above.
Block = Heading | Body | Bullets | Ordered | Table_ | Quote


def rich_text(plain: str) -> str:
    """Escape plain text so it is safe to drop into a ReportLab Paragraph.

    Callers that want inline ``<b>``/``<i>`` add those tags *after*
    escaping (the tags themselves are literal markup, not content).
    """
    return _xml_escape(plain)


# --------------------------------------------------------------------------- #
# Stylesheet — Helvetica, phone-readable leading, Letter portrait.
# --------------------------------------------------------------------------- #

_PAGE_SIZE = letter
_MARGIN = 0.7 * inch
_RULE = colors.HexColor("#c8c8c8")
_HEADER_BG = colors.HexColor("#eef0f2")
_QUOTE_BAR = colors.HexColor("#9aa0a6")
_FAINT = colors.HexColor("#444444")


def _stylesheet() -> StyleSheet1:
    ss = StyleSheet1()
    ss.add(
        ParagraphStyle(
            "DocTitle",
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            spaceBefore=0,
            spaceAfter=10,
            textColor=colors.black,
        )
    )
    ss.add(
        ParagraphStyle(
            "DocH2",
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=16,
            spaceBefore=14,
            spaceAfter=5,
            textColor=colors.black,
        )
    )
    ss.add(
        ParagraphStyle(
            "DocH3",
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            spaceBefore=10,
            spaceAfter=4,
            textColor=colors.black,
        )
    )
    ss.add(
        ParagraphStyle(
            "DocBody",
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            spaceBefore=0,
            spaceAfter=6,
            alignment=TA_LEFT,
            textColor=colors.black,
        )
    )
    ss.add(
        ParagraphStyle(
            "DocQuote",
            parent=ss["DocBody"],
            fontName="Helvetica-Oblique",
            leftIndent=16,
            borderColor=_QUOTE_BAR,
            spaceBefore=4,
            spaceAfter=8,
            textColor=_FAINT,
        )
    )
    ss.add(
        ParagraphStyle(
            "DocCell",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            spaceBefore=0,
            spaceAfter=0,
            textColor=colors.black,
        )
    )
    ss.add(
        ParagraphStyle(
            "DocCellHead",
            parent=ss["DocCell"],
            fontName="Helvetica-Bold",
        )
    )
    return ss


# --------------------------------------------------------------------------- #
# Flowable mapping.
# --------------------------------------------------------------------------- #

# Per nesting level: how far to indent the body and where to hang the marker.
_LIST_STEP = 16
_HANG = 12


def _list_style(ss: StyleSheet1, depth: int) -> ParagraphStyle:
    """A body style with a hanging indent for a list marker at ``depth``."""
    base = _LIST_STEP * (depth + 1)
    return ParagraphStyle(
        f"DocList{depth}",
        parent=ss["DocBody"],
        leftIndent=base,
        firstLineIndent=-_HANG,
        spaceAfter=3,
    )


def _list_flowables(
    items: list[ListItem],
    *,
    ordered: bool,
    ss: StyleSheet1,
    depth: int,
) -> list[Flowable]:
    out: list[Flowable] = []
    style = _list_style(ss, depth)
    for n, item in enumerate(items, start=1):
        marker = f"{n}. " if ordered else "•&nbsp;"
        out.append(Paragraph(f"{marker}{item.text}", style))
        if item.children:
            # Nested entries always render as bullets one level deeper.
            out.extend(_list_flowables(item.children, ordered=False, ss=ss, depth=depth + 1))
    return out


def _table_flowable(block: Table_, ss: StyleSheet1, avail_width: float) -> Flowable:
    head_style = ss["DocCellHead"]
    cell_style = ss["DocCell"]
    n_cols = max(len(block.header), 1)
    col_w = avail_width / n_cols

    data: list[list[Paragraph]] = [[Paragraph(c, head_style) for c in block.header]]
    for row in block.rows:
        # Pad/truncate defensively so a malformed row never raises.
        cells = list(row)[:n_cols] + [""] * (n_cols - len(row))
        data.append([Paragraph(c, cell_style) for c in cells])

    table = Table(data, colWidths=[col_w] * n_cols, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), _HEADER_BG),
                ("GRID", (0, 0), (-1, -1), 0.5, _RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def _blocks_to_flowables(
    blocks: list[Block], ss: StyleSheet1, avail_width: float
) -> list[Flowable]:
    flowables: list[Flowable] = []
    for block in blocks:
        if isinstance(block, Heading):
            if block.level <= 1:
                flowables.append(Paragraph(block.text, ss["DocTitle"]))
            elif block.level == 2:
                flowables.append(Paragraph(block.text, ss["DocH2"]))
            else:
                flowables.append(Paragraph(block.text, ss["DocH3"]))
        elif isinstance(block, Body):
            flowables.append(Paragraph(block.text, ss["DocBody"]))
        elif isinstance(block, Quote):
            flowables.append(Paragraph(block.text, ss["DocQuote"]))
        elif isinstance(block, Bullets):
            flowables.extend(_list_flowables(block.items, ordered=False, ss=ss, depth=0))
            flowables.append(Spacer(1, 4))
        elif isinstance(block, Ordered):
            flowables.extend(_list_flowables(block.items, ordered=True, ss=ss, depth=0))
            flowables.append(Spacer(1, 4))
        elif isinstance(block, Table_):
            # Keep the header with at least the first row where it fits.
            flowables.append(KeepTogether(_table_flowable(block, ss, avail_width)))
            flowables.append(Spacer(1, 6))
    return flowables


def render_document_pdf(
    blocks: list[Block],
    output_path: str,
    *,
    title: str | None = None,
) -> str:
    """Render ``blocks`` to a PDF at ``output_path`` and return the path.

    Mirrors the write-to-path-return-path convention of
    ``render_plan_sheet`` / ``generate_crew_narrative`` so the FastAPI
    ``_render_with`` plumbing works unchanged.  ``title`` sets the PDF
    document metadata only — it is not drawn as a flowable (the narrative
    already carries its own ``# H1`` title).
    """
    avail_width = _PAGE_SIZE[0] - 2 * _MARGIN
    ss = _stylesheet()
    doc = SimpleDocTemplate(
        output_path,
        pagesize=_PAGE_SIZE,
        leftMargin=_MARGIN,
        rightMargin=_MARGIN,
        topMargin=_MARGIN,
        bottomMargin=_MARGIN,
        title=title or "Document",
    )
    doc.build(_blocks_to_flowables(blocks, ss, avail_width))
    return output_path
