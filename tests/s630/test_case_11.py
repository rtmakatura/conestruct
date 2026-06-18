"""Phase 5 harness for CDOT S-630-1 Sheet 7 Case 11 — general (no
reduction) — plus the Case 11b probe of the diamond-marker branch.

Per match_rules.md the harness reads the placement list directly for
sign-code presence / station / count assertions, and the audit dict for
derived values (case routing, buffer divergence wording, envelope
geometry, operational notes, CO §2B.13 reporting).

Documented variances (per match_rules.md + findings.md) **not** asserted:
    * MUTCD A/B/C advance-warning spacing (1000/1500/2640 ft) vs CDOT
      Sheet 7's 1700/500/VAR/1000/500 — match_rules §"VAR distances".
    * Fines Double envelope generic geometry (500/500/1000 ft) for 11b
      vs Sheet 14 Case 26/27 specific 530/530/260 ft — match_rules
      §"Fines Double envelope geometry".
    * W20-1 leftmost code chosen over W21-5 alternative — Phase 4 locked
      record per match_rules §"W20-1 vs W21-5".
    * G20-1 / G20-2 work-zone boundary marker augmentation (Conestruct
      emits per MUTCD §6F.13/§6F.14; Sheet 7 omits as presentational).
    * Standalone G20-5P emission on no-reduction branch (CO §6C.06(A)
      enforcement vs Sheet 7 fines-double-only depiction) — see
      Surprise S2 in findings.md.

Sunburst / triangle / star / diamond annotations are not assertable —
match_rules §"Sign annotations" treats these as operational notes,
contractor judgement, or conditional-on-reduction (handled via the
``case.routing`` field rather than placement-level annotations).
"""

from __future__ import annotations

from typing import Any

import pytest

from src.rules.validators import DevicePlacement

from ._harness import (
    CASE_11_GENERAL_BODY,
    CASE_11B_BODY,
    assert_mirror_balanced,
    assert_within,
    count_label,
    count_label_prefix,
    placements_and_audit,
    stations_of,
)

# ---------------------------------------------------------------------------
# Module-scoped fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def case_11_general() -> tuple[list[DevicePlacement], dict[str, Any]]:
    return placements_and_audit(CASE_11_GENERAL_BODY)


@pytest.fixture(scope="module")
def case_11b() -> tuple[list[DevicePlacement], dict[str, Any]]:
    return placements_and_audit(CASE_11B_BODY)


# ---------------------------------------------------------------------------
# Case 11 general — shoulder_no_reduction routing
# ---------------------------------------------------------------------------


