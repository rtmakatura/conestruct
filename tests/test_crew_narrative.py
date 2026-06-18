"""Crew narrative rendering — Trigger Condition section (G6).

First narrative-side pytest coverage in the project. Verifies the
verbatim-or-nothing symmetry between audit, AuditTrail UI, and crew
narrative for the Sheet 14 Cases 26/27 trigger language: present at
65/75 mph with reduction, silent otherwise.
"""

from __future__ import annotations

from src.generation.layout import generate_shoulder_closure_divided
from src.narrative.crew_narrative import _render_template, build_narrative_context
from src.rules.site_adjustments import apply_site_adjustments
from src.rules.validators import ScenarioParams

_TRIGGER_HEADER = "## Trigger Condition"
_TRIGGER_8FT = (
    "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 8 FT OF TRAVEL WAY"
)
_TRIGGER_10FT = (
    "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 10 FT OF TRAVEL WAY"
)


def _render(params: ScenarioParams) -> str:
    placements = generate_shoulder_closure_divided(params)
    context = build_narrative_context(placements, params)
    return _render_template(context)


def test_crew_narrative_65mph_reduction_includes_trigger_section() -> None:
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=60,
    )
    markdown = _render(params)
    assert _TRIGGER_HEADER in markdown
    assert f"> {_TRIGGER_8FT}" in markdown
    assert "The engineer of record determines activation" in markdown


def test_crew_narrative_75mph_reduction_includes_trigger_section() -> None:
    params = ScenarioParams(
        speed_mph=75,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=65,
    )
    markdown = _render(params)
    assert _TRIGGER_HEADER in markdown
    assert f"> {_TRIGGER_10FT}" in markdown


def test_crew_narrative_no_reduction_omits_trigger_section() -> None:
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=None,
    )
    markdown = _render(params)
    assert _TRIGGER_HEADER not in markdown
    assert _TRIGGER_8FT not in markdown
    assert _TRIGGER_10FT not in markdown


def test_crew_narrative_55mph_reduction_omits_trigger_section() -> None:
    # Case 11 variant — reduction is in effect but Sheet 14 does not
    # tabulate trigger text at 55 mph. Verbatim-or-nothing: stay silent
    # in the narrative just as audit.trigger_condition stays None.
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=45,
    )
    markdown = _render(params)
    assert _TRIGGER_HEADER not in markdown
    assert _TRIGGER_8FT not in markdown
    assert _TRIGGER_10FT not in markdown


# ---------------------------------------------------------------------------
# G4 — entrance R2-1 sign schedule row
# ---------------------------------------------------------------------------
# Verifies that the work-zone speed posting (entrance R2-1) appears in
# the crew Markdown Sign Placement Schedule under reduction, and is
# absent when no reduction is in effect.


def test_crew_narrative_65mph_reduction_includes_entrance_r2_1_row() -> None:
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=60,
    )
    markdown = _render(params)
    # Entrance R2-1 row carries the reduced limit; downstream R2-1 row
    # carries the posted-speed restoration.
    assert "| R2-1 | SPEED LIMIT 60 (work-zone speed posting)" in markdown
    assert "| R2-1 | SPEED LIMIT 65 (posted-speed restoration)" in markdown
    assert "Within work zone (paired with G20-5P plaque)" in markdown


def test_crew_narrative_55mph_reduction_includes_entrance_r2_1_row() -> None:
    # Case 11 variant — the entrance R2-1 is regulatory per §2B.13(A),
    # not tabulated only at 65/75. It should appear at 55→45 too.
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=45,
    )
    markdown = _render(params)
    assert "| R2-1 | SPEED LIMIT 45 (work-zone speed posting)" in markdown
    assert "| R2-1 | SPEED LIMIT 55 (posted-speed restoration)" in markdown


def test_crew_narrative_no_reduction_omits_entrance_r2_1_row() -> None:
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=None,
    )
    markdown = _render(params)
    # No reduction → no Fines Double envelope schedule rows at all.
    assert "(work-zone speed posting)" not in markdown
    assert "(posted-speed restoration)" not in markdown


