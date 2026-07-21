"""Jurisdiction rule-evaluation tests (phase1-backend-spec §5).

Four families:

1. Golden-rule fixtures (§5.2) — hand-transcribed expected outcomes from
   the official documents, in ``tests/fixtures/jurisdictions/``.
2. Regression (§5.3) — a scenario without jurisdiction fields produces
   the pre-extension payload plus only the additive ``zone_geometry``
   key; device rows and totals are untouched.
3. Trigger matrix (§5.4) — every delta in every data file fires and
   abstains correctly across (class x closure x night), checked against
   an independent oracle plus hand-written cases for the known deltas.
4. Agreement — the breakdown's ``zone_geometry`` taper equals the audit
   trail's required taper for both enabled kinds (two encodings of the
   same rule may never disagree).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api.audit import build_audit_trail
from src.api.render_api import app
from src.api.schemas import scenario_to_call
from src.rules.jurisdiction import (
    ABSTAINS,
    CONDITIONAL,
    FIRES,
    UNKNOWN,
    PlanContext,
    WorkSchedule,
    apply_count_deltas,
    available_jurisdictions,
    context_for_closure_type,
    evaluate,
    evaluate_hours,
    evaluate_trigger,
    load_jurisdiction,
    urban_high_speed_breakpoint,
)

FIXTURES = Path(__file__).parent / "fixtures" / "jurisdictions"

AUTH = {"Authorization": "Bearer test-secret"}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


def _fixture(name: str) -> dict:
    with open(FIXTURES / name, encoding="utf-8") as f:
        return json.load(f)


def _flagger_scenario(**extra) -> dict:
    base = {
        "kind": "flagger_lane_closure",
        "roadType": "urban_arterial",
        "speed": 35,
        "laneWidth": 12.0,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
    }
    base.update(extra)
    return base


def _shoulder_scenario(**extra) -> dict:
    base = {
        "kind": "shoulder",
        "roadType": "urban_arterial",
        "speed": 35,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 800.0,
        "night": False,
    }
    base.update(extra)
    return base


# ---------------------------------------------------------------------------
# §5.2 Golden-rule fixtures
# ---------------------------------------------------------------------------


def test_golden_englewood_tc1_geometry():
    """Englewood TC-1 spacing table rows, verbatim from the sheet."""
    expected = _fixture("englewood_tc1_geometry.json")
    geom = load_jurisdiction("englewood")["geometry"]

    rows = [
        {k: v for k, v in row.items() if k in ("min_speed_mph", "max_speed_mph", "distance_ft")}
        for row in geom["sign_spacing"]
    ]
    for want in expected["sign_spacing_rows"]:
        assert any(all(row.get(k) == v for k, v in want.items()) for row in rows), (
            f"TC-1 spacing row missing: {want}"
        )
    assert geom["device_spacing"]["taper_ft"] == expected["device_spacing"]["taper_ft"]
    assert geom["device_spacing"]["tangent_ft"] == expected["device_spacing"]["tangent_ft"]
    assert geom["min_lane_width_ft"]["value"] == expected["min_lane_width_ft"]
    assert geom["urban_high_speed_breakpoint_mph"] == expected["urban_high_speed_breakpoint_mph"]


def test_golden_greeley_arterial_lane_closure_arrow_board_fires():
    """Greeley: Type C arrow board fires on an arterial through-lane closure
    and lands in the device rows via the count pipeline."""
    record = load_jurisdiction("greeley")
    ctx = context_for_closure_type("lane", street_class="arterial", night=False)
    result = evaluate(record, ctx)

    fired = [d for d in result["applied_deltas"] if d["status"] == FIRES]
    assert len(fired) == 1
    assert fired[0]["effect"] == {"op": "add_device", "device": "arrow_board_type_c", "qty": 1}
    assert fired[0]["source"]["doc"].startswith("Greeley Permitting Requirements")

    rows = apply_count_deltas([], result["applied_deltas"])
    assert rows == [
        {
            "device": "Arrow Board (Type C)",
            "code": "—",
            "function": "Jurisdiction-required",
            "qty": 1,
            "jurisdiction_required": True,
            "jurisdiction_source": fired[0]["source"],
        }
    ]


def test_golden_greeley_arrow_board_abstains_off_trigger():
    """Same delta must abstain on a local street and on a shoulder closure."""
    record = load_jurisdiction("greeley")
    local = evaluate(record, context_for_closure_type("lane", street_class="local", night=False))
    assert all(d["status"] != FIRES for d in local["applied_deltas"])
    shoulder = evaluate(
        record, context_for_closure_type("shoulder", street_class="arterial", night=False)
    )
    assert all(d["status"] != FIRES for d in shoulder["applied_deltas"])


def test_golden_lcuass_hours_eval_meter_math():
    """Loveland, arterial, 8:00 AM weekday start: 0.5 h inside the 7:00-8:30
    ban -> one violation, priced at one half-hour of the $700 arterial meter."""
    fx = _fixture("lcuass_hours_eval.json")
    case, expected = fx["case"], fx["expected"]
    record = load_jurisdiction(case["jurisdiction_key"])
    sched = case["schedule"]
    from datetime import date

    ctx = context_for_closure_type(
        case["closure_type"],
        street_class=case["street_class"],
        night=False,
        schedule=WorkSchedule(
            date_mode=sched["date_mode"],
            work_date=date.fromisoformat(sched["work_date"]),
            start_time=sched["start_time"],
            end_time=sched["end_time"],
        ),
    )
    hours = evaluate_hours(record, ctx)
    assert hours["status"] == expected["status"]
    assert len(hours["violations"]) == expected["violation_count"]
    v = hours["violations"][0]
    assert v["overlap_hours"] == expected["overlap_hours"]
    assert v["window"]["start"] == expected["violated_window"]["start"]
    assert v["window"]["end"] == expected["violated_window"]["end"]
    assert hours["exposure_estimate_cents"] == expected["exposure_estimate_cents"]


def test_golden_parker_conflict_rendering():
    """Parker's hours conflict block, verbatim (spec §2.6): rendered
    9:00-3:30 with both sources preserved for the footnote."""
    fx = _fixture("parker_conflict.json")
    record = load_jurisdiction("parker")
    assert record["hours"]["conflict"] == fx["expected_conflict"]
    window = record["hours"]["windows"][0]
    assert window["start"] == fx["expected_window"]["start"]
    assert window["end"] == fx["expected_window"]["end"]

    ctx = context_for_closure_type("lane", street_class="arterial", night=False)
    assert fx["expected_conflict"] in evaluate(record, ctx)["conflicts"]


def test_golden_littleton_template_case():
    fx = _fixture("littleton_template.json")["expected"]
    record = load_jurisdiction("littleton")
    geom = record["geometry"]
    assert geom["device_spacing"]["taper_ft"] == fx["cone_spacing_taper_ft"]
    assert geom["min_lane_width_ft"]["value"] == fx["min_lane_width_ft"]
    assert geom["min_lane_width_ft"]["conflict"]["rendered"] == fx["lane_width_conflict_rendered"]
    afad = [d for d in record["deltas"] if fx["afad_ban_rule_contains"] in d["rule"]]
    assert len(afad) == 1 and afad[0]["severity"] == "op"


def test_golden_el_paso_fee_formula_structure():
    """El Paso's Traffic Management formula consumes the engine's real
    closed-lane count and MUTCD-computed zone length (spec §1.1 #10).
    No worked worksheet example exists in the corpus (BLOCKED.md), so
    this pins the formula's structure, not an output value."""
    record = load_jurisdiction("el_paso")
    formula = record["fees"]["formula"]
    assert record["fees"]["model"] == "formula"
    assert formula["inputs"] == ["lanes_closed", "zone_length_ft", "days"]
    assert "MUTCD" in formula["note"]
    assert formula["source"]["status"] == "provisional"


def test_breakpoint_fallback_labeled_per_cdot_baseline():
    """Undocumented breakpoint -> CDOT 40/45, labeled — never as the city's own."""
    bp, label = urban_high_speed_breakpoint(load_jurisdiction("cdot"))
    assert (bp, label) == (45, "CDOT")
    bp, label = urban_high_speed_breakpoint(load_jurisdiction("englewood"))
    assert (bp, label) == (35, "Englewood")
    bp, label = urban_high_speed_breakpoint(load_jurisdiction("loveland"))
    assert bp == 45
    assert label == "per CDOT baseline"


# ---------------------------------------------------------------------------
# §5.3 Regression — jurisdiction absent ⇒ unchanged output
# ---------------------------------------------------------------------------


def test_regression_no_jurisdiction_payload_shape(client):
    """Without jurisdiction fields the payload differs from the
    pre-extension shape only by the additive ``zone_geometry`` key."""
    r = client.post("/render/device-breakdown", json=_flagger_scenario(), headers=AUTH)
    assert r.status_code == 200
    payload = r.json()
    assert sorted(payload.keys()) == ["devices", "total_devices", "unique_types", "zone_geometry"]
    assert "jurisdiction" not in payload
    # No row carries any jurisdiction marker.
    assert all("jurisdiction_required" not in row for row in payload["devices"])
    # Totals keep the pre-extension invariant: one placement per device.
    assert payload["total_devices"] == sum(r["qty"] for r in payload["devices"])


def test_regression_jurisdiction_fields_do_not_change_baseline_rows(client):
    """A jurisdiction whose deltas all abstain leaves rows byte-identical."""
    plain = client.post("/render/device-breakdown", json=_flagger_scenario(), headers=AUTH).json()
    with_jur = client.post(
        "/render/device-breakdown",
        # Greeley delta abstains on a local street: no count change.
        json=_flagger_scenario(jurisdiction_key="greeley", street_class="local"),
        headers=AUTH,
    ).json()
    assert with_jur["devices"] == plain["devices"]
    assert with_jur["total_devices"] == plain["total_devices"]
    assert "jurisdiction" in with_jur


def test_unknown_jurisdiction_is_a_clear_400(client):
    r = client.post(
        "/render/device-breakdown",
        json=_flagger_scenario(jurisdiction_key="narnia"),
        headers=AUTH,
    )
    assert r.status_code == 400
    assert "unknown jurisdiction" in r.json()["detail"]


def test_greeley_arterial_end_to_end_adds_arrow_board(client):
    r = client.post(
        "/render/device-breakdown",
        json=_flagger_scenario(jurisdiction_key="greeley", street_class="arterial"),
        headers=AUTH,
    )
    assert r.status_code == 200
    payload = r.json()
    added = [row for row in payload["devices"] if row.get("jurisdiction_required")]
    assert [row["device"] for row in added] == ["Arrow Board (Type C)"]
    assert payload["total_devices"] == sum(row["qty"] for row in payload["devices"])


# ---------------------------------------------------------------------------
# §5.4 Trigger matrix — every delta, (class x closure x night)
# ---------------------------------------------------------------------------


def _oracle(trigger: dict | None, street_class, closures: set, night) -> str:
    """Independent re-derivation of the trigger contract (test oracle)."""
    if not trigger:
        return FIRES
    unknown = False
    classes = trigger.get("classes")
    if classes:
        if street_class is None:
            unknown = True
        elif street_class not in classes:
            return ABSTAINS
    closure = trigger.get("closure")
    if closure and not (closures & set(closure)):
        return ABSTAINS
    t_night = trigger.get("night")
    if t_night is not None:
        if night is None:
            unknown = True
        elif night != t_night:
            return ABSTAINS
    if trigger.get("min_duration_days") is not None:
        unknown = True  # matrix never supplies duration
    if unknown:
        return UNKNOWN
    if trigger.get("condition"):
        return CONDITIONAL
    return FIRES


MATRIX = [
    (sc, cl, night)
    for sc in ("local", "collector", "arterial", None)
    for cl in ("lane", "shoulder")
    for night in (False, True, None)
]


@pytest.mark.parametrize("key", available_jurisdictions())
def test_trigger_matrix_every_delta(key):
    record = load_jurisdiction(key)
    records = record.get("deltas", []) + record.get("personnel", []) + record.get("devices", [])
    for rec in records:
        trigger = rec.get("trigger")
        for street_class, closure_type, night in MATRIX:
            ctx = PlanContext(
                street_class=street_class,
                closures=frozenset({closure_type}),
                night=night,
            )
            got = evaluate_trigger(trigger, ctx)
            want = _oracle(trigger, street_class, {closure_type}, night)
            assert got == want, (
                f"{key}: {rec.get('rule', '')[:60]!r} trigger={trigger} "
                f"ctx=({street_class}, {closure_type}, night={night}): "
                f"engine={got}, oracle={want}"
            )


def test_trigger_matrix_hand_cases():
    """Hand-written expectations for the known deltas — the oracle can't
    catch a bug shared with the implementation; these can."""
    greeley = load_jurisdiction("greeley")["deltas"][0]["trigger"]
    assert evaluate_trigger(greeley, PlanContext("arterial", frozenset({"lane"}), False)) == FIRES
    assert evaluate_trigger(greeley, PlanContext("collector", frozenset({"lane"}), True)) == FIRES
    assert evaluate_trigger(greeley, PlanContext("local", frozenset({"lane"}), False)) == ABSTAINS
    assert (
        evaluate_trigger(greeley, PlanContext("arterial", frozenset({"shoulder"}), False))
        == ABSTAINS
    )
    assert evaluate_trigger(greeley, PlanContext(None, frozenset({"lane"}), False)) == UNKNOWN

    # Thornton stipulation #16: drums on ALL night operations.
    thornton = load_jurisdiction("thornton")
    drums = next(d for d in thornton["deltas"] if d["effect"].get("device") == "drum")
    assert evaluate_trigger(drums["trigger"], PlanContext(None, frozenset({"lane"}), True)) == FIRES
    assert (
        evaluate_trigger(drums["trigger"], PlanContext(None, frozenset({"lane"}), False))
        == ABSTAINS
    )

    # Englewood arrow board: arterial/collector lane closures.
    englewood = load_jurisdiction("englewood")
    ab = next(d for d in englewood["deltas"] if d["effect"].get("device") == "arrow_board")
    collector_lane = PlanContext("collector", frozenset({"lane"}), False)
    assert evaluate_trigger(ab["trigger"], collector_lane) == FIRES
    assert (
        evaluate_trigger(ab["trigger"], PlanContext("local", frozenset({"lane"}), False))
        == ABSTAINS
    )

    # Parker vertical panels: free-form excavation condition -> CONDITIONAL,
    # never silently applied to counts.
    parker = load_jurisdiction("parker")
    vp = next(d for d in parker["deltas"] if d["effect"].get("device") == "vertical_panel")
    verdict = evaluate_trigger(vp["trigger"], PlanContext("arterial", frozenset({"lane"}), False))
    assert verdict == CONDITIONAL
    rows = apply_count_deltas([], [dict(vp, status=verdict)])
    assert rows == []


def test_conditional_deltas_never_change_counts():
    """rule 10: any delta whose verdict is conditional/unknown must leave
    device quantities untouched, for every jurisdiction."""
    for key in available_jurisdictions():
        record = load_jurisdiction(key)
        for delta in record.get("deltas", []):
            for status in (CONDITIONAL, UNKNOWN):
                assert apply_count_deltas([], [dict(delta, status=status)]) == []


# ---------------------------------------------------------------------------
# Agreement — zone_geometry vs. the audit trail (two encodings, one rule)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("scenario_json", [_flagger_scenario(), _shoulder_scenario()])
def test_zone_geometry_agrees_with_audit(client, scenario_json):
    from src.api.schemas import (
        FlaggerLaneClosureScenario,
        ShoulderScenario,
    )

    model = (
        FlaggerLaneClosureScenario
        if scenario_json["kind"] == "flagger_lane_closure"
        else ShoulderScenario
    )
    scenario = model(**scenario_json)
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    audit = build_audit_trail(placements, params)

    payload = client.post("/render/device-breakdown", json=scenario_json, headers=AUTH).json()
    zone = payload["zone_geometry"]
    assert zone["taper_l_ft"] == pytest.approx(audit["taper"]["L_required_ft"])
    assert zone["buffer_b_ft"] == pytest.approx(audit["buffer"]["buffer_ft"])
    assert zone["work_len_ft"] == scenario_json["workLen"]
