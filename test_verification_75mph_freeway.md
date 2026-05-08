# 75 mph Expressway Divided — Verification Report (high-speed boundary)

**Generated:** 2026-05-08
**Harness:** `scripts/verify_75mph_freeway.py`
**Tool revision:** `main` working tree — uncommitted Bug Fixes 1, 4, 6 applied
**Purpose:** Exercise the upper end of MUTCD Table 6B-2 (75 mph → 820 ft buffer) and the longest advance-warning regime (C = 2,640 ft). Confirm Bug Fix 1 mirrors signs and §6C.04(A) PASSes.

---

## Test Parameters

| Field | Value |
|---|---|
| speed_mph | 75 |
| num_lanes | 2 |
| closure_type | shoulder |
| road_type | **expressway** (also accepted: `freeway`; both give identical Table 6B-1 distances at 75 mph) |
| work_zone_length_ft | 1,500 |
| lane_width_ft | 12 |
| shoulder_width_ft | 10 |
| is_divided | **True** |
| is_night | False |

> **road_type choice:** `"expressway"` and `"freeway"` are both accepted at 75 mph and return identical advance-warning distances (1000 / 1500 / 2640). I picked `expressway` because it was the first option in the user's spec; the I-25 baseline already exercises `freeway`. Bug Fix 6's auto-infer guard *would* fire here if `road_type` were omitted.

---

## Hand Calculations

| Quantity | Formula | Expected |
|---|---|---:|
| Full L (linear) | `W × S = 10 × 75` | 750 ft |
| L/3 | `L / 3` | 250 ft |
| Buffer | Table 6B-2 @ 75 mph (table maximum) | **820 ft** |
| Advance A / B / C | Table 6B-1, expressway | 1,000 / 1,500 / 2,640 ft |
| In-taper spacing | `device_spacing_in_taper(75)` | 75 ft |
| On-tangent spacing | `device_spacing_on_tangent(75)` | 150 ft |
| Taper drums | `pick_device_count(250, 75, min_count=2)` — exact=3.33, floor=3 (83.33 ft, out [67.5,82.5]), ceil=4 (62.5 ft, out). Both out → ceil → 4 intervals → **5 drums** | 5 |
| Tangent cones (line) | `pick_device_count(1500, 150, min_count=2)` — exact=10.0 (lands exactly), floor=ceil=10 intervals → 11 cones | 11 |
| Downstream-taper cones | hard-coded | 2 |
| **Total cones** | tangent + downstream | **13** |

---

## Tool Output

### Total / Breakdown

**35 devices.**

| # | Device | Label |
|---:|---|---|
| 1 | ARROW_BOARD | RIGHT_ARROW |
| 13 | CONE | — |
| 5 | DRUM | — |
| 2 | SIGN_GENERIC | G20-1 |
| 2 | SIGN_GENERIC | G20-2 |
| 6 | SIGN_GENERIC | G20-5P (3 stations × 2 sides) |
| 2 | SIGN_GENERIC | W20-1 |
| 2 | SIGN_GENERIC | W20-2 |
| 2 | SIGN_GENERIC | W21-5aR |

### Sign-side analysis

**8 right, 8 left, 0 centerline.** Bug Fix 1's mirror is exactly balanced.

### Hand-calc comparison

```
[PASS] L_full (taper):                750.00 / 750.00     delta=+0.00
[PASS] L/3 (shoulder taper):          250.00 / 250.00     delta=+0.00
[PASS] buffer:                        820.00 / 820.00     delta=+0.00
[PASS] device_spacing_in_taper:        75.00 / 75.00      delta=+0.00
[PASS] device_spacing_on_tangent:     150.00 / 150.00     delta=+0.00
[PASS] taper drums (count):             5.00 / 5.00       delta=+0.00
[PASS] tangent cones (incl. ds):       13.00 / 13.00      delta=+0.00
[PASS] advance A:                    1000.00 / 1000.00    delta=+0.00
[PASS] advance B:                    1500.00 / 1500.00    delta=+0.00
[PASS] advance C:                    2640.00 / 2640.00    delta=+0.00

10/10 hand-calc checks passed.
```

### Formula verification

```
Formula choice: Speed 75 mph >= 40 mph threshold -> using L = W x S
Expected formula kind: linear
```

### Validation

**0 errors, 0 warnings.** Bug Fix 4's drum picker handles the 250 ft taper cleanly (5 drums @ 62.5 ft, conservative under the 75 ft target).

### Colorado supplement

```
[PASS] Signs on both sides of divided highway (CO Supp §6C.04(A))
       Required: True. Signs placed: 8 left, 8 right.
[PASS] G20-5P plaques every 2,640 ft (CO Supp §6C.06(A))
       Zone length: 7,710 ft. Required: 3. Placed: 3.
```

### Corridor

- Min station: −150 ft
- Max station: 7,710 ft (W20-1 at C = 2,640 ft upstream of taper)
- **Total corridor: 7,860 ft (~1.49 mi).** Largest of any verification — driven by C = 2,640 ft × 3 advance signs upstream of the 250 ft taper, and three plaque stations spaced at half-mile intervals across the work zone + buffer + advance-warning region.

### Quote

| | Day | Night |
|---|---:|---:|
| Equipment | $184 | $184 |
| Labor | $375 | $562 |
| Total | $1,039 | $1,266 |

---

## Critical-Check Summary

| Check | Result |
|---|---|
| §6C.04(A) fires and PASSes (is_divided=True) | ✅ `Required: True`, 8 L / 8 R |
| Sign sides balanced left/right | ✅ 8 / 8 |
| Buffer = 820 ft (table max) — no off-by-one or rounding | ✅ exact match |
| Total corridor very long (~1.5 mi from advance-warning C) | ✅ 7,860 ft |
| 0 errors, 0 warnings | ✅ |

**Upper-bound geometry verified.** The 75 mph case exercises Table 6B-2's maximum buffer (820 ft), the largest A/B/C advance distances (1000/1500/2640), and the longest possible corridor — all without numerical issues. Bug Fix 4's picker correctly chooses 5 drums when both candidates fall outside the ±10 % tolerance window. Bug Fix 1's mirror produces 8/8 sign balance.

*Re-run with* `uv run python scripts/verify_75mph_freeway.py`.
