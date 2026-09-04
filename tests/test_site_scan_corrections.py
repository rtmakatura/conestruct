"""#224 phase 4 (s2-arc18, commit 1) — operator corrections of the scanned
site conditions, on the wire and through the real render routes.

Rule 11 — test where the bug lives: every case posts a scenario carrying
``meta.siteConditionOverrides`` to the REAL ``/render/audit`` (TestClient)
with the Overpass trip stubbed exactly as the containment harness stubs
it, and reads the answer off ``sections.site_scan`` / the adjustment
records / ``pending_verification`` — the same wire section every surface
and both tier mirrors consume.

The grid (GO 2026-09-04): dismiss a detected key ⇒ applied, the flag
leaves ``effective_flags`` and its adjustment record no longer fires;
assert an absent key ⇒ applied, the flag joins and its record fires with
the scan still reporting none; a correction the scan agrees with ⇒ moot,
disclosed, the verdict unchanged (rule 10); without an ok scan an assert
still applies and a dismiss is moot; every applied correction is ONE
pending item (the #177 shape); the cross-field rules are an honest 400
with the code the recovery affordance reads; the suggest-never-set
boundary holds for a corrected payload.
"""

from __future__ import annotations

import copy
import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api import site_scan as ss
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
FIXTURE = Path(__file__).parent / "fixtures" / "site_scan" / "lakewood_overpass.json"
LAT, LNG, BEARING = 39.7113, -105.0815, 180.0
AT = "2026-09-04T12:00:00+00:00"


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


@pytest.fixture()
def overpass(monkeypatch: pytest.MonkeyPatch, payload: dict[str, Any]) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_k: (copy.deepcopy(payload), None)
    )


@pytest.fixture()
def overpass_down(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_k: (None, "stub: mirrors down")
    )


def scenario(overrides: list[dict[str, Any]] | None, **over: Any) -> dict[str, Any]:
    """The s2-arc15 parity scenario (shoulder, divided, 45 mph, Lakewood pin)
    with ``site_scan`` requested and the corrections under test."""
    base: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {
            "project": "s2a18",
            "address": "",
            "lat": LAT,
            "lng": LNG,
            "bearingDeg": BEARING,
            "siteConditionOverrides": overrides,
        },
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
        "site_scan": {"proceed_if_unavailable": False},
    }
    meta_over = over.pop("meta", None)
    base.update(over)
    if meta_over:
        base["meta"] = {**base["meta"], **meta_over}
    return base


def _audit(client: TestClient, auth: dict[str, str], sc: dict[str, Any]) -> dict[str, Any]:
    res = client.post("/render/audit", headers=auth, json=sc)
    assert res.status_code == 200, res.text[:400]
    return res.json()


def _fired(audit: dict[str, Any]) -> list[str]:
    return sorted(r["flag"] for r in audit["sections"].get("site_adjustments") or [])


def _pending_kinds(audit: dict[str, Any]) -> list[str]:
    return [i["kind"] for i in audit["pending_verification"].get("items") or []]


# The recorded Lakewood payload detects sidewalks, bike facilities and
# intersections; no school, no interchange (the s2-arc15 record).
DISMISS_SIDEWALK = {
    "flag": "pedestrian_facility",
    "action": "dismiss",
    "reason": "fenced",
    "recorded_at": AT,
}
ASSERT_SCHOOL = {"flag": "school_zone", "action": "assert", "recorded_at": AT}


# --------------------------------------------------------------------------- #
# Applied corrections
# --------------------------------------------------------------------------- #


def test_no_corrections_is_the_phase_3_wire_exactly(
    client: TestClient, auth: dict[str, str], overpass: None
) -> None:
    audit = _audit(client, auth, scenario(None))
    scan = audit["sections"]["site_scan"]
    assert scan["status"] == "ok"
    assert scan["corrections"] == []
    assert "site_condition_overridden" not in _pending_kinds(audit)
    assert _fired(audit) == ["adjacent_intersection", "bicycle_facility", "pedestrian_facility"]


