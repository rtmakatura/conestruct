"""Shared edge-case verification harness.

Runs a single shoulder-closure scenario through the public Python API
and prints the same structured output the verify_i25.py / verify_us85.py
scripts produce, plus a hand-calc comparison block.

Each thin wrapper script (verify_25mph_urban.py, etc.) declares its
parameters + expected hand calculations and calls ``run_scenario``.
"""

from __future__ import annotations

import sys
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.api.audit import build_audit_trail
from src.export.quote_generator import generate_quote
from src.generation.layout import (
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
)
from src.rules.spacing import (
    advance_warning_spacing,
    device_spacing_in_taper,
    device_spacing_on_tangent,
)
from src.rules.validators import ScenarioParams, validate_layout


@dataclass
class Expected:
    L_full_ft: float
    L_third_ft: float
    buffer_ft: float
    advance_A: float
    advance_B: float
    advance_C: float
    spacing_in_taper_ft: float
    spacing_on_tangent_ft: float
    n_taper_drums: int
    n_tangent_cones_total: int  # tangent line + downstream-taper cones
    formula_kind: str  # "linear" or "quadratic"


def _section(title: str) -> None:
    bar = "=" * 78
    print(f"\n{bar}\n{title}\n{bar}")


def _counts(placements):
    return Counter((p.device_type.value, p.label or "") for p in placements)


def _print_breakdown(label, placements):
    counts = _counts(placements)
    print(f"\n{label} — total = {len(placements)}")
    for (dt, lbl), n in sorted(counts.items()):
        print(f"  {n:>3} × {dt:<24} {lbl}")


def _print_violations(violations):
    if not violations:
        print("  (no validation issues)")
        return
    for v in violations:
        print(f"  [{v.severity.upper()}] {v.rule_id} ({v.mutcd_section}): {v.message}")


def _check(label, actual, expected, tol=0.01):
    delta = actual - expected
    ok = abs(delta) <= tol
    icon = "PASS" if ok else "FAIL"
    print(f"  [{icon}] {label}: actual={actual:.2f}, expected={expected:.2f}, delta={delta:+.2f}")
    return ok


