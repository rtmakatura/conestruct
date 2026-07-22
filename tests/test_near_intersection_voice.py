"""Voice tier for the (gated) near_intersection kind — Option C inc. 3 (Refs #117).

Increment 3 gives the kind its words: crew-narrative blocks per
cross-street approach, per-approach audit sections with the Sheet 10
advance-signing key math shown, the signals flag-and-cite pending item,
and the plan sheet's Cases 18/19 citation note in place of a
cross-street drawing.  The HTTP path still 400s the kind by design, so
everything here asserts on the INTERNAL call path (``scenario_to_call``
→ generator → narrative/audit/renderer) — the layer where the
increment's behavior lives (rule #11).

Spec anchors, verified by subject against the local PDFs:
  * CDOT S-630-1 Sheet 10, Cases 18/19 (advance-signing key; rural
    note; corner-quadrant plate shape)
  * MUTCD Fig. 6P-21 / TA-21 "Lane Closure on the Near Side of an
    Intersection"; Fig. 6P-22 / TA-22 "Right-Hand Lane Closure on the
    Far Side of an Intersection"
  * MUTCD §6N.12 (work at an intersection; items 04/05 signal review)
"""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import TypeAdapter

from src.api.audit import (
    INTERSECTION_SUPPORT_ISSUE,
    _compute_step_count,
    audit_projection,
    build_audit_trail,
)
from src.api.schemas import Scenario, scenario_to_call
from src.narrative.crew_narrative import build_narrative_context, render_crew_narrative_markdown
from src.rendering.audit_blocks import audit_to_blocks, render_audit_pdf
from src.rendering.document import Heading
from src.rendering.plan_sheet import render_plan_sheet

_ADAPTER: TypeAdapter[Scenario] = TypeAdapter(Scenario)


def _approach(**overrides: Any) -> dict[str, Any]:
    base = {
        "id": "cross_n",
        "speed": 30,
        "roadType": "urban_arterial",
        "lanesPerDirection": 1,
        "laneWidth": 12.0,
        "signalized": False,
        "bearingDeg": None,
        "alongStationFt": -60.0,
    }
    return {**base, **overrides}


def _body(**overrides: Any) -> dict[str, Any]:
    base = {
        "kind": "near_intersection",
        "meta": {
            "project": "ni-voice",
            "address": "",
            "lat": 0.0,
            "lng": 0.0,
            "siteConditions": {},
        },
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 300.0,
        "night": False,
        "approaches": [_approach()],
    }
    return {**base, **overrides}


def _internal(body: dict[str, Any]):
    """Internal call path: (placements, params, approaches)."""
    scenario = _ADAPTER.validate_python(body)
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    return placements, params, kwargs["approaches"], scenario


# Far-side variant: intersection 900 ft downstream of station 0 is
# upstream of the work zone end (station frame increases upstream), so
# along > workLen ⇒ far side, and the §6N.12.12 companion closure fires.
_FAR_BODY = _body(
    approaches=[
        _approach(roadType="rural_undivided", speed=55, alongStationFt=900.0),
    ]
)

# Two-approach body with DIFFERENT per-leg numbers: the urban 30-mph leg
# keys A=100, the rural 55-mph leg keys A=500 — the audit/narrative must
# show each leg its own math, not the mainline's.
_TWO_LEG_BODY = _body(
    approaches=[
        _approach(id="cross_n", speed=30, signalized=True),
        _approach(id="cross_s", speed=55, roadType="rural_undivided", lanesPerDirection=2),
    ]
)


# ---------------------------------------------------------------------------
# Crew narrative
# ---------------------------------------------------------------------------


def test_narrative_has_per_approach_blocks_with_key_math() -> None:
    placements, params, approaches, _ = _internal(_TWO_LEG_BODY)
    md = render_crew_narrative_markdown(placements, params, approaches=approaches)
    # One block per leg, each with its OWN Sheet 10 key value.
    assert "**cross_n approach** (30 mph" in md
    assert "**cross_s approach** (55 mph" in md
    assert "A = 100 ft" in md  # urban 30 leg
    assert "A = 500 ft" in md  # rural 55 leg
    # Approach-frame labeling is explicit, per leg.
    assert "FROM the intersection curb line" in md
    assert "measured from the intersection curb line" in md


def test_narrative_sequencing_is_flagged_not_prescribed() -> None:
    placements, params, approaches, _ = _internal(_body())
    md = render_crew_narrative_markdown(placements, params, approaches=approaches)
    assert "**Sequencing note:**" in md
    assert "The MUTCD does not prescribe the order of mainline versus cross-street setup" in md
    assert "Traffic Control Supervisor's determination" in md


