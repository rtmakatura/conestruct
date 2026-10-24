"""#382 R1 step 2: render each plan kind at a short work zone, locally.

Runs the R1 cases (five bodies) through the real render API (TestClient) on the
worktree's code: audit, plan PDF, crew PDF, device breakdown and XLSX.
Saves every response under render-check/<case>/ and prints one summary
line per case.  Bodies are audit-lane requests and the test suite's
shoulder bodies with only ``workLen`` changed to the short length.

    cd validation-artifacts/committed/issue-382-short-work-zone
    uv run --extra dev python render_check.py
"""

from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("RENDER_API_SECRET", "test-secret")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from tests.test_plan_sheet_device_summary import SHOULDER_BODY  # noqa: E402
from tests.test_single_lane_block import UNDIVIDED_SHOULDER_BODY  # noqa: E402

RUNS = ROOT / "validation-artifacts" / "committed"
CASES = {
    # case: (source request, short work zone ft)
    "flagger-50": (RUNS / "audit-lane/runs/F17/request.json", 50),
    "near-int-45-50": (RUNS / "audit-lane/runs/N12/request.json", 50),
    "near-int-55-50": (RUNS / "audit-lane/runs/N14/request.json", 50),
    # The audit-shoulder requests predate the current pin schema, so the
    # shoulder cases use the test suite's bodies.
    "shoulder-divided-55-50": (SHOULDER_BODY, 50),
    "shoulder-undivided-50": (UNDIVIDED_SHOULDER_BODY, 50),
}
ROUTES = {
    "audit": ("/render/audit", "json"),
    "pdf": ("/render/pdf", "pdf"),
    "crew": ("/render/crew-pdf", "pdf"),
    "devices": ("/render/device-breakdown", "json"),
    "xlsx": ("/render/xlsx", "xlsx"),
}
AUTH = {"Authorization": "Bearer test-secret"}


def main() -> None:
    client = TestClient(app)
    out_root = HERE / "render-check"
    for case, (src, work_ft) in CASES.items():
        if isinstance(src, Path):
            body = copy.deepcopy(json.loads(src.read_text(encoding="utf-8"))["scenario"])
        else:
            body = copy.deepcopy(src)
        body["workLen"] = work_ft
        out = out_root / case
        out.mkdir(parents=True, exist_ok=True)
        (out / "request.json").write_text(json.dumps(body, indent=1), encoding="utf-8")
        statuses = {}
        for name, (path, ext) in ROUTES.items():
            resp = client.post(path, json=body, headers=AUTH)
            statuses[name] = resp.status_code
            if resp.status_code == 200 and ext != "json":
                (out / f"{name}.{ext}").write_bytes(resp.content)
            else:
                (out / f"{name}.json").write_text(
                    json.dumps(resp.json(), indent=1), encoding="utf-8"
                )
        print(case, work_ft, "ft", statuses)


if __name__ == "__main__":
    main()
