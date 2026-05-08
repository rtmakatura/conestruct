# I-25 Colorado Springs — Verification Report (v2, post-fix regression)

**Generated:** 2026-05-08
**Harness:** `scripts/verify_i25.py` (run from project root, unchanged from v1)
**Tool revision:** `main` working tree — uncommitted Bug Fix 1 + Bug Fix 4 + Bug Fix 6 applied
**Purpose:** Regression check after Bug Fixes 1, 4, 6. Targets: 0 errors, 0 warnings, §6C.04(A) PASS, total > 25.

---

## Summary

| Metric | v1 (pre-fix) | v2 (post-fix) | Δ | Target |
|---|---:|---:|---:|---|
| Total devices | 25 | **34** | +9 | > 25 ✅ |
| Validator errors | 0 | **0** | — | 0 ✅ |
| Validator warnings | 3 | **0** | −3 | 0 ✅ |
| CO §6C.04(A) (both sides) | FAIL | **PASS** | — | PASS ✅ |
| Advance-warning distances | 1000/1500/2640 | 1000/1500/2640 | — | unchanged |
| `road_type="divided_highway"` | rural fallback | **ValueError** | — | reject ✅ |
| Auto-infer at 55 mph | rural fallback | **ValueError** | — | reject ✅ |

All four post-fix targets met.

---

## Test Parameters

Identical to v1.

```python
ScenarioParams(
    speed_mph=55,
    num_lanes=3,
    closure_type="shoulder",
    road_type="freeway",
    work_zone_length_ft=1000.0,
    lane_width_ft=12.0,
    shoulder_width_ft=10.0,
    is_night=False,
    is_divided=True,
    jurisdiction="CDOT",
)
```

Coordinates 38.886, −104.822 (I-25 NB near Garden of the Gods Rd, Colorado Springs, MP 144.5–146.0).

---

## Test 1: Baseline Results

### a) Total device count

**34 devices** (was 25).

### b) Device breakdown by type

| # | Device | Label | v1 → v2 |
|---:|---|---|---|
| 1 | ARROW_BOARD | RIGHT_ARROW | 1 → 1 |
| 12 | CONE | — | 12 → 12 |
| **5** | DRUM | — | 4 → **5** (Bug Fix 4) |
| 2 | SIGN_GENERIC | G20-1 | 1 → **2** (Bug Fix 1 mirror) |
| 2 | SIGN_GENERIC | G20-2 | 1 → **2** (Bug Fix 1 mirror) |
| **6** | SIGN_GENERIC | G20-5P | 3 → **6** (Bug Fix 1 mirror) |
| 2 | SIGN_GENERIC | W20-1 | 1 → **2** (Bug Fix 1 mirror) |
| 2 | SIGN_GENERIC | W20-2 | 1 → **2** (Bug Fix 1 mirror) |
| 2 | SIGN_GENERIC | W21-5aR | 1 → **2** (Bug Fix 1 mirror) |

Net delta: +1 drum (Bug Fix 4), +8 mirrored signs (Bug Fix 1). 25 + 1 + 8 = **34**.

### c) Taper length (L/3)

- Full L = `W × S = 10 × 55 = 550 ft`
- Shoulder taper = `L/3 = 183.33 ft`
- Formula choice: 55 mph ≥ 40 mph → `L = W × S` (MUTCD §6C.08)

Unchanged from v1.

### d) Buffer space

**495 ft** (MUTCD Table 6B-2 lookup at 55 mph). Unchanged.

### e) Advance warning sign distances (A, B, C)

**A = 1,000 ft, B = 1,500 ft, C = 2,640 ft.** Freeway / expressway Table 6B-1 distances. Unchanged from v1, confirmed via raw lookup `advance_warning_spacing(55, "freeway")`.

### f) Advance warning sign codes

W21-5aR (A), W20-2 (B), W20-1 (C). Plus G20-1 / G20-2 begin/end markers and three pairs of G20-5P plaques every 2,640 ft. Each is now mirrored on the median (Bug Fix 1).

### g) Total corridor length

- Most-downstream device station: −150 ft
- Most-upstream device station: 6,818 ft
- **Corridor: 6,968 ft (~1.32 mi).** Identical to v1 — Bug Fixes 1 and 4 don't move stations, they add devices at existing stations.

### h) Validation errors / warnings

**0 errors, 0 warnings.**

The three `CHANNELIZER_SPACING_TOO_WIDE` warnings from v1 are gone:
- Bug Fix 4 replaced the 4-drum hard-coded count with `pick_device_count`, which now picks **5** drums in the 183.33 ft shoulder taper (≈45.8 ft spacing). 45.8 ft is below the 55 ft target with no upper-limit cap, which is conservative under MUTCD §6C.09 (the section specifies a *maximum* spacing only).
- The `CHANNELIZER_SPACING_TOO_TIGHT` validator branch was deleted in Bug Fix 4 (per MUTCD §6C.09 there is no minimum spacing — tighter than target is always allowed).

Audit trail Colorado checks:

```
[PASS] Signs on both sides of divided highway (CO Supp §6C.04(A))
       Required: True. Signs placed: 8 left, 8 right.
[PASS] G20-5P/R2-6P plaques every 2,640 ft (CO Supp §6C.06(A))
       Zone length: 6,818 ft. Required: 3. Placed: 3.
[PASS] Speed reduction <= 15 mph per sign installation (CO Supp §2B.13(A))
[PASS] Flagger station lighting 500W @ 8 ft (CO Supp §6E.02(A))
[INFO] AADT threshold for mobile operations (<= 2,000) (CO Supp §6G.02(A))
```