def test_narrative_mainline_steps_are_lane_closure_not_shoulder() -> None:
    placements, params, approaches, _ = _internal(_body())
    md = render_crew_narrative_markdown(placements, params, approaches=approaches)
    assert "LEFT ARROW mode" in md
    assert "merging taper" in md
    assert "RIGHT ARROW" not in md
    assert "shoulder taper" not in md
    # Full merging L (12 ft x 45 mph = 540), not the shoulder L/3.
    ctx = build_narrative_context(placements, params, approaches=approaches)
    assert ctx["taper_len_ft"] == 540.0


def test_narrative_schedule_covers_the_unconditional_regulatory_signs() -> None:
    placements, params, approaches, _ = _internal(_body())
    md = render_crew_narrative_markdown(placements, params, approaches=approaches)
    # R2-10 / G20-1 / R2-11 are placed unconditionally for this kind
    # (plate-driven); each needs a schedule row + a setup step (#96).
    assert "1/2 C inside the outermost sign, per Case 18" in md
    assert "upstream of the work zone (within the buffer space)" in md
    assert "downstream of the work zone" in md
    assert "R2-10 BEGIN DOUBLE FINES ZONE at station" in md
    # No template token may survive substitution (UX-10 invariant).
    assert "XXX" not in md
    assert "XX MILES" not in md


def test_narrative_signalized_approach_carries_flag_and_cite() -> None:
    placements, params, approaches, _ = _internal(_TWO_LEG_BODY)
    md = render_crew_narrative_markdown(placements, params, approaches=approaches)
    assert "signalized" in md
    assert "signal operation must be reviewed before work begins" in md
    assert "§6N.12" in md and "Part 4" in md


def test_narrative_far_side_describes_companion_closure() -> None:
    placements, params, approaches, _ = _internal(_FAR_BODY)
    md = render_crew_narrative_markdown(placements, params, approaches=approaches)
    assert "already be closed where it crosses the intersection (MUTCD §6N.12.12)" in md
    assert "no devices inside the intersection" in md


def test_narrative_requires_matching_approaches() -> None:
    placements, params, approaches, _ = _internal(_body())
    with pytest.raises(ValueError, match="requires .*approaches"):
        build_narrative_context(placements, params)
    shoulder_params = params.__class__(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        is_divided=True,
    )
    with pytest.raises(ValueError, match="only meaningful"):
        build_narrative_context(placements, shoulder_params, approaches=approaches)


# ---------------------------------------------------------------------------
# Audit trail
# ---------------------------------------------------------------------------


def test_audit_taper_is_full_merging_l_with_case18_reference() -> None:
    placements, params, approaches, _ = _internal(_body())
    audit = build_audit_trail(placements, params, approaches=approaches)
    taper = audit["taper"]
    assert taper["L_required_label"] == "L (full merging taper)"
    assert taper["L_required_ft"] == 540
    assert "Case 18" in taper["cdot_reference"] and "Sheet 10" in taper["cdot_reference"]
    # The pre-fix failure mode: the flagger presentation (100-ft
    # one-lane two-way taper) claiming this kind.
    assert "one-lane two-way" not in taper["formula_choice"]


def test_audit_approaches_section_shows_per_leg_key_math() -> None:
    placements, params, approaches, _ = _internal(_TWO_LEG_BODY)
    audit = build_audit_trail(placements, params, approaches=approaches)
    section = audit["approaches"]
    assert section["side"] == "near"
    rows = {r["id"]: r for r in section["approaches"]}
    assert rows["cross_n"]["a_dist_ft"] == 100.0
    assert rows["cross_s"]["a_dist_ft"] == 500.0
    assert rows["cross_n"]["signalized"] is True
    assert rows["cross_s"]["signalized"] is False
    n_table = {r["Code"]: r for r in rows["cross_s"]["sign_table"]}
    assert n_table["W20-1"]["Station (ft from curb line)"] == "1,000"  # 2 x A
    assert n_table["R2-10"]["Station (ft from curb line)"] == "500"  # A
    assert n_table["R2-11"]["Placement rule"] == "100 ft, departure side (Case 18)"
    assert "Sheet 10" in section["source"]


def test_audit_case_section_carries_the_three_part_disclosure() -> None:
    placements, params, approaches, _ = _internal(_body())
    audit = build_audit_trail(placements, params, approaches=approaches)
    case = audit["case"]
    assert case["case"].startswith("Case 18:")
    assert "§6C.04(A)" in case["narrative"]
    disclosure = case["narrative_2"]
    assert "corner-quadrant" in disclosure
    assert "issues/128" in disclosure
    assert "opposing mainline direction is not signed" in disclosure.lower()
    assert "Sheet 10 Note 1" in disclosure
    assert "Type III corner barricade" in disclosure
    assert "more than 3 days" in disclosure
    # The generic narrative_2 would falsely claim "the same device
    # layout as the reference case".
    assert "same device layout" not in disclosure


