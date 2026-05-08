"""US-85 NB Brighton verification harness — same shape as verify_i25.py
but at 65 mph on a rural divided highway (NOT a freeway).

Run from project root:  uv run python scripts/verify_us85.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.api.audit import build_audit_trail
from src.export.quote_generator import generate_quote
from src.generation.layout import generate_shoulder_closure_divided
from src.rules.site_detection import detect_site_conditions
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    device_spacing_in_taper,
    device_spacing_on_tangent,
    shoulder_taper_length,
    taper_length,
)
from src.rules.validators import ScenarioParams, validate_layout

# --------------------------------------------------------------------------
# Project parameters — US-85 NB shoulder closure north of Brighton, CO
# --------------------------------------------------------------------------
LAT, LNG = 39.9714, -104.8205
SPEED = 65
NUM_LANES = 2
WORK_LEN = 1000.0
LANE_WIDTH = 12.0
SHOULDER_WIDTH = 10.0
ROAD_TYPE = "rural"  # US-85 is rural divided, NOT a freeway

EXPECTED = {
    "L_full_ft": 10 * 65,  # 650
    "L_third_ft": (10 * 65) / 3,  # 216.67
    "buffer_ft": 645.0,  # MUTCD Table 6B-2 @ 65 mph
    "advance_A": 500.0,  # rural at 65 mph
    "advance_B": 500.0,
    "advance_C": 500.0,
    "spacing_in_taper_ft": 65.0,  # MUTCD §6C.09 (= speed)
    "spacing_on_tangent_ft": 130.0,  # 2 × speed
    "n_taper_drums": 5,  # ~43 ft spacing
    "n_tangent_cones": 8,  # ~125 ft spacing
}


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


def build_params(road_type: str, *, is_night: bool = False) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=SPEED,
        num_lanes=NUM_LANES,
        closure_type="shoulder",
        road_type=road_type,
        work_zone_length_ft=WORK_LEN,
        lane_width_ft=LANE_WIDTH,
        shoulder_width_ft=SHOULDER_WIDTH,
        is_night=is_night,
        is_divided=True,
        jurisdiction="CDOT",
    )


# ---------- TEST 1: baseline ----------
_section(f"TEST 1 — baseline (road_type={ROAD_TYPE}, day shift, 65 mph)")
params = build_params(ROAD_TYPE)
placements = generate_shoulder_closure_divided(params, shoulder_width_ft=SHOULDER_WIDTH)
violations = validate_layout(placements, params)

print(f"Total devices: {len(placements)}")
_print_breakdown(f"Breakdown — road_type={ROAD_TYPE}", placements)

audit = build_audit_trail(placements, params, shoulder_width_ft=SHOULDER_WIDTH)
t = audit["taper"]
b = audit["buffer"]
sp = audit["spacing"]
adv = audit["advance"]
co = audit["colorado"]

print("\nTaper:")
print(f"  L_full = {t['L_full_ft']:.2f} ft   (expected {EXPECTED['L_full_ft']:.2f})")
print(f"  L/3   = {t['L_third_ft']:.2f} ft   (expected {EXPECTED['L_third_ft']:.2f})")
print(f"  L_required = {t['L_required_ft']:.2f} ft ({t['L_required_label']})")
print(f"  Formula choice: {t['formula_choice']}")

print("\nBuffer:")
print(f"  buffer_ft = {b['buffer_ft']:.2f} ft   (expected {EXPECTED['buffer_ft']:.2f})")
print(f"  source: {b['lookup_text']}")

print("\nAdvance warning (audit trail):")
print(f"  road_type_text: {adv['road_type_text']}")
print(f"  spacing_text:   {adv['spacing_text']}")
print(
    f"  expected: A={EXPECTED['advance_A']:.0f} "
    f"B={EXPECTED['advance_B']:.0f} C={EXPECTED['advance_C']:.0f}"
)
print("  signs:")
for row in adv["sign_table"]:
    print(f"    {row}")

print("\nSpacing summary:")
print(f"  in-taper:   {sp['in_taper_text']}   (expected {EXPECTED['spacing_in_taper_ft']:.0f} ft)")
print(
    f"  on-tangent: {sp['on_tangent_text']}   (expected {EXPECTED['spacing_on_tangent_ft']:.0f} ft)"
)
print(
    f"  taper drums (req/actual): {sp['n_taper_drums_required']} / {sp['n_taper_drums_actual']}"
    f"   (expected actual {EXPECTED['n_taper_drums']})"
)
print(
    f"  tangent cones (req/actual): {sp['n_tangent_cones_required']} / "
    f"{sp['n_tangent_cones_actual']}   (expected actual {EXPECTED['n_tangent_cones']})"
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

# ---------- raw primitives at 65 mph ----------
_section("RAW — advance_warning_spacing(65, ...) per road_type")
for rt in ("urban_low", "urban_high", "rural", "expressway", "freeway"):
    print(f"  {rt:>16}: {advance_warning_spacing(65, rt)}")
try:
    advance_warning_spacing(65)
    print(f"  {'(auto-infer)':>16}: BUG — should have raised ValueError")
except ValueError as exc:
    print(f"  {'(auto-infer)':>16}: refused (Bug Fix 6) — {exc}")

print("\nRaw primitives at 65 mph:")
print(f"  taper_length(65, 10) = {taper_length(65, 10):.2f} ft  (full L)")
print(f"  shoulder_taper_length(65, 10) = {shoulder_taper_length(65, 10):.2f} ft  (L/3)")
print(f"  buffer_space(65) = {buffer_space(65):.2f} ft")
print(f"  device_spacing_in_taper(65) = {device_spacing_in_taper(65):.2f} ft")
print(f"  device_spacing_on_tangent(65) = {device_spacing_on_tangent(65):.2f} ft")


# ---------- TEST 2: site detection ----------
_section(f"TEST 2 — detect_site_conditions({LAT}, {LNG}, 500m)")
try:
    det = detect_site_conditions(LAT, LNG, radius_m=500.0)
    print(json.dumps(det, indent=2, default=str))
except Exception as exc:  # noqa: BLE001
    print(f"  detection failed: {type(exc).__name__}: {exc}")


# ---------- TEST 3: night variant ----------
_section("TEST 3 — night shift (is_night=True)")
params_night = build_params(ROAD_TYPE, is_night=True)
placements_night = generate_shoulder_closure_divided(params_night, shoulder_width_ft=SHOULDER_WIDTH)
print(f"Day total:   {len(placements)}")
print(f"Night total: {len(placements_night)}")
day_counts = _counts(placements)
night_counts = _counts(placements_night)
diffs = []
for key in set(day_counts) | set(night_counts):
    d, n = day_counts.get(key, 0), night_counts.get(key, 0)
    if d != n:
        diffs.append((key, d, n))
if diffs:
    print("Day → Night diffs:")
    for (dt, lbl), d, n in diffs:
        print(f"  {dt:<24} {lbl}: {d} → {n}")
else:
    print("No device-type or label differences day vs. night.")

import tempfile

with tempfile.TemporaryDirectory() as td:
    _, qb_day = generate_quote(
        placements,
        params,
        output_path=str(Path(td) / "q_day.xlsx"),
        project_name="US-85 Day",
        project_duration_days=1,
        num_flaggers=0,
    )
    _, qb_night = generate_quote(
        placements_night,
        params_night,
        output_path=str(Path(td) / "q_night.xlsx"),
        project_name="US-85 Night",
        project_duration_days=1,
        num_flaggers=0,
    )

print(
    f"\nQuote (day): equip ${qb_day.equipment_total:,.0f}  "
    f"labor ${qb_day.labor_total:,.0f}  total ${qb_day.total:,.0f}  "
    f"is_night={qb_day.is_night}  mult={qb_day.night_multiplier}"
)
print(
    f"Quote (night): equip ${qb_night.equipment_total:,.0f}  "
    f"labor ${qb_night.labor_total:,.0f}  total ${qb_night.total:,.0f}  "
    f"is_night={qb_night.is_night}  mult={qb_night.night_multiplier}"
)


# ---------- TEST 4: hand-calc comparison ----------
_section("TEST 4 — hand-calculation comparison")


def _check(label, actual, expected, tol=0.01):
    delta = actual - expected
    ok = abs(delta) <= tol
    icon = "PASS" if ok else "FAIL"
    print(f"  [{icon}] {label}: actual={actual:.2f}, expected={expected:.2f}, delta={delta:+.2f}")
    return ok


results = []
results.append(_check("L_full (taper)", t["L_full_ft"], EXPECTED["L_full_ft"]))
results.append(_check("L/3 (shoulder taper)", t["L_third_ft"], EXPECTED["L_third_ft"]))
results.append(_check("buffer", b["buffer_ft"], EXPECTED["buffer_ft"]))
results.append(
    _check("device_spacing_in_taper", device_spacing_in_taper(65), EXPECTED["spacing_in_taper_ft"])
)
results.append(
    _check(
        "device_spacing_on_tangent",
        device_spacing_on_tangent(65),
        EXPECTED["spacing_on_tangent_ft"],
    )
)
results.append(
    _check(
        "taper drums (actual)", float(sp["n_taper_drums_actual"]), float(EXPECTED["n_taper_drums"])
    )
)
results.append(
    _check(
        "tangent cones (actual)",
        float(sp["n_tangent_cones_actual"]),
        float(EXPECTED["n_tangent_cones"]),
    )
)
results.append(
    _check("advance A", advance_warning_spacing(65, ROAD_TYPE)["A"], EXPECTED["advance_A"])
)
results.append(
    _check("advance B", advance_warning_spacing(65, ROAD_TYPE)["B"], EXPECTED["advance_B"])
)
results.append(
    _check("advance C", advance_warning_spacing(65, ROAD_TYPE)["C"], EXPECTED["advance_C"])
)

ok_count = sum(results)
print(f"\n  {ok_count}/{len(results)} hand-calc checks passed.")
