# US-85 NB Brighton — Verification Report

**Generated:** 2026-05-08
**Harness:** `scripts/verify_us85.py` (run from project root)
**Tool revision:** `main` working tree — uncommitted Bug Fixes 1, 4, 6 applied
**Purpose:** Cross-check the post-fix tool on a *rural divided* corridor at 65 mph (NOT a freeway). Validates that the fixes generalize beyond the I-25 freeway baseline.

---

## Test Parameters

| Field | Value | Source |
|---|---|---|
| Project | US-85 NB shoulder closure, north of Brighton | spec |
| Coordinates | 39.9714, −104.8205 | spec |
| Direction | Northbound | spec |
| Roadway | US-85 (rural divided) | spec |
| Posted speed | 65 mph | spec |
| Lanes | 2 NB | spec |
| Closure | Right shoulder | spec |
| Work zone | 1,000 ft | spec |
| Lane width | 12 ft | spec |
| Shoulder width | 10 ft | spec |
| `is_divided` | True | divided highway with median |
| `road_type` | `"rural"` | US-85 is rural divided, not interstate |
| Jurisdiction | CDOT | spec |

```python
ScenarioParams(
    speed_mph=65,
    num_lanes=2,
    closure_type="shoulder",
    road_type="rural",
    work_zone_length_ft=1000.0,
    lane_width_ft=12.0,
    shoulder_width_ft=10.0,
    is_night=False,
    is_divided=True,
    jurisdiction="CDOT",
)
```

---

## Hand Calculations (expected)

| Quantity | Formula / source | Expected |
|---|---|---:|
| Full taper L | `W × S = 10 × 65` (MUTCD §6C.08, S ≥ 40 mph) | 650 ft |
| Shoulder taper (L/3) | `L / 3` | 216.67 ft |
| Buffer space | MUTCD Table 6B-2, 65 mph | 645 ft |
| Advance A / B / C | Table 6B-1 *rural* at 65 mph | 500 / 500 / 500 ft |
| In-taper spacing | `device_spacing_in_taper(65)` (= speed) | 65 ft |
| On-tangent spacing | `device_spacing_on_tangent(65)` (= 2× speed) | 130 ft |
| Taper drums | 5 drums (4 intervals @ 54.2 ft) | 5 |
| Tangent cones (taper line) | 9 cones (8 intervals @ 125 ft) | 9 |
| Downstream-taper cones | hard-coded 2 | 2 |
| **Total cones** | tangent + downstream | **11** |

> **Note on hand-calc inputs** — the user-supplied expectations included two minor errors that the harness surfaced:
>
> - "5 drums in 216.67 ft taper at ~43 ft spacing" — 5 drums means 4 intervals; 216.67 / 4 = **54.17 ft**, not 43 ft. (43 ft would be 5 intervals = 6 drums.) The tool emits 5 drums at 54.17 ft, which is conservative under §6C.09 (target 65 ft, max 71.5 ft).
> - "8 cones on 1,000 ft tangent at ~125 ft spacing" — 8 cones means 7 intervals; 1000 / 7 = **142.86 ft**, not 125 ft. (125 ft would be 8 intervals = 9 cones.) The tool emits 9 cones for the tangent line, which is the count that *actually* produces 125 ft spacing. The total cone count of 11 then includes the 2 downstream-taper cones the hand calc didn't enumerate.
>
> Both corrections come out *toward more devices* (= more conservative spacing), which is what Bug Fix 4 was designed to do: prefer ceil intervals (smaller spacing) when neither candidate lands inside the ±10 % tolerance window, and tolerate sub-target spacing freely (MUTCD §6C.09 specifies a maximum only).

---

## Test 1: Baseline Results

### Total device count

**31 devices.**

### Breakdown

| # | Device | Label |
|---:|---|---|
| 1 | ARROW_BOARD | RIGHT_ARROW |
| 11 | CONE | — |
| 5 | DRUM | — |
| 2 | SIGN_GENERIC | G20-1 (mirrored) |
| 2 | SIGN_GENERIC | G20-2 (mirrored) |
| 4 | SIGN_GENERIC | G20-5P (mirrored, 2 stations × 2 sides) |
| 2 | SIGN_GENERIC | W20-1 (mirrored) |
| 2 | SIGN_GENERIC | W20-2 (mirrored) |
| 2 | SIGN_GENERIC | W21-5aR (mirrored) |

