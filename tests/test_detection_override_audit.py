"""Override provenance — the audit records what confirms erase (issue #177).

The recovery affordances (#136/#158/#86 confirms, the #120 lane-edit
clears) lift a gate refusal or caution by erasing the detection relays,
which made a confirmed override byte-identical to a road that was never
detected: the Colfax demonstration (2026-07-28) generated a plan titled
"2-Lane Undivided" from a raw ``lanes=5`` detection with ``is_clean:
true`` and nothing anywhere recording the disagreement.

The fix: the frontend attaches a ``DetectionOverride`` marker (what
detection reported, what the human asserted) as it clears the relays;
one emission point in ``audit_projection`` turns each marker into a
``detection_overridden`` item riding ``pending_verification`` →
``plan_flags`` → every surface that prints audit blocks.  Informational
only — the backend never re-blocks a confirmed payload.

Markers exist only for DISPUTED erasures (the relays were driving a live
refusal or caution), so absence and override never look alike: a payload
with no marker is a road that was never detected (or an ordinary
manual-supersede edit, the #112 convention) and stays clean.
"""

from __future__ import annotations

import copy

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from tests.test_plan_sheet_device_summary import FLAGGER_BODY, SHOULDER_BODY

AUTH = {"Authorization": "Bearer test-secret"}

# The E Colfax demonstration case: detection read raw lanes=5,
# lanes:forward=3; one tick of the #86 confirm cleared all four relays.
# The marker preserves exactly the relay fields that were present.
COLFAX_OVERRIDE = {
    "via": "flagger_multilane_confirm",
    "detectedLanesTotal": 5,
    "detectedLanesForward": 3,
    "asserted": "one through lane in each direction",
}

COLFAX_LABEL = (
    "Detection override — map data reported 5 total lanes (3 forward); "
    "the user asserted one through lane in each direction. The plan is "
    "built to the assertion — verify it in the field or on imagery "
    "before deploying."
)


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


def _item_kinds(projection: dict) -> list[str]:
    return [i["kind"] for i in projection.get("pending_verification", {}).get("items", [])]


def _override_labels(projection: dict) -> list[str]:
    return [
        i["label"]
        for i in projection.get("pending_verification", {}).get("items", [])
        if i["kind"] == "detection_overridden"
    ]


