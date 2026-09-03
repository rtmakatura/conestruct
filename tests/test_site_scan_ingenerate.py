"""#224 phase 1 (s2-arc15) — the in-generate corridor site scan.

Generation runs ``detect_along_corridor`` itself when the scenario carries
``site_scan``; the result is a plan fact (the five detection-driven
flags) plus ``sections.site_scan`` provenance on the audit, ALWAYS
present (``not_run`` / ``not_requested`` is the honest default — a
missing key is what a pre-phase-1 backend emits in the deploy window and
must not double as "not run").  Overpass is never touched: every scan
here sees the recorded Lakewood payload (``tests/fixtures/site_scan/``)
or a stubbed outage.

Rulings (2026-09-02, all seven as recommended):
  1 precedence — the scan owns the five detection keys; manual-only keys
    pass through; discarded manual values are disclosed.
  2 one scan per Generate — per-container memo, TTL 120 s (CHOSEN).
  3 the scan uses the plan's own params; the parity fixture's "today"
    path sends the SAME inputs to /render/detect-site.
  4 budget 20 s wall (CHOSEN) → ``unavailable`` "scan budget exceeded".
  5 no bearing → ``not_run`` / ``no_bearing`` (no point-mode fallback).
  6 ``sections.site_scan`` always present.
  7 nothing prints this phase (the audit PDF / narrative / panel tests
    are untouched; this file asserts the DATA only).

Parity is claimed for corridor mode only (ruling 5).  The parity case is
the shoulder-divided kind because /render/detect-site cannot take a
shoulder width: divided ⇒ params.shoulder_width_ft == build_corridor's
10 ft default, so the two paths' corridor inputs are identical without
a new field on the manual endpoint (the button's two input drifts are on
the record in the arc README, ruling 3).
"""

from __future__ import annotations

import copy
import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from src.api import site_scan as ss
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
FIXTURE = Path(__file__).parent / "fixtures" / "site_scan" / "lakewood_overpass.json"

# The Lakewood control pin (the #224 reproduction pin; the picker suites'
# typed pair).  bearing 180 = the N–S road the pin sits on.
LAT, LNG, BEARING = 39.7113, -105.0815, 180.0


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _fresh_memo() -> Iterator[None]:
    ss.clear_memo()
    yield
    ss.clear_memo()


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


@pytest.fixture()
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {_TEST_SECRET}"}


@pytest.fixture(scope="module")
def payload() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


class Overpass:
    """A stub for ``_overpass_request_with_fallback`` that counts calls."""

    def __init__(self, payload: dict[str, Any] | None, error: str | None = None) -> None:
        self.payload = payload
        self.error = error
        self.calls = 0

    def __call__(self, *_args: Any, **_kwargs: Any) -> tuple[dict[str, Any] | None, str | None]:
        self.calls += 1
        if self.payload is None:
            return None, self.error or "stub outage"
        return copy.deepcopy(self.payload), None


@pytest.fixture()
def overpass(monkeypatch: pytest.MonkeyPatch, payload: dict[str, Any]) -> Overpass:
    stub = Overpass(payload)
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", stub)
    return stub


@pytest.fixture()
def overpass_down(monkeypatch: pytest.MonkeyPatch) -> Overpass:
    stub = Overpass(None, "https://overpass-api.de/api/interpreter: 504 Gateway Timeout")
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", stub)
    return stub


def scenario(**over: Any) -> dict[str, Any]:
    """The parity scenario: shoulder, divided (10 ft shoulder), 45 mph urban
    arterial (→ urban_high), 1000 ft work zone, at the Lakewood pin."""
    base: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "s2a15", "address": "", "lat": LAT, "lng": LNG, "bearingDeg": BEARING},
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }
    meta_over = over.pop("meta", None)
    base.update(over)
    if meta_over:
        base["meta"] = {**base["meta"], **meta_over}
    return base


# The button's rule (SiteConditionsField.tsx DETECTION_TO_FLAG + detect()):
# a detection-driven flag is set when its bucket reports a relevant
# feature and deleted when it doesn't; manual-only flags are preserved.
BUTTON_MAP = {
    "intersections": "adjacent_intersection",
    "interchanges": "adjacent_interchange",
    "sidewalks": "pedestrian_facility",
    "bike_facilities": "bicycle_facility",
    "schools": "school_zone",
}


def button_flags(detection: dict[str, Any], prior: dict[str, bool]) -> dict[str, bool]:
    nxt = dict(prior)
    for det, flag in BUTTON_MAP.items():
        bucket = detection.get(det)
        if isinstance(bucket, dict) and bucket.get("detected"):
            nxt[flag] = True
        else:
            nxt.pop(flag, None)
    return nxt