def run_scenario(
    *,
    scenario_name: str,
    speed_mph: int,
    num_lanes: int,
    road_type: str,
    work_zone_length_ft: float,
    lane_width_ft: float,
    shoulder_width_ft: float,
    is_divided: bool,
    expected: Expected,
    is_night: bool = False,
):
    params = ScenarioParams(
        speed_mph=speed_mph,
        num_lanes=num_lanes,
        closure_type="shoulder",
        road_type=road_type,
        work_zone_length_ft=work_zone_length_ft,
        lane_width_ft=lane_width_ft,
        shoulder_width_ft=shoulder_width_ft,
        is_night=is_night,
        is_divided=is_divided,
        jurisdiction="CDOT",
    )

    if is_divided:
        placements = generate_shoulder_closure_divided(params, shoulder_width_ft=shoulder_width_ft)
    else:
        placements = generate_shoulder_closure_undivided(
            params, shoulder_width_ft=shoulder_width_ft
        )

    violations = validate_layout(placements, params)
    audit = build_audit_trail(placements, params, shoulder_width_ft=shoulder_width_ft)

    _section(
        f"TEST 1 — {scenario_name} (speed={speed_mph}, road_type={road_type}, "
        f"is_divided={is_divided})"
    )
    print(f"Total devices: {len(placements)}")
    _print_breakdown(f"Breakdown — {scenario_name}", placements)

    # Sign side analysis (right vs. left)
    signs = [p for p in placements if p.device_type.value == "SIGN_GENERIC"]
    n_right = sum(1 for s in signs if s.offset_ft > 0)
    n_left = sum(1 for s in signs if s.offset_ft < 0)
    n_center = sum(1 for s in signs if s.offset_ft == 0)
    print(f"\nSign side analysis: {n_right} right, {n_left} left, {n_center} centerline")

    t = audit["taper"]
    b = audit["buffer"]
    sp = audit["spacing"]
    adv = audit["advance"]
    co = audit["colorado"]

    print("\nTaper:")
    print(f"  L_full = {t['L_full_ft']:.2f} ft   (expected {expected.L_full_ft:.2f})")
    print(f"  L/3   = {t['L_third_ft']:.2f} ft   (expected {expected.L_third_ft:.2f})")
    print(f"  L_required = {t['L_required_ft']:.2f} ft ({t['L_required_label']})")
    print(f"  Formula choice: {t['formula_choice']}")
    print(f"  Expected formula kind: {expected.formula_kind}")

    print("\nBuffer:")
    print(f"  buffer_ft = {b['buffer_ft']:.2f} ft   (expected {expected.buffer_ft:.2f})")
    print(f"  source: {b['lookup_text']}")

    print("\nAdvance warning (audit trail):")
    print(f"  road_type_text: {adv['road_type_text']}")
    print(f"  spacing_text:   {adv['spacing_text']}")
    print(
        f"  expected: A={expected.advance_A:.0f} B={expected.advance_B:.0f} "
        f"C={expected.advance_C:.0f}"
    )
    for row in adv["sign_table"]:
        print(f"    {row}")

    print("\nSpacing summary:")
    print(f"  in-taper:   {sp['in_taper_text']}")
    print(f"  on-tangent: {sp['on_tangent_text']}")
    print(
        f"  taper drums (req/actual): {sp['n_taper_drums_required']} / "
        f"{sp['n_taper_drums_actual']}   (expected actual {expected.n_taper_drums})"
    )
    print(
        f"  tangent cones (req/actual): {sp['n_tangent_cones_required']} / "
        f"{sp['n_tangent_cones_actual']}"
    )

    print("\nColorado supplement checks:")
    for chk in co["checks"]:
        icon = "PASS" if chk["pass"] else "FAIL"
        print(f"  [{icon}] {chk['label']} ({chk['citation']}) — {chk['detail']}")
    for item in co.get("info_items", []):
        print(f"  [INFO] {item['label']} ({item['citation']}) — {item['detail']}")

    print("\nValidation:")
    _print_violations(violations)

    stations = [p.station_ft for p in placements]
    print(
        f"\nStation range: min={min(stations):.1f} ft  max={max(stations):.1f} ft  "
        f"corridor={(max(stations) - min(stations)):.1f} ft"
    )

    # Quote (day vs night for the same params)
    params_night = ScenarioParams(
        speed_mph=speed_mph,
        num_lanes=num_lanes,
        closure_type="shoulder",
        road_type=road_type,
        work_zone_length_ft=work_zone_length_ft,
        lane_width_ft=lane_width_ft,
        shoulder_width_ft=shoulder_width_ft,
        is_night=True,
        is_divided=is_divided,
        jurisdiction="CDOT",
    )
    if is_divided:
        placements_night = generate_shoulder_closure_divided(
            params_night, shoulder_width_ft=shoulder_width_ft
        )
    else:
        placements_night = generate_shoulder_closure_undivided(
            params_night, shoulder_width_ft=shoulder_width_ft
        )

    with tempfile.TemporaryDirectory() as td:
        _, qb_day = generate_quote(
            placements,
            params,
            output_path=str(Path(td) / "q_day.xlsx"),
            project_name=f"{scenario_name} Day",
            project_duration_days=1,
            num_flaggers=0,
        )
        _, qb_night = generate_quote(
            placements_night,
            params_night,
            output_path=str(Path(td) / "q_night.xlsx"),
            project_name=f"{scenario_name} Night",
            project_duration_days=1,
            num_flaggers=0,
        )
    print(
        f"\nQuote (day): equip ${qb_day.equipment_total:,.0f}  "
        f"labor ${qb_day.labor_total:,.0f}  total ${qb_day.total:,.0f}"
    )
    print(
        f"Quote (night): equip ${qb_night.equipment_total:,.0f}  "
        f"labor ${qb_night.labor_total:,.0f}  total ${qb_night.total:,.0f}"
    )
    print(f"Day total devices: {len(placements)}, Night total devices: {len(placements_night)}")

    # Hand-calc comparison
    _section("TEST — hand-calculation comparison")
    cone_total = sum(1 for p in placements if p.device_type.value == "CONE")
    drum_total = sum(1 for p in placements if p.device_type.value == "DRUM")
    results = []
    results.append(_check("L_full (taper)", t["L_full_ft"], expected.L_full_ft))
    results.append(_check("L/3 (shoulder taper)", t["L_third_ft"], expected.L_third_ft))
    results.append(_check("buffer", b["buffer_ft"], expected.buffer_ft))
    results.append(
        _check(
            "device_spacing_in_taper",
            device_spacing_in_taper(speed_mph),
            expected.spacing_in_taper_ft,
        )
    )
    results.append(
        _check(
            "device_spacing_on_tangent",
            device_spacing_on_tangent(speed_mph),
            expected.spacing_on_tangent_ft,
        )
    )
    results.append(_check("taper drums (count)", float(drum_total), float(expected.n_taper_drums)))
    results.append(
        _check(
            "tangent cones (count, incl. ds-taper)",
            float(cone_total),
            float(expected.n_tangent_cones_total),
        )
    )
    results.append(
        _check(
            "advance A",
            advance_warning_spacing(speed_mph, road_type)["A"],
            expected.advance_A,
        )
    )
    results.append(
        _check(
            "advance B",
            advance_warning_spacing(speed_mph, road_type)["B"],
            expected.advance_B,
        )
    )
    results.append(
        _check(
            "advance C",
            advance_warning_spacing(speed_mph, road_type)["C"],
            expected.advance_C,
        )
    )

    ok_count = sum(results)
    print(f"\n  {ok_count}/{len(results)} hand-calc checks passed.")

    # Critical checks summary
    _section("CRITICAL CHECKS")
    n_errors = sum(1 for v in violations if v.severity == "error")
    n_warnings = sum(1 for v in violations if v.severity == "warning")
    co_pass = next(
        (chk["pass"] for chk in co["checks"] if "both sides" in chk["label"].lower()),
        None,
    )
    print(f"  validator errors:   {n_errors}")
    print(f"  validator warnings: {n_warnings}")
    print(f"  §6C.04(A) audit:    {co_pass}")
    print(f"  signs right/left:   {n_right} / {n_left}")
    if is_divided:
        print("  is_divided=True -> expect §6C.04(A) PASS and balanced sign sides")
        if co_pass is not True:
            print("    !! §6C.04(A) did NOT pass !!")
        if n_left == 0:
            print("    !! No left-side signs on a divided plan !!")
    else:
        print("  is_divided=False -> expect §6C.04(A) check skipped/PASS, all signs right-side")
        if n_left > 0:
            print(f"    !! {n_left} left-side signs on an undivided plan !!")
    print(
        f"  formula choice text: {t['formula_choice']!r}  (expected kind: {expected.formula_kind})"
    )
