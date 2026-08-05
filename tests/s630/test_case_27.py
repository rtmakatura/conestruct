"""Phase 5 harness for CDOT S-630-1 Sheet 14 Case 27 — shoulder work,
freeway/expressway, 75 mph posted with 65 mph work-zone reduction.

Case 27 is the 75 mph variant of Case 26; structure identical, speed-
dependent values (trigger 10 ft, L=750 / L3=250, buffer 650 / MUTCD
820) differ.  Documented variances are the same as Case 26 — see
``test_case_26.py`` docstring for the full list.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.rules.validators import DevicePlacement

from ._harness import (
    CASE_27_BODY,
    assert_mirror_balanced,
    assert_within,
    count_label,
    placements_and_audit,
)


@pytest.fixture(scope="module")
def case_27() -> tuple[list[DevicePlacement], dict[str, Any]]:
    return placements_and_audit(CASE_27_BODY)


# ---------------------------------------------------------------------------
# Case + routing
# ---------------------------------------------------------------------------


def test_case_27_case_routing_reduced_speed(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_27
    assert audit["case"]["routing"] == "shoulder_reduced_speed"


def test_case_27_trigger_condition_within_10_ft_exact(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G6 — fixture case_27.trigger_condition verbatim.
    _, audit = case_27
    assert audit["case"]["trigger_condition"] == (
        "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 10 FT OF TRAVEL WAY"
    )


def test_case_27_case_id_at_75(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_27
    assert audit["case"]["case"] == (
        "Case 27 at 75 mph: Shoulder closure with reduced work-zone speed"
    )


# ---------------------------------------------------------------------------
# Sign-code emissions
# ---------------------------------------------------------------------------


def test_case_27_emits_w20_1_leftmost(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    placements, _ = case_27
    assert count_label(placements, "W20-1") == 2


def test_case_27_w3_5_65_emitted(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G5 — fixture Sheet 14 position 2: W3-5(65) at 75 → 65 reduction.
    placements, _ = case_27
    assert count_label(placements, "W3-5(65)") == 2


def test_case_27_entrance_r2_1_speed_limit_65(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # G4 — fixture Sheet 14 position 5: G20-5P + R2-1(65) at the
    # reduced work-zone speed.
    _, audit = case_27
    env = audit["fines_double"]["envelope"]
    assert env["entrance_r2_1_label"] == "SPEED LIMIT 65"
    assert_within(env["entrance_r2_1_station_ft"], 833.33, name="entrance R2-1")


def test_case_27_downstream_r2_1_speed_limit_75_at_minus_1000(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_27
    env = audit["fines_double"]["envelope"]
    assert env["downstream_r2_1_label"] == "SPEED LIMIT 75"
    assert env["downstream_r2_1_station_ft"] == -1000.0


def test_case_27_r2_11_at_minus_500(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_27
    assert audit["fines_double"]["envelope"]["r2_11_station_ft"] == -500.0


def test_case_27_r2_10_at_plus_500(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_27
    assert audit["fines_double"]["envelope"]["r2_10_station_ft"] == 1500.0


def test_case_27_omits_w5_1_reduced(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    placements, _ = case_27
    assert count_label(placements, "W5-1") == 0


# ---------------------------------------------------------------------------
# Derived values (taper / buffer)
# ---------------------------------------------------------------------------


def test_case_27_taper_l_750_l3_250_within_tolerance(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # Fixture case_27.taper.for_W_10ft_at_75mph: L=750, L/3=250.
    _, audit = case_27
    assert_within(audit["taper"]["L_full_ft"], 750.0, name="L")
    assert_within(audit["taper"]["L_required_ft"], 250.0, name="L/3")


def test_case_27_buffer_650_mutcd_820_divergence_true(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # V1-Wide Item 2 at 75 mph: CDOT supplement 650 ft vs MUTCD Table
    # 6C-2's 820 ft.  CDOT supplement is more permissive than the
    # federal table at this speed.
    _, audit = case_27
    buffer = audit["buffer"]
    assert buffer["buffer_ft"] == 650.0
    assert buffer["cdot_value_ft"] == 650
    assert buffer["mutcd_value_ft"] == 820
    assert buffer["divergence"] is True
    assert buffer["jurisdiction"] == "CDOT"


# ---------------------------------------------------------------------------
# Compliance + structure
# ---------------------------------------------------------------------------


def test_case_27_mirror_doubling(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    placements, _ = case_27
    assert_mirror_balanced(placements)


def test_case_27_sheet_12_operational_notes_count_4(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_27
    assert len(audit["fines_double"]["operational_notes"]) == 4


def test_case_27_2640_frequency_check_label(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_27
    label = audit["colorado"]["checks"][1]["label"]
    assert label == "G20-5P Work Zone signs every 2,640 ft"


def test_case_27_co_2b13_delta_10_check_passes(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    _, audit = case_27
    check = audit["colorado"]["checks"][2]
    assert check["pass"] is True
    assert "Δ10 mph" in check["detail"]
    assert "Required: 1. Placed: 1" in check["detail"]


# ---------------------------------------------------------------------------
# G1 — second W21-5aR + plaques (#45 closed)
# ---------------------------------------------------------------------------


def test_case_27_two_w21_5aR_with_plaques(
    case_27: tuple[list[DevicePlacement], dict[str, Any]],
) -> None:
    # Sheet 14 position 4 / 6 — same shape as Case 26.  W16-2a is the
    # deterministic V1 pick from Sheet 14's contractor-pick set.
    placements, _ = case_27
    assert count_label(placements, "W21-5aR") == 4
    assert count_label(placements, "W16-2a") == 2
    assert count_label(placements, "W7-3a") == 2