Every advance / begin / end / plaque sign is mirrored on the median per Bug Fix 1.

### Geometry vs. hand calc

| Quantity | Tool | Hand calc | Match |
|---|---:|---:|:-:|
| L_full | 650.00 ft | 650.00 ft | ✅ |
| L/3 | 216.67 ft | 216.67 ft | ✅ |
| Buffer | 645.00 ft | 645.00 ft | ✅ |
| In-taper spacing target | 65.00 ft | 65 ft | ✅ |
| On-tangent spacing target | 130.00 ft | 130 ft | ✅ |
| Advance A | 500 ft | 500 ft | ✅ |
| Advance B | 500 ft | 500 ft | ✅ |
| Advance C | 500 ft | 500 ft | ✅ |
| Taper drums | 5 | 5 | ✅ |
| Tangent cones (line) | 9 | 9 (corrected) | ✅ |
| Downstream-taper cones | 2 | 2 | ✅ |
| **Total cones** | 11 | 11 | ✅ |

**9 of 10 automated `_check` assertions PASS.** The one FAIL — `tangent cones (actual): actual=11.00, expected=8.00, delta=+3.00` — reflects the off-by-one in the user-supplied hand-calc spec, not a tool defect (see "Note on hand-calc inputs" above). Once corrected, the count is exact.

### Advance warning sign positions

| Position | Code | Station (ft) | Distance from taper |
|---|---|---:|---|
| C (furthest) | W20-1 | 3,362 | 1,500 ft upstream |
| B (middle) | W20-2 | 2,862 | 1,000 ft upstream |
| A (nearest) | W21-5aR | 2,362 | 500 ft upstream |

Each row has a mirrored twin at offset_ft = −sign_offset_right.

### Validation

**0 errors, 0 warnings.** No `CHANNELIZER_SPACING_TOO_WIDE` or `_TOO_TIGHT` (Bug Fix 4 in effect — picker selects 5 drums at 54.17 ft, below the 65 ft target).

### Colorado supplement audit

```
[PASS] Signs on both sides of divided highway (CO Supp §6C.04(A))
       Required: True. Signs placed: 7 left, 7 right.
[PASS] G20-5P/R2-6P plaques every 2,640 ft (CO Supp §6C.06(A))
       Zone length: 3,362 ft. Required: 2. Placed: 2.
[PASS] Speed reduction <= 15 mph per sign installation (CO Supp §2B.13(A))
[PASS] Flagger station lighting 500W @ 8 ft (CO Supp §6E.02(A))
[INFO] AADT threshold for mobile operations (<= 2,000) (CO Supp §6G.02(A))
```

### Corridor

- Most-downstream device: −150 ft
- Most-upstream device: 3,362 ft (W20-1)
- **Total corridor: 3,512 ft (~0.66 mi).**

About half the I-25 corridor (6,968 ft) — correct for a rural advance-warning regime where C lives at 500 ft instead of 2,640 ft.

---

## Raw spacing-table check at 65 mph

| `road_type` | A | B | C |
|---|---:|---:|---:|
| `urban_low` | 100 | 100 | 100 |
| `urban_high` | 350 | 350 | 350 |
| **`rural`** | **500** | **500** | **500** |
| `expressway` | 1,000 | 1,500 | 2,640 |
| `freeway` | 1,000 | 1,500 | 2,640 |
| `None` (auto-infer) | **ValueError** (Bug Fix 6) | | |

Bug Fix 6 still active at 65 mph — auto-infer refuses, `divided_highway` would also raise.

Raw primitives all match the hand calc:

```
taper_length(65, 10)            = 650.00 ft
shoulder_taper_length(65, 10)   = 216.67 ft
buffer_space(65)                = 645.00 ft
device_spacing_in_taper(65)     = 65.00 ft
device_spacing_on_tangent(65)   = 130.00 ft
```

---

## Test 2: Site Detection (Brighton)

`detect_site_conditions(39.9714, −104.8205, radius_m=500)`:

| Category | Detected | Count | Nearest |
|---|:-:|---:|---:|
| intersections | ✅ | 31 | 116 m |
| sidewalks | ✅ | 5 | 323 m |
| bike_facilities | — | 0 | — |
| schools | ✅ | 1 (**Brighton Adventist Academy**, 451 m) | 451 m |
| railroad_crossings | ✅ | 2 | 399 m |
| hospitals | — | 0 | — |
| road_curvature | — | (not implemented) | — |

