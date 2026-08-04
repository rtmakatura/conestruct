"""S-630-1 Case 18 typicals-match harness (Arc 11 phase 10, Refs #117).

The amended Rule-8 enablement bar (ruled 2026-07-27): generated
near_intersection output matches the published intersection typicals.
Fixture: tests/fixtures/cdot_s630_typicals/case_18.json (July 2026
26-sheet edition, hand-extracted with per-value provenance); mapping
and the three documented departures: match_rules.md "Case 18
(near_intersection)".

The rural-keyed scenario is the strongest match: the plate's drawn
opposing-set dims (500'/500'/100') ARE the rural key row, so the
cross-leg assertions hit the plate's printed numbers exactly.  The
far side has no Case 18 drawing; its target is MUTCD Fig. 6P-22 via
the note-7 option + the §6N.12.12 companion (match_rules mapping).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.api.audit import build_audit_trail
from src.api.schemas import NearIntersectionScenario, scenario_to_call
from src.rules.devices import DeviceType
from src.rules.validators import DevicePlacement

from ._harness import assert_within

FIXTURE = json.loads(
    (Path(__file__).parent.parent / "fixtures" / "cdot_s630_typicals" / "case_18.json").read_text(
        encoding="utf-8"
    )
)
CASE = FIXTURE["case_18"]
RURAL_KEY = CASE["advance_signing_key"]["rows"]["rural"]  # A=B=C=500
OPPOSING = CASE["opposing_approach_advance_set"]


def _ni_body(along: float, cross_road: str = "rural_undivided") -> dict[str, Any]:
    """Rural two-lane-per-direction mainline + one rural cross leg.

    Rural keys both streets at A=B=C=500 (fixture key table), so the
    cross-leg stations must equal the plate's DRAWN dims verbatim.
    """
    return {
        "kind": "near_intersection",
        "meta": {"project": "case-18 typicals match", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": "rural_undivided",
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
                "id": "cross_a",
                "speed": 45,
                "roadType": cross_road,
                "lanesPerDirection": 1,
                "laneWidth": 12.0,
                "signalized": False,
                "bearingDeg": None,
                "alongStationFt": along,
            }
        ],
    }


def _run(body: dict[str, Any]) -> tuple[list[DevicePlacement], dict[str, Any]]:
    scenario = NearIntersectionScenario.model_validate(body)
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    audit = build_audit_trail(placements, params, approaches=kwargs["approaches"])
    return placements, audit


def _mainline(placements: list[DevicePlacement]) -> list[DevicePlacement]:
    return [p for p in placements if p.approach_id == "mainline"]


def _sign_station(placements: list[DevicePlacement], label: str, approach_id: str) -> float:
    hits = [
        p.station_ft
        for p in placements
        if p.approach_id == approach_id
        and p.device_type == DeviceType.SIGN_GENERIC
        and p.label == label
    ]
    assert len(hits) == 1, f"{label}@{approach_id}: {hits}"
    return hits[0]


# ---------------------------------------------------------------------------
# Near side — the plate's own shape (TA-21 reading per match_rules)
# ---------------------------------------------------------------------------


def test_mainline_train_matches_the_feeding_train_sign_sequence():
    """Fixture feeding_approach_closure_train.sign_sequence_outermost_first."""
    placements, _ = _run(_ni_body(along=-200.0))
    expected_order = CASE["feeding_approach_closure_train"]["sign_sequence_outermost_first"]
    # Tool labels: W20-5(R) -> W20-5R, W4-2(R) -> W4-2R (parenthesis-free).
    tool_labels = {"W20-1": "W20-1", "R2-10": "R2-10", "W20-5(R)": "W20-5R", "W4-2(R)": "W4-2R"}
    stations = {
        plate: _sign_station(placements, tool_labels[plate], "mainline") for plate in expected_order
    }
    # Outermost-first = strictly decreasing stations (upstream = larger).
    assert stations["W20-1"] > stations["R2-10"] > stations["W20-5(R)"] > stations["W4-2(R)"], (
        stations
    )


def test_mainline_gaps_are_the_rural_key_and_r2_10_sits_half_c_inside():
    """Gap markers *C/*B/*A read through the fixture's rural key row
    (A=B=C=500), and R2-10 at *1/2C inside the outermost sign (the
    horizontal-train reading, fixture r2_10_position_note)."""
    placements, audit = _run(_ni_body(along=-200.0))
    w20_1 = _sign_station(placements, "W20-1", "mainline")
    w20_5 = _sign_station(placements, "W20-5R", "mainline")
    w4_2 = _sign_station(placements, "W4-2R", "mainline")
    r2_10 = _sign_station(placements, "R2-10", "mainline")
    assert_within(w20_1 - w20_5, RURAL_KEY["C"], name="C gap (W20-1 -> W20-5(R))")
    assert_within(w20_5 - w4_2, RURAL_KEY["B"], name="B gap (W20-5(R) -> W4-2(R))")
    assert_within(w20_1 - r2_10, RURAL_KEY["C"] / 2.0, name="R2-10 at 1/2C inside W20-1")
    # A gap: W4-2(R) sits A upstream of the merging taper start (the
    # taper's most-upstream drum, read from the placements — the audit
    # taper section carries lengths, not stations).
    del audit
    taper_start = max(
        p.station_ft for p in _mainline(placements) if p.device_type == DeviceType.DRUM
    )
    assert_within(w4_2 - taper_start, RURAL_KEY["A"], name="A gap (W4-2(R) -> taper)")


def test_merging_taper_length_matches_the_legend_formula():
    """Legend: L = S x W at >= 45 mph -> 540 ft at 45 mph x 12 ft
    (fixture feeding_approach_closure_train.taper)."""
    placements, _ = _run(_ni_body(along=-200.0))
    drums = sorted(p.station_ft for p in _mainline(placements) if p.device_type == DeviceType.DRUM)
    assert drums, "no merging-taper drums on the mainline"
    assert_within(drums[-1] - drums[0], 45 * 12, name="L = S x W at 45 mph x 12 ft")


def test_cross_leg_matches_the_plate_drawn_dims_verbatim():
    """The plate's opposing-set drawn dims (500'/500'/100') ARE the
    rural key row, so on a rural cross leg the stations equal the
    fixture's drawn_dimensions_ft with no key scaling in between."""
    placements, _ = _run(_ni_body(along=-200.0))
    drawn = OPPOSING["drawn_dimensions_ft"]
    # Approach-frame stations are measured from the intersection curb line.
    assert_within(
        _sign_station(placements, "R2-10", "cross_a"),
        drawn["r2_10_to_intersection"],
        name="cross R2-10 at A (drawn 500')",
    )
    assert_within(
        _sign_station(placements, "W20-1", "cross_a"),
        drawn["w20_1_to_intersection"],
        name="cross W20-1 at 2A (drawn 500' + 500')",
    )
    assert_within(
        _sign_station(placements, "R2-11", "cross_a"),
        drawn["r2_11_past_intersection"],
        name="cross R2-11 at 100' departure",
    )
    r2_11 = [p for p in placements if p.approach_id == "cross_a" and p.label == "R2-11"]
    assert r2_11[0].offset_ft < 0, "R2-11 must sit on the departure side"
    assert set(OPPOSING["sign_sequence_outermost_first"] + [OPPOSING["departure_sign"]]) == {
        "W20-1",
        "R2-10",
        "R2-11",
    }


def test_urban_cross_leg_substitutes_its_key_row_per_note_1():
    """Documented departure 3 / Sheet 10 Note 1: the drawn dims typify
    rural; an urban <= 40 leg substitutes A=100 (fixture key table)."""
    body = _ni_body(along=-200.0, cross_road="urban_arterial")
    body["approaches"][0]["speed"] = 30
    placements, _ = _run(body)
    urban_a = CASE["advance_signing_key"]["rows"]["urban_lte_40mph"]["A"]
    assert_within(_sign_station(placements, "R2-10", "cross_a"), urban_a, name="urban A")
    assert_within(_sign_station(placements, "W20-1", "cross_a"), 2 * urban_a, name="urban 2A")


def test_documented_departures_are_disclosed_not_emitted():
    """Departures 1 and 2 (match_rules): no second closure train on the
    cross street, no opposing-mainline signs — and the disclosure
    voice carries the delta (audit case narrative names the plate's
    corner-quadrant shape and #128)."""
    placements, audit = _run(_ni_body(along=-200.0))
    cross = [p for p in placements if p.approach_id == "cross_a"]
    # Departure 1: advance sets only — exactly three signs, no taper
    # devices, no W20-5/W4-2 on the cross street.
    assert sorted(p.label for p in cross) == ["R2-10", "R2-11", "W20-1"]
    assert all(p.device_type == DeviceType.SIGN_GENERIC for p in cross)
    # Departure 2: every mainline sign sits on the work side (offset > 0).
    for p in _mainline(placements):
        if p.device_type == DeviceType.SIGN_GENERIC:
            assert p.offset_ft > 0, (p.label, p.offset_ft)
    # The disclosure names the corner-quadrant delta and the tracker.
    narrative_2 = audit["case"].get("narrative_2", "")
    assert "128" in narrative_2 and "corner" in narrative_2.lower()


# ---------------------------------------------------------------------------
# Far side — MUTCD Fig. 6P-22 via note 7 + §6N.12.12 (match_rules mapping)
# ---------------------------------------------------------------------------


def test_far_side_companion_is_the_note_7_continuous_channelizer_shape():
    """Fig. 6P-22 note 7: continuous channelizers from the taper end to
    the intersection, resuming past it, and NO turn-bay conversion
    signs (RIGHT LANE MUST TURN RIGHT, R3-7 family)."""
    body = _ni_body(along=900.0)  # > workLen 700 -> far side
    placements, audit = _run(body)
    assert audit["approaches"]["side"] == "far"
    half_cross = 1 * 12.0  # 1 lane/direction x 12 ft (body above)
    upstream_curb = 900.0 + half_cross
    downstream_curb = 900.0 - half_cross
    lane_cones = sorted(
        p.station_ft
        for p in _mainline(placements)
        if p.device_type == DeviceType.CONE and p.station_ft > 700.0
    )
    # Continuous delineation on BOTH sides of the box, none inside it.
    assert any(s > upstream_curb for s in lane_cones), "no cones taper-side of the box"
    assert any(700.0 < s <= downstream_curb for s in lane_cones), "no cones box-to-work-zone"
    assert not [s for s in lane_cones if downstream_curb < s < upstream_curb], (
        "devices inside the intersection box"
    )
    # Note 7's consequence: the turn-bay conversion signs are NOT installed.
    labels = {p.label for p in placements if p.label}
    assert not any(lbl.startswith("R3-7") for lbl in labels), labels


def test_far_side_taper_sits_upstream_of_the_intersection():
    """§6N.12.12: the lane is already closed where it crosses — the
    merging taper's downstream end lies at/above the upstream curb."""
    body = _ni_body(along=900.0)
    placements, _ = _run(body)
    drums = sorted(p.station_ft for p in _mainline(placements) if p.device_type == DeviceType.DRUM)
    assert drums[0] >= 900.0 + 12.0 - 1e-6, drums[:3]


# ---------------------------------------------------------------------------
# The audit cites the fixture's source
# ---------------------------------------------------------------------------


def test_audit_cites_case_18_sheet_10():
    _, audit = _run(_ni_body(along=-200.0))
    label = audit["case"]["case"]
    assert "Case 18" in label
    source = audit["approaches"]["source"]
    assert "Sheet 10" in source and "18/19" in source
