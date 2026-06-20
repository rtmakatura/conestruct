"""Markdown → block-model parser for the crew narrative.

Narrative-only: it handles exactly the eight Markdown constructs
``base.md.j2`` emits, and nothing else.  It is deliberately not a general
CommonMark parser — the narrative's Markdown is a small, closed subset,
and anything outside that subset degrades to a plain body paragraph
rather than raising (honest-failure: a future template line renders
readably instead of crashing the PDF).

Handled constructs:
  1. ``#`` / ``##`` headings
  2. body paragraphs (with inline ``**bold**`` / ``_italic_``)
  3. ``> `` block quotes
  4. ``- `` bullet lists, one level of ``  - `` nesting
  5. ``1.`` ordered lists, with ``   - `` sub-bullets and indented
     continuation lines
  6. ``| a | b |`` pipe tables with a ``|---|`` delimiter row
  7. inline ``**bold**``
  8. inline ``_italic_``

The audit-trail PDF (a later PR) does NOT use this module — it builds
blocks directly from its projection.  The seam between consumers is the
block model in ``document.py``, not Markdown.
"""

from __future__ import annotations

import re

from src.rendering.document import (
    Block,
    Body,
    Bullets,
    Heading,
    ListItem,
    Ordered,
    Quote,
    Table_,
    rich_text,
)

_ORDERED_RE = re.compile(r"^(\d+)\.\s+(.*)$")
_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
_ITALIC_RE = re.compile(r"(?<!\w)_(.+?)_(?!\w)")


def _inline(text: str) -> str:
    """Escape, then convert ``**bold**`` / ``_italic_`` to ReportLab markup."""
    out = rich_text(text)
    out = _BOLD_RE.sub(r"<b>\1</b>", out)
    out = _ITALIC_RE.sub(r"<i>\1</i>", out)
    return out


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _is_table_delim(line: str) -> bool:
    s = line.strip()
    if not s.startswith("|"):
        return False
    cells = s.strip("|").split("|")
    return bool(cells) and all(re.fullmatch(r":?-+:?", c.strip()) for c in cells)


def _split_row(line: str) -> list[str]:
    cells = line.strip().strip("|").split("|")
    return [_inline(c.strip()) for c in cells]


def _starts_new_block(line: str) -> bool:
    """True if ``line`` opens a construct that ends a running paragraph."""
    s = line.strip()
    if not s:
        return True
    if s.startswith("#") or s.startswith(">") or s.startswith("- "):
        return True
    if s.startswith("|"):
        return True
    return bool(_ORDERED_RE.match(s))


def _parse_bullets(lines: list[str], i: int, n: int) -> tuple[list[ListItem], int]:
    """Top-level ``- `` items with one level of ``  - `` children."""
    items: list[ListItem] = []
    while i < n:
        line = lines[i]
        if not line.strip():
            break
        if _indent(line) == 0 and line.strip().startswith("- "):
            items.append(ListItem(_inline(line.strip()[2:].strip())))
            i += 1
            while i < n and lines[i].strip().startswith("- ") and _indent(lines[i]) >= 2:
                items[-1].children.append(ListItem(_inline(lines[i].strip()[2:].strip())))
                i += 1
        else:
            break
    return items, i


def _parse_ordered(lines: list[str], i: int, n: int) -> tuple[list[ListItem], int]:
    """``1.`` items, blank-separated, with ``   - `` sub-bullets and
    indented continuation lines folded into the item text."""
    items: list[ListItem] = []
    while i < n:
        # Skip blank lines between items, but only stay in the list if the
        # next content line is another top-level ordered item.
        j = i
        while j < n and not lines[j].strip():
            j += 1
        if j >= n:
            i = j
            break
        line = lines[j]
        m = _ORDERED_RE.match(line.strip())
        if _indent(line) != 0 or not m:
            # Not another ordered item — end the list, leaving any blank
            # lines for the main loop to skip.
            break
        text_parts = [m.group(2).strip()]
        children: list[ListItem] = []
        i = j + 1
        while i < n and lines[i].strip() and _indent(lines[i]) >= 1:
            inner = lines[i].strip()
            if inner.startswith("- "):
                children.append(ListItem(_inline(inner[2:].strip())))
            else:
                text_parts.append(inner)
            i += 1
        items.append(ListItem(_inline(" ".join(text_parts)), children))
    return items, i


def markdown_to_blocks(md: str) -> list[Block]:
    """Parse the narrative Markdown subset into renderable blocks."""
    lines = md.splitlines()
    n = len(lines)
    blocks: list[Block] = []
    i = 0
    while i < n:
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # Headings.
        if stripped.startswith("#"):
            level = len(stripped) - len(stripped.lstrip("#"))
            blocks.append(Heading(level, _inline(stripped[level:].strip())))
            i += 1
            continue

        # Pipe table: a header row immediately followed by a delimiter row.
        if stripped.startswith("|") and i + 1 < n and _is_table_delim(lines[i + 1]):
            header = _split_row(stripped)
            i += 2
            rows: list[list[str]] = []
            while i < n and lines[i].strip().startswith("|"):
                rows.append(_split_row(lines[i]))
                i += 1
            blocks.append(Table_(header, rows))
            continue

        # Block quote (consecutive ``>`` lines).
        if stripped.startswith(">"):
            quote_parts: list[str] = []
            while i < n and lines[i].strip().startswith(">"):
                quote_parts.append(lines[i].strip()[1:].strip())
                i += 1
            blocks.append(Quote(_inline(" ".join(quote_parts).strip())))
            continue

        # Ordered list.
        if _ORDERED_RE.match(stripped) and _indent(line) == 0:
            items, i = _parse_ordered(lines, i, n)
            if items:
                blocks.append(Ordered(items))
                continue

        # Unordered list.
        if stripped.startswith("- ") and _indent(line) == 0:
            items, i = _parse_bullets(lines, i, n)
            if items:
                blocks.append(Bullets(items))
                continue

        # Default: a body paragraph, folding wrapped continuation lines.
        para = [stripped]
        i += 1
        while i < n and lines[i].strip() and not _starts_new_block(lines[i]):
            para.append(lines[i].strip())
            i += 1
        blocks.append(Body(_inline(" ".join(para))))

    return blocks
