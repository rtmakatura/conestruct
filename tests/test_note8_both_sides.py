"""#243 -- CDOT S-630-1 Sheet 2 General Note 8 counts the signs it governs.

Note 8: "All warning and regulatory signs shall be posted on both sides of
the roadway on divided highways, ..."  The site adjustments add the
sidewalk (R9-9) and bike-lane (M4-9a) signs on the facility side only.
Ruling R53: the audit row leaves them out of the per-side count and says
so in the detail; a plan genuinely missing a governed sign still fails.

Plans are built in-process (the generator, then ``apply_site_adjustments``
with the scan's flags) so no test reaches Overpass.
"""

from __future__ import annotations

from dataclasses import replace

from src.api.audit import build_audit_trail
from src.generation.layout import generate_lane_closure_divided
from src.rules.devices import DeviceType
from src.rules.site_adjustments import apply_site_adjustments
from src.rules.tables import note8_counts_sign
from src.rules.validators import ScenarioParams, validate_co_signs_both_sides

LABEL = "Signs on both sides of divided highway"


def _lane_divided() -> ScenarioParams:
    """TA-19 / Case 10: a divided lane closure, where Note 8 applies."""
    return ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="lane",
        road_type="expressway",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )


def _note8(placements, params) -> dict:
    audit = build_audit_trail(placements, params)
    (row,) = [c for c in audit["colorado"]["checks"] if c["label"] == LABEL]
    return row


def _plan(params, **flags):
    placements, _records = apply_site_adjustments(
        generate_lane_closure_divided(params), params, flags
    )
    return placements


def _signs(placements, side):
    return [
        p
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC
        and (p.offset_ft < 0 if side == "left" else p.offset_ft > 0)
    ]


def test_the_counted_families() -> None:
    for label in ("R9-9", "R9-10", "R9-11", "R9-11a", "M4-9a"):
        assert not note8_counts_sign(label), label
    for label in ("W20-1", "W20-2", "W21-5aR", "G20-1", "G20-2", "G20-5P", "R2-1", "S1-1"):
        assert note8_counts_sign(label), label


def test_generator_plan_unchanged_wording() -> None:
    params = _lane_divided()
    plan = _plan(params)
    n = len(_signs(plan, "left"))
    assert n == len(_signs(plan, "right")) > 0
    row = _note8(plan, params)
    assert row["pass"] is True
    assert row["detail"] == f"Required: True. Signs placed: {n} left, {n} right."


def test_sidewalk_signs_are_named_not_counted() -> None:
    params = _lane_divided()
    plan = _plan(params, pedestrian_facility=True)
    n = len(_signs(_plan(params), "left"))
    row = _note8(plan, params)
    assert row["pass"] is True
    assert row["detail"] == (
        f"Required: True. Signs counted: {n} left, {n} right. "
        "Not counted: 2 R9-9 (sidewalk signs, posted at the sidewalk)."
    )


def test_sidewalk_and_bike_signs_are_named_not_counted() -> None:
    params = _lane_divided()
    plan = _plan(params, pedestrian_facility=True, bicycle_facility=True)
    n = len(_signs(_plan(params), "left"))
    row = _note8(plan, params)
    assert row["pass"] is True
    assert row["detail"] == (
        f"Required: True. Signs counted: {n} left, {n} right. "
        "Not counted: 2 R9-9, 2 M4-9a (sidewalk and bike-lane signs, posted at the facility)."
    )


def test_bike_signs_alone() -> None:
    params = _lane_divided()
    row = _note8(_plan(params, bicycle_facility=True), params)
    assert row["pass"] is True
    assert row["detail"].endswith("Not counted: 2 M4-9a (bike-lane signs, posted at the facility).")


def test_missing_left_advance_sign_still_fails() -> None:
    """The negative case: remove the left W20-1; the facility signs don't mask it."""
    params = _lane_divided()
    for flags in ({}, {"pedestrian_facility": True, "bicycle_facility": True}):
        plan = _plan(params, **flags)
        w20 = next(p for p in _signs(plan, "left") if p.label == "W20-1")
        broken = [p for p in plan if p is not w20]
        row = _note8(broken, params)
        assert row["pass"] is False, flags
        n = len(_signs(_plan(params), "right"))
        assert f"{n - 1} left, {n} right." in row["detail"], row["detail"]


