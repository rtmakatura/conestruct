"""TA-10 flagger Phase 5 validation harness.

Encodes the committed fixture set (tests/fixtures/ta10_flagger/ —
ta10_basic_flagger.json + match_rules.md locked decisions) as a
regression net, following the shoulder-closure pattern in
``tests/s630/_harness.py``: placement list for sign presence /
stations / counts, audit dict for derived values.

Two scenario layers:

* ``FLAGGER_BASIC_BODY`` — the exact API bridge path
  (FlaggerLaneClosureScenario → scenario_to_call) that production
  serves post gate-flip.  No speed reduction is expressible here: the
  schema carries no ``workZoneSpeed`` (V1 ships basic flagger;
  reduced-speed flagger ships in V1.1 — PR 4 follow-up).
* ``_reduced_params()`` — direct ScenarioParams with
  work_zone_speed_mph, exercising the Fines Double envelope the
  PR 4 schema work will expose.

Numeric conventions per tests/fixtures/ta10_flagger/match_rules.md:
dimensioned fixture values (260 / 500 / 530 / 2,640 ft gaps, the
A/B/C key) assert exactly — the flagger chain is integer-exact, so
the ±10 ft harness tolerance never binds here; band picks (taper 100
of 50–100, flagger +100 of 50–100, standoff 300 of 200–300) assert
the picked value AND band membership so a future re-pick inside the
band fails loudly rather than silently.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.api.audit import audit_projection, build_audit_trail
from src.api.schemas import FlaggerLaneClosureScenario, scenario_to_call
from src.generation.layout import flagger_chain_stations, generate_flagger_alternating_2lane
from src.rules.spacing import buffer_space
from src.rules.validators import DevicePlacement, ScenarioParams, validate_layout
from tests.s630._harness import count_label, count_label_prefix, stations_of

# ---------------------------------------------------------------------------
# Scenario bodies
# ---------------------------------------------------------------------------

# The V1 production surface: rural 2-lane, 45 mph, basic flagger.
# Letter-gap key resolves to rural A=B=C=500 (S-630-1 Sheet 9 KEY TO
# ADVANCE SIGNING DISTANCES, re-verified in the PR 2 Phase A pass).
FLAGGER_BASIC_BODY: dict[str, Any] = {
    "kind": "flagger_lane_closure",
    "meta": {"project": "TA-10 Phase 5 validation"},
    "roadType": "rural_undivided",
    "speed": 45,
    "laneWidth": 11.0,
    "workType": "utility_cut",
    "duration": "short",
    "workLen": 1000.0,
    "night": False,
    "pilotCar": False,
    "afad": False,
    "pedestrianAccess": False,
}

RURAL_ABC = 500.0  # A = B = C for the rural row of the CDOT key
TAPER_FT = 100.0  # one-lane two-way taper, §6B.08 ¶14 band max
FLAGGER_TO_TAPER_FT = 100.0  # Fig. 6P-10 band max
OPPOSING_STANDOFF_FT = 300.0  # Case 17 "200' TO 300'" band max


def flagger_placements_and_audit(
    body: dict[str, Any],
) -> tuple[list[DevicePlacement], dict[str, Any], ScenarioParams]:
    """Bridge-path runner (mirrors _harness.placements_and_audit)."""
    scenario = FlaggerLaneClosureScenario.model_validate(body)
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    audit = build_audit_trail(placements, params)
    return placements, audit, params


def _reduced_params(work_zone_speed: int = 30) -> ScenarioParams:
    """Direct-params reduced scenario (envelope active).

    Bypasses the API bridge: FlaggerLaneClosureScenario has no
    workZoneSpeed field yet (V1.1 / PR 4).
    """
    return ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=1000.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
        work_zone_speed_mph=work_zone_speed,
    )


def _side_stations(placements: list[DevicePlacement], label: str, side: str) -> list[float]:
    """Stations of SIGN_GENERIC placements with ``label`` on one side."""
    sel = (lambda o: o > 0) if side == "right" else (lambda o: o < 0)
    return sorted(
        p.station_ft
        for p in placements
        if p.device_type.value == "SIGN_GENERIC" and p.label == label and sel(p.offset_ft)
    )


# ---------------------------------------------------------------------------
# V1 basic case — sign set, series geometry, taper, flagger stations
# ---------------------------------------------------------------------------


def test_basic_sign_codes_match_fixture() -> None:
    """Sign-code set matches ta10_basic_flagger.json: the 4-sign series
    (W20-1, W20-4, W3-4 per locked OQ-2, W20-7) both directions, plus
    the G20-1/G20-2 pairing and G20-5P plaques.  W16-2P stays a
    documented omission (optional on Fig. 6P-10); R4-1 deferred
    (locked OQ-5); no envelope signs without a reduction."""
    placements, _, _ = flagger_placements_and_audit(FLAGGER_BASIC_BODY)
    codes = {p.label for p in placements if p.device_type.value == "SIGN_GENERIC" and p.label}
    assert codes == {"W20-1", "W20-4", "W3-4", "W20-7", "G20-1", "G20-2", "G20-5P"}
    # Per-direction mirroring: one of each series sign per side.
    for code in ("W20-1", "W20-4", "W3-4", "W20-7"):
        assert len(_side_stations(placements, code, "right")) == 1, code
        assert len(_side_stations(placements, code, "left")) == 1, code


def test_basic_series_letter_gaps_both_directions() -> None:
    """Driver order W20-1 → W20-4 → W3-4 → W20-7 with gaps C / C / B
    anchored on each flagger station (the stop point), rural key
    A = B = C = 500 ft.  Exact per match_rules (key values are
    dimensioned)."""
    placements, _, _ = flagger_placements_and_audit(FLAGGER_BASIC_BODY)
    flaggers = sorted(p.station_ft for p in placements if p.device_type.value == "FLAGGER_STATION")
    flagger_2, flagger_1 = flaggers[0], flaggers[-1]

    # Right/approach direction: stations increase upstream.
    w20_7_r = _side_stations(placements, "W20-7", "right")[0]
    w3_4_r = _side_stations(placements, "W3-4", "right")[0]
    w20_4_r = _side_stations(placements, "W20-4", "right")[0]
    w20_1_r = _side_stations(placements, "W20-1", "right")[0]
    assert w20_7_r - flagger_1 == RURAL_ABC  # A gap, flagger-anchored
    assert w3_4_r - w20_7_r == RURAL_ABC  # B gap
    assert w20_4_r - w3_4_r == RURAL_ABC  # C gap
    assert w20_1_r - w20_4_r == RURAL_ABC  # C gap (no R2-10 insertion)

    # Opposing direction: mirrored off flagger #2, negative stations.
    w20_7_l = _side_stations(placements, "W20-7", "left")[0]
    w3_4_l = _side_stations(placements, "W3-4", "left")[0]
    w20_4_l = _side_stations(placements, "W20-4", "left")[0]
    w20_1_l = _side_stations(placements, "W20-1", "left")[0]
    assert flagger_2 - w20_7_l == RURAL_ABC
    assert w20_7_l - w3_4_l == RURAL_ABC
    assert w3_4_l - w20_4_l == RURAL_ABC
    assert w20_4_l - w20_1_l == RURAL_ABC


def test_basic_taper_geometry() -> None:
    """One-lane two-way taper: 100 ft span, 6 drums at 20 ft (§6B.08
    ¶14: 50–100 ft at ~20 ft; Case 17: short enough to not read as a
    transition).  Span asserts exactly; drum count derives from the
    fixture spacing rule."""
    placements, audit, params = flagger_placements_and_audit(FLAGGER_BASIC_BODY)
    drums = sorted(p.station_ft for p in placements if p.device_type.value == "DRUM")
    span = drums[-1] - drums[0]
    assert span == TAPER_FT
    assert 50.0 <= span <= 100.0  # fixture band
    assert len(drums) == 6
    gaps = [b - a for a, b in zip(drums, drums[1:], strict=False)]
    assert all(gap <= 25.0 for gap in gaps), gaps  # "approximately 20" tolerance
    # Audit agrees.
    assert audit["taper"]["L_required_ft"] == TAPER_FT
    assert audit["taper"]["L_required_label"] == "one-lane two-way taper"
    # Taper start = wz + buffer + taper (audit's own anchor).
    expected_tss = params.work_zone_length_ft + buffer_space(45, jurisdiction="CDOT") + TAPER_FT
    assert drums[-1] == expected_tss


def test_basic_flagger_station_positions() -> None:
    """Approach flagger 100 ft upstream of taper start (Fig. 6P-10
    50–100 ft band); opposing flagger 300 ft past the work-area end
    (Case 17 "200' TO 300'" band).  Picked values exact; band
    membership asserted for the fixture rule."""
    placements, _, params = flagger_placements_and_audit(FLAGGER_BASIC_BODY)
    drums = sorted(p.station_ft for p in placements if p.device_type.value == "DRUM")
    taper_start = drums[-1]
    flaggers = sorted(p.station_ft for p in placements if p.device_type.value == "FLAGGER_STATION")
    assert len(flaggers) == 2
    flagger_2, flagger_1 = flaggers[0], flaggers[-1]
    assert flagger_1 - taper_start == FLAGGER_TO_TAPER_FT
    assert 50.0 <= flagger_1 - taper_start <= 100.0
    assert flagger_2 == -OPPOSING_STANDOFF_FT  # work-area end is station 0
    assert 200.0 <= -flagger_2 <= 300.0
    _ = params


def test_basic_downstream_taper_band() -> None:
    """Downstream device run past the work-area end stays within the
    100 ft max (Case 17 "100' MAX."; §6B.08 ¶12 50–100 ft)."""
    placements, _, _ = flagger_placements_and_audit(FLAGGER_BASIC_BODY)
    ds_cones = [
        p.station_ft for p in placements if p.device_type.value == "CONE" and p.station_ft < 0.0
    ]
    assert ds_cones, "downstream taper cones missing"
    assert min(ds_cones) >= -100.0


def test_basic_mirror_is_per_direction_not_same_station() -> None:
    """Mirroring is full per-direction chains (Case 42 both chains;
    Case 17 'SIGN SEQUENCE IS THE SAME FOR OPPOSITE DIRECTION') — NOT
    the divided-highway same-station left/right convention."""
    placements, _, _ = flagger_placements_and_audit(FLAGGER_BASIC_BODY)
    for code in ("W20-1", "W20-4", "W3-4", "W20-7"):
        right = _side_stations(placements, code, "right")[0]
        left = _side_stations(placements, code, "left")[0]
        assert right > 0 > left, (code, right, left)
        assert right != -left or code == "W20-7", code  # chains anchor differently


def test_basic_no_arrow_board_two_stations() -> None:
    """Flaggers replace the arrow board (fixture
    two_flagger_stations_required); validator-clean layout."""
    placements, _, params = flagger_placements_and_audit(FLAGGER_BASIC_BODY)
    assert not any(p.device_type.value == "ARROW_BOARD" for p in placements)
    errors = [v for v in validate_layout(placements, params) if v.severity == "error"]
    assert errors == [], [v.rule_id for v in errors]


# ---------------------------------------------------------------------------
# V1 basic case — audit surfaces
# ---------------------------------------------------------------------------


def test_basic_audit_references_and_rollup() -> None:
    """TA-10 / S-630-1 citations (PR 3 correction), clean colorado
    checks on a daytime plan, empty pending rollup."""
    placements, audit, _ = flagger_placements_and_audit(FLAGGER_BASIC_BODY)
    assert audit["taper"]["cdot_reference"] == (
        "MUTCD 11th Ed. Part 6 TA-10 (flagger-controlled one-lane two-way operation)"
    )
    assert audit["case"]["case"] == "MUTCD TA-10: Flagger one-lane two-way"
    assert "fines_double" not in audit  # no reduction expressible on V1 bridge

    proj = audit_projection(audit, scenario_kind="flagger_lane_closure", step_count=12)
    assert proj["summary"]["ta"] == "TA-10"
    assert proj["summary"]["cdot_sheet"] == "S-630-1"
    assert proj["summary"]["taper_length_ft"] == TAPER_FT
    assert proj["summary"]["device_spacing_taper_ft"] == 20.0
    assert proj["pending_verification"]["count"] == 0
    assert audit["colorado"]["all_pass"] is True  # day: lighting check n/a-pass
    assert "case_routing" not in proj["summary"]  # no routing field on flagger


def test_basic_night_lighting_honest_fail() -> None:
    """Night basic flagger: the Sheet 2 Note 22 lighting check fails
    honestly (V1 emits no lighting equipment) and the projection
    carries the flagger_lighting_manual_handling pending item."""
    body = dict(FLAGGER_BASIC_BODY, night=True)
    placements, audit, _ = flagger_placements_and_audit(body)
    lighting = next(
        c for c in audit["colorado"]["checks"] if c["label"].startswith("Flagger station lighting")
    )
    assert lighting["pass"] is False
    proj = audit_projection(audit, scenario_kind="flagger_lane_closure", step_count=12)
    kinds = [it["kind"] for it in proj["pending_verification"]["items"]]
    assert "flagger_lighting_manual_handling" in kinds
    _ = placements


# ---------------------------------------------------------------------------
# Reduced-speed case (direct params until PR 4 exposes workZoneSpeed)
# ---------------------------------------------------------------------------


def test_reduced_envelope_chain_insertion_geometry() -> None:
    """Fines Double envelope, Case-42 chain insertion (locked Q8):
    R2-10 exactly 260 ft upstream of W20-4 in each approach chain with
    W20-1 pushed to R2-10 + C; exit per Case 17 — downstream-taper end
    → 500 ft → R2-11 → 500 ft → restoration R2-1.  Dimensioned values
    exact."""
    params = _reduced_params()
    placements = generate_flagger_alternating_2lane(params)

    r2_10_r = _side_stations(placements, "R2-10", "right")[0]
    w20_4_r = _side_stations(placements, "W20-4", "right")[0]
    w20_1_r = _side_stations(placements, "W20-1", "right")[0]
    assert r2_10_r - w20_4_r == 260.0
    assert w20_1_r - r2_10_r == RURAL_ABC

    r2_10_l = _side_stations(placements, "R2-10", "left")[0]
    w20_4_l = _side_stations(placements, "W20-4", "left")[0]
    w20_1_l = _side_stations(placements, "W20-1", "left")[0]
    assert w20_4_l - r2_10_l == 260.0
    assert r2_10_l - w20_1_l == RURAL_ABC

    # Exit chain (right direction): ds-taper end (-50) → 500 → R2-11
    # → 500 → restoration R2-1.
    assert min(_side_stations(placements, "R2-11", "right")) == -550.0
    assert min(_side_stations(placements, "R2-1", "right")) == -1050.0

    # W3-5 per direction at R2-10 + 530·k (Δ=15 → one per side).
    assert count_label_prefix(placements, "W3-5") == 2
    # Assemblies at 2,640 ft intervals across the envelope, both sides.
    assert count_label(placements, "R2-6P") >= 2

    # Validator clean with the fines checks active.
    errors = [v for v in validate_layout(placements, params) if v.severity == "error"]
    assert errors == [], [v.rule_id for v in errors]


def test_reduced_audit_envelope_matches_layout() -> None:
    """Audit fines_double envelope mirrors the placement stations via
    the shared flagger_chain_stations helper; §2B.13(A) check passes
    with Required = Placed; pending rollup empty (day)."""
    params = _reduced_params()
    placements = generate_flagger_alternating_2lane(params)
    audit = build_audit_trail(placements, params)
    st = flagger_chain_stations(params)

    env = audit["fines_double"]["envelope"]
    assert env["r2_10_station_ft"] == st["r2_10_r"]
    assert env["r2_11_station_ft"] == st["r2_11_r"]
    assert env["mirrored_per_direction"] is True
    assert env["r2_10_station_ft_opposing"] == st["r2_10_l"]
    assert env["entrance_r2_1_station_ft"] in stations_of(placements, "R2-1")
    assert len(audit["fines_double"]["operational_notes"]) == 4

    checks = audit["colorado"]["checks"]
    speed_reduction = checks[2]
    assert "Required: 1. Placed: 1." in speed_reduction["detail"]
    assert speed_reduction["pass"] is True

    proj = audit_projection(audit, scenario_kind="flagger_lane_closure", step_count=12)
    assert proj["pending_verification"]["count"] == 0


def test_reduced_stepped_w3_5_sequence() -> None:
    """Δ = 20 (45 → 25) → stepped two-sign W3-5 sequence per direction
    at R2-10 + 530 / + 1,060 ft (G5 formula, 530 ft Sheet 14 anchor)."""
    params = _reduced_params(work_zone_speed=25)
    placements = generate_flagger_alternating_2lane(params)
    assert count_label_prefix(placements, "W3-5") == 4
    r2_10_r = _side_stations(placements, "R2-10", "right")[0]
    right_w3_5 = sorted(
        p.station_ft for p in placements if (p.label or "").startswith("W3-5") and p.offset_ft > 0
    )
    assert right_w3_5 == [r2_10_r + 530.0, r2_10_r + 1060.0]


# ---------------------------------------------------------------------------
# Deferred variants — fixtures committed, routing deferred (V1.1+)
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason=(
        "Deferred to V1.1: curve variant (CDOT S-630-1 Sheet 9 Case 17). "
        "Fixture committed at tests/fixtures/ta10_flagger/cdot_case17_curve.json; "
        "the form captures no horizontal-curve geometry, and the case adds no "
        "sign the basic TA-10 + CDOT overlay does not carry (match_rules.md)."
    )
)
def test_case17_curve_variant() -> None:  # pragma: no cover
    raise NotImplementedError


@pytest.mark.skip(
    reason=(
        "Deferred to V1.1: pilot-car variant (CDOT S-630-1 Sheet 25 Case 42). "
        "Fixture committed at tests/fixtures/ta10_flagger/cdot_case42_pilot_car.json; "
        "pilotCar exists on the form, the pilot vehicle + rear-mounted G20-4 are "
        "narrative field equipment (PR 3), and the in-chain R4-1 / speed-assembly "
        "slots are documented omissions (match_rules.md locked decisions)."
    )
)
def test_case42_pilot_car_variant() -> None:  # pragma: no cover
    raise NotImplementedError


# ---------------------------------------------------------------------------
# Off-page ADVANCE WARNING table — approach station row (PR 5 / UX-09)
# ---------------------------------------------------------------------------
#
# The approach flagger sits at taper_start + 100 (Fig. 6P-10 band max)
# while the schematic's visible extent ends at taper_start + 50, so it
# is off-page on every flagger plan.  Before PR 5 the off-page table
# was signs-only and the station vanished from page 1 entirely (UX
# audit finding UX-09); these tests lock the row in.


def _offpage_rows(
    placements: list[DevicePlacement], params: ScenarioParams
) -> list[tuple[str, str, float]]:
    """Run the production mapping → table path on a placement list."""
    from src.rendering.plan_sheet import _build_advance_warning_table, _make_x_mapping

    mapping = _make_x_mapping(placements, params, params.shoulder_width_ft)
    return _build_advance_warning_table(
        placements,
        mapping["taper_start_station"],
        mapping["station_max_visible"],
        params,
    )


def test_offpage_table_lists_approach_flagger_first() -> None:
    """UX-09: the approach flagger station is a table row, not a silent drop.

    Exactly one station row (the opposing station draws on-page at a
    negative station), CODE "—" (a flagger is a person, not an MUTCD
    code), #1 numbering matching the narrative convention (#1 = max
    station = approach side), distance = the Fig. 6P-10 +100 ft band
    max — sorted first as the closest off-page entry.
    """
    placements, _, params = flagger_placements_and_audit(FLAGGER_BASIC_BODY)
    rows = _offpage_rows(placements, params)

    station_rows = [r for r in rows if r[0] == "—"]
    assert station_rows == [("—", "FLAGGER STATION #1 (APPROACH)", FLAGGER_TO_TAPER_FT)]
    assert rows[0] == station_rows[0]  # closest-first puts it on top

    # The sign rows are untouched by the widened filter: same four-sign
    # upstream series the table carried before PR 5.
    assert [r[0] for r in rows[1:]] == ["W20-7", "W3-4", "W20-4", "W20-1"]


def test_offpage_table_afad_variant() -> None:
    """The AFAD form (live "Use AFAD" toggle) gets the same treatment."""
    placements, _, params = flagger_placements_and_audit(dict(FLAGGER_BASIC_BODY, afad=True))
    rows = _offpage_rows(placements, params)

    station_rows = [r for r in rows if r[0] == "—"]
    assert station_rows == [("—", "AFAD #1 (APPROACH)", FLAGGER_TO_TAPER_FT)]


def test_offpage_table_shoulder_has_no_station_rows() -> None:
    """Non-flagger regression: shoulder plans emit zero station rows."""
    from src.api.schemas import ShoulderScenario
    from tests.s630._harness import CASE_11_GENERAL_BODY

    scenario = ShoulderScenario.model_validate(CASE_11_GENERAL_BODY)
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    rows = _offpage_rows(placements, params)

    assert rows  # the table itself is populated…
    assert all(r[0] != "—" for r in rows)  # …with sign rows only
