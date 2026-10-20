"""#360: re-record the snapshots the Rule 5 prediction names (rulings.md).

Usage: PYTHONPATH=. uv run python <this file>
Same app, auth and bodies as tests/corpus/test_grid.py and
tests/test_audit_endpoint.py; outbound HTTP is blocked like the corpus guard.
"""

import os
from pathlib import Path

import httpx

os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


def _blocked(*_a, **_k):
    raise RuntimeError("re-record must not touch the network")


for _name in ("get", "post", "put", "patch", "delete", "head", "request", "stream"):
    setattr(httpx, _name, _blocked)

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from tests._snapshot_helper import write_snapshot  # noqa: E402
from tests.corpus.manifest import GRID_CASES, scenario_body, snapshot_path  # noqa: E402
from tests.test_audit_endpoint import _shoulder_scenario  # noqa: E402

client = TestClient(app)
headers = {"Authorization": "Bearer test-secret-do-not-deploy"}
targets: list[tuple[Path, dict]] = []
for case in GRID_CASES:
    if case.id.startswith("grid_reduced_"):
        targets.append((snapshot_path(case.id), scenario_body(case)))
for name, wz in (("audit_shoulder_reduction_10", 45), ("audit_shoulder_reduction_25", 30)):
    targets.append((Path(f"tests/snapshots/{name}.json"), {**_shoulder_scenario(), "workZoneSpeed": wz}))
for path, body in targets:
    res = client.post("/render/audit", headers=headers, json=body)
    assert res.status_code == 200, res.text[:300]
    write_snapshot(path, res.json())
    print("re-recorded", path)
