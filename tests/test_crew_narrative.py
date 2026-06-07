"""Crew narrative rendering — Trigger Condition section (G6).

First narrative-side pytest coverage in the project. Verifies the
verbatim-or-nothing symmetry between audit, AuditTrail UI, and crew
narrative for the Sheet 14 Cases 26/27 trigger language: present at
65/75 mph with reduction, silent otherwise.
"""

from __future__ import annotations

from src.generation.layout import generate_shoulder_closure_divided
from src.narrative.crew_narrative import _render_template, build_narrative_context
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