def test_audit_sign_table_labels_the_half_c_r2_10() -> None:
    placements, params, approaches, _ = _internal(_body())
    audit = build_audit_trail(placements, params, approaches=approaches)
    rows = {r["Code"]: r for r in audit["advance"]["sign_table"]}
    assert rows["R2-10"]["Position"] == "1/2 C inside the outermost sign (Case 18)"
    # Approach-frame signs must never leak into the mainline sign table.
    stations = [r["Station (ft)"] for r in audit["advance"]["sign_table"]]
    assert "200" not in stations  # cross_n W20-1 approach-frame station


def test_audit_requires_matching_approaches() -> None:
    placements, params, approaches, _ = _internal(_body())
    with pytest.raises(ValueError, match="requires .*approaches"):
        build_audit_trail(placements, params)


# ---------------------------------------------------------------------------
# Audit projection (summary TA, signals pending item, plan flags)
# ---------------------------------------------------------------------------


def _projection(body: dict[str, Any]) -> dict[str, Any]:
    placements, params, approaches, scenario = _internal(body)
    audit = build_audit_trail(placements, params, approaches=approaches)
    return audit_projection(audit, "near_intersection", step_count=_compute_step_count(scenario))


def test_projection_ta_is_side_aware() -> None:
    assert _projection(_body())["summary"]["ta"] == "TA-21"
    assert _projection(_FAR_BODY)["summary"]["ta"] == "TA-22"


def test_projection_signalized_emits_pending_item_and_flips_clean() -> None:
    proj = _projection(_TWO_LEG_BODY)
    items = proj["pending_verification"]["items"]
    signal_items = [i for i in items if i["kind"] == "signal_operation_review_required"]
    assert len(signal_items) == 1
    label = signal_items[0]["label"]
    assert "cross_n" in label and "cross_s" not in label
    assert "§6N.12" in label and "Part 4" in label
    assert signal_items[0]["tracking_issue"] == INTERSECTION_SUPPORT_ISSUE
    assert proj["plan_flags"]["v1_limitations"] >= 1
    assert proj["plan_flags"]["is_clean"] is False


def test_projection_unsignalized_has_no_signal_item() -> None:
    proj = _projection(_body())
    items = proj["pending_verification"].get("items", [])
    assert not [i for i in items if i["kind"] == "signal_operation_review_required"]
    assert proj["pending_verification"]["count"] == 0


def test_step_count_is_sixteen() -> None:
    scenario = _ADAPTER.validate_python(_body())
    assert _compute_step_count(scenario) == 16


# ---------------------------------------------------------------------------
# Audit PDF + plan sheet
# ---------------------------------------------------------------------------


def test_audit_pdf_blocks_carry_the_approaches_section(tmp_path) -> None:
    proj = _projection(_TWO_LEG_BODY)
    blocks = audit_to_blocks(proj)
    headings = [b.text for b in blocks if isinstance(b, Heading)]
    assert any("Cross-Street Approaches" in h for h in headings)
    flat = " ".join(str(b) for b in blocks)
    assert "SIGNALIZED" in flat
    assert "A = 500 ft" in flat
    path = str(tmp_path / "ni_audit.pdf")
    render_audit_pdf(proj, path)
    raw = (tmp_path / "ni_audit.pdf").read_bytes()
    assert raw.startswith(b"%PDF-") and b"%%EOF" in raw


def _sheet_text(body: dict[str, Any], tmp_path) -> str:
    import pypdfium2 as pdfium

    placements, params, approaches, _ = _internal(body)
    path = str(tmp_path / "ni_sheet.pdf")
    render_plan_sheet(placements, params, output_path=path, approaches=approaches)
    pdf = pdfium.PdfDocument(path)
    try:
        return "\n".join(page.get_textpage().get_text_range() for page in pdf)
    finally:
        pdf.close()


def test_plan_sheet_carries_citation_note_and_side_aware_ta(tmp_path) -> None:
    text = _sheet_text(_body(), tmp_path)
    # Phrase assertions run whitespace-normalized: the 4-box footer
    # (issue #150) narrows the NOTES box, so any phrase can span a line
    # break — the copy itself is intact, only wrap positions moved.
    flat = " ".join(text.split())
    assert "CROSS-STREET CONTROL PER CDOT S-630-1 SHEET 10, CASES" in flat
    assert "corner work tracked at issue #128" in flat
    assert "Opposing mainline direction not signed" in flat
    assert "Sheet 10 Note 1" in flat
    assert "TA-21" in text
    assert "TA-10" not in text  # the flagger TA the branch order used to hit
    # The unconditional mainline R2-10 must surface in the off-page
    # advance table (placement-driven path, not the static 3-row list).
    assert "BEGIN DOUBLE FINES ZONE" in text


def test_plan_sheet_far_side_prints_ta_22(tmp_path) -> None:
    assert "TA-22" in _sheet_text(_FAR_BODY, tmp_path)


def test_plan_sheet_requires_approaches(tmp_path) -> None:
    placements, params, _, _ = _internal(_body())
    with pytest.raises(ValueError, match="requires .*approaches"):
        render_plan_sheet(placements, params, output_path=str(tmp_path / "x.pdf"))