def _ni_body() -> dict:
    """A valid near_intersection payload (mirrors test_lane_confidence_block)."""
    return {
        "kind": "near_intersection",
        "meta": {
            "project": "override-177",
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
        "workLen": 700.0,
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


# ---------------------------------------------------------------------------
# The item fires — confirmed payloads disclose, with the approved copy
# ---------------------------------------------------------------------------


def test_confirmed_flagger_renders_and_audit_discloses(client: TestClient) -> None:
    """The Colfax case, post-#177: the confirmed payload still renders
    (the backend never re-blocks an override) but the audit now states
    both sides verbatim and the plan is no longer clean."""
    body = {**copy.deepcopy(FLAGGER_BODY), "detectionOverrides": [COLFAX_OVERRIDE]}
    assert client.post("/render/pdf", json=body, headers=AUTH).status_code == 200

    audit = client.post("/render/audit", json=body, headers=AUTH)
    assert audit.status_code == 200, audit.text
    projection = audit.json()
    assert "detection_overridden" in _item_kinds(projection)
    assert _override_labels(projection) == [COLFAX_LABEL]
    assert projection["plan_flags"]["is_clean"] is False
    assert projection["plan_flags"]["v1_limitations"] >= 1


def test_oneway_override_states_the_direction_dispute(client: TestClient) -> None:
    """The #158 confirm's marker carries the raw oneway tag — the clause
    names the tag, and the amended copy says "built", not "sized"
    (direction is not a size)."""
    body = {
        **copy.deepcopy(FLAGGER_BODY),
        "detectionOverrides": [
            {
                "via": "flagger_twoway_confirm",
                "detectedOneway": "yes",
                "asserted": "two-way traffic",
            }
        ],
    }
    audit = client.post("/render/audit", json=body, headers=AUTH)
    assert audit.status_code == 200, audit.text
    (label,) = _override_labels(audit.json())
    assert "map data reported a one-way road (oneway=yes)" in label
    assert "the user asserted two-way traffic" in label
    assert "built to the assertion" in label
    assert "sized to" not in label


def test_shoulder_edit_override_no_caution_double_fire(client: TestClient) -> None:
    """A disputed shoulder lane edit: the relays are gone (erased by the
    edit), so the #120 caution cannot fire — the override item fully
    replaces its job in that state."""
    body = {
        **copy.deepcopy(SHOULDER_BODY),
        "detectionOverrides": [
            {
                "via": "shoulder_lane_edit",
                "detectedLanesTotal": 2,
                "detectedLanesForward": 1,
                "detectedLanesBackward": 2,
                "asserted": "3 lanes per direction",
            }
        ],
    }
    audit = client.post("/render/audit", json=body, headers=AUTH)
    assert audit.status_code == 200, audit.text
    projection = audit.json()
    kinds = _item_kinds(projection)
    assert "detection_overridden" in kinds
    assert "lane_count_low_confidence" not in kinds
    (label,) = _override_labels(projection)
    assert "2 total lanes (1 forward, 2 backward)" in label
    assert "the user asserted 3 lanes per direction" in label


def test_near_intersection_marker_unit_level() -> None:
    """Unit-level coverage while the kind is gated (#177 plan): the
    NearIntersectionScenario schema carries the marker, the exact
    threading expression _audit_projection_for uses extracts it, and the
    clause builder renders its fields.  The emission loop itself is
    kind-independent and endpoint-proven by the flagger/shoulder tests
    above.  (/render/audit does not support the gated kind today —
    build_audit_trail requires the approaches list the endpoint path
    never threads — so there is no endpoint to drive.)"""
    from src.api.audit import _override_detected_clause
    from src.api.schemas import NearIntersectionScenario

    scenario = NearIntersectionScenario(
        **{
            **_ni_body(),
            "detectionOverrides": [
                {
                    "via": "approach_lane_confirm",
                    "detectedLanesTotal": 5,
                    "detectedLanesForward": 3,
                    "detectedLanesBackward": 2,
                    "asserted": "approach lane count 1",
                }
            ],
        }
    )
    records = [
        r.model_dump(exclude_none=True)
        for r in (getattr(scenario, "detectionOverrides", None) or [])
    ]
    assert records == [
        {
            "via": "approach_lane_confirm",
            "detectedLanesTotal": 5,
            "detectedLanesForward": 3,
            "detectedLanesBackward": 2,
            "asserted": "approach lane count 1",
        }
    ]
    assert _override_detected_clause(records[0]) == "5 total lanes (3 forward, 2 backward)"


def test_two_markers_emit_two_items(client: TestClient) -> None:
    """A session can legitimately produce two overrides (#86 tick then
    #158 tick) — one item each, both counted."""
    body = {
        **copy.deepcopy(FLAGGER_BODY),
        "detectionOverrides": [
            COLFAX_OVERRIDE,
            {
                "via": "flagger_twoway_confirm",
                "detectedOneway": "yes",
                "asserted": "two-way traffic",
            },
        ],
    }
    audit = client.post("/render/audit", json=body, headers=AUTH)
    assert audit.status_code == 200, audit.text
    projection = audit.json()
    assert len(_override_labels(projection)) == 2
    assert projection["plan_flags"]["v1_limitations"] >= 2


# ---------------------------------------------------------------------------
# The item does NOT fire — absence and override must not look alike
# ---------------------------------------------------------------------------


def test_never_detected_payload_carries_no_item(client: TestClient) -> None:
    body = copy.deepcopy(FLAGGER_BODY)
    assert "detectionOverrides" not in body
    audit = client.post("/render/audit", json=body, headers=AUTH)
    assert audit.status_code == 200, audit.text
    assert "detection_overridden" not in _item_kinds(audit.json())


def test_marker_list_capped_at_eight(client: TestClient) -> None:
    """The schema bound: nine markers is not a payload our frontend can
    produce — reject rather than carry unbounded lists forever."""
    body = {**copy.deepcopy(FLAGGER_BODY), "detectionOverrides": [COLFAX_OVERRIDE] * 9}
    resp = client.post("/render/audit", json=body, headers=AUTH)
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# Rendered output — the override text prints in the audit blocks
# ---------------------------------------------------------------------------


def _flatten_strings(obj) -> list[str]:
    if isinstance(obj, str):
        return [obj]
    if isinstance(obj, (list, tuple)):
        return [s for item in obj for s in _flatten_strings(item)]
    if hasattr(obj, "__dict__"):
        return [s for v in vars(obj).values() for s in _flatten_strings(v)]
    return []


def test_override_text_prints_in_audit_blocks(client: TestClient) -> None:
    """The item rides the same pending_verification block the audit PDF
    renders (audit_blocks._pending_blocks) — the deliverable states both
    sides, not just the panel."""
    from src.rendering.audit_blocks import audit_to_blocks

    body = {**copy.deepcopy(FLAGGER_BODY), "detectionOverrides": [COLFAX_OVERRIDE]}
    projection = client.post("/render/audit", json=body, headers=AUTH).json()
    text = " ".join(_flatten_strings(audit_to_blocks(projection)))
    assert COLFAX_LABEL in text
