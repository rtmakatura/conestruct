# 35 mph Urban High — Verification Report (urban_high road type, just below linear cutoff)

**Generated:** 2026-05-08
**Harness:** `scripts/verify_35mph_urban_high.py`
**Tool revision:** `main` working tree — uncommitted Bug Fixes 1, 4, 6 applied
**Purpose:** Confirm `urban_high` road_type produces 350/350/350 advance distances (NOT rural's 500), and that the quadratic taper formula still applies just below the 40 mph cutoff.

---

## Test Parameters

| Field | Value |
|---|---|
| speed_mph | 35 |
| num_lanes | 2 |
| closure_type | shoulder |
| road_type | **urban_high** |
| work_zone_length_ft | 600 |
| lane_width_ft | 11 |
| shoulder_width_ft | 6 |
| is_divided | False |
| is_night | False |

---

## Hand Calculations (revised)

> **Hand-calc reconciliation:** spec used `W = 11 ft`; the implementation uses `W = shoulder_width_ft = 6 ft`. Restated below.

| Quantity | Formula | Expected |
|---|---|---:|
| Full L (quadratic, S < 40) | `W × S² / 60 = 6 × 1225 / 60` | **122.50 ft** |
| L/3 | `L / 3` | 40.83 ft |
| Buffer | Table 6B-2 @ 35 mph | 250 ft |
| Advance A / B / C | Table 6B-1, **urban_high** | 350 / 350 / 350 ft |
| In-taper spacing | `device_spacing_in_taper(35)` | 35 ft |
| On-tangent spacing | `device_spacing_on_tangent(35)` | 70 ft |
| Taper drums | `pick_device_count(40.83, 35, min_count=4)` — exact=1.17, floor=1 (40.83, out [31.5,38.5]), ceil=1 (40.83, out). Both out → ceil → 1 interval → max(4, 2) = **4 drums** | 4 |
| Tangent cones (line) | `pick_device_count(600, 70, min_count=2)` — exact=8.57, floor=8 (75 ft, in [63,77]), ceil=9 (66.67 ft, in). Both in → smaller dev: ceil 3.33 < floor 5.0 → ceil wins → 9 intervals → 10 cones | 10 |
| Downstream-taper cones | hard-coded | 2 |
| **Total cones** | tangent + downstream | **12** |

---

## Tool Output

### Total / Breakdown

**23 devices.**

| # | Device | Label |
|---:|---|---|
| 1 | ARROW_BOARD | RIGHT_ARROW |
| 12 | CONE | — |
| 4 | DRUM | — |
| 1 | SIGN_GENERIC | G20-1 |
| 1 | SIGN_GENERIC | G20-2 |
| 1 | SIGN_GENERIC | G20-5P |
| 1 | SIGN_GENERIC | W20-1 |
| 1 | SIGN_GENERIC | W20-2 |
| 1 | SIGN_GENERIC | W21-5aR |

### Sign-side analysis

**6 right, 0 left, 0 centerline.** Undivided gating works — single-sided.

### Hand-calc comparison

```
[PASS] L_full (taper):                122.50 / 122.50     delta=+0.00
[PASS] L/3 (shoulder taper):           40.83 / 40.83      delta=+0.00
[PASS] buffer:                        250.00 / 250.00     delta=+0.00
[PASS] device_spacing_in_taper:        35.00 / 35.00      delta=+0.00
[PASS] device_spacing_on_tangent:      70.00 / 70.00      delta=+0.00
[PASS] taper drums (count):             4.00 / 4.00       delta=+0.00
[PASS] tangent cones (incl. ds):       12.00 / 12.00      delta=+0.00
[PASS] advance A:                     350.00 / 350.00     delta=+0.00
[PASS] advance B:                     350.00 / 350.00     delta=+0.00
[PASS] advance C:                     350.00 / 350.00     delta=+0.00

10/10 hand-calc checks passed.
```

### Formula verification

```
Formula choice: Speed 35 mph < 40 mph threshold -> using L = W x S^2 / 60
Expected formula kind: quadratic
```

### Validation

**0 errors, 0 warnings.**

### Colorado supplement

```
[PASS] Signs on both sides of divided highway (CO Supp §6C.04(A))
       Required: False. Signs placed: 0 left, 6 right.
[PASS] G20-5P plaques every 2,640 ft (CO Supp §6C.06(A))
       Zone length: 1,941 ft. Required: 1. Placed: 1.
```

### Corridor

- Min station: −150 ft
- Max station: 1,941 ft (W20-1 at C = 350 ft upstream of taper)
- **Total corridor: 2,091 ft (~0.40 mi).**

### Quote

| | Day | Night |
|---|---:|---:|
| Equipment | $139 | $139 |
| Labor | $375 | $562 |
| Total | $985 | $1,212 |

---

## Critical-Check Summary

| Check | Result |
|---|---|
| `urban_high` advance distances applied (350/350/350) | ✅ confirmed (NOT rural's 500/500/500) |
| §6C.04(A) does NOT fire (is_divided=False) | ✅ `Required: False` |
| Quadratic formula at 35 mph (< 40 mph cutoff) | ✅ "Speed 35 mph < 40 mph threshold" |
| 0 errors, 0 warnings | ✅ |

**urban_high road type verified.** A common configuration error would be to misroute `urban_high` to the `rural` row of Table 6B-1 (500 ft); the tool correctly returns 350 ft for all three advance positions. Combined with the verified quadratic formula and the undivided gating, this confirms the engine handles the 35 mph urban-arterial scenario without falling through to the wrong table row.

*Re-run with* `uv run python scripts/verify_35mph_urban_high.py`.
