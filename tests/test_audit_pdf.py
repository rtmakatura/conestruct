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
#
# ``flag`` / ``level`` are corridor-warning styling/enum metadata (#82):
# the UI uses them for a tag chip and severity tone, but the rendered
# prose is the warning's ``message``.  They are not displayed text, so
# they are excluded like ``formula_latex``.  Caveat: ``_SKIP_KEYS`` is
# global, so this assumes no future section adds a *displayed* ``flag`` /
# ``level`` string — true today (they appear only on corridor warnings).
_SKIP_KEYS = frozenset({"formula_latex", "flag", "level"})

# #97 — the taper/buffer/spacing ``citation`` field ({cite, footer}) feeds
# the React audit PANEL's cite header + footer chip only; the PDF renders
# the prose ``source`` field on each section (unchanged), so these discrete
# strings intentionally do NOT appear in the PDF blocks.  They are a nested
# dict under the key ``citation`` — which elsewhere (plaque / Colorado /
# Fines Double) is a *rendered* string, so we can't skip the key globally
# (that would stop verifying those real PDF citations).  Allowlist the exact
# panel-only leaves instead.  Kept in sync with ``_CITATION_*`` in
# ``src/api/audit.py``.
_PANEL_ONLY_CITATIONS = frozenset(
    {
        "MUTCD § 6B.08",
        "MUTCD 2023 EDITION · CHAPTER 6B · TABLE 6B-3",
        "MUTCD § 6B.06",
        "MUTCD § 6B.06 · STOPPING SIGHT DISTANCE",
        "MUTCD § 6K.01",
        "MUTCD § 6K.01 · CHANNELIZING DEVICE SPACING",
        # #104 — site-adjustment ``citation`` chips (derived from ``rule``
        # by _site_citation): panel-only; the PDF renders the full ``rule``
        # prose in the Site Adjustments table instead.
        "MUTCD § 6B.04",
        "MUTCD § 6N.12",
        "MUTCD § 6N.16 + Ch. 6H",
        "MUTCD § 6C.02",
        "MUTCD § 9C.101",
        "MUTCD § 7B.08",
    }
)

_TAG_RE = re.compile(r"<[^>]+>")


def _projection() -> dict[str, Any]:
    placements = generate_shoulder_closure_divided(_PARAMS)
    audit = build_audit_trail(placements, _PARAMS)
    return audit_projection(audit, "shoulder", step_count=11, road_type=_PARAMS.road_type)


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


def _missing_leaves(projection: Any, text: str) -> list[str]:
    """Projection string leaves absent from the rendered PDF text, minus the
    #97 panel-only citations (rendered by the React audit panel, not the PDF
    — the PDF carries the prose ``source`` field instead)."""
    return [
        leaf
        for leaf in _string_leaves(projection)
        if leaf not in _PANEL_ONLY_CITATIONS and normalize_glyphs(leaf) not in text
    ]


def test_blocks_carry_every_projection_string() -> None:
    """No citation, source, value-sentence, table cell, or note is dropped
    or altered in the projection → blocks step (single-source proof)."""
    projection = _projection()
    text = normalize_glyphs(_block_plaintext(audit_to_blocks(projection)))
    missing = _missing_leaves(projection, text)
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
    projection = audit_projection(
        build_audit_trail(placements, params), "shoulder", 11, road_type="freeway"
    )
    assert "fines_double" not in projection["sections"]
    blocks = audit_to_blocks(projection)
    assert not any(isinstance(b, Quote) for b in blocks)
    # The single-source guarantee still holds for the lighter projection.
    text = normalize_glyphs(_block_plaintext(blocks))
    missing = _missing_leaves(projection, text)
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


