"""I-25 Colorado Springs verification harness — drives the public Python API
and prints structured results for the test_verification_i25.md report.

Run from project root:  python scripts/verify_i25.py
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
from src.rules.site_adjustments import apply_site_adjustments
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
# Project parameters
# --------------------------------------------------------------------------
LAT, LNG = 38.886, -104.822
SPEED = 55
NUM_LANES = 3
WORK_LEN = 1000.0
LANE_WIDTH = 12.0
SHOULDER_WIDTH = 10.0


def _section(title: str) -> None:
    bar = "=" * 78
    print(f"\n{bar}\n{title}\n{bar}")


def _placement_dump(placements):
    rows = []
    for p in placements:
        rows.append(
            {
                "device": p.device_type.value,
                "label": p.label or "",
                "station_ft": round(p.station_ft, 2),
                "offset_ft": round(p.offset_ft, 2),
            }
        )
    return rows


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


# --------------------------------------------------------------------------
# Build the scenario two ways: once with road_type="freeway", once with
# road_type="divided_highway".  We want to see whether the audit trail (and
# therefore the rendered plan) actually picks up Table 6B-1 expressway/
# freeway distances vs. silently falling back to rural (500/500/500) at
# 55 mph.
# --------------------------------------------------------------------------


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
_section("TEST 1 — baseline (road_type=freeway, day shift)")
params_freeway = build_params("freeway")
placements_freeway = generate_shoulder_closure_divided(
    params_freeway, shoulder_width_ft=SHOULDER_WIDTH
)
viol_freeway = validate_layout(placements_freeway, params_freeway)

print(f"Total devices: {len(placements_freeway)}")
_print_breakdown("Breakdown — road_type=freeway", placements_freeway)

audit_freeway = build_audit_trail(
    placements_freeway, params_freeway, shoulder_width_ft=SHOULDER_WIDTH
)
t = audit_freeway["taper"]
b = audit_freeway["buffer"]
sp = audit_freeway["spacing"]
adv = audit_freeway["advance"]
co = audit_freeway["colorado"]

print("\nTaper:")
print(f"  L_full = {t['L_full_ft']:.2f} ft")
print(f"  L/3   = {t['L_third_ft']:.2f} ft")
print(f"  L_required = {t['L_required_ft']:.2f} ft ({t['L_required_label']})")
print(f"  Formula choice: {t['formula_choice']}")

print("\nBuffer:")
print(f"  buffer_ft = {b['buffer_ft']:.2f} ft  ({b['lookup_text']})")

print("\nAdvance warning (audit trail):")
print(f"  road_type_text: {adv['road_type_text']}")
print(f"  spacing_text:   {adv['spacing_text']}")
print("  signs:")
for row in adv["sign_table"]:
    print(f"    {row}")

print("\nSpacing summary:")
print(f"  in-taper:   {sp['in_taper_text']}")
print(f"  on-tangent: {sp['on_tangent_text']}")
print(f"  taper drums (req/actual): {sp['n_taper_drums_required']} / {sp['n_taper_drums_actual']}")
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
_print_violations(viol_freeway)

# Total corridor length: most-upstream advance sign → most-downstream device
stations = [p.station_ft for p in placements_freeway]
print(
    f"\nStation range: min={min(stations):.1f} ft  max={max(stations):.1f} ft  "
    f"corridor={(max(stations) - min(stations)):.1f} ft"
)

# --- Compare against road_type="expressway" and "divided_highway" ---
for alt in ("expressway", "divided_highway"):
    _section(f"TEST 1 (alt) — road_type={alt}")
    try:
        p_alt = build_params(alt)
        plc_alt = generate_shoulder_closure_divided(p_alt, shoulder_width_ft=SHOULDER_WIDTH)
        aud_alt = build_audit_trail(plc_alt, p_alt, shoulder_width_ft=SHOULDER_WIDTH)
        adv_alt = aud_alt["advance"]
        print(f"  road_type_text: {adv_alt['road_type_text']}")
        print(f"  spacing_text:   {adv_alt['spacing_text']}")
        print("  sign rows:")
        for row in adv_alt["sign_table"]:
            print(f"    {row}")
    except Exception as exc:  # noqa: BLE001
        print(f"  FAILED: {type(exc).__name__}: {exc}")

# Direct spacing-table check — what each road_type returns at 55 mph
_section("TEST 1 (raw) — advance_warning_spacing(55, ...) per road_type")
for rt in ("urban_low", "urban_high", "rural", "expressway", "freeway"):
    print(f"  {rt:>16}: {advance_warning_spacing(55, rt)}")
# Bug Fix 6: at 55+ mph the function refuses to guess.  Verify the
# guard fires so a future regression that re-introduces silent fallback
# trips this harness immediately.
try:
    advance_warning_spacing(55)
    print(f"  {'(auto-infer)':>16}: BUG — should have raised ValueError")
except ValueError as exc:
    print(f"  {'(auto-infer)':>16}: refused (Bug Fix 6) — {exc}")

# Also dump raw spacing primitives
print("\nRaw primitives:")
print(f"  taper_length(55, 10) = {taper_length(55, 10):.2f} ft  (full L)")
print(f"  shoulder_taper_length(55, 10) = {shoulder_taper_length(55, 10):.2f} ft  (L/3)")
print(f"  buffer_space(55) = {buffer_space(55):.2f} ft")
print(f"  device_spacing_in_taper(55) = {device_spacing_in_taper(55):.2f} ft")
print(f"  device_spacing_on_tangent(55) = {device_spacing_on_tangent(55):.2f} ft")


# ---------- TEST 2: site detection ----------
_section("TEST 2 — detect_site_conditions(38.886, -104.822, 500m)")
det = detect_site_conditions(LAT, LNG, radius_m=500.0)
print(json.dumps(det, indent=2, default=str))


# ---------- TEST 3: site adjustments (adjacent_intersection=True) ----------
_section("TEST 3 — apply_site_adjustments(adjacent_intersection=True)")
flags = {
    "adjacent_intersection": True,
    "driveways_present": False,
    "pedestrian_facility": False,
    "bicycle_facility": False,
    "limited_sight_distance": False,
    "school_zone": False,
}
placements_adj, records = apply_site_adjustments(placements_freeway, params_freeway, flags)
print(f"Baseline total: {len(placements_freeway)}")
print(
    f"After adjustments: {len(placements_adj)}  "
    f"(delta = {len(placements_adj) - len(placements_freeway)})"
)
print("\nAdjustment records:")
print(json.dumps(records, indent=2, default=str))
_print_breakdown("Breakdown after adjustments", placements_adj)


# ---------- TEST 4: night variant ----------
_section("TEST 4 — night shift (is_night=True)")
params_night = build_params("freeway", is_night=True)
placements_night = generate_shoulder_closure_divided(params_night, shoulder_width_ft=SHOULDER_WIDTH)
print(f"Day total: {len(placements_freeway)}")
print(f"Night total: {len(placements_night)}")
day_counts = _counts(placements_freeway)
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

# Quote diff
import tempfile

with tempfile.TemporaryDirectory() as td:
    _, qb_day = generate_quote(
        placements_freeway,
        params_freeway,
        output_path=str(Path(td) / "q_day.xlsx"),
        project_name="I-25 Day",
        project_duration_days=1,
        num_flaggers=0,
    )
    _, qb_night = generate_quote(
        placements_night,
        params_night,
        output_path=str(Path(td) / "q_night.xlsx"),
        project_name="I-25 Night",
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
print(
    f"Night labor delta: +${qb_night.labor_total - qb_day.labor_total:,.0f}  "
    f"({(qb_night.labor_total / qb_day.labor_total - 1) * 100:.1f}% over day)"
)


# ---------- TEST 5 — already exercised inline above ----------
_section("TEST 5 — see TEST 1/road_type variants and raw spacing dump above")
print("Compare audit['advance'].sign_table for road_type=freeway vs the raw")
print("Table 6B-1 lookup ('freeway' at 55 mph -> A=1000 B=1500 C=2640).")
