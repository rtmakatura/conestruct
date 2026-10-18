"""#339 — a freeway plan counts no sidewalk from the site scan.

The I-25 shoulder plan closed a sidewalk with R9-9 signs because the scan
counted 43 crossing-street, overpass and frontage paths as sidewalks along
the work.  R145 self-ruled (rulings.md S1): on ``road_type == "freeway"``
the sidewalk bucket counts nothing, keeps what it found as not counted,
and says so; the operator can still assert one.  The urban arterial over
the same recorded scan is the control (unchanged).

Payload-level (Rule 11): the real API over the recorded Lakewood payload,
which carries sidewalks; Overpass is never reached.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi.testclient import TestClient

from src.api import site_scan as ss
from tests import test_site_scan_ingenerate as base
from tests.test_site_scan_ingenerate import Overpass, scenario

# The in-generate suite's fixtures, shared by name (Overpass never reached).
_render_secret = base._render_secret
_fresh_memo = base._fresh_memo
client = base.client
auth = base.auth
payload = base.payload
overpass = base.overpass


def freeway(**over: Any) -> dict[str, Any]:
    return scenario(roadType="freeway", speed=65, lanes=3, **over)


def _r9_9_count(breakdown: dict[str, Any]) -> int:
    return sum(1 for d in breakdown["devices"] if "R9-9" in json.dumps(d))


def test_freeway_plan_counts_no_sidewalk_and_says_why(
    client: TestClient, auth: dict[str, str], overpass: Overpass
) -> None:
    audit = client.post("/render/audit", headers=auth, json=freeway(site_scan={}))
    assert audit.status_code == 200, audit.text
    prov = audit.json()["sections"]["site_scan"]
    assert prov["status"] == "ok"
    assert prov["inputs"]["road_type"] == "freeway"
    assert "pedestrian_facility" not in prov["flags"]
    side = prov["buckets"]["sidewalks"]
    assert side["detected"] is False and side["count"] == 0
    assert side["nearest_distance_m"] is None and side["nearest_distance_ft"] is None
    assert len(side["details"]) == 1
    assert side["details"][0].endswith(
        "near the freeway not counted: the scan can't tell a sidewalk along a "
        "freeway from one on a crossing or frontage street. "
        "If one runs along the work zone, correct the scan."
    )
    assert side["features"] and all(f["relevant"] is False for f in side["features"])
    # The other buckets are the scan's own answer, untouched.
    assert prov["buckets"]["intersections"]["detected"] is True

    ss.clear_memo()
    breakdown = client.post("/render/device-breakdown", headers=auth, json=freeway(site_scan={}))
    assert breakdown.status_code == 200, breakdown.text
    assert _r9_9_count(breakdown.json()) == 0


def test_the_memo_keeps_the_raw_scan(
    client: TestClient, auth: dict[str, str], overpass: Overpass
) -> None:
    client.post("/render/audit", headers=auth, json=freeway(site_scan={}))
    (entry,) = ss._MEMO.values()
    assert entry[1]["sidewalks"]["detected"] is True


def test_urban_arterial_control_still_counts_its_sidewalks(
    client: TestClient, auth: dict[str, str], overpass: Overpass
) -> None:
    audit = client.post("/render/audit", headers=auth, json=scenario(site_scan={}))
    prov = audit.json()["sections"]["site_scan"]
    assert prov["flags"].get("pedestrian_facility") is True
    assert prov["buckets"]["sidewalks"]["detected"] is True
    breakdown = client.post("/render/device-breakdown", headers=auth, json=scenario(site_scan={}))
    assert _r9_9_count(breakdown.json()) > 0


def test_operator_can_still_assert_a_sidewalk_on_a_freeway(
    client: TestClient, auth: dict[str, str], overpass: Overpass
) -> None:
    corr = {
        "flag": "pedestrian_facility",
        "action": "assert",
        "recorded_at": "2026-10-17T00:00:00Z",
    }
    audit = client.post(
        "/render/audit",
        headers=auth,
        json=freeway(site_scan={}, meta={"siteConditionOverrides": [corr]}),
    )
    assert audit.status_code == 200, audit.text
    prov = audit.json()["sections"]["site_scan"]
    assert prov["flags"].get("pedestrian_facility") is True
    (record,) = prov["corrections"]
    assert record["status"] == "applied" and record["scan_detected"] is False