# ---------------------------------------------------------------------------
# G5 — W3-5 advisory-speed sign schedule row(s)
# ---------------------------------------------------------------------------
# Verifies that the W3-5 advisory advance-warning sign appears in the
# crew Markdown Sign Placement Schedule whenever a reduction applies —
# single row for Δ ≤ 15, N rows for stepped sequences — and is absent
# under no reduction.


def test_crew_narrative_65mph_reduction_includes_w3_5_row() -> None:
    """65 → 60 (Δ=5, N=1) → one W3-5(60) row above the entrance R2-1."""
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=60,
    )
    markdown = _render(params)
    assert "| W3-5(60) | ADVISORY SPEED 60 | 530 ft upstream of R2-10 " in markdown


def test_crew_narrative_55mph_reduction_includes_w3_5_row() -> None:
    """55 → 45 (Δ=10, N=1) → one W3-5(45) row."""
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=45,
    )
    markdown = _render(params)
    assert "| W3-5(45) | ADVISORY SPEED 45 | 530 ft upstream of R2-10 " in markdown


def test_crew_narrative_stepped_reduction_includes_n_w3_5_rows() -> None:
    """55 → 30 (Δ=25, N=2 stepped) → two W3-5 rows: driver-encounter
    order is W3-5(40) first (1,060 ft upstream), W3-5(30) second (530 ft
    upstream of R2-10, rightmost = target speed)."""
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=30,
    )
    markdown = _render(params)
    assert "| W3-5(40) | ADVISORY SPEED 40 | 1,060 ft upstream of R2-10 " in markdown
    assert "| W3-5(30) | ADVISORY SPEED 30 | 530 ft upstream of R2-10 " in markdown


def test_crew_narrative_no_reduction_omits_w3_5_row() -> None:
    """No reduction → no W3-5 row(s) in the sign schedule."""
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=None,
    )
    markdown = _render(params)
    assert "W3-5" not in markdown
    assert "ADVISORY SPEED" not in markdown


# ---------------------------------------------------------------------------
# G2 — W5-1 ROAD NARROWS sign schedule row
# ---------------------------------------------------------------------------
# Verifies that the W5-1 row appears in the Sign Placement Schedule on
# freeway no-reduction shoulder closures (Case 11), and is absent on
# reduced-speed (Cases 26/27) or non-freeway scenarios.  The row is
# emitted automatically by ``_advance_signs_from_placements`` since W5-1
# carries a positive offset, sits upstream of the taper, and is not in
# ``_PLAQUE_AND_END_LABELS`` — no narrative-code change required.


def test_crew_narrative_freeway_no_reduction_includes_w5_1_row() -> None:
    """Freeway × no reduction → W5-1 row present at 500 ft upstream."""
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=None,
    )
    markdown = _render(params)
    assert "| W5-1 | ROAD NARROWS" in markdown
    assert "500 ft upstream" in markdown


def test_crew_narrative_freeway_reduced_omits_w5_1_row() -> None:
    """Cases 26/27 exclude W5-1 — confirm no row appears when reduced."""
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=60,
    )
    markdown = _render(params)
    assert "W5-1" not in markdown
    assert "ROAD NARROWS" not in markdown


def test_crew_narrative_non_freeway_no_reduction_omits_w5_1_row() -> None:
    """Case 11 (Sheet 7) is freeway-scoped — rural shoulder closures
    don't get W5-1 even without a work-zone reduction."""
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=800.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=None,
    )
    markdown = _render(params)
    assert "W5-1" not in markdown
    assert "ROAD NARROWS" not in markdown


# ---------------------------------------------------------------------------
# G1 — Second W21-5aR + W16-2a / W7-3a plaque schedule rows
# ---------------------------------------------------------------------------
# Verifies that the W16-2a plaque row carries the computed "NEXT XXX FT"
# text (distance from first W21-5aR to wz_start) and the W7-3a row
# carries the computed "NEXT X MILES" text (work zone length / 5280,
# floored at 1).  Rows appear on freeway shoulder closures regardless of
# routing; absent on non-freeway.


