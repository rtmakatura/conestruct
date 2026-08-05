"""Arc 12 / #83 byte-compare harness.

Dumps the full /render/audit JSON for a scenario matrix that exercises
every Colorado-section branch in build_audit_trail:

  * shoulder divided, no reduction        (both_sides / plaques / no-reduction
                                           speed branch / no-flagger lighting)
  * shoulder divided 65 -> 60             (Case 26 step-down + Fines Double A)
  * shoulder undivided 55 -> 45           (Case 11 undivided prose + Fines
                                           Double A, non-step-down)
  * flagger day, no reduction             (flagger lighting daytime branch)
  * flagger night 45 -> 35                (flagger lighting fail branch +
                                           Fines Double B)
  * near_intersection                     (NI case_narrative CO prose)

Run before and after the #83 single-source migration; the two dumps must
be byte-identical (zero audit churn is the migration's proof).

Usage:  python validation-artifacts/committed/arc12-citation-tail/dump_audit_matrix.py <out.json>
"""

from __future__ import annotations

import json
import os
import sys

os.environ.setdefault("RENDER_API_SECRET", "arc12-byte-compare")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402

HEADERS = {"Authorization": f"Bearer {os.environ['RENDER_API_SECRET']}"}


def _shoulder(**overrides):
    base = {
        "kind": "shoulder",
        "meta": {"project": "arc12", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": "rural_divided",
        "speed": 55,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 800.0,
        "night": False,
    }
    return {**base, **overrides}


def _flagger(**overrides):
    base = {
        "kind": "flagger_lane_closure",
        "meta": {"project": "arc12", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 11.0,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
    }
    return {**base, **overrides}


def _near_intersection(**overrides):
    base = {
        "kind": "near_intersection",
        "meta": {
            "project": "arc12",
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
        # ≥ the 540-ft merging taper at 45 mph (the production geometry
        # gate rejects shorter zones with an honest 400).
        "workLen": 800.0,
        "night": False,
        "approaches": [
            {
                "id": "cross_n",
                "speed": 30,
                "roadType": "urban_arterial",
                "lanesPerDirection": 1,
                "laneWidth": 12.0,
                "signalized": False,
                "bearingDeg": None,
                "alongStationFt": -60.0,
            }
        ],
    }
    return {**base, **overrides}


MATRIX = {
    "shoulder_divided_no_reduction": _shoulder(),
    "shoulder_divided_case26_stepdown": _shoulder(speed=65, workZoneSpeed=60),
    "shoulder_undivided_reduced": _shoulder(
        roadType="rural_undivided", divided=False, workZoneSpeed=45
    ),
    "flagger_day": _flagger(),
    "flagger_night_reduced": _flagger(night=True, workZoneSpeed=35),
    "near_intersection": _near_intersection(),
}


def main(out_path: str) -> None:
    client = TestClient(app)
    dump = {}
    for name, payload in MATRIX.items():
        res = client.post("/render/audit", json=payload, headers=HEADERS)
        if res.status_code != 200:
            raise SystemExit(f"{name}: HTTP {res.status_code}: {res.text[:300]}")
        dump[name] = res.json()
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(dump, f, indent=2, sort_keys=True, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {out_path}: {len(dump)} scenarios")


if __name__ == "__main__":
    main(sys.argv[1])