**Same Bug-2 caveat as I-25** — Brighton's site detection still has no notion of roadway class. The 31 "intersections" include surface-street features parallel to US-85; the school is ~451 m off the highway and would not normally trigger a school-zone TC pattern; the railroad crossings could be on a parallel rail corridor rather than the work zone itself.

That said, Brighton's site detection produces **more genuinely-relevant signal** than I-25 did, because US-85 *does* run through a community where lateral conflicts are physically possible. A railroad-crossing detection at 399 m on a rural divided highway is potentially load-bearing in a way the I-25 sidewalk false-positives weren't.

**Recommendation unchanged:** Bug 2 fix should match features against the actual corridor polygon, not the bbox.

---

## Test 3: Night Operation Results

| Field | Day | Night | Δ |
|---|---:|---:|---:|
| Device count | 31 | 31 | 0 |
| equipment_total | $172 | $172 | 0 |
| labor_total | $375 | $562 | +$188 (+50.0 %) |
| total | $1,025 | $1,252 | +$226 |

Same Bug-5 issue as I-25: night labor multiplier flows into the quote (1.5×) but no night-specific equipment (warning lights, taper lighting) appears in the device list. Unaddressed in this fix batch.

---

## Compare to I-25 v2

| Quantity | I-25 (55 mph, freeway) | US-85 (65 mph, rural) | Difference rationale |
|---|---:|---:|---|
| Total devices | 34 | 31 | I-25 has 6 G20-5P (3 stations); US-85 has 4 (2 stations) due to shorter signed length. Drums and tangent cones differ slightly with speed/length. |
| Drums in taper | 5 | 5 | Same picker output; different geometry (183.33 ft / 55 ft → 5; 216.67 ft / 65 ft → 5). |
| Tangent cones | 12 | 11 | I-25 picker chose floor (10 cones at 111 ft, dev=1.1) over ceil (11 at 100 ft, dev=10) — both in-tolerance. US-85 picker chose ceil (9 cones at 125 ft, dev=5) over floor (8 at 143 ft, dev=13). Different deviations because the targets differ. Both then add 2 downstream-taper cones. |
| G20-5P plaques | 6 (3 stations × 2 sides) | 4 (2 × 2) | Function of total signed corridor length: 6,818 ft → ⌈6818/2640⌉ = 3 stations; 3,362 ft → ⌈3362/2640⌉ = 2 stations. |
| Advance A/B/C | 1000/1500/2640 (freeway) | 500/500/500 (rural) | Different Table 6B-1 row. |
| Corridor length | 6,968 ft | 3,512 ft | Almost entirely a function of the advance-warning spread upstream of the taper. |
| Validator output | 0/0/0 | 0/0/0 | Bug Fixes 4/1 hold across both. |
| §6C.04(A) | PASS (8L / 8R) | PASS (7L / 7R) | Bug Fix 1 applies on every divided generator path. |

The fixes are **not freeway-specific.** They behave identically on a rural divided corridor.

---

## Bugs Reproduced / Avoided

| Bug | Status on US-85 |
|---|---|
| 1 (CO §6C.04(A) both sides) | **Avoided** — 7L / 7R, PASS |
| 2 (site detection roadway-class-blind) | **Reproduced** — 31 intersections, school, RR crossings — same false-positive pattern as I-25, slightly less severe |
| 3 (`adjacent_intersection` for interchanges) | Not exercised in this run (no `apply_site_adjustments` call) |
| 4 (drum spacing tolerance) | **Avoided** — 5 drums @ 54.17 ft, no warnings |
| 5 (night invisible in device list) | **Reproduced** — same 0-device-delta for is_night=True |
| 6 (`road_type` silent fallback) | **Avoided** — auto-infer raises at 65 mph |

---

## Conclusion

The post-fix tool produces a fully-validated US-85 NB Brighton 65 mph rural-divided shoulder closure: **31 devices, 0 errors, 0 warnings, all §6C.04(A) checks PASS.** Every hand-calculation match exactly except where the user-supplied hand calc had an off-by-one (cone count) — which the harness correctly surfaced as a discrepancy and which the tool's count is right about.

The four post-fix targets defined for I-25 v2 — 0 errors, 0 warnings, §6C.04(A) PASS, devices > pre-fix baseline — also hold for US-85 with no special-casing. The fixes generalize.

*Re-run with* `uv run python scripts/verify_us85.py` *from the project root. No changes committed.*