def test_dismiss_of_a_detected_key_applies_and_its_record_no_longer_fires(
    client: TestClient, auth: dict[str, str], overpass: None
) -> None:
    audit = _audit(client, auth, scenario([DISMISS_SIDEWALK]))
    scan = audit["sections"]["site_scan"]
    assert scan["buckets"]["sidewalks"]["detected"] is True  # the scan still says so
    assert "pedestrian_facility" not in scan["flags"]
    assert _fired(audit) == ["adjacent_intersection", "bicycle_facility"]
    [c] = scan["corrections"]
    assert c["status"] == "applied"
    assert c["scan_detected"] is True
    assert c["reason"] == "fenced"
    assert c["disclosure"].startswith(
        "Operator dismissed the scan's pedestrian sidewalks: fenced off."
    )
    # ONE pending item, its label the disclosure verbatim (the #177 shape).
    items = [
        i
        for i in audit["pending_verification"]["items"]
        if i["kind"] == "site_condition_overridden"
    ]
    assert len(items) == 1
    assert items[0]["label"] == c["disclosure"]
    assert items[0]["tracking_issue"].endswith("/issues/224")
    assert audit["plan_flags"]["is_clean"] is False


def test_assert_of_an_absent_key_applies_and_its_record_fires(
    client: TestClient, auth: dict[str, str], overpass: None
) -> None:
    audit = _audit(client, auth, scenario([ASSERT_SCHOOL]))
    scan = audit["sections"]["site_scan"]
    assert scan["buckets"]["schools"]["detected"] is False  # the scan still says none
    assert scan["flags"]["school_zone"] is True
    assert "school_zone" in _fired(audit)
    [c] = scan["corrections"]
    assert c["status"] == "applied"
    assert c["scan_detected"] is False
    assert c["reason"] is None
    assert c["disclosure"].startswith(
        "Operator asserted school zone — the scan found none along the corridor."
    )
    assert _pending_kinds(audit).count("site_condition_overridden") == 1


def test_other_reason_carries_the_note_in_the_sentence(
    client: TestClient, auth: dict[str, str], overpass: None
) -> None:
    other = {**DISMISS_SIDEWALK, "reason": "other", "note": "construction fence on the east side"}
    audit = _audit(client, auth, scenario([other]))
    [c] = audit["sections"]["site_scan"]["corrections"]
    assert "construction fence on the east side" in c["disclosure"]


# --------------------------------------------------------------------------- #
# Moot corrections (rule 10: disclosed, never dropped)
# --------------------------------------------------------------------------- #


def test_moot_corrections_are_disclosed_and_change_nothing(
    client: TestClient, auth: dict[str, str], overpass: None
) -> None:
    moot = [
        {"flag": "school_zone", "action": "dismiss", "reason": "removed", "recorded_at": AT},
        {"flag": "pedestrian_facility", "action": "assert", "recorded_at": AT},
    ]
    audit = _audit(client, auth, scenario(moot))
    scan = audit["sections"]["site_scan"]
    assert _fired(audit) == ["adjacent_intersection", "bicycle_facility", "pedestrian_facility"]
    statuses = {c["flag"]: c["status"] for c in scan["corrections"]}
    assert statuses == {"school_zone": "moot", "pedestrian_facility": "moot"}
    assert "site_condition_overridden" not in _pending_kinds(audit)
    texts = [c["disclosure"] for c in scan["corrections"]]
    assert any("dismissal of school zone is moot" in t for t in texts)
    assert any("assertion of pedestrian sidewalks is moot" in t for t in texts)


# --------------------------------------------------------------------------- #
# Without an ok scan
# --------------------------------------------------------------------------- #