def test_corridor_warning_renders_as_clean_line() -> None:
    """A corridor warning renders as its composed ``message`` line, not a
    raw Python dict (#82).

    The projection slims the rule's rich diagnostic dict to {flag, level,
    message}, dropping the debug fields, and the single-source proof holds
    for the warning-bearing projection.  Injecting the warning avoids a
    live Overpass call (``validate_corridor_against_osm`` is network-bound).
    """
    placements = generate_shoulder_closure_divided(_PARAMS)
    audit = build_audit_trail(placements, _PARAMS)
    # The #82 example: the full diagnostic dict the corridor rule emits.
    message = (
        "No motorway/trunk/primary/secondary road detected at anchor "
        "(39.73915, -104.99025) within 30 m (closest road within 30 m: "
        "'residential').  Verify coordinates correspond to the actual work zone."
    )
    audit["corridor_validation"] = {
        "checked": True,
        "warnings": [
            {
                "flag": "no_road_at_anchor",
                "level": "warning",
                "message": message,
                "anchor_lat": 39.73915,
                "anchor_lng": -104.99025,
                "detected_highway": "residential",
                "search_radius_m": 30.0,
            }
        ],
    }
    projection = audit_projection(audit, "shoulder", step_count=11, road_type="rural")

    # The projection slims each warning to exactly {flag, level, message};
    # the debug fields (anchor_lat, detected_highway, ...) are dropped.
    warning = projection["sections"]["corridor_validation"]["warnings"][0]
    assert warning == {
        "flag": "no_road_at_anchor",
        "level": "warning",
        "message": message,
    }

    text = normalize_glyphs(_block_plaintext(audit_to_blocks(projection)))
    # The composed message renders; no stringified-dict text leaks in.
    assert "No motorway/trunk/primary/secondary road detected at anchor" in text
    assert "{'flag'" not in text
    assert "'message':" not in text

    # The single-source proof still holds for the warning-bearing projection
    # (flag/level are skipped; message is the rendered prose).
    missing = _missing_leaves(projection, text)
    assert not missing, f"projection strings absent from the PDF blocks: {missing}"


# ---------------------------------------------------------------------------
# Flagger twin of the single-source proof (Region 6 item 1)
# ---------------------------------------------------------------------------


def _flagger_projection() -> dict[str, Any]:
    """The V1 flagger baseline (FLAGGER_BASIC_BODY) through the same
    production build_audit_trail -> audit_projection path."""
    from src.api.audit import _compute_step_count
    from src.api.schemas import FlaggerLaneClosureScenario, scenario_to_call
    from tests.s630.test_ta10_flagger import FLAGGER_BASIC_BODY

    scenario = FlaggerLaneClosureScenario.model_validate(FLAGGER_BASIC_BODY)
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    audit = build_audit_trail(placements, params)
    return audit_projection(
        audit,
        "flagger_lane_closure",
        step_count=_compute_step_count(scenario),
        road_type=params.road_type,
    )


def test_blocks_carry_every_projection_string_flagger() -> None:
    """Flagger twin of the single-source proof: no flagger citation, value
    sentence, table cell, or note is dropped or altered in the projection ->
    blocks step.  (String leaves only — the numeric-leaf gap is a tracked,
    separate item: reliability-map Region 6 item 3.)"""
    projection = _flagger_projection()
    text = normalize_glyphs(_block_plaintext(audit_to_blocks(projection)))
    missing = _missing_leaves(projection, text)
    assert not missing, f"flagger projection strings absent from the PDF blocks: {missing}"


# ---------------------------------------------------------------------------
# #104 — Site Adjustments section (sections.site_adjustments)
# ---------------------------------------------------------------------------

_ALL_SITE_FLAGS = (
    "limited_sight_distance",
    "adjacent_intersection",
    "adjacent_interchange",
    "driveways_present",
    "pedestrian_facility",
    "bicycle_facility",
    "school_zone",
)


def _projection_with_site_flags() -> dict[str, Any]:
    """The shoulder baseline with every site flag fired, through the same
    production path (_placements_for applies site adjustments before the
    audit builder; here apply_site_adjustments plays that role)."""
    from src.rules.site_adjustments import apply_site_adjustments

    placements = generate_shoulder_closure_divided(_PARAMS)
    placements, site_records = apply_site_adjustments(
        placements, _PARAMS, {flag: True for flag in _ALL_SITE_FLAGS}
    )
    audit = build_audit_trail(placements, _PARAMS)
    return audit_projection(
        audit,
        "shoulder",
        step_count=11,
        road_type=_PARAMS.road_type,
        site_records=site_records,
    )


def test_blocks_carry_every_projection_string_site_adjustments() -> None:
    """Site-flag twin of the single-source proof: the projection's new
    sections.site_adjustments records (rule prose + action text) render on
    the PDF — the audit PDF is the complete attach-to-a-bid-packet view, so
    a section the projection carries cannot be silently dropped."""
    projection = _projection_with_site_flags()
    text = normalize_glyphs(_block_plaintext(audit_to_blocks(projection)))
    missing = _missing_leaves(projection, text)
    assert not missing, f"site-adjustment strings absent from the PDF blocks: {missing}"
    assert "Site Adjustments" in text