The §6C.04(A) FAIL from v1 is now a PASS — Bug Fix 1 mirrored every advance-warning sign, every begin/end marker, and every G20-5P plaque to a left-side (median) twin at offset_ft = −sign_offset_right.

### i) Sign positions (audit trail)

Audit trail's right-side rows are unchanged from v1. The new mirrored left-side signs sit at the same stations with negated offsets:

| Position | Code | Station (ft) | Right offset | Left offset (new) |
|---|---|---:|---:|---:|
| C (furthest) | W20-1 | 6,818 | +24 | −24 |
| B (middle)   | W20-2 | 4,178 | +24 | −24 |
| A (nearest)  | W21-5aR | 2,678 | +24 | −24 |

---

## Test 1 (alt) — road_type variants at 55 mph

| `road_type` argument | v1 result | v2 result |
|---|---|---|
| `"freeway"` | 1000/1500/2640 ✅ | 1000/1500/2640 ✅ |
| `"expressway"` | 1000/1500/2640 ✅ | 1000/1500/2640 ✅ |
| `"divided_highway"` | 500/500/500 (silent rural fallback) | **ValueError** ✅ |
| `None` (auto-infer at 55 mph) | 500/500/500 (silent rural fallback) | **ValueError** ✅ |

Bug Fix 6 closes both silent-fallback paths. The harness now logs:

```
(auto-infer): refused (Bug Fix 6) — advance_warning_spacing requires
              an explicit road_type at 55 mph (auto-infer is unsafe at
              55+ mph because rural / expressway / freeway differ by
              thousands of feet in Table 6B-1).
              Pass one of 'rural', 'expressway', 'freeway'.

divided_highway: ValueError: Unknown road_type 'divided_highway';
                 expected one of ['expressway', 'freeway', 'rural',
                 'urban_high', 'urban_low'].  Note: 'divided_highway'
                 is not a road_type — divided-ness is a separate
                 boolean (ScenarioParams.is_divided).
```

The error message points the caller at `is_divided` so the fix is obvious.

---

## Test 2: Site Detection Results

Unchanged from v1 (Bug 2 is P2 and not in this fix batch). Same 19 intersections, 14 sidewalks, 3 bike facilities — all on parallel surface streets, all false positives for an interstate shoulder. See v1 §Test 2 for the discussion.

---

## Test 3: Site Adjustments Results

`apply_site_adjustments(adjacent_intersection=True)`:

- **Baseline total:** 34 (was 25)
- **After adjustment:** 36 (was 27)
- **Delta:** +2 W20-1 ROAD WORK AHEAD signs facing cross-street traffic (unchanged)

The adjustment is additive on top of the new baseline — Bug Fix 1's mirrored signs are still there, the cross-street pair is layered on. Bug 3 (interchange vs. at-grade misapplication) is unaddressed and unchanged.

---

## Test 4: Night Operation Results

| Field | Day | Night | Δ |
|---|---:|---:|---:|
| Device count | 34 | 34 | 0 |
| equipment_total | $182 | $182 | 0 |
| labor_total | $375 | $562 | **+$188** (+50.0%) |
| total | $1,037 | $1,264 | +$226 |
| `is_night` flag | False | True | — |
| `night_multiplier` | 1.5 | 1.5 | — |

Equipment total ticked up from v1 ($147 → $182) because the larger device count adds rental cost. Labor multiplier (1.5×) is unchanged. **Bug 5 (night invisible in device list) is unaddressed and still present** — placements are identical between day and night.

---

## Test 5: S-630-1 Comparison

| Check | v1 | v2 |
|---|---|---|
| Advance signs (W20-1, W20-2, W21-5aR) | ✅ | ✅ |
| Taper drums | ✅ (4) | ✅ (**5**, picker) |
| Tangent cones | ✅ (12) | ✅ (12) |
| Arrow board | ✅ | ✅ |
| **Both-sides on divided** | ❌ | **✅** |
| **Freeway A/B/C distances** | ✅ for `"freeway"`, silent-rural for others | **✅ for `"freeway"`, ValueError for non-canonical** |

---

## Discrepancies vs. Targets

None. All four targets met. Open bugs (2, 3, 5) are documented in `test_verification_i25.md` v1 and were not in scope for this fix batch.

---

## Bug Status After This Run

| # | Severity | v1 status | v2 status |
|---|---|---|---|
| 1 | P0 | FAIL — divided plans missing left-side signs | **FIXED** (Bug Fix 1) |
| 2 | P2 | Site detection roadway-class-blind | unchanged (deferred) |
| 3 | P1 | `adjacent_intersection` misfires for interchanges | unchanged (deferred) |
| 4 | P2 | Drum spacing 61.1 ft → 3 warnings | **FIXED** (Bug Fix 4) |
| 5 | P1 | Night invisible in device list | unchanged (deferred) |
| 6 | P0 | `road_type` silent rural fallback | **FIXED** (Bug Fix 6) |

---

## Notes

- Validator-vs-audit-trail split is now reconciled for the §6C.04(A) check: Bug Fix 1 turned `validate_co_signs_both_sides` into an *error*-severity Violation when `is_divided=True`. The check no longer lives only in the audit trail — `validate_layout` now blocks it.
- The corridor length report (6,968 ft for a 1,000 ft work zone) is unchanged. Still worth surfacing in the UI for the static preview.
- Equipment total moved from $147 → $182 because of the extra mirrored signs and the additional drum. This is correct.

*Re-run with* `uv run python scripts/verify_i25.py` *from the project root. No changes committed.*
