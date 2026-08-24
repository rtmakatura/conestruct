"""Audit projection → block-model adapter for the audit-trail PDF.

The second consumer of ``document.py`` (after the crew narrative).  Where
the narrative parses Markdown into blocks, the audit builds blocks
*directly* from the projection ``audit_projection`` already produces — no
Markdown step, no recompute.  Every value and citation in the PDF is the
same one ``/render/audit`` serializes and the AuditTrail UI renders; this
module only re-presents it.

It imports nothing from ``src.api`` — only the block model from
``document.py`` — so the rendering package stays free of an api→rendering
cycle.

Glyph note: the projection contains a few characters Helvetica's WinAnsi
encoding can't draw (``→``, ``Δ``, ``≥``).  These are normalized to ASCII
equivalents at this render boundary (:func:`normalize_glyphs`).  That
changes a glyph's *shape*, never a number, citation, or case ID — the
single-source proof normalizes the projection the same way before
comparing.
"""

from __future__ import annotations

from typing import Any

from src.rendering.document import (
    Block,
    Body,
    Bullets,
    Heading,
    ListItem,
    Quote,
    Table_,
    render_document_pdf,
    rich_text,
)
from src.rendering.tier_ledger import ledger_line, tier_ledger

# Characters the projection emits that Helvetica/WinAnsi cannot render.
_GLYPH_FALLBACKS: dict[str, str] = {
    "→": "->",  # → rightwards arrow ("65 → 60 mph")
    "Δ": "Delta ",  # Δ greek capital delta ("Δ10 mph")
    "≥": ">=",  # ≥ greater-than-or-equal
}


def normalize_glyphs(text: str) -> str:
    """Replace non-WinAnsi glyphs with ASCII equivalents (render boundary)."""
    for bad, good in _GLYPH_FALLBACKS.items():
        text = text.replace(bad, good)
    return text


def _cell(value: Any) -> str:
    """Normalize glyphs and escape so the text is ReportLab-Paragraph-safe."""
    return rich_text(normalize_glyphs("" if value is None else str(value)))


def _body(text: str) -> Body:
    return Body(_cell(text))


def _kv_table(rows: list[tuple[str, str]], weights: list[float] | None = None) -> Table_:
    """A 2-column Field/Value table (Value gets the wider share by default)."""
    return Table_(
        header=["Field", "Value"],
        rows=[[_cell(k), _cell(v)] for k, v in rows],
        weights=weights or [1, 2],
    )


def _str(section: dict[str, Any], key: str) -> str:
    val = section.get(key)
    return str(val) if val is not None else ""


# --------------------------------------------------------------------------- #
# Per-section builders.
# --------------------------------------------------------------------------- #


def _summary_blocks(summary: dict[str, Any], status_line: str | None = None) -> list[Block]:
    case_id = _str(summary, "case_id") or "Audit Trail"
    blocks: list[Block] = [Heading(1, _cell(f"Audit Trail — {case_id}"))]
    rows: list[tuple[str, str]] = []
    # #220 — the triage summary leads the cover, sharing the screen
    # ledger's exact words (tier_ledger.ledger_line == tiering.ts
    # ledgerLine; the cross-surface test pins the counts equal).
    if status_line is not None:
        rows.append(("Plan status", _cell(status_line)))
    rows += [
        ("MUTCD typical application", _str(summary, "ta")),
        ("CDOT standard sheet", _str(summary, "cdot_sheet")),
        ("Case", _str(summary, "case_id")),
        (
            "Taper length",
            f"{_g(summary, 'taper_length_ft')} ft ({_str(summary, 'taper_label')})",
        ),
        ("Buffer space", f"{_g(summary, 'buffer_space_ft')} ft"),
        ("Device spacing — taper", f"{_g(summary, 'device_spacing_taper_ft')} ft"),
        ("Device spacing — tangent", f"{_g(summary, 'device_spacing_tangent_ft')} ft"),
        ("Crew steps", str(summary.get("step_count", ""))),
    ]
    if "case_routing" in summary:
        rows.append(("Routing", _str(summary, "case_routing")))
    if "trigger_condition" in summary:
        rows.append(("Trigger condition", _str(summary, "trigger_condition")))
    blocks.append(_kv_table(rows))
    return blocks


def _g(section: dict[str, Any], key: str) -> str:
    val = section.get(key)
    if isinstance(val, bool) or not isinstance(val, (int, float)):
        return str(val) if val is not None else ""
    return f"{val:g}"


