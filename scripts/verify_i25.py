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
from src.rules.devices import DeviceType
from src.rules.night_adjustments import apply_night_adjustments
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
# Anchor verified on the I-25 northbound mainline near Exit 146 (Garden of
# the Gods Rd) in Colorado Springs.  Pulled from OSM way 136556833
# (highway=motorway, ref="I 25", oneway=yes, lanes=3) — see the diagnostic
# pass that traced the original (38.886, -104.822) anchor 0.3 miles east
# of the actual roadway.  BEARING is the segment bearing OSM reports for
# this NB way at this latitude; passing it through to the renderer
# produces an aerial overlay that follows the actual carriageway.
LAT, LNG = 38.8862, -104.8354
BEARING_DEG = 19.0
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
        bearing_deg=BEARING_DEG,
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
    placements_freeway,
    params_freeway,
    shoulder_width_ft=SHOULDER_WIDTH,
    site_lat=LAT,
    site_lng=LNG,
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

cv = audit_freeway.get("corridor_validation") or {}
print("\nCorridor / aerial validation:")
if not cv.get("checked"):
    print("  (skipped — OSM unreachable or coords/bearing missing)")
elif not cv.get("warnings"):
    print(f"  PASS — anchor ({LAT}, {LNG}) on a major road, bearing matches OSM")
else:
    for w in cv["warnings"]:
        print(f"  [WARN] {w['flag']}: {w['message']}")

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


# ---------- TEST 3: site adjustments (adjacent_interchange=True) ----------
# I-25 mainline near Garden of the Gods Rd is a freeway adjacent to Exit
# 146 — the at-grade intersection treatment (W20-1 cross-street pair) is
# the wrong response.  The interchange treatment (W20-3 + PCMS) is what
# the corridor actually needs (Bug Fix 3).
_section("TEST 3 — apply_site_adjustments(adjacent_interchange=True)")
flags = {
    "adjacent_intersection": False,
    "adjacent_interchange": True,
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
_section("TEST 4 — night shift (is_night=True, apply_night_adjustments)")
params_night = build_params("freeway", is_night=True)
placements_night_raw = generate_shoulder_closure_divided(
    params_night, shoulder_width_ft=SHOULDER_WIDTH
)
placements_night, night_records = apply_night_adjustments(placements_night_raw, params_night)

print(f"Day total: {len(placements_freeway)}")
print(f"Night total (post-adjustments): {len(placements_night)}")

n_taper_drums_night = sum(1 for p in placements_night_raw if p.device_type == DeviceType.DRUM)
expected_night = len(placements_night_raw) + n_taper_drums_night + 1
assert len(placements_night) == expected_night, (
    f"Expected baseline ({len(placements_night_raw)}) + warning lights "
    f"({n_taper_drums_night}) + 1 light plant = {expected_night}, "
    f"got {len(placements_night)}"
)
print(
    f"  expected = baseline ({len(placements_night_raw)}) + warning lights "
    f"({n_taper_drums_night}) + 1 light plant = {expected_night}  PASS"
)

day_counts = _counts(placements_freeway)
night_counts = _counts(placements_night)
diffs = []
for key in set(day_counts) | set(night_counts):
    d, n = day_counts.get(key, 0), night_counts.get(key, 0)
    if d != n:
        diffs.append((key, d, n))
print("Day → Night diffs:")
for (dt, lbl), d, n in sorted(diffs):
    print(f"  {dt:<24} {lbl}: {d} → {n}")

print(f"\nNight adjustment records ({len(night_records)}):")
for r in night_records:
    print(f"  [{r['flag']}] {r['action']}")
    print(f"     rule: {r['rule']}")
assert len(night_records) == 3, f"Expected 3 night adjustment records, got {len(night_records)}"

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
expected_equipment_delta = n_taper_drums_night * 5.00 + 125.00
actual_equipment_delta = qb_night.equipment_total - qb_day.equipment_total
print(
    f"Night equipment delta: +${actual_equipment_delta:,.2f}  "
    f"(expected ~${expected_equipment_delta:.2f}: "
    f"{n_taper_drums_night} warning lights @ $5 + 1 plant @ $125)"
)
print(
    f"Night labor delta: +${qb_night.labor_total - qb_day.labor_total:,.0f}  "
    f"({(qb_night.labor_total / qb_day.labor_total - 1) * 100:.1f}% over day, "
    f"day flaggers=0 so labor delta is from non-flagger labor only)"
)


# ---------- TEST 5 — already exercised inline above ----------
_section("TEST 5 — see TEST 1/road_type variants and raw spacing dump above")
print("Compare audit['advance'].sign_table for road_type=freeway vs the raw")
print("Table 6B-1 lookup ('freeway' at 55 mph -> A=1000 B=1500 C=2640).")


# ---------- TEST 6: combined night + interchange PDF ----------
# Bug Fix 3 visual verification: render a PDF with both is_night=True and
# adjacent_interchange=True applied so a reviewer can see the W20-3 ramp
# sign + PCMS alongside the warning lights and light plant from the night
# adjustments.  Saved at the project root for inspection.
_section("TEST 6 — combined night + adjacent_interchange PDF render")
from src.rendering.plan_sheet import render_plan_sheet  # noqa: E402

night_interchange_flags = {
    "adjacent_intersection": False,
    "adjacent_interchange": True,
    "driveways_present": False,
    "pedestrian_facility": False,
    "bicycle_facility": False,
    "limited_sight_distance": False,
    "school_zone": False,
}
placements_combo, combo_site_records = apply_site_adjustments(
    placements_night_raw, params_night, night_interchange_flags
)
placements_combo, combo_night_records = apply_night_adjustments(placements_combo, params_night)

pdf_path = _ROOT / "test_pdf_i25_interchange_night.pdf"
render_plan_sheet(
    placements_combo,
    params_night,
    output_path=str(pdf_path),
    project_name="I-25 NB MP 144.5 — Night + Interchange",
    site_lat=LAT,
    site_lng=LNG,
    shoulder_width_ft=SHOULDER_WIDTH,
)
print(f"Wrote {pdf_path.name} — total devices {len(placements_combo)}")
print("\nSite adjustment records (interchange):")
for rec in combo_site_records:
    print(f"  [{rec['flag']}] {rec['action']}")
print("\nNight adjustment records:")
for rec in combo_night_records:
    print(f"  [{rec['flag']}] {rec['action']}")

w20_3 = [p for p in placements_combo if p.label == "W20-3"]
pcms = [p for p in placements_combo if p.device_type == DeviceType.PCMS]
print(f"\nW20-3 LANE CLOSED AHEAD signs in placement list: {len(w20_3)}")
print(f"PCMS placements in placement list: {len(pcms)}")