def test_proceeded_after_outage_applies_asserts_and_moots_dismisses(
    client: TestClient, auth: dict[str, str], overpass_down: None
) -> None:
    sc = scenario([ASSERT_SCHOOL, DISMISS_SIDEWALK], site_scan={"proceed_if_unavailable": True})
    audit = _audit(client, auth, sc)
    scan = audit["sections"]["site_scan"]
    assert scan["status"] == "unavailable" and scan["proceeded_anyway"] is True
    assert scan["disclosure"] == ss.NOT_CHECKED_DISCLOSURE
    by_flag = {c["flag"]: c for c in scan["corrections"]}
    assert by_flag["school_zone"]["status"] == "applied"
    assert by_flag["school_zone"]["scan_detected"] is None
    assert "the site scan did not complete" in by_flag["school_zone"]["disclosure"]
    assert by_flag["pedestrian_facility"]["status"] == "moot"
    assert "school_zone" in _fired(audit)
    assert "pedestrian_facility" not in _fired(audit)


def test_not_run_applies_asserts_too(client: TestClient, auth: dict[str, str]) -> None:
    sc = scenario([ASSERT_SCHOOL])
    del sc["site_scan"]
    audit = _audit(client, auth, sc)
    scan = audit["sections"]["site_scan"]
    assert scan["status"] == "not_run"
    assert [c["status"] for c in scan["corrections"]] == ["applied"]
    assert "school_zone" in _fired(audit)


# --------------------------------------------------------------------------- #
# The honest 400
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "overrides, fragment",
    [
        (
            [{"flag": "pedestrian_facility", "action": "dismiss", "recorded_at": AT}],
            "needs a reason",
        ),
        (
            [
                {
                    "flag": "pedestrian_facility",
                    "action": "dismiss",
                    "reason": "other",
                    "recorded_at": AT,
                }
            ],
            "needs a note",
        ),
        (
            [
                {
                    "flag": "pedestrian_facility",
                    "action": "dismiss",
                    "reason": "fenced",
                    "note": "x",
                    "recorded_at": AT,
                }
            ],
            "only with the reason 'other'",
        ),
        ([{**ASSERT_SCHOOL, "reason": "fenced"}], "takes no reason"),
        ([ASSERT_SCHOOL, {**ASSERT_SCHOOL}], "Two corrections name school zone"),
    ],
)
def test_cross_field_rules_are_an_honest_400_with_the_code(
    client: TestClient,
    auth: dict[str, str],
    overpass: None,
    overrides: list[dict[str, Any]],
    fragment: str,
) -> None:
    res = client.post("/render/audit", headers=auth, json=scenario(overrides))
    assert res.status_code == 400, res.text[:400]
    detail = res.json()["detail"]
    assert detail["error"] == ss.SITE_CONDITION_OVERRIDE_ERROR
    assert fragment in detail["message"]
    assert detail["recovery"] == {"field": "meta.siteConditionOverrides"}


def test_shape_errors_stay_pydantics(
    client: TestClient, auth: dict[str, str], overpass: None
) -> None:
    bad = [
        {"flag": "driveways_present", "action": "dismiss", "reason": "fenced", "recorded_at": AT}
    ]
    res = client.post("/render/audit", headers=auth, json=scenario(bad))
    assert res.status_code == 422  # a manual-only key is not a scanned flag


# --------------------------------------------------------------------------- #
# Suggest-never-set on a corrected payload
# --------------------------------------------------------------------------- #


def test_corrections_never_write_the_wire_scenario(overpass: None) -> None:
    from pydantic import TypeAdapter

    from src.api.schemas import Scenario, scenario_to_call

    sc = TypeAdapter(Scenario).validate_python(scenario([DISMISS_SIDEWALK, ASSERT_SCHOOL]))
    params, _gen, _kw = scenario_to_call(sc)
    before = sc.model_dump()
    result = ss.run_site_scan(sc, params)
    assert result.provenance.status == "ok"
    assert "pedestrian_facility" not in result.effective_flags
    assert result.effective_flags["school_zone"] is True
    assert sc.model_dump() == before
    assert sc.meta.siteConditions == {}  # the corrections never became manual flags