def _taper_blocks(taper: dict[str, Any]) -> list[Block]:
    if not taper:
        return []
    blocks: list[Block] = [Heading(2, _cell("Taper Length"))]
    for key in ("formula_choice", "L_calc_text", "L_third_calc_text"):
        if taper.get(key):
            blocks.append(_body(_str(taper, key)))
    blocks.append(
        _kv_table(
            [
                ("Closure type", _str(taper, "closure_type")),
                (
                    f"Offset ({_str(taper, 'offset_label')})",
                    f"{_g(taper, 'offset_ft')} ft",
                ),
                (
                    f"Required taper ({_str(taper, 'L_required_label')})",
                    f"{_g(taper, 'L_required_ft')} ft",
                ),
            ]
        )
    )
    blocks.append(_body(f"Source: {_str(taper, 'source')}"))
    blocks.append(_body(f"CDOT reference: {_str(taper, 'cdot_reference')}"))
    return blocks


def _buffer_blocks(buffer: dict[str, Any]) -> list[Block]:
    if not buffer:
        return []
    blocks: list[Block] = [Heading(2, _cell("Buffer Space"))]
    blocks.append(_body(_str(buffer, "lookup_text")))
    if "jurisdiction" in buffer:
        blocks.append(_body(f"Jurisdiction: {_str(buffer, 'jurisdiction')}"))
    blocks.append(_body(f"Source: {_str(buffer, 'source')}"))
    return blocks


def _spacing_blocks(spacing: dict[str, Any]) -> list[Block]:
    if not spacing:
        return []
    blocks: list[Block] = [Heading(2, _cell("Channelizing Device Spacing"))]
    for key in (
        "in_taper_text",
        "on_tangent_text",
        "taper_count_text",
        "tangent_count_text",
        "downstream_count_text",
    ):
        if spacing.get(key):
            blocks.append(_body(_str(spacing, key)))
    blocks.append(_body(f"Source: {_str(spacing, 'source')}"))
    return blocks


def _table_from_dicts(
    rows: list[dict[str, Any]], weights: list[float] | None = None
) -> Table_ | None:
    """Build a Table_ from a list of uniform dicts (header = first row keys)."""
    if not rows:
        return None
    header = list(rows[0].keys())
    body = [[_cell(row.get(col, "")) for col in header] for row in rows]
    return Table_(header=[_cell(h) for h in header], rows=body, weights=weights)


def _advance_blocks(advance: dict[str, Any]) -> list[Block]:
    if not advance:
        return []
    blocks: list[Block] = [Heading(2, _cell("Advance Warning Signs"))]
    blocks.append(_body(_str(advance, "road_type_text")))
    blocks.append(_body(_str(advance, "spacing_text")))
    table = _table_from_dicts(advance.get("sign_table", []), weights=[2, 1, 1, 3])
    if table is not None:
        blocks.append(table)
    blocks.append(_body(f"Source: {_str(advance, 'source')}"))
    return blocks


def _colorado_blocks(colorado: dict[str, Any]) -> list[Block]:
    if not colorado:
        return []
    blocks: list[Block] = [Heading(2, _cell("Colorado Requirements (CDOT S-630-1)"))]
    checks = colorado.get("checks", [])
    if checks:
        rows = [
            [
                _cell(c.get("label", "")),
                _cell("PASS" if c.get("pass") else "FAIL"),
                _cell(c.get("citation", "")),
                _cell(c.get("detail", "")),
            ]
            for c in checks
        ]
        blocks.append(
            Table_(
                header=[_cell(h) for h in ("Check", "Result", "Citation", "Detail")],
                rows=rows,
                weights=[2, 1, 1, 3],
            )
        )
    for info in colorado.get("info_items", []):
        blocks.append(
            _body(f"{_str(info, 'label')} — {_str(info, 'detail')} ({_str(info, 'citation')})")
        )
    blocks.append(_body(f"All Colorado checks pass: {colorado.get('all_pass')}"))
    return blocks


def _case_blocks(case: dict[str, Any]) -> list[Block]:
    if not case:
        return []
    blocks: list[Block] = [Heading(2, _cell("CDOT Case Reference"))]
    blocks.append(_body(_str(case, "case")))
    blocks.append(_body(_str(case, "narrative")))
    blocks.append(_body(_str(case, "narrative_2")))
    if "routing" in case:
        blocks.append(_body(f"Routing: {_str(case, 'routing')}"))
    if case.get("trigger_condition"):
        blocks.append(Quote(_cell(_str(case, "trigger_condition"))))
    blocks.append(_body(f"Reference: {_str(case, 'url')}"))
    return blocks


