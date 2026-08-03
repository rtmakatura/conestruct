"""Arc 6 evidence capture — schedule pair (#188 / #199 / #206).

Posts four scenarios to the local /render/device-breakdown seam and
writes each response (status + body, hours_eval extracted when present)
to <outdir>/<name>.json.  Run BEFORE the fix with outdir=pre-fix and
AFTER with outdir=post-fix; the diff between the two directories is the
evidence.

Usage:  .venv/Scripts/python.exe capture_hours_eval.py <outdir>
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402

client = TestClient(app, headers={"Authorization": "Bearer test-secret-do-not-deploy"})


def shoulder(jurisdiction_key=None, street_class=None, schedule=None):
    body = {
        "kind": "shoulder",
        "meta": {"project": "Arc 6 capture"},
        "roadType": "freeway",
        "speed": 55,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }
    if jurisdiction_key:
        body["jurisdiction_key"] = jurisdiction_key
    if street_class:
        body["street_class"] = street_class
    if schedule:
        body["schedule"] = schedule
    return body


CASES = {
    # A — #188 at the wire: overnight 20:00-05:00.
    "A-overnight-20-05": shoulder(
        "denver",
        "arterial",
        {"date_mode": "single", "work_date": "2026-08-05", "start_time": 20.0, "end_time": 5.0},
    ),
    # B — #206: Denver compliant weekday DAY shift 9:00-15:00 (inside the
    # 8:30-15:30 daytime window; the split night windows must not count
    # against it).  2026-08-05 is a Wednesday.
    "B-denver-day-9-15": shoulder(
        "denver",
        "arterial",
        {"date_mode": "single", "work_date": "2026-08-05", "start_time": 9.0, "end_time": 15.0},
    ),
    # C — #199 backend half: date_mode "tbd" with residual times.
    "C-tbd-residual-times": shoulder(
        "thornton",
        "arterial",
        {"date_mode": "tbd", "start_time": 4.0, "end_time": 6.0},
    ),
    # D — control: no schedule at all (the honest unknown arm).
    "D-no-schedule": shoulder("denver", "arterial"),
    # E — genuine violation must still be caught: Denver 10:00-16:00
    # (16:00 > 15:30 daytime close; night windows are alternatives, not
    # rescue) — pre-fix this is polluted by the composition bug, post-fix
    # it must remain "outside" with only the real 0.5h excess.
    "E-denver-day-10-16": shoulder(
        "denver",
        "arterial",
        {"date_mode": "single", "work_date": "2026-08-05", "start_time": 10.0, "end_time": 16.0},
    ),
}


def main() -> None:
    outdir = Path(__file__).parent / sys.argv[1]
    outdir.mkdir(parents=True, exist_ok=True)
    sha = subprocess.run(
        ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()
    for name, body in CASES.items():
        res = client.post("/render/device-breakdown", json=body)
        try:
            payload = res.json()
        except ValueError:
            payload = {"raw_text": res.text}
        record = {
            "captured_at_sha": sha,
            "request_schedule": body.get("schedule"),
            "jurisdiction_key": body.get("jurisdiction_key"),
            "street_class": body.get("street_class"),
            "status_code": res.status_code,
        }
        if res.status_code == 200:
            record["hours_eval"] = payload.get("jurisdiction", {}).get("hours_eval")
        else:
            record["error_body"] = payload
        path = outdir / f"{name}.json"
        path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        summary = (
            record.get("hours_eval", {}).get("status")
            if res.status_code == 200 and record.get("hours_eval")
            else f"HTTP {res.status_code}"
        )
        print(f"{name}: {summary}")


if __name__ == "__main__":
    main()