# ---------------------------------------------------------------------------
# Parity (acceptance bullet 1) — detect-then-generate ≡ auto-generate
# ---------------------------------------------------------------------------


def test_parity_detect_then_generate_equals_auto_scan(
    client: TestClient, auth: dict[str, str], overpass: Overpass
) -> None:
    # Path A — today's manual flow with the plan's own corridor inputs.
    manual = client.post(
        "/render/detect-site",
        headers=auth,
        json={
            "lat": LAT,
            "lng": LNG,
            "radius_m": 500,
            "bearing_deg": BEARING,
            "speed_mph": 45,
            "work_zone_ft": 1000.0,
            "closure_type": "shoulder",
            "road_type": "urban_arterial",
            "lane_width_ft": 12.0,
        },
    )
    assert manual.status_code == 200, manual.text
    assert manual.json()["mode"] == "corridor"
    flags = button_flags(manual.json(), {})
    assert flags == {
        "adjacent_intersection": True,
        "pedestrian_facility": True,
        "bicycle_facility": True,
    }
    a_audit = client.post(
        "/render/audit", headers=auth, json=scenario(meta={"siteConditions": flags})
    )
    a_break = client.post(
        "/render/device-breakdown", headers=auth, json=scenario(meta={"siteConditions": flags})
    )
    assert a_audit.status_code == 200 and a_break.status_code == 200

    # Path B — no manual step: generation scans.
    ss.clear_memo()
    b_audit = client.post("/render/audit", headers=auth, json=scenario(site_scan={}))
    b_break = client.post("/render/device-breakdown", headers=auth, json=scenario(site_scan={}))
    assert b_audit.status_code == 200, b_audit.text
    assert b_break.status_code == 200, b_break.text

    a_adj = a_audit.json()["sections"]["site_adjustments"]
    b_adj = b_audit.json()["sections"]["site_adjustments"]
    assert len(a_adj) == 3
    assert json.dumps(a_adj, sort_keys=True) == json.dumps(b_adj, sort_keys=True)
    assert a_break.json()["devices"] == b_break.json()["devices"]

    prov = b_audit.json()["sections"]["site_scan"]
    assert prov["status"] == "ok"
    assert prov["mode"] == "corridor"
    assert prov["flags"] == flags
    assert prov["manual_flags_discarded"] == {}
    assert prov["proceeded_anyway"] is False
    assert prov["disclosure"] is None
    assert prov["measured_at"] and prov["duration_ms"] is not None
    assert prov["inputs"]["closure_type"] == "shoulder"
    assert prov["inputs"]["road_type"] == "urban_high"
    assert prov["inputs"]["shoulder_width_ft"] == 10.0
    assert prov["buckets"]["intersections"]["detected"] is True
    assert prov["buckets"]["schools"]["detected"] is False
    assert "error" not in prov["buckets"]


