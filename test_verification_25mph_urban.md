# 25 mph Urban Low — Verification Report (low-speed boundary, quadratic taper)

**Generated:** 2026-05-08
**Harness:** `scripts/verify_25mph_urban.py`
**Tool revision:** `main` working tree — uncommitted Bug Fixes 1, 4, 6 applied
**Purpose:** Exercise the quadratic taper formula (S < 40 mph) and confirm undivided behavior — §6C.04(A) two-sided signing must NOT fire.

---

## Test Parameters

| Field | Value |
|---|---|
| speed_mph | 25 |
| num_lanes | 1 |
| closure_type | shoulder |
| road_type | urban_low |
| work_zone_length_ft | 500 |
| lane_width_ft | 11 |
| shoulder_width_ft | 6 |
| is_divided | False |
| is_night | False |
| jurisdiction | CDOT |

---

## Hand Calculations (revised)

> **Hand-calc reconciliation:** the original spec used `W = lane_width_ft = 11 ft` in the taper formula. The implementation uses `W = shoulder_width_ft = 6 ft` (the *lateral distance being tapered*) for shoulder closures, which is the correct interpretation of MUTCD §6C.08 — `W` is the offset to be transitioned, and a shoulder taper transitions across the shoulder, not across a lane. Spec values restated below using `W = 6 ft`.

| Quantity | Formula | Expected |
|---|---|---:|
| Full L (quadratic, S < 40) | `W × S² / 60 = 6 × 625 / 60` | **62.50 ft** |
| L/3 (shoulder taper) | `L / 3` | 20.83 ft |
| Buffer | Table 6B-2 @ 25 mph | 155 ft |
| Advance A / B / C | Table 6B-1, urban_low | 100 / 100 / 100 ft |
| In-taper spacing | `device_spacing_in_taper(25)` | 25 ft |
| On-tangent spacing | `device_spacing_on_tangent(25)` | 50 ft |
| Taper drums | `pick_device_count(20.83, 25, min_count=4)` — both candidates out of tolerance, ceil wins, 1 interval, but `min_count=4` floors to **4 drums** | 4 |
| Tangent cones (line) | `pick_device_count(500, 50, min_count=2)` = 11 (10 intervals @ 50 ft, exact) | 11 |
| Downstream-taper cones | hard-coded | 2 |
| **Total cones** | tangent + downstream | **13** |

> **Note on `min_count=4`:** the undivided shoulder generator floors taper drums at 4 to disambiguate the upstream merging-taper run from the downstream-taper run (which has 2 cones + the first tangent cone). Without the floor, low-speed scenarios would tie at 3 drums and `_extract_taper_indices` would mis-identify the taper. (Comment at `src/generation/layout.py:299`.)

---

## Tool Output

### Total / Breakdown

**24 devices.**

| # | Device | Label |
|---:|---|---|
| 1 | ARROW_BOARD | RIGHT_ARROW |
| 13 | CONE | — |
| 4 | DRUM | — |
| 1 | SIGN_GENERIC | G20-1 |
| 1 | SIGN_GENERIC | G20-2 |
| 1 | SIGN_GENERIC | G20-5P |
| 1 | SIGN_GENERIC | W20-1 |
| 1 | SIGN_GENERIC | W20-2 |
| 1 | SIGN_GENERIC | W21-5aR |

### Sign-side analysis

**6 right, 0 left, 0 centerline.** All signs single-sided as expected for undivided.

### Hand-calc comparison

```
[PASS] L_full (taper):                 62.50 / 62.50      delta=+0.00
[PASS] L/3 (shoulder taper):           20.83 / 20.83      delta=+0.00
[PASS] buffer:                        155.00 / 155.00     delta=+0.00
[PASS] device_spacing_in_taper:        25.00 / 25.00      delta=+0.00
[PASS] device_spacing_on_tangent:      50.00 / 50.00      delta=+0.00
[PASS] taper drums (count):             4.00 / 4.00       delta=+0.00
[PASS] tangent cones (incl. ds):       13.00 / 13.00      delta=+0.00
[PASS] advance A:                     100.00 / 100.00     delta=+0.00
[PASS] advance B:                     100.00 / 100.00     delta=+0.00
[PASS] advance C:                     100.00 / 100.00     delta=+0.00

10/10 hand-calc checks passed.
```

### Formula verification

```
Formula choice: Speed 25 mph < 40 mph threshold -> using L = W x S^2 / 60
Expected formula kind: quadratic
```

Quadratic formula confirmed.

### Validation

**0 errors, 0 warnings.**

### Colorado supplement

```
[PASS] Signs on both sides of divided highway (CO Supp §6C.04(A))
       Required: False. Signs placed: 0 left, 6 right.
[PASS] G20-5P plaques every 2,640 ft (CO Supp §6C.06(A))
       Zone length: 976 ft. Required: 1. Placed: 1.
```

§6C.04(A) reports `Required: False` — exactly the expected behavior on an undivided highway. The audit no-ops the sign-side check rather than firing it.

### Corridor

- Most-downstream device: −150 ft
- Most-upstream device: 976 ft (W20-1)
- **Total corridor: 1,126 ft.** Tight (~0.21 mi) thanks to the urban-low advance-warning regime where C lives at only 100 ft.

### Quote

| | Day | Night |
|---|---:|---:|
| Equipment | $140 | $140 |
| Labor | $375 | $562 |
| Total | $987 | $1,214 |

---

## Critical-Check Summary

| Check | Result |
|---|---|
| §6C.04(A) does NOT fire (is_divided=False) | ✅ skipped (`Required: False`) |
| All signs on right side only | ✅ 6 right / 0 left |
| Quadratic formula confirmed (L = W × S² / 60) | ✅ "Speed 25 mph < 40 mph threshold" path |
| 0 errors, 0 warnings | ✅ |

All four critical checks pass. The low-speed quadratic boundary works correctly, undivided gating is honored, and the post-fix tool produces a clean validation result.

*Re-run with* `uv run python scripts/verify_25mph_urban.py`.