def test_case_11_general_case_routing_no_reduction(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_11_general
    assert audit["case"]["routing"] == "shoulder_no_reduction"


def test_case_11_general_no_trigger_condition(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # Fixture case_specific_notes: "Case 11 has no 'WITHIN N FT OF
    # TRAVEL WAY' trigger; Cases 26 and 27 do."
    _, audit = case_11_general
    assert "trigger_condition" not in audit["case"]


def test_case_11_general_case_id_text(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # Post-S1: case section narrates the general / no-reduction branch
    # without the "(reduced work-zone speed)" parenthetical.
    _, audit = case_11_general
    assert audit["case"]["case"] == "Case 11: Shoulder closure on divided highway"


def test_case_11_general_emits_w20_1_leftmost(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # Phase 4 locked record — W20-1 over W21-5 per match_rules.
    placements, _ = case_11_general
    assert count_label(placements, "W20-1") == 2


def test_case_11_general_emits_w5_1_mirrored_at_taper_start_plus_500(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G2 — Sheet 7 position 7.  Taper start at 55 mph =
    # wz_len (1000) + buffer (495 silent fallback) + L/3 (183.33) =
    # 1678.33 ft.  W5-1 sits 500 ft upstream of taper start.
    placements, _ = case_11_general
    w5_1_stations = stations_of(placements, "W5-1")
    assert len(w5_1_stations) == 2, f"expected mirrored W5-1, got {w5_1_stations}"
    expected = 1000.0 + 495.0 + (550.0 / 3.0) + 500.0
    for station in w5_1_stations:
        assert_within(station, expected, name="W5-1 station")


def test_case_11_general_diamond_omits_fines_double_section(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # match_rules §"Diamond marker": no speed reduction → fines_double
    # section absent.  findings.md MATCH §"Diamond marker conditional".
    _, audit = case_11_general
    assert "fines_double" not in audit


def test_case_11_general_no_r2_1_emitted(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # Both the downstream R2-1 (diamond conditional) and the entrance
    # R2-1 (Fines Double envelope) are gated on reduced-speed routing.
    placements, _ = case_11_general
    assert count_label(placements, "R2-1") == 0


def test_case_11_general_buffer_silent_fallback_495(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # V1-Wide Item 2 silent-fallback: CDOT supplement does not cover
    # 55 mph for shoulder closure on freeway, so the buffer dict omits
    # divergence/cdot/mutcd keys and uses MUTCD Table 6C-2 directly.
    _, audit = case_11_general
    buffer = audit["buffer"]
    assert buffer["buffer_ft"] == 495.0
    assert "divergence" not in buffer
    assert "cdot_value_ft" not in buffer
    assert "MUTCD Table 6B-2: 495 ft" in buffer["lookup_text"]
    assert "CDOT supplement silent" in buffer["lookup_text"]


def test_case_11_general_omits_w3_5_no_reduction(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G5 gate is the inverse of G2: emitted only on reduced-speed cases.
    placements, _ = case_11_general
    assert count_label_prefix(placements, "W3-5") == 0


def test_case_11_general_mirror_doubling(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    placements, _ = case_11_general
    assert_mirror_balanced(placements)


def test_case_11_general_taper_l_550_within_tolerance(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # L = S × W = 10 × 55 = 550 ft.  L/3 = 183.33 ft (shoulder taper).
    _, audit = case_11_general
    assert_within(audit["taper"]["L_full_ft"], 550.0, name="L")
    assert_within(audit["taper"]["L_required_ft"], 550.0 / 3.0, name="L/3")


def test_case_11_general_co_2b13_no_reduction_wording(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # CO §2B.13(A) check on the no-reduction branch reports the
    # posted-speed-applies wording, not the Δ/N-signs wording.
    _, audit = case_11_general
    detail = audit["colorado"]["checks"][2]["detail"]
    assert "No work-zone speed reduction" in detail
    assert "Posted speed 55 mph" in detail


def test_case_11_general_2640_frequency_check_label(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # The "every 2,640 ft" frequency note from Sheet 7 / 14 surfaces
    # as the CO §6C.06(A) check label.
    _, audit = case_11_general
    label = audit["colorado"]["checks"][1]["label"]
    assert label == "G20-5P construction plaques every 2,640 ft"


def test_case_11_general_second_w21_5aR_with_plaques(
    case_11_general: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G1 — fixture Sheet 7 positions 5 and 6 prescribe two W21-5aR
    # signs.  Conestruct emits two per side (4 total), with W16-2a and
    # W7-3a plaques co-located at the first and second W21-5aR.
    placements, _ = case_11_general
    assert count_label(placements, "W21-5aR") == 4
    assert count_label(placements, "W16-2a") == 2
    assert count_label(placements, "W7-3a") == 2


# ---------------------------------------------------------------------------
# Case 11b — diamond branch probe (reduction 55 → 50)
# ---------------------------------------------------------------------------
# Case 11b shares the Case 11 fixture family (no trigger condition,
# Sheet 7 geometry) but exercises the reduced-speed branch.  Its purpose
# is to validate the diamond conditional, the Fines Double envelope
# generic geometry, and the G4/G5 emissions at a speed (55 mph) where
# no Sheet 14 fixture exists.


def test_case_11b_case_routing_reduced_speed(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_11b
    assert audit["case"]["routing"] == "shoulder_reduced_speed"


def test_case_11b_no_trigger_condition(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # 11b is the Case 11 family — even with a reduction, the trigger
    # condition stays absent (Case 11 has no "WITHIN N FT" predicate).
    _, audit = case_11b
    assert "trigger_condition" not in audit["case"]


def test_case_11b_fines_double_envelope_geometry(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # V1-Wide Item 3 generic envelope at wz_len=1000 ft:
    #   R2-10 at wz_start + 500 = +1500
    #   R2-11 at wz_end   − 500 = −500
    #   downstream R2-1 at wz_end − 1000 = −1000
    _, audit = case_11b
    env = audit["fines_double"]["envelope"]
    assert env["r2_10_station_ft"] == 1500.0
    assert env["r2_11_station_ft"] == -500.0
    assert env["downstream_r2_1_station_ft"] == -1000.0
    assert env["length_ft"] == 2000.0


def test_case_11b_entrance_r2_1_speed_limit_50(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G4 — work-zone entrance R2-1 carries the reduced posted speed.
    _, audit = case_11b
    env = audit["fines_double"]["envelope"]
    assert env["entrance_r2_1_label"] == "SPEED LIMIT 50"
    # Entrance R2-1 co-located with the first internal G20-5P at
    # wz_start − (wz_len / 6) = 1000 − 166.67 = 833.33 ft.
    assert_within(env["entrance_r2_1_station_ft"], 833.33, name="entrance R2-1")


def test_case_11b_downstream_r2_1_speed_limit_55(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # Diamond branch: downstream R2-1 restores the posted speed at
    # wz_end − 1000.
    _, audit = case_11b
    env = audit["fines_double"]["envelope"]
    assert env["downstream_r2_1_label"] == "SPEED LIMIT 55"


def test_case_11b_w3_5_50_emitted(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G5 — W3-5 advisory speed sign tagged with work-zone speed.
    # Mirrored on divided highway: count == 2.
    placements, _ = case_11b
    assert count_label(placements, "W3-5(50)") == 2


def test_case_11b_omits_w5_1_reduced(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G2 gate is freeway × no-reduction; reduced cases omit W5-1
    # (Sheet 14 Case 26/27 do not show W5-1).
    placements, _ = case_11b
    assert count_label(placements, "W5-1") == 0


def test_case_11b_sheet_12_operational_notes_count_4(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_11b
    assert len(audit["fines_double"]["operational_notes"]) == 4


def test_case_11b_co_2b13_check_passes_delta_5(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_11b
    check = audit["colorado"]["checks"][2]
    assert check["pass"] is True
    assert "Δ5 mph" in check["detail"]
    assert "Required: 1. Placed: 1" in check["detail"]


def test_case_11b_buffer_silent_fallback_495(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # 11b is at 55 mph — same silent-fallback shape as Case 11 general.
    _, audit = case_11b
    buffer = audit["buffer"]
    assert buffer["buffer_ft"] == 495.0
    assert "divergence" not in buffer


def test_case_11b_mirror_doubling(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    placements, _ = case_11b
    assert_mirror_balanced(placements)


def test_case_11b_second_w21_5aR_with_plaques(
    case_11b: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G1 propagates to 11b (reduced-speed branch): same shoulder pair
    # emission regardless of routing.
    placements, _ = case_11b
    assert count_label(placements, "W21-5aR") == 4
    assert count_label(placements, "W16-2a") == 2
    assert count_label(placements, "W7-3a") == 2
