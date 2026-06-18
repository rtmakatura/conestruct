"""Phase 5 harness for CDOT S-630-1 Sheet 14 Case 26 — shoulder work,
freeway/expressway, 65 mph posted with 60 mph work-zone reduction.

Documented variances (per match_rules.md + findings.md) **not** asserted:
    * Fines Double envelope distances 530/530/260 (Sheet 14 Case 26)
      vs Conestruct's 500/500/1000 generic geometry — match_rules
      §"Fines Double envelope geometry".
    * MUTCD A/B/C advance-warning spacing (1000/1500/2640 ft) vs Sheet
      14 530/260/260/260/530 — match_rules §"VAR distances (Case 11)"
      total-span rule applies.
    * W20-1 leftmost code (Phase 4 lock).
    * "ROAD WORK 1 MILE" wording vs fixture "ROAD WORK 1/2 MILE" — code
      match, wording variance per SPEC_INTERPRETATION.
    * G20-1 / G20-2 work-zone-boundary marker augmentation.
    * First W21-5aR plaque code: Conestruct uniformly emits W16-2a
      across all four shoulder cases per the deterministic-pick
      decision; Sheet 14 offers W16-2aP / W16-3aP / W16-9P (contractor
      pick).  Code-match (W16 family); literal-text variance.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.rules.validators import DevicePlacement

from ._harness import (
    CASE_26_BODY,
    assert_mirror_balanced,
    assert_within,
    count_label,
    placements_and_audit,
)


@pytest.fixture(scope="module")
def case_26() -> tuple[list[DevicePlacement], dict[str, Any]]:
    return placements_and_audit(CASE_26_BODY)


# ---------------------------------------------------------------------------
# Case + routing
# ---------------------------------------------------------------------------


def test_case_26_case_routing_reduced_speed(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_26
    assert audit["case"]["routing"] == "shoulder_reduced_speed"


def test_case_26_trigger_condition_within_8_ft_exact(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G6 — fixture case_26.trigger_condition verbatim.
    _, audit = case_26
    assert audit["case"]["trigger_condition"] == (
        "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 8 FT OF TRAVEL WAY"
    )


def test_case_26_case_id_at_65(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # S1 — post-routing case section narrates the Case 26 family
    # rather than the hard-coded "Case 11" pre-S1 default.
    _, audit = case_26
    assert audit["case"]["case"] == (
        "Case 26 at 65 mph: Shoulder closure with reduced work-zone speed"
    )


# ---------------------------------------------------------------------------
# Sign-code emissions
# ---------------------------------------------------------------------------


def test_case_26_emits_w20_1_leftmost(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    placements, _ = case_26
    assert count_label(placements, "W20-1") == 2


def test_case_26_w3_5_60_emitted(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G5 — fixture Sheet 14 position 2: W3-5(60) at 65 → 60 reduction.
    placements, _ = case_26
    assert count_label(placements, "W3-5(60)") == 2


def test_case_26_entrance_r2_1_speed_limit_60(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G4 — fixture Sheet 14 position 5: G20-5P + R2-1(60).  Conestruct
    # surfaces the entrance R2-1 in the envelope dict with the reduced
    # work-zone speed; placement label is bare "R2-1".
    _, audit = case_26
    env = audit["fines_double"]["envelope"]
    assert env["entrance_r2_1_label"] == "SPEED LIMIT 60"
    assert_within(env["entrance_r2_1_station_ft"], 833.33, name="entrance R2-1")


def test_case_26_downstream_r2_1_speed_limit_65_at_minus_1000(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # Diamond branch: downstream R2-1 restores the posted speed 65 mph.
    _, audit = case_26
    env = audit["fines_double"]["envelope"]
    assert env["downstream_r2_1_label"] == "SPEED LIMIT 65"
    assert env["downstream_r2_1_station_ft"] == -1000.0


def test_case_26_r2_11_at_minus_500(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_26
    assert audit["fines_double"]["envelope"]["r2_11_station_ft"] == -500.0


def test_case_26_r2_10_at_plus_500(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # R2-10 at wz_start + 500.  wz_start = workLen = 1000 ft, so 1500.
    _, audit = case_26
    assert audit["fines_double"]["envelope"]["r2_10_station_ft"] == 1500.0


def test_case_26_omits_w5_1_reduced(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G2 gate is freeway × no-reduction; Case 26 is reduced → omit.
    placements, _ = case_26
    assert count_label(placements, "W5-1") == 0


# ---------------------------------------------------------------------------
# Derived values (taper / buffer)
# ---------------------------------------------------------------------------


def test_case_26_taper_l_650_l3_217_within_tolerance(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # Fixture case_26.taper.for_W_10ft_at_65mph: L=650, L/3=217.
    # ±10 ft per match_rules §"Numeric tolerance".
    _, audit = case_26
    assert_within(audit["taper"]["L_full_ft"], 650.0, name="L")
    assert_within(audit["taper"]["L_required_ft"], 650.0 / 3.0, name="L/3")


def test_case_26_buffer_570_mutcd_645_divergence_true(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # V1-Wide Item 2: CDOT supplement 570 ft at 65 mph diverges from
    # MUTCD Table 6C-2's 645 ft.  Match_rules §"Buffer space" requires
    # CDOT value when jurisdiction = CDOT.
    _, audit = case_26
    buffer = audit["buffer"]
    assert buffer["buffer_ft"] == 570.0
    assert buffer["cdot_value_ft"] == 570
    assert buffer["mutcd_value_ft"] == 645
    assert buffer["divergence"] is True
    assert buffer["jurisdiction"] == "CDOT"


# ---------------------------------------------------------------------------
# Compliance + structure
# ---------------------------------------------------------------------------


def test_case_26_mirror_doubling(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    placements, _ = case_26
    assert_mirror_balanced(placements)


def test_case_26_sheet_12_operational_notes_count_4(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_26
    assert len(audit["fines_double"]["operational_notes"]) == 4


def test_case_26_2640_frequency_check_label(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_26
    label = audit["colorado"]["checks"][1]["label"]
    assert label == "G20-5P construction plaques every 2,640 ft"


def test_case_26_co_2b13_delta_5_check_passes(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_26
    check = audit["colorado"]["checks"][2]
    assert check["pass"] is True
    assert "Δ5 mph" in check["detail"]
    assert "Required: 1. Placed: 1" in check["detail"]


# ---------------------------------------------------------------------------
# G1 — second W21-5aR + plaques (#45 closed)
# ---------------------------------------------------------------------------


def test_case_26_two_w21_5aR_with_plaques(
    case_26: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # Fixture Sheet 14 positions 4 and 6 — two W21-5aR signs per side.
    # Conestruct emits W16-2a uniformly under position 4 (deterministic
    # pick from Sheet 14's W16-2aP / W16-3aP / W16-9P contractor-pick
    # set) and W7-3a under position 6.
    placements, _ = case_26
    assert count_label(placements, "W21-5aR") == 4
    assert count_label(placements, "W16-2a") == 2
    assert count_label(placements, "W7-3a") == 2