def test_ok_with_zero_features_is_a_measurement_not_an_outage(
    client: TestClient, auth: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    stub = Overpass({"elements": []})
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", stub)
    res = client.post("/render/audit", headers=auth, json=scenario(site_scan={}))
    assert res.status_code == 200, res.text
    prov = res.json()["sections"]["site_scan"]
    assert prov["status"] == "ok"
    assert prov["flags"] == {}
    assert all(not b["detected"] for b in prov["buckets"].values())
    assert "site_adjustments" not in res.json()["sections"]


# ---------------------------------------------------------------------------
# not_run — three distinct honest reasons (Rule 10), never an Overpass call
# ---------------------------------------------------------------------------


def _assert_not_run(prov: dict[str, Any], reason: str) -> None:
    assert prov["status"] == "not_run"
    assert prov["reason"] == reason
    assert prov["error"] is None
    assert prov["mode"] is None
    assert prov["measured_at"] is None
    assert prov["buckets"] == {}
    assert prov["flags"] == {}
    assert prov["proceeded_anyway"] is False
    assert prov["disclosure"] is None


def test_not_requested_is_the_always_present_default(
    client: TestClient, auth: dict[str, str], overpass: Overpass
) -> None:
    res = client.post("/render/audit", headers=auth, json=scenario())
    assert res.status_code == 200
    _assert_not_run(res.json()["sections"]["site_scan"], "not_requested")
    assert overpass.calls == 0
    # Manual flags still apply exactly as before phase 1.
    res2 = client.post(
        "/render/audit", headers=auth, json=scenario(meta={"siteConditions": {"school_zone": True}})
    )
    assert [r["flag"] for r in res2.json()["sections"]["site_adjustments"]] == ["school_zone"]
    assert overpass.calls == 0


def test_no_coords_is_not_run(client: TestClient, auth: dict[str, str], overpass: Overpass) -> None:
    res = client.post(
        "/render/audit", headers=auth, json=scenario(site_scan={}, meta={"lat": 0, "lng": 0})
    )
    assert res.status_code == 200, res.text
    _assert_not_run(res.json()["sections"]["site_scan"], "no_coords")
    assert overpass.calls == 0


def test_no_bearing_is_not_run_no_point_mode_fallback(
    client: TestClient, auth: dict[str, str], overpass: Overpass
) -> None:
    body = scenario(site_scan={})
    del body["meta"]["bearingDeg"]
    res = client.post("/render/audit", headers=auth, json=body)
    assert res.status_code == 200, res.text
    _assert_not_run(res.json()["sections"]["site_scan"], "no_bearing")
    assert overpass.calls == 0


def test_every_kind_accepts_site_scan() -> None:
    from src.api import schemas

    for cls in (
        schemas.ShoulderScenario,
        schemas.FlaggerLaneClosureScenario,
        schemas.LaneClosureDividedScenario,
        schemas.WorkBeyondShoulderScenario,
        schemas.MobileOp2LaneScenario,
        schemas.MobileOpMultilaneScenario,
        schemas.NearIntersectionScenario,
    ):
        assert "site_scan" in cls.model_fields, cls.__name__
        assert cls.model_fields["site_scan"].default is None


# ---------------------------------------------------------------------------
# unavailable — honest 400 (relay-fact shape) or proceed-anyway
# ---------------------------------------------------------------------------


def test_unavailable_refuses_with_code_provenance_and_recovery(
    client: TestClient, auth: dict[str, str], overpass_down: Overpass
) -> None:
    res = client.post("/render/audit", headers=auth, json=scenario(site_scan={}))
    assert res.status_code == 400, res.text
    detail = res.json()["detail"]
    assert detail["error"] == "site_scan_unavailable"
    assert detail["message"] == ss.SITE_SCAN_UNAVAILABLE_MESSAGE
    assert "school zones, sidewalks, or signals" in detail["message"]
    prov = detail["site_scan"]
    assert prov["status"] == "unavailable"
    assert "504 Gateway Timeout" in prov["error"]
    assert prov["proceeded_anyway"] is False
    assert prov["flags"] == {}
    assert detail["recovery"] == {
        "retry": True,
        "proceed_field": "site_scan.proceed_if_unavailable",
    }
    # Every render surface refuses the same way (one chokepoint).
    for ep in ("/render/device-breakdown", "/render/markdown"):
        r = client.post(ep, headers=auth, json=scenario(site_scan={}))
        assert r.status_code == 400, (ep, r.text)
        assert r.json()["detail"]["error"] == "site_scan_unavailable"


def test_unavailable_is_never_memoised(
    client: TestClient, auth: dict[str, str], overpass_down: Overpass
) -> None:
    for _ in range(2):
        res = client.post("/render/audit", headers=auth, json=scenario(site_scan={}))
        assert res.status_code == 400
    assert overpass_down.calls == 2  # a retry within the TTL really retries


def test_proceed_anyway_builds_with_manual_flags_and_the_disclosure(
    client: TestClient, auth: dict[str, str], overpass_down: Overpass
) -> None:
    body = scenario(
        site_scan={"proceed_if_unavailable": True},
        meta={"siteConditions": {"school_zone": True, "driveways_present": True}},
    )
    res = client.post("/render/audit", headers=auth, json=body)
    assert res.status_code == 200, res.text
    prov = res.json()["sections"]["site_scan"]
    assert prov["status"] == "unavailable"
    assert prov["proceeded_anyway"] is True
    assert prov["disclosure"] == ss.NOT_CHECKED_DISCLOSURE
    assert prov["disclosure"] == "SITE CONDITIONS NOT CHECKED — service unavailable at generation."
    assert prov["flags"] == {}
    assert prov["manual_flags_discarded"] == {}
    # The plan builds from the manual flags only — nothing invented.
    fired = sorted(r["flag"] for r in res.json()["sections"]["site_adjustments"])
    assert fired == ["driveways_present", "school_zone"]


def test_budget_exceeded_is_unavailable_and_stops_trying_mirrors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clock = {"t": 1000.0}
    posts: list[float] = []

    def fake_post(url: str, **_kw: Any) -> httpx.Response:
        posts.append(_kw.get("timeout"))
        clock["t"] += 21.0  # the first mirror hangs past the whole budget
        raise httpx.ConnectTimeout("hung", request=httpx.Request("POST", url))

    monkeypatch.setattr(sd.time, "monotonic", lambda: clock["t"])
    monkeypatch.setattr(sd.httpx, "post", fake_post)
    payload, error = sd._overpass_request_with_fallback("[out:json];", budget_s=20.0)
    assert payload is None
    assert error == "scan budget exceeded (20 s)"
    assert len(posts) == 1  # the second and third mirrors were never tried
    assert posts[0] == 20.0  # per-mirror timeout = min(25, remaining)


def test_budget_constants_are_the_ruled_values() -> None:
    assert ss.SCAN_BUDGET_S == 20.0
    assert ss.MEMO_TTL_S == 120.0


# ---------------------------------------------------------------------------
# one scan per Generate — the per-container memo
# ---------------------------------------------------------------------------


def test_one_overpass_call_across_the_generate_fan_out(
    client: TestClient, auth: dict[str, str], overpass: Overpass
) -> None:
    body = scenario(site_scan={})
    first = client.post("/render/audit", headers=auth, json=body)
    assert first.status_code == 200
    assert client.post("/render/device-breakdown", headers=auth, json=body).status_code == 200
    assert client.post("/render/markdown", headers=auth, json=body).status_code == 200
    second = client.post("/render/audit", headers=auth, json=body)
    assert overpass.calls == 1
    p1, p2 = first.json()["sections"]["site_scan"], second.json()["sections"]["site_scan"]
    assert p1["measured_at"] == p2["measured_at"]  # the hit is visible
    assert p1["memo_hit"] is False and p2["memo_hit"] is True

    # A moved pin is a different corridor: it scans again.
    moved = scenario(site_scan={}, meta={"lat": LAT + 0.01})
    assert client.post("/render/audit", headers=auth, json=moved).status_code == 200
    assert overpass.calls == 2
    # So is a changed work-zone length (the bbox follows the corridor).
    longer = scenario(site_scan={}, workLen=1500)
    assert client.post("/render/audit", headers=auth, json=longer).status_code == 200
    assert overpass.calls == 3


def test_memo_expires_after_the_ttl(
    client: TestClient, auth: dict[str, str], overpass: Overpass, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = {"t": 5000.0}
    monkeypatch.setattr(ss.time, "monotonic", lambda: clock["t"])
    body = scenario(site_scan={})
    assert client.post("/render/audit", headers=auth, json=body).status_code == 200
    clock["t"] += ss.MEMO_TTL_S - 1
    assert client.post("/render/audit", headers=auth, json=body).status_code == 200
    assert overpass.calls == 1
    clock["t"] += 2
    assert client.post("/render/audit", headers=auth, json=body).status_code == 200
    assert overpass.calls == 2


# ---------------------------------------------------------------------------
# precedence (ruling 1) and the plan sheet's context flags
# ---------------------------------------------------------------------------


def test_scan_owns_the_five_keys_manual_only_pass_through_discards_disclosed(
    client: TestClient, auth: dict[str, str], overpass: Overpass
) -> None:
    manual = {
        "school_zone": True,  # the map says no school here → discarded, disclosed
        "adjacent_intersection": True,  # agrees with the scan → kept, not a discard
        "limited_sight_distance": True,  # manual-only → passes through untouched
    }
    res = client.post(
        "/render/audit", headers=auth, json=scenario(site_scan={}, meta={"siteConditions": manual})
    )
    assert res.status_code == 200, res.text
    prov = res.json()["sections"]["site_scan"]
    assert prov["flags"] == {
        "adjacent_intersection": True,
        "pedestrian_facility": True,
        "bicycle_facility": True,
        "limited_sight_distance": True,
    }
    assert prov["manual_flags_discarded"] == {"school_zone": True}
    fired = sorted(r["flag"] for r in res.json()["sections"]["site_adjustments"])
    assert fired == [
        "adjacent_intersection",
        "bicycle_facility",
        "limited_sight_distance",
        "pedestrian_facility",
    ]


def test_plan_sheet_context_flags_follow_the_effective_flags() -> None:
    from pydantic import TypeAdapter

    from src.api.render_api import _plan_sheet_site_flags
    from src.api.schemas import Scenario

    sc = TypeAdapter(Scenario).validate_python(
        scenario(meta={"siteConditions": {"school_zone": True}})
    )
    effective = {"pedestrian_facility": True, "limited_sight_distance": True}
    # The sheet draws what the plan applied — not the wire's manual dict.
    assert _plan_sheet_site_flags(sc, effective) == effective
    assert "school_zone" not in _plan_sheet_site_flags(sc, effective)


def test_scan_never_writes_the_wire_scenario(overpass: Overpass) -> None:
    """Suggest-never-set boundary: the result carries the effective flags;
    the scenario object the request parsed is left exactly as sent."""
    from pydantic import TypeAdapter

    from src.api.schemas import Scenario, scenario_to_call

    sc = TypeAdapter(Scenario).validate_python(scenario(site_scan={}))
    params, _gen, _kw = scenario_to_call(sc)
    before = sc.model_dump()
    result = ss.run_site_scan(sc, params)
    assert result.provenance.status == "ok"
    assert result.effective_flags["pedestrian_facility"] is True
    assert sc.model_dump() == before
