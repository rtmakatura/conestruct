"""#342: regenerate the snapshots the buffer cones move, through the canonical
writer (tests._snapshot_helper.write_snapshot), from the same builders the
tests use.  Every grid case is rewritten, so `git diff --stat` shows which
moved; shoulder and far-side files must come out byte-identical.  Run from the
worktree root, then review the diff:

    python -B validation-artifacts/committed/issue-342-buffer-devices/regen342.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

from fastapi.testclient import TestClient  # noqa: E402

import tests.corpus.test_near_intersection as tni  # noqa: E402
from src.api import render_api  # noqa: E402
from src.api.audit import audit_projection, build_audit_trail  # noqa: E402
from src.generation.layout import generate_flagger_alternating_2lane  # noqa: E402
from src.rules.validators import ScenarioParams  # noqa: E402
from tests._snapshot_helper import write_snapshot  # noqa: E402
from tests.corpus.manifest import GRID_CASES, scenario_body, snapshot_path  # noqa: E402

c = TestClient(render_api.app)
H = {"Authorization": "Bearer test-secret-do-not-deploy"}

n = 0
for case in GRID_CASES:
    path = snapshot_path(case.id)
    if path.exists() and path.read_text(encoding="utf-8") == "":
        continue
    r = c.post("/render/audit", headers=H, json=scenario_body(case))
    r.raise_for_status()
    write_snapshot(path, r.json())
    n += 1
print("audit grid snapshots written:", n)

for case_id, body in tni.GRID_BODIES.items():
    write_snapshot(snapshot_path(case_id), tni._placements_payload(body))
print("near-intersection grid snapshots written:", len(tni.GRID_BODIES))

# test_audit_endpoint.test_audit_flagger_reduction_fines_double_required_matches_baseline
params = ScenarioParams(
    speed_mph=45,
    num_lanes=2,
    closure_type="lane",
    road_type="rural",
    work_zone_length_ft=500.0,
    lane_width_ft=11.0,
    shoulder_width_ft=8.0,
    is_divided=False,
    jurisdiction="CDOT",
    work_zone_speed_mph=30,
)
audit = build_audit_trail(generate_flagger_alternating_2lane(params), params)
write_snapshot(
    Path("tests/snapshots/audit_flagger_reduction_fines_double_required.json"),
    audit_projection(audit, scenario_kind="flagger_lane_closure", step_count=16),
)
print("wrote audit_flagger_reduction_fines_double_required.json")