def test_crew_narrative_freeway_includes_w16_2a_and_w7_3a_rows() -> None:
    """Freeway shoulder closure → sign schedule carries W16-2a / W7-3a
    rows with parametric distance text under the W21-5aR siblings."""
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
    markdown = _render(params)
    assert "| W16-2a |" in markdown
    assert "NEXT" in markdown
    assert "FT (under upstream W21-5aR)" in markdown
    assert "| W7-3a |" in markdown
    assert "MILE (under downstream W21-5aR)" in markdown


def test_crew_narrative_freeway_reduced_includes_w21_5aR_pair() -> None:
    """Reduced-speed shoulder closure (Sheet 14 Cases 26/27) keeps the
    W21-5aR pair + plaques — emission gate is freeway-shoulder, not
    routing-dependent."""
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1000.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=60,
    )
    markdown = _render(params)
    assert "| W16-2a |" in markdown
    assert "| W7-3a |" in markdown


def test_crew_narrative_non_freeway_omits_w21_5aR_pair_plaques() -> None:
    """Rural shoulder closure doesn't trigger G1 — no W16-2a / W7-3a
    rows in the schedule."""
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=1000.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=None,
    )
    markdown = _render(params)
    assert "W16-2a" not in markdown
    assert "W7-3a" not in markdown


# ---------------------------------------------------------------------------
# Site-Specific Notes — emitted MUTCD citations
# ---------------------------------------------------------------------------
# The site-adjustment "rule" string renders into the crew narrative under
# "## Site-Specific Notes" (base.md.j2) and the Streamlit panel.  This
# surface is NOT in the /render/audit projection, so it has no snapshot
# coverage — which is how stale §6C citations regressed unnoticed past
# a86740c (audit-projection only).  These tests pin the 11th-edition
# citation each site adjustment emits, with a negative guard against the
# old §6C number.
#
# Each test drives a SINGLE flag so its negative guard only inspects that
# flag's own rendered note.  Do NOT add a whole-narrative "no §6C"
# assertion: the §6C.10 / §6F.60 intersection and interchange citations
# are intentionally still stale (UNRESOLVED — pending PDF verification),
# and pinning them here would pin an unverified value.


def _render_with_flags(params: ScenarioParams, flags: dict[str, bool]) -> str:
    placements = generate_shoulder_closure_divided(params)
    adjusted, records = apply_site_adjustments(placements, params, flags)
    context = build_narrative_context(adjusted, params, site_adjustments=records)
    return _render_template(context)


_SITE_ADJ_PARAMS = ScenarioParams(
    speed_mph=65,
    num_lanes=2,
    closure_type="shoulder",
    road_type="freeway",
    work_zone_length_ft=800.0,
    is_divided=True,
    jurisdiction="CDOT",
    work_zone_speed_mph=None,
)


def test_crew_narrative_limited_sight_distance_emits_6b04_citation() -> None:
    """limited_sight_distance note cites §6B.04 (advance warning), not §6C.04."""
    markdown = _render_with_flags(_SITE_ADJ_PARAMS, {"limited_sight_distance": True})
    assert "## Site-Specific Notes" in markdown
    assert "MUTCD §6B.04" in markdown
    # Guard the MUTCD citation specifically: the divided-highway note still
    # carries a retained "Colorado Supplement §6C.04(A)" (Category 4), so a
    # bare "§6C.04" guard would collide with it.
    assert "MUTCD §6C.04" not in markdown


def test_crew_narrative_driveways_present_emits_6k01_citation() -> None:
    """driveways_present note cites §6K.01 (channelizing devices), not §6C.09."""
    markdown = _render_with_flags(_SITE_ADJ_PARAMS, {"driveways_present": True})
    assert "## Site-Specific Notes" in markdown
    assert "MUTCD §6K.01" in markdown
    assert "MUTCD §6C.09" not in markdown
