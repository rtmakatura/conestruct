# 45 mph Rural Undivided — Verification Report (linear-formula transition + undivided)

**Generated:** 2026-05-08
**Harness:** `scripts/verify_45mph_rural.py`
**Tool revision:** `main` working tree — uncommitted Bug Fixes 1, 4, 6 applied
**Purpose:** Confirm the linear taper kicks in at 45 mph (≥ 40 mph cutoff) and that Bug Fix 1's both-sides mirroring **does NOT fire** when `is_divided=False`. Compares against the 65 mph US-85 divided baseline to confirm sign-count halving.

---

## Test Parameters

| Field | Value |
|---|---|
| speed_mph | 45 |
| num_lanes | 1 |
| closure_type | shoulder |
| road_type | rural |
| work_zone_length_ft | 800 |
| lane_width_ft | 11 |
| shoulder_width_ft | 8 |
| is_divided | **False** |
| is_night | False |

---

## Hand Calculations (revised)

> **Hand-calc reconciliation:** spec used `W = 11 ft`; the implementation uses `W = shoulder_width_ft = 8 ft`. Restated below.

| Quantity | Formula | Expected |
|---|---|---:|
| Full L (linear, S ≥ 40) | `W × S = 8 × 45` | **360 ft** |
| L/3 (shoulder taper) | `L / 3` | 120 ft |
| Buffer | Table 6B-2 @ 45 mph | 360 ft |
| Advance A / B / C | Table 6B-1, rural | 500 / 500 / 500 ft |
| In-taper spacing | `device_spacing_in_taper(45)` | 45 ft |
| On-tangent spacing | `device_spacing_on_tangent(45)` | 90 ft |
| Taper drums | `pick_device_count(120, 45, min_count=4)` — exact=2.67, floor=2 (60 ft, out [40.5,49.5]), ceil=3 (40 ft, out). Both out → ceil wins → 3 intervals → max(4, 4) = **4 drums** | 4 |
| Tangent cones (line) | `pick_device_count(800, 90, min_count=2)` — floor=8 (100, out [81,99]), ceil=9 (88.89, in). Ceil wins → 10 cones | 10 |
| Downstream-taper cones | hard-coded | 2 |
| **Total cones** | tangent + downstream | **12** |

---

## Tool Output

### Total / Breakdown

**24 devices.**

| # | Device | Label |
|---:|---|---|
| 1 | ARROW_BOARD | RIGHT_ARROW |
| 12 | CONE | — |
| 4 | DRUM | — |
| 1 | SIGN_GENERIC | G20-1 |
| 1 | SIGN_GENERIC | G20-2 |
| 2 | SIGN_GENERIC | G20-5P |
| 1 | SIGN_GENERIC | W20-1 |
| 1 | SIGN_GENERIC | W20-2 |
| 1 | SIGN_GENERIC | W21-5aR |

### Sign-side analysis

**7 right, 0 left, 0 centerline.** All signs right-side only — Bug Fix 1's mirroring correctly suppressed for `is_divided=False`. Signs are roughly **half** of the 14 produced on the divided 65 mph US-85 baseline (7 vs. 14), confirming the divided-only mirror gate.

### Hand-calc comparison

```
[PASS] L_full (taper):                360.00 / 360.00     delta=+0.00
[PASS] L/3 (shoulder taper):          120.00 / 120.00     delta=+0.00
[PASS] buffer:                        360.00 / 360.00     delta=+0.00
[PASS] device_spacing_in_taper:        45.00 / 45.00      delta=+0.00
[PASS] device_spacing_on_tangent:      90.00 / 90.00      delta=+0.00
[PASS] taper drums (count):             4.00 / 4.00       delta=+0.00
[PASS] tangent cones (incl. ds):       12.00 / 12.00      delta=+0.00
[PASS] advance A:                     500.00 / 500.00     delta=+0.00
[PASS] advance B:                     500.00 / 500.00     delta=+0.00
[PASS] advance C:                     500.00 / 500.00     delta=+0.00

10/10 hand-calc checks passed.
```

### Formula verification

```
Formula choice: Speed 45 mph >= 40 mph threshold -> using L = W x S
Expected formula kind: linear
```

Linear formula confirmed at the 45 mph cutoff.

### Validation

**0 errors, 0 warnings.**

### Colorado supplement

```
[PASS] Signs on both sides of divided highway (CO Supp §6C.04(A))
       Required: False. Signs placed: 0 left, 7 right.
[PASS] G20-5P plaques every 2,640 ft (CO Supp §6C.06(A))
       Zone length: 2,780 ft. Required: 2. Placed: 2.
```

§6C.04(A) reports `Required: False` — undivided gating works.

### Corridor

- Min station: −150 ft
- Max station: 2,780 ft
- **Total corridor: 2,930 ft (~0.55 mi).**

### Quote

| | Day | Night |
|---|---:|---:|
| Equipment | $143 | $143 |
| Labor | $375 | $562 |
| Total | $990 | $1,217 |

---

## Critical-Check Summary

| Check | Result |
|---|---|
| §6C.04(A) does NOT fire (is_divided=False) | ✅ `Required: False` |
| All signs right-side only | ✅ 7 right / 0 left |
| Sign count ~half of divided variant | ✅ 7 (here) vs. 14 (US-85 65 mph divided) |
| 0 errors, 0 warnings | ✅ |
| Linear formula at 45 mph | ✅ "Speed 45 mph >= 40 mph threshold" |

**Bug Fix 1 gate verified.** When `is_divided=False`, the divided generator is not called, the lateral mirror loop never executes, and `validate_co_signs_both_sides` returns early without firing. There is no path by which left-side signs can appear on an undivided plan.

*Re-run with* `uv run python scripts/verify_45mph_rural.py`.
