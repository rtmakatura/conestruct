"""R117 Q1a/Q1b + R118 -- a jurisdiction rule says whether it raised a count.

R117 Q1b: "the backend records whether each rule raised a count; only then
'changed this plan' or '+N jurisdiction-required'."  R118: "A jurisdiction
rule that raised no count moves to ✓ Checked & passed, on screen and in the
audit PDF's ledger.  A rule that raised a count stays ▲ in Needs You."

The fact is computed once, from the same row pipeline the device list,
the XLSX and the on-sheet summary use (``apply_count_deltas_structured``),
and the backend owns the device's words (Rule 3).  Tested at the function,
at the payload chokepoint and on the audit PDF's ledger (Rule 11).  The
plan is the R116 repro: a near-intersection lane closure on N Broadway SB
with Denver, whose arrow-board rule (denver.json) fires on any lane
closure, and whose layout already places an arrow board.
"""

from __future__ import annotations

import copy
import os
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from src.api import render_api
from src.api.render_api import app
from src.api.schemas import Scenario
from src.rendering.tier_ledger import tier_facts
from src.rules import site_detection as sd
from src.rules.devices import DeviceType
from src.rules.jurisdiction import annotate_count_effects, device_label
from src.rules.validators import DevicePlacement

AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}


@pytest.fixture(scope="module", autouse=True)
def _env() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(autouse=True)
def _no_overpass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


ARROW_RULE: dict[str, Any] = {
    "severity": "count",
    "rule": "Arrow board required if closing one or more lanes",
    "effect": {"op": "add_device", "device": "arrow_board", "qty": 1},
    "status": "fires",
    "source": {"doc": "DOTI PT-116.1", "date": "2022-04-01", "status": "verified"},
}


def _board(station: float = 0.0) -> DevicePlacement:
    return DevicePlacement(DeviceType.ARROW_BOARD, station, 10.0, label="LEFT_ARROW")


def test_a_rule_the_layout_already_meets_raised_nothing() -> None:
    (d,) = annotate_count_effects([ARROW_RULE], [_board()])
    assert d["raised"] is False
    assert d["device_label"] == "Arrow board"


def test_a_rule_that_adds_the_device_raised_a_count() -> None:
    (d,) = annotate_count_effects([ARROW_RULE], [])
    assert d["raised"] is True


def test_a_rule_that_tops_a_row_up_raised_a_count() -> None:
    two = {**ARROW_RULE, "effect": {**ARROW_RULE["effect"], "qty": 2}}
    (d,) = annotate_count_effects([two], [_board()])
    assert d["raised"] is True


def test_only_fired_count_adds_carry_raised() -> None:
    """Conditional rules, method rules and admin rules don't change counts;
    no `raised` key, so their tier stays as before."""
    method = {**ARROW_RULE, "severity": "op", "effect": {"op": "method", "note": "x"}}
    conditional = {**ARROW_RULE, "status": "conditional"}
    for d in annotate_count_effects([method, conditional], []):
        assert "raised" not in d


def test_the_input_is_not_mutated() -> None:
    src = [copy.deepcopy(ARROW_RULE)]
    annotate_count_effects(src, [])
    assert "raised" not in src[0]


def test_device_labels_are_sentence_case() -> None:
    assert device_label("arrow_board") == "Arrow board"
    assert device_label("arrow_board_type_c") == "Arrow board (Type C)"
    assert device_label("no_parking_sign") == "No parking sign (R7-series)"
    assert device_label("type_1_barrier") == "Type 1 barrier"
    assert device_label("some_new_device") == "Some new device"


def _broadway_denver() -> dict[str, Any]:
    approach = {
        "speed": 25,
        "roadType": "urban_arterial",
        "lanesPerDirection": 1,
        "laneWidth": 11.0,
        "signalized": True,
        "alongStationFt": -100.0,
    }
    return {
        "kind": "near_intersection",
        "meta": {"project": "r117", "address": "", "lat": 39.7337, "lng": -104.98753},
        "roadType": "urban_arterial",
        "speed": 30,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "approaches": [{"id": "e11", **approach}],
        "jurisdiction_key": "denver",
        "street_class": "arterial",
    }


client = TestClient(app)


def test_the_breakdown_says_the_board_was_already_placed() -> None:
    r = client.post("/render/device-breakdown", headers=AUTH, json=_broadway_denver())
    assert r.status_code == 200, r.text
    body = r.json()
    (arrow,) = [
        d
        for d in body["jurisdiction"]["applied_deltas"]
        if d["effect"].get("device") == "arrow_board"
    ]
    assert arrow["raised"] is False
    assert arrow["device_label"] == "Arrow board"
    rows = [row for row in body["devices"] if row.get("jurisdiction_required")]
    assert rows and all(row["jurisdiction_added"] == 0 for row in rows)


def test_the_audit_pdf_ledger_counts_the_met_rule_as_checked() -> None:
    scenario = TypeAdapter(Scenario).validate_python(_broadway_denver())
    _projection, params, placements = render_api._audit_build(scenario)
    jurisdiction, _ = render_api._jurisdiction_eval(scenario, params, placements)
    facts = tier_facts(None, jurisdiction)
    ids = [
        f"jur:delta:{i}"
        for i, d in enumerate(jurisdiction["applied_deltas"])
        if d["effect"].get("device") == "arrow_board"
    ]
    assert ids and all(facts[i] == "checked" for i in ids)


def test_the_ledger_routes_by_raised() -> None:
    jur = {"applied_deltas": [dict(ARROW_RULE, raised=False), dict(ARROW_RULE, raised=True)]}
    facts = tier_facts(None, jur)
    assert facts["jur:delta:0"] == "checked"
    assert facts["jur:delta:1"] == "changed"
    # A recorded block from before R117 (no `raised`) keeps its tier.
    assert tier_facts(None, {"applied_deltas": [ARROW_RULE]})["jur:delta:0"] == "changed"
