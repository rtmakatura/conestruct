"""Shared scaffolding for the S-630-1 typical-application validation harness.

Phase 5 of the S-630-1 validation work encodes the Phase 4 findings
(validation-artifacts/s630_typicals/findings.md) against the three case
fixtures + the Case 11b probe.  Conventions per match_rules.md:

* ``placements_and_audit(body)`` returns both surfaces from a single
  generator+audit invocation.  Per-case test functions choose which to
  read for each assertion (placement list for sign-code presence,
  stations, and counts; audit dict for derived values like taper L,
  buffer divergence wording, envelope geometry, case routing, trigger
  conditions, operational notes).
* Numeric tolerance: ±10 ft for computed station/taper distances.
  Table lookups and structured audit fields (buffer values, divergence
  flag, routing strings, frequency-note text) are asserted exactly.
* The four scenario bodies are identical in shape to the Phase 3
  research artifacts (validation-artifacts/s630_typicals/_generate_outputs.py)
  so the harness asserts against the same code path Phase 4 documented.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.api.audit import build_audit_trail
from src.api.schemas import ShoulderScenario, scenario_to_call
from src.rules.validators import DevicePlacement


def _common(speed: int, work_zone_speed: int | None) -> dict[str, Any]:
    """Scenario body shared across all four S-630-1 fixtures.

    Matches ``validation-artifacts/s630_typicals/_generate_outputs.py``
    so the harness exercises the same code path Phase 4 audited.
    """
    body: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "S-630-1 validation"},
        "roadType": "freeway",
        "speed": speed,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }
    if work_zone_speed is not None:
        body["workZoneSpeed"] = work_zone_speed
    return body


CASE_11_GENERAL_BODY = _common(55, None)
CASE_11B_BODY = _common(55, 50)
CASE_26_BODY = _common(65, 60)
CASE_27_BODY = _common(75, 65)


def placements_and_audit(
    body: dict[str, Any],
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """Run a scenario through the live generator + audit pipeline.

    Mirrors ``_dump_placements.py``'s in-process path (no FastAPI
    round-trip) so the harness exercises ``generate_shoulder_closure_*``
    and ``build_audit_trail`` directly.

    The returned audit dict is ``build_audit_trail``'s raw output — i.e.
    the section-keyed dict (``case``, ``buffer``, ``fines_double``,
    ``taper``, ``colorado``, ...).  The ``/render/audit`` endpoint nests
    this under ``"sections"`` and adds ``"summary"`` /
    ``"pending_verification"`` wrappers; the harness does not.
    """
    scenario = ShoulderScenario.model_validate(body)
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    audit = build_audit_trail(placements, params)
    return placements, audit


# ---------------------------------------------------------------------------
# Placement-list helpers
# ---------------------------------------------------------------------------


def count_label(placements: list[DevicePlacement], label: str) -> int:
    """Number of SIGN_GENERIC placements with an exact label match."""
    return sum(1 for p in placements if p.device_type.value == "SIGN_GENERIC" and p.label == label)


def count_label_prefix(placements: list[DevicePlacement], prefix: str) -> int:
    """Number of SIGN_GENERIC placements whose label starts with ``prefix``.

    Used for W3-5(NN) advisory-speed signs where the suffix carries the
    work-zone posted speed and varies per scenario.
    """
    return sum(
        1
        for p in placements
        if p.device_type.value == "SIGN_GENERIC"
        and p.label is not None
        and p.label.startswith(prefix)
    )


def stations_of(placements: list[DevicePlacement], label: str) -> list[float]:
    return sorted(
        p.station_ft
        for p in placements
        if p.device_type.value == "SIGN_GENERIC" and p.label == label
    )


def assert_within(actual: float, expected: float, tol: float = 10.0, name: str = "") -> None:
    """±tol-ft tolerance check per match_rules.md §"Numeric tolerance"."""
    assert actual == pytest.approx(expected, abs=tol), (
        f"{name or 'value'}: expected {expected} ± {tol}, got {actual}"
    )


def assert_mirror_balanced(placements: list[DevicePlacement]) -> None:
    """Every SIGN_GENERIC label emitted on a divided highway must have
    matching counts on the positive-offset and negative-offset sides.

    Per CO Supplement §6C.04(A): signs on both sides of divided highway.
    Implements the divided-highway mirror check at placement-list level.
    """
    labels: set[str] = {
        p.label
        for p in placements
        if p.device_type.value == "SIGN_GENERIC" and p.label is not None and p.offset_ft != 0
    }
    imbalances: list[str] = []
    for label in sorted(labels):
        right = sum(
            1
            for p in placements
            if p.device_type.value == "SIGN_GENERIC" and p.label == label and p.offset_ft > 0
        )
        left = sum(
            1
            for p in placements
            if p.device_type.value == "SIGN_GENERIC" and p.label == label and p.offset_ft < 0
        )
        if right != left:
            imbalances.append(f"  {label}: right={right} left={left}")
    assert not imbalances, "Mirror imbalance on divided highway:\n" + "\n".join(imbalances)