def _geometry_blocks(geo: dict[str, Any]) -> list[Block]:
    if not geo:
        return []
    blocks: list[Block] = [Heading(2, _cell("Geometry Validation"))]
    blocks.append(
        _body(
            f"Work zone {_g(geo, 'work_zone_ft')} ft vs required taper "
            f"{_g(geo, 'taper_ft')} ft ({_str(geo, 'taper_label')}) + buffer "
            f"{_g(geo, 'buffer_ft')} ft."
        )
    )
    blocks.append(_body(f"All geometry checks pass: {geo.get('all_pass')}"))
    table = _table_from_dicts(geo.get("violations", []), weights=[1, 1, 3, 1])
    if table is not None:
        blocks.append(table)
    blocks.append(_body(f"Source: {_str(geo, 'source')}"))
    return blocks


def _corridor_blocks(corridor: dict[str, Any]) -> list[Block]:
    if not corridor:
        return []
    blocks: list[Block] = [Heading(2, _cell("Corridor Validation"))]
    if not corridor.get("checked"):
        blocks.append(_body("Corridor check not run (no site coordinates supplied)."))
        return blocks
    warnings = corridor.get("warnings", [])
    if warnings:
        blocks.append(_body("OpenStreetMap corridor check produced warnings:"))
        # Each warning is a dict (#82: the projection slims it to
        # {flag, level, message}); render the composed ``message`` line,
        # not str(dict).
        blocks.append(Bullets([ListItem(_cell(w.get("message", ""))) for w in warnings]))
    else:
        blocks.append(_body("OpenStreetMap corridor check ran with no warnings."))
    return blocks


def _site_adjustments_blocks(records: list[dict[str, Any]]) -> list[Block]:
    """Site-condition adjustments (#104) — one row per fired flag.

    The PDF renders each record's full ``rule`` prose + ``action`` text;
    the derived discrete ``citation`` chip is panel-only (same split as
    the #97 taper/buffer/spacing citations, where the PDF carries the
    prose ``source``).  ``flag`` is a machine key, not display text.
    """
    if not records:
        return []
    blocks: list[Block] = [Heading(2, _cell("Site Adjustments"))]
    blocks.append(
        _body(
            "Site-condition flags layered onto the baseline MUTCD/CDOT "
            "layout. Each adjustment is traced to its source rule; the "
            "rendered plan, device list, and crew narrative reflect every "
            "item below."
        )
    )
    rows = [[_cell(r.get("rule", "")), _cell(r.get("action", ""))] for r in records]
    blocks.append(
        Table_(
            header=[_cell(h) for h in ("Rule", "Adjustment")],
            rows=rows,
            weights=[2, 3],
        )
    )
    return blocks


def _approaches_blocks(approaches: dict[str, Any]) -> list[Block]:
    """Cross-street approaches (near_intersection kind, Refs #117).

    One sub-table per approach leg via the shared ``_table_from_dicts``
    machinery — the Sheet 10 advance-signing key math travels in each
    row's ``key_text`` line so a reviewer can trace every station to
    the leg's own speed/road-type lookup.
    """
    if not approaches:
        return []
    blocks: list[Block] = [Heading(2, _cell("Cross-Street Approaches"))]
    blocks.append(
        _body(
            f"Intersection on the {_str(approaches, 'side')} side of the "
            f"work zone (centerline crossing at mainline station "
            f"{_g(approaches, 'along_station_ft')} ft)."
        )
    )
    blocks.append(_body(_str(approaches, "narrative")))
    for ap in approaches.get("approaches", []):
        signal_note = (
            " — SIGNALIZED (signal operation review required)" if ap.get("signalized") else ""
        )
        blocks.append(
            _body(
                f"Approach '{_str(ap, 'id')}' — {_g(ap, 'speed_mph')} mph, "
                f"{_str(ap, 'road_type')}{signal_note}. {_str(ap, 'key_text')}."
            )
        )
        table = _table_from_dicts(ap.get("sign_table", []), weights=[1, 2, 2])
        if table is not None:
            blocks.append(table)
    blocks.append(_body(f"Source: {_str(approaches, 'source')}"))
    return blocks


def _flagger_blocks(flagger: dict[str, Any]) -> list[Block]:
    if not flagger:
        return []
    blocks: list[Block] = [Heading(2, _cell("Flagger Control"))]
    blocks.append(_body(_str(flagger, "narrative")))
    table = _table_from_dicts(flagger.get("table", []))
    if table is not None:
        blocks.append(table)
    blocks.append(_body(f"Source: {_str(flagger, 'source')}"))
    return blocks


