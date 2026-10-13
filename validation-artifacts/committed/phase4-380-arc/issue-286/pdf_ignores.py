import copy
import os
import sys

os.chdir(r"C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-286-formula-fields")
sys.path.insert(0, os.getcwd())
sys.stdout.reconfigure(encoding="utf-8")

from src.api.audit import audit_projection, build_audit_trail  # noqa: E402
from src.generation.layout import (  # noqa: E402
    generate_flagger_alternating_2lane,
    generate_shoulder_closure_divided,
)
from src.rendering.audit_blocks import audit_to_blocks  # noqa: E402
from src.rules.validators import ScenarioParams  # noqa: E402

NEW = {"result_text", "formula_text", "sight_distance_result_text", "sight_distance_formula_text"}


def strip(p):
    q = copy.deepcopy(p)
    for name, sec in q["sections"].items():
        if isinstance(sec, dict):
            for k in NEW:
                sec.pop(k, None)
    q["sections"]["advance"].pop("citation", None)
    return q


cases = []
sp = ScenarioParams(speed_mph=65, num_lanes=2, closure_type="shoulder", road_type="freeway",
                    work_zone_length_ft=1000.0, lane_width_ft=12.0, shoulder_width_ft=10.0,
                    is_divided=True, jurisdiction="CDOT")
cases.append(("shoulder", audit_projection(build_audit_trail(generate_shoulder_closure_divided(sp), sp),
                                           "shoulder", step_count=11, road_type="freeway")))
fp = ScenarioParams(speed_mph=45, num_lanes=2, closure_type="lane", road_type="rural",
                    work_zone_length_ft=500.0, lane_width_ft=11.0, shoulder_width_ft=8.0,
                    is_divided=False, jurisdiction="CDOT", work_zone_speed_mph=30)
cases.append(("flagger", audit_projection(build_audit_trail(generate_flagger_alternating_2lane(fp), fp),
                                          scenario_kind="flagger_lane_closure", step_count=16)))
ok = True
for name, proj in cases:
    with_new = repr(audit_to_blocks(proj))
    without = repr(audit_to_blocks(strip(proj)))
    same = with_new == without
    ok &= same
    print(f"{name}: PDF blocks identical with and without the #286 keys: {same} ({len(with_new)} chars)")
sys.exit(0 if ok else 1)