def test_undivided_row_counts_every_sign_as_before() -> None:
    """Not required: the count and wording are today's, facility signs included."""
    params = replace(_lane_divided(), is_divided=False)
    plan = _plan(params, pedestrian_facility=True)
    left, right = len(_signs(plan, "left")), len(_signs(plan, "right"))
    row = _note8(plan, params)
    assert row["pass"] is True
    assert row["detail"] == f"Required: False. Signs placed: {left} left, {right} right."


def test_validator_agrees_with_the_row() -> None:
    params = _lane_divided()
    plan = _plan(params, pedestrian_facility=True, bicycle_facility=True)
    assert validate_co_signs_both_sides(plan, params) == []
    w20 = next(p for p in _signs(plan, "left") if p.label == "W20-1")
    broken = [p for p in plan if p is not w20]
    (v,) = validate_co_signs_both_sides(broken, params)
    assert "W20-1" in v.message


# --------------------------------------------------------------------------- #
# The exception (ruling R54): "except where only one shoulder is closed (ex:
# Case 11 on Sheet 7)".  A shoulder closure on a divided road is that case.
# --------------------------------------------------------------------------- #


def _shoulder_divided() -> ScenarioParams:
    """The N Broadway SB shape: shoulder, 30 mph urban, 4 lanes, divided."""
    return ScenarioParams(
        speed_mph=30,
        num_lanes=4,
        closure_type="shoulder",
        road_type="urban_low",
        work_zone_length_ft=1000.0,
        lane_width_ft=10.5,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )


def _shoulder_plan(params, **flags):
    from src.generation.layout import generate_shoulder_closure_divided

    placements, _records = apply_site_adjustments(
        generate_shoulder_closure_divided(params), params, flags
    )
    return placements


def test_shoulder_closure_is_the_exception() -> None:
    """Broadway's plan: 6 left, 8 right with the sidewalk signs; not required."""
    params = _shoulder_divided()
    plan = _shoulder_plan(params, pedestrian_facility=True)
    left, right = len(_signs(plan, "left")), len(_signs(plan, "right"))
    assert (left, right) == (6, 8)
    row = _note8(plan, params)
    assert row["pass"] is True
    assert row["detail"] == (
        "Not required: one shoulder closed (Note 8's Case 11 exception). "
        "Signs placed: 6 left, 8 right."
    )


def test_shoulder_missing_left_sign_is_not_a_note8_fail() -> None:
    """The note's words: one closed shoulder needs no second side.

    The generator still mirrors (house choice, CHOSEN), and the layout
    validator still holds it to that; only the Note 8 row stands down.
    """
    params = _shoulder_divided()
    plan = _shoulder_plan(params)
    w20 = next(p for p in _signs(plan, "left") if p.label == "W20-1")
    broken = [p for p in plan if p is not w20]
    assert _note8(broken, params)["pass"] is True
    assert any(
        v.rule_id == "CO_SIGN_BOTH_SIDES" for v in validate_co_signs_both_sides(broken, params)
    )


# --------------------------------------------------------------------------- #
# R57: the plan sheet's median note gives the same reason as the audit row.
# Rendered output, read back (Rule 11).
# --------------------------------------------------------------------------- #


def _legend_text(params: ScenarioParams, plan, tmp_path) -> str:
    import pypdfium2 as pdfium

    from src.rendering.plan_sheet import render_plan_sheet

    path = tmp_path / f"{params.closure_type}.pdf"
    render_plan_sheet(plan, params, output_path=str(path))
    pdf = pdfium.PdfDocument(str(path))
    try:
        return pdf[0].get_textpage().get_text_range()
    finally:
        pdf.close()


def test_shoulder_plan_median_note_cites_note_28(tmp_path) -> None:
    params = _shoulder_divided()
    text = _legend_text(params, _shoulder_plan(params), tmp_path)
    assert "Left-side advance signs sit in the median" in text
    assert "by choice, beyond the minimum (S-630-1 Sheet 2 Note 28)." in text
    assert "per S-630-1 Sheet 2 General Note 8." not in text


def test_divided_lane_closure_median_note_keeps_note_8(tmp_path) -> None:
    params = _lane_divided()
    text = _legend_text(params, _plan(params), tmp_path)
    assert "Left-side advance signs sit in the median" in text
    assert "per S-630-1 Sheet 2 General Note 8." in text
    assert "Note 28" not in text