def _fines_double_blocks(fd: dict[str, Any]) -> list[Block]:
    blocks: list[Block] = [Heading(2, _cell("Fines Double Envelope"))]
    blocks.append(_body(f"Citation: {_str(fd, 'citation')}"))
    if fd.get("gating"):
        blocks.append(_body(_str(fd, "gating")))
    env = fd.get("envelope", {})
    if env:
        rows: list[tuple[str, str]] = [
            ("R2-10 station", f"{_g(env, 'r2_10_station_ft')} ft"),
            ("R2-11 station", f"{_g(env, 'r2_11_station_ft')} ft"),
            ("Envelope length", f"{_g(env, 'length_ft')} ft"),
            ("Assemblies", _g(env, "n_assemblies")),
            (
                "Entrance R2-1",
                f"{_str(env, 'entrance_r2_1_label')} @ {_g(env, 'entrance_r2_1_station_ft')} ft",
            ),
            (
                "Downstream R2-1",
                f"{_str(env, 'downstream_r2_1_label')} @ "
                f"{_g(env, 'downstream_r2_1_station_ft')} ft",
            ),
        ]
        blocks.append(_kv_table(rows))
        if env.get("geometry_note"):
            blocks.append(_body(_str(env, "geometry_note")))
    notes = fd.get("operational_notes", [])
    if notes:
        rows_n = [[_cell(n.get("citation", "")), _cell(n.get("action", ""))] for n in notes]
        blocks.append(
            Table_(
                header=[_cell(h) for h in ("Citation", "Operational rule")],
                rows=rows_n,
                weights=[1, 3],
            )
        )
    blocks.append(_body(f"Source: {_str(fd, 'source')}"))
    return blocks


def _pending_blocks(pending: dict[str, Any]) -> list[Block]:
    if not pending:
        return []
    blocks: list[Block] = [Heading(2, _cell("Pending Verification"))]
    count = pending.get("count", 0)
    note = _str(pending, "note")
    blocks.append(
        _body(
            f"{count} reference(s) pending verification. {note}".strip()
            + f"  Tracking: {_str(pending, 'tracking_issue')}"
        )
    )
    items = pending.get("items", [])
    if items:
        blocks.append(
            Bullets(
                [
                    ListItem(
                        _cell(
                            f"[{_str(it, 'kind')}] {_str(it, 'label')} "
                            f"({_str(it, 'tracking_issue')})"
                        )
                    )
                    for it in items
                ]
            )
        )
    return blocks


# --------------------------------------------------------------------------- #
# Public entry points.
# --------------------------------------------------------------------------- #


def audit_to_blocks(
    projection: dict[str, Any],
    jurisdiction: dict[str, Any] | None = None,
) -> list[Block]:
    """Map a full audit projection (summary + sections + pending) to blocks.

    Renders every section the projection carries, independent of the UI's
    accordion state — the PDF is the complete, attach-to-a-bid-packet view.
    ``jurisdiction`` is the evaluated block (when the scenario names one)
    — it feeds ONLY the cover's #220 status line; the jurisdiction corpus
    itself is a screen surface, not an audit-PDF section.
    """
    summary = projection.get("summary", {})
    sections = projection.get("sections", {})
    pending = projection.get("pending_verification", {})

    blocks: list[Block] = []
    blocks += _summary_blocks(
        summary, status_line=ledger_line(tier_ledger(projection, jurisdiction))
    )
    blocks += _taper_blocks(sections.get("taper", {}))
    blocks += _buffer_blocks(sections.get("buffer", {}))
    blocks += _spacing_blocks(sections.get("spacing", {}))
    blocks += _advance_blocks(sections.get("advance", {}))
    blocks += _colorado_blocks(sections.get("colorado", {}))
    blocks += _case_blocks(sections.get("case", {}))
    blocks += _geometry_blocks(sections.get("geometry_validation", {}))
    blocks += _corridor_blocks(sections.get("corridor_validation", {}))
    blocks += _site_adjustments_blocks(sections.get("site_adjustments", []))
    blocks += _approaches_blocks(sections.get("approaches", {}))
    blocks += _flagger_blocks(sections.get("flagger", {}))
    if "fines_double" in sections:
        blocks += _fines_double_blocks(sections["fines_double"])
    blocks += _pending_blocks(pending)
    return blocks


def render_audit_pdf(
    projection: dict[str, Any],
    output_path: str,
    jurisdiction: dict[str, Any] | None = None,
) -> str:
    """Render the audit projection to a PDF at ``output_path``; return the path.

    Mirrors the write-to-path-return-path convention of the other
    renderers so the FastAPI ``_render_with`` plumbing works unchanged.
    """
    blocks = audit_to_blocks(projection, jurisdiction=jurisdiction)
    return render_document_pdf(blocks, output_path, title="Audit Trail")
