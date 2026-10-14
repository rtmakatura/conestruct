"""#266: the audit PDF's Colorado heading names the plan's own standard sheet.

It used to print "CDOT S-630-1" for every kind, while the screen and the plan
sheet read S-630-3 on the divided lane-closure kinds.  It now reads the audit
summary's ``cdot_sheet``, the one producer they all share.
"""

from __future__ import annotations

from src.api.audit import audit_projection, build_audit_trail
from src.generation.layout import (
    generate_lane_closure_divided,
    generate_shoulder_closure_divided,
)
from src.rendering.audit_blocks import Heading, audit_to_blocks
from src.rules.validators import ScenarioParams


def _params(closure_type: str) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type=closure_type,
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
    )


def _colorado_heading(projection: dict) -> str:
    texts = [b.text for b in audit_to_blocks(projection) if isinstance(b, Heading)]
    return next(t for t in texts if t.startswith("Colorado Requirements"))


def test_shoulder_plan_names_s630_1() -> None:
    p = _params("shoulder")
    proj = audit_projection(
        build_audit_trail(generate_shoulder_closure_divided(p), p),
        "shoulder",
        step_count=11,
        road_type="rural",
    )
    assert proj["summary"]["cdot_sheet"] == "S-630-1"
    assert _colorado_heading(proj) == "Colorado Requirements (CDOT S-630-1)"


def test_divided_lane_closure_names_s630_3() -> None:
    p = _params("lane")
    trail = build_audit_trail(generate_lane_closure_divided(p), p)
    proj = audit_projection(trail, "lane_closure_divided", step_count=14)
    assert proj["summary"]["cdot_sheet"] == "S-630-3"
    assert _colorado_heading(proj) == "Colorado Requirements (CDOT S-630-3)"


def test_no_sheet_names_no_sheet() -> None:
    p = _params("shoulder")
    proj = audit_projection(
        build_audit_trail(generate_shoulder_closure_divided(p), p),
        "shoulder",
        step_count=11,
        road_type="rural",
    )
    proj["summary"] = {k: v for k, v in proj["summary"].items() if k != "cdot_sheet"}
    assert _colorado_heading(proj) == "Colorado Requirements"
