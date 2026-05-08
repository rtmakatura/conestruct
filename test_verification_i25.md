# I-25 Colorado Springs — Verification Report

**Generated:** 2026-05-08
**Harness:** `scripts/verify_i25.py` (run from project root)
**Tool revision:** `main` @ commit `1603ab4` (working tree, uncommitted Prompt-1 gate applied)

---

## Test Parameters

| Field | Value | Source |
|---|---|---|
| Project | I-25 Acceleration/Deceleration Lanes | CDOT public project page |
| Location | I-25 NB, Colorado Springs, MP 144.5–146.0 | project page |
| Coordinates | 38.886, -104.822 (near Garden of the Gods Rd interchange) | manual lookup |
| Direction of travel | Northbound, bearing ~350° | manual |
| Roadway | Interstate 25, divided, 3 NB travel lanes + auxiliary | project page |
| Posted speed | 55 mph (reduced from 75 mph in work zone) | project page |
| Closure | Right shoulder closure for auxiliary-lane construction | project page |
| Work zone length modeled | **1,000 ft** (single-shift segment of MP 144.5–146.0 = 7,920 ft) | spec |
| Lane width | 12.0 ft | spec |
| Shoulder width | 10.0 ft | spec |
| Divided | True | I-25 has concrete median barrier |
| Night work? | Modeled both day and night shifts | project page flags night |

ScenarioParams used:

```python
ScenarioParams(
    speed_mph=55,
    num_lanes=3,
    closure_type="shoulder",
    road_type="freeway",          # mapped from interstate
    work_zone_length_ft=1000.0,
    lane_width_ft=12.0,
    shoulder_width_ft=10.0,
    is_night=False,               # flipped True for Test 4
    is_divided=True,
    jurisdiction="CDOT",
)
```

---

## Test 1: Baseline Results

### a) Total device count

**25 devices.**

### b) Device breakdown by type

| # | Device | Label |
|---:|---|---|
| 1 | ARROW_BOARD | RIGHT_ARROW |
| 12 | CONE | — |
| 4 | DRUM | — |
| 1 | SIGN_GENERIC | G20-1 (BEGIN ROAD WORK) |
| 1 | SIGN_GENERIC | G20-2 (END ROAD WORK) |
| 3 | SIGN_GENERIC | G20-5P (construction plaques, ½-mile) |
| 1 | SIGN_GENERIC | W20-1 (ROAD WORK AHEAD) |
| 1 | SIGN_GENERIC | W20-2 (DETOUR AHEAD) |
| 1 | SIGN_GENERIC | W21-5aR (RIGHT SHOULDER CLOSED) |

### c) Taper length (L/3)

- Full merging taper `L = W × S = 10 × 55 = 550 ft`
- Shoulder taper used = `L/3 = 183.33 ft`
- Formula choice: 55 mph ≥ 40 mph threshold → `L = W × S` (MUTCD §6C.08)

### d) Buffer space

**495 ft** (MUTCD Table 6B-2, lookup at 55 mph).

### e) Advance warning sign distances (A, B, C)

**A = 1,000 ft, B = 1,500 ft, C = 2,640 ft.**

These are the **freeway / expressway** Table 6B-1 distances — the asymmetric values you wanted to verify. Confirmed via raw lookup `advance_warning_spacing(55, "freeway") → {A: 1000, B: 1500, C: 2640}`.

### f) Advance warning sign codes used

W21-5aR (at A), W20-2 (at B), W20-1 (at C). Plus G20-1 / G20-2 begin/end markers and G20-5P plaques every ½ mile per CO Supplement §6C.06(A).

### g) Total corridor length

- Most-downstream device station: −150 ft (downstream taper / G20-2 END ROAD WORK)
- Most-upstream device station: 6,818 ft (W20-1 ROAD WORK AHEAD at C)
- **Total corridor: 6,968 ft (~1.32 miles).** Most of this is the 5,140 ft of advance-warning space upstream of the shoulder taper, which is correct for an interstate.

### h) Validation errors / warnings

3 × **WARNING** `CHANNELIZER_SPACING_TOO_WIDE` (MUTCD §6C.09): "Channelizer spacing 61 ft exceeds the in-taper maximum 55 ft (±10%) at 55 mph."

→ The shoulder taper is 183.33 ft and the generator places 4 drums, giving an interval of 183.33 / 3 = 61.1 ft, which rounds outside the 10 % tolerance on the 55 ft target. See **Bug 4** below.

Plus one **Colorado supplement check FAIL** (surfaced through the audit trail, not as a `Violation`):

> [FAIL] Signs on both sides of divided highway (CO Supplement §6C.04(A)) — Required: True. Signs placed: 0 left, 8 right.

This is **Bug 1** below — the most consequential finding of the run.

### i) Sign positions (audit trail)

| Position | Code | Station (ft) | Distance from taper start |
|---|---|---:|---|
| C (furthest) | W20-1 | 6,818 | 5,140 ft upstream |
| B (middle)   | W20-2 | 4,178 | 2,500 ft upstream |
| A (nearest)  | W21-5aR | 2,678 | 1,000 ft upstream |

Stations are measured from the downstream end of the work zone (positive = upstream). All three advance signs are right-side only — see Bug 1.

---

## Test 2: Site Detection Results

`detect_site_conditions(38.886, -104.822, radius_m=500)`:

| Category | Detected | Count | Nearest |
|---|:-:|---:|---|
| intersections | ✅ | 19 | 47.1 m |
| sidewalks | ✅ | 14 | 45.7 m |
| bike_facilities | ✅ | 3 | 152.3 m |
| schools | — | 0 | — |
| railroad_crossings | — | 0 | — |
| hospitals | — | 0 | — |
| road_curvature | — | (not implemented) | — |

### c) False positives

The 500 m radius pulls in everything in the **surrounding city grid**, not the interstate itself. Specifically:

- **All 19 "intersections"** are surface-street intersections on the parallel local network (Cascade Ave, etc.) that share lat/lng proximity but not roadway. None of them affect TCP for the I-25 mainline shoulder.
- **All 14 "sidewalks"** are on those parallel surface streets (e.g. Templeton Gap Trail, ~458 m). Interstate 25 has no pedestrian facility along the work zone.
- **All 3 "bike_facilities"** are on N Cascade Ave (~152 m), again on a parallel street.

**Practical impact:** if the operator clicks "auto-fill site conditions" they will get `pedestrian_facility=True`, `bicycle_facility=True`, `adjacent_intersection=True` — none of which are correct for an interstate shoulder closure. The downstream `apply_site_adjustments` would then add 4 Type-III barricades + 2 R9-9 + 2 M4-9a + 2 W20-1 signs, ~10 spurious devices.

### d) False negatives (things from the project page that weren't surfaced)

| What we know is there | Did the detector find it? |
|---|---|
| Garden of the Gods Rd **interchange** at MP 146 (within work zone) | ❌ Treated as plain "intersections" — no interchange/ramp distinction |
| Fillmore St interchange at MP 144 | ❌ Same |
| **Ellston St overpass under reconstruction** (within work zone) | ❌ No overhead structure / bridge category exists |
| Chestnut St cross street | ❌ Mixed in with the 19 generic intersections |
| The fact that **this is an interstate** (high-speed, controlled-access) | ❌ Detector doesn't know roadway class |

The detector has no concept of:
- ramp/interchange vs. at-grade intersection
- overhead structures (overpasses, sign bridges)
- roadway classification (interstate vs. surface street)
- whether a "sidewalk" is actually within the work area or on a different road

For interstate work, **site detection at the current configuration is not load-bearing** — every flag it sets is either irrelevant or wrong. See Bug 2.

---

## Test 3: Site Adjustments Results

`apply_site_adjustments(adjacent_intersection=True, all-others=False)`:

### a) New device count

**25 → 27 (delta = +2).**

### b) Adjustment record

```json
{
  "flag": "adjacent_intersection",
  "action": "Added 2 ROAD WORK AHEAD (W20-1) signs facing cross-street traffic.",
  "devices_added": 2,
  "rule": "MUTCD §6C.10 — signing for intersections within or adjacent to work zones"
}
```

Breakdown after adjustment shows the W20-1 count rising 1 → 3 (one mainline, two cross-street facing).

### c) Does cross-street signing make sense for an **interchange**?

**Probably not, as currently implemented.** The two added W20-1 signs are placed "facing cross-street traffic" without any geometric context. An interchange:

- has **ramps**, not at-grade intersections — cross-traffic enters via merge lanes, not a stop bar
- already has its own set of construction signage requirements (W20-3 LANE CLOSED, ramp-specific R-series)
- the cross-street ROAD WORK AHEAD signs from `adjacent_intersection` are designed for surface-street intersections (a 4-way stop next to a paving job, not an interstate ramp)

For this project, `adjacent_intersection=True` would add noise without adding compliance value. A proper "interchange present" adjustment would need separate logic (W20-3 on the upstream ramp, possibly a PCMS at the gore, etc.). See Bug 3.

---

## Test 4: Night Operation Results

Re-ran the generator with `is_night=True`.

### a) Device list — what changes

**Nothing.** Day and night placements are identical: 25 devices, same types, same labels, same stations.

```
Day total:   25
Night total: 25
No device-type or label differences day vs. night.
```

### b) Crew narrative — what changes

Not regenerated in this harness (the narrative is markdown text, not a placement diff). The narrative pipeline (`generate_crew_narrative`) does receive the `is_night` flag through `params`, so the prose differs, but the device table it embeds is identical to the day shift.

### c) Quote — what changes

| Field | Day | Night | Δ |
|---|---:|---:|---:|
| equipment_total | $147 | $147 | 0 |
| labor_total | $375 | $562 | **+$188** (+50.0%) |
| total | $995 | $1,221 | +$226 |
| `is_night` flag | False | True | — |
| `night_multiplier` | 1.5 | 1.5 | — |

The night multiplier of 1.5× is correctly applied to all labor lines (`50.0% over day` matches the configured multiplier exactly).

### d) Night-specific devices — added or not?

**None added.** The generator does not insert:

- Temporary lighting (CDOT M&S §630.05.1 requires illumination at flagger stations and recommends it at tapers for night work — N/A here because no flaggers, but the lighting at the taper itself is still expected on interstates)
- Retroreflective sheeting callouts (currently implicit in DRUM / W-series signs but never *named* in the device list)
- High-intensity warning lights on drums (Type B steady-burn or Type C flashing per MUTCD §6F.83 / §6L.02)

The crew narrative may mention these, but the device list does not. See Bug 5.

---

## Test 5: S-630-1 Comparison

### a) Advance warning sign selection (W20-1, W20-2, W21-5aR)

✅ **Match.** All three S-630-1 Case-11 codes are emitted in the correct positions.

### b) Taper device type (drums)

✅ **Match.** 4 DRUMs in the shoulder taper.

### c) Tangent device type (cones)

✅ **Match.** 12 CONEs along the tangent.

### d) Arrow board placement (at taper start)

✅ **Match.** A single `ARROW_BOARD` with label `RIGHT_ARROW` is emitted; positioned by the generator at the upstream end of the shoulder taper. (No explicit station check vs. the audit trail — the `audit['advance']` table doesn't enumerate the arrow board, but `placements` shows it within the taper-start window.)

### e) Signs on both sides of divided highway

❌ **FAIL.** Colorado Supplement §6C.04(A) requires advance warning signs on **both** the right shoulder and the median for divided highways. The generator places **0 left, 8 right.** This is surfaced inside the audit trail's `colorado.checks` block as a failed check, but it is **not raised as a `Violation`** by `validate_layout` and so the user-facing "validation results" panel still reads green. See Bug 1.

### f) Expressway / freeway distances from Table 6B-1 (THE CRITICAL CHECK)

Two answers, depending on which `road_type` string the user happens to send:

| `road_type` argument | A | B | C | Result |
|---|---:|---:|---:|---|
| `"freeway"` | 1,000 | 1,500 | 2,640 | ✅ **CORRECT** — what we want for I-25 |
| `"expressway"` | 1,000 | 1,500 | 2,640 | ✅ correct |
| `"divided_highway"` | 500 | 500 | 500 | ❌ **silently falls back to rural** |
| `None` (auto-infer at 55 mph) | 500 | 500 | 500 | ❌ silently falls back to rural |
| `"rural"` | 500 | 500 | 500 | (correct for rural, not for interstate) |

**The headline finding:** when the operator selects `road_type="freeway"` (which is what the TS schema sends for `roadType: "freeway"` from the UI), the freeway 1000/1500/2640 distances ARE applied — the tool gets this right for the canonical interstate path.

**But** the `validators.py` module docstring lists `divided_highway` as a valid `road_type` (alongside `urban_low | urban_high | rural | expressway | divided_highway`), while the spacing-table lookup only knows `freeway` and quietly maps anything else through `rural` (500/500/500). A user who follows the validators docstring and passes `road_type="divided_highway"` for a divided-highway-but-not-interstate corridor would get **rural advance warning distances on a 65 mph divided highway** — same bug class you flagged. See Bug 6.

---

## Discrepancies Found

| # | Severity | Surface | Detail |
|---|---|---|---|
| 1 | **HIGH** | Test 1.h, Test 5.e | Divided-highway requires signs on both sides (CO Supp §6C.04(A)). Generator places 0 left, 8 right. Audit trail flags it; `validate_layout` does not. |
| 2 | **MEDIUM** | Test 2 | Site detection has no concept of roadway class; flags surface-street features for interstate work. False-positive rate ~100% for this scenario. |
| 3 | **MEDIUM** | Test 3 | `adjacent_intersection` adjustment doesn't distinguish interchanges from at-grade intersections. Adds wrong sign type for interchange ramps. |
| 4 | **LOW** | Test 1.h | Shoulder-taper drum spacing computes 61 ft when target is 55 ft (±10% = 49.5–60.5). 4 drums on 183.33 ft → 61.1 ft intervals; needs 5 drums (45.8 ft) to land in tolerance. |
| 5 | **MEDIUM** | Test 4.a, 4.d | `is_night=True` is invisible in the device list. No lighting, no warning-light callouts, no Type B/C designations on drums. Quote captures the labor multiplier; placements don't. |
| 6 | **HIGH** | Test 5.f | `road_type="divided_highway"` (documented as valid) silently falls back to rural advance-warning distances. Auto-infer at 45+ mph also silently picks rural. Either should be an explicit error or should map to `expressway`. |

(There is also a minor doc/code mismatch to flag: `validators.ScenarioParams.road_type` doc lists `divided_highway` as a valid value; `spacing.advance_warning_spacing` lists `freeway` instead. They disagree — pick one.)

---

## Bugs to Fix (priority ordered)

### P0 — Bug 1: Missing Colorado-Supplement left-side signs on divided highways

**File:** `src/generation/layout.py::generate_shoulder_closure_divided`

**Symptom:** On a divided highway, every advance warning sign (W20-1, W20-2, W21-5aR) is right-shoulder only. CO Supp §6C.04(A) requires the same set on the left (median) shoulder.

**Fix:** in the divided generator, mirror the W-series advance signs across the median (negative offset). Optionally extend the validator to raise this as an `error`-severity `Violation` so the UI surfaces it.

**Why P0:** This is a regulatory-compliance failure that the tool currently emits as a passing plan (no `Violation` raised). For divided-highway shoulder work it ships an under-signed plan.

### P0 — Bug 6: `road_type` resolution silently falls back to rural

**Files:** `src/rules/spacing.py::advance_warning_spacing`, `src/rules/validators.py::ScenarioParams` (docstring), bridge in `src/api/schemas.py::_map_road_type`.

**Symptom:** `road_type="divided_highway"` and auto-infer at 45+ mph both return rural distances (500/500/500) instead of expressway (1000/1500/2640). For a 65 mph divided highway this is a 5,000+ ft mis-placement of the C sign.

**Fix:** make the lookup raise on unknown `road_type` (it already does for non-listed strings — but not for `divided_highway`, which is "documented but unmapped"). Either add `divided_highway → expressway` to the table, or remove `divided_highway` from the validators docstring and add a Pydantic-level check on the schema bridge that rejects ambiguous values. Auto-infer should also raise (or warn) for 45+ mph rather than silently downgrading.

**Why P0:** Same compliance class as Bug 1 — under-spec'd advance warning at high speed. The current TS UI happens to send `freeway` and avoids the bug, but anyone calling the Python API directly (tests, future integrations) hits it.

### P1 — Bug 5: Night operation invisible in device list

**Files:** `src/generation/layout.py` (and helpers), possibly a new `src/rules/night.py` for the augmentation pass.

**Symptom:** `is_night=True` doesn't change placements. CDOT M&S §630 / MUTCD §6F.83 expect Type B/C warning lights on drums, taper-area illumination, and explicit retroreflective callouts.

**Fix:** add a post-pass that, when `is_night=True`, decorates DRUMs with a `night=True` attribute (or appends a `WARNING_LIGHT` device per drum) and inserts portable lighting at the taper start. Re-run the device-list export to surface the new column.

**Why P1:** Quote pricing already reflects night labor; the operator gets a labor-only cost increase but no extra hardware on the BOM. They will under-order equipment.

### P1 — Bug 3: `adjacent_intersection` mis-applies to interchanges

**File:** `src/rules/site_adjustments.py`

**Symptom:** Adds at-grade-intersection W20-1 signs on cross-street legs that don't exist for an interchange.

**Fix:** split the flag into `adjacent_intersection` (at-grade) vs. `adjacent_interchange` (ramps). The new flag drives W20-3 / R-series / PCMS at the gore. Exposure: requires a new entry in `_DETECTION_TO_FLAG` and a UI checkbox.

**Why P1:** False positive in a common interstate setup; misleading audit trail for engineers reviewing the plan.

### P2 — Bug 2: Site detection is roadway-class-blind

**File:** `src/rules/site_detection.py`

**Symptom:** A 500 m radius around an interstate point catches every parallel surface-street feature (sidewalks, intersections, bike lanes) and reports them as relevant.

**Fix:** join detected features against the corridor / target way (already partially scaffolded in `detect_along_corridor` from WP1) and filter to features that intersect the corridor polygon, not the point's bbox. Tag features with their parent way's `highway` tag so the consumer can ignore non-mainline matches.

**Why P2:** Correctness improvement, not a compliance failure on its own — but it makes the site-detection step actively misleading on interstate jobs. Probably wants to be done together with the corridor-aware site-detection work in WP2's deferred items.

### P2 — Bug 4: Drum spacing in shoulder taper exceeds tolerance

**File:** `src/generation/layout.py` (taper drum count selection).

**Symptom:** 4 drums in a 183.33 ft taper → 61.1 ft intervals; tolerance is 55 ft ±10% → 49.5–60.5 ft. Triggers 3 × `CHANNELIZER_SPACING_TOO_WIDE` warnings on every divided-highway shoulder run at 55 mph.

**Fix:** swap the drum-count selector for `pick_device_count(length_ft, target_spacing_ft, tolerance=0.10)` (already exists in `src/rules/spacing.py`), which would pick 5 drums at 45.8 ft.

**Why P2:** Currently a warning, not an error. But it fires on the canonical happy-path scenario — every shoulder closure at 55 mph generates noise in the validator output, eroding the operator's trust in the validator.

---

## Notes for Future Scenarios

- **Corridor-aware detection (WP2 deferred):** Bug 2 should be addressed jointly with the deferred WP2 corridor map work — both want the same "match features against the actual corridor polygon, not a circle around a point" primitive.
- **Validator vs. audit-trail dichotomy:** The Colorado-supplement `[FAIL]` from §6C.04(A) lives in the audit trail but never crosses over into `validate_layout`'s `Violation` list. The audit trail is verification-grade prose; the validator is what gates the UI's red/green status. Failures that are *binary* (sign present / not present) should produce a `Violation`, not just an audit row. Bug 1 is a worked example.
- **Road-type taxonomy is split-brain:** `validators.py` documents `divided_highway` as a valid value; `spacing.py` documents `freeway`. The TS schema bridge maps to `freeway`. Pick one canonical list and write it down. Recommend `urban_low | urban_high | rural | expressway | freeway` (drop `divided_highway` — divided-ness is already a separate boolean on `ScenarioParams.is_divided`).
- **Quote vs. plan invariant:** Bug 5 exposes a class of issues — anything driven by `is_night` (or any boolean modifier) should fan out to **both** placements and pricing. A simple test could enforce: any param flag that flips a quote line item must also flip at least one placement-list row (or be explicitly opted out of with a comment).
- **Workzone-length sanity:** the audit trail reports a 6,968 ft corridor for a 1,000 ft work zone (almost 7× the work area). That's correct for an interstate — most of the corridor is advance-warning distance, not work — but it's worth surfacing in the UI so an operator entering a 1,000 ft scenario doesn't get surprised when the static-image preview pans over a 1.3-mile region.

---

*Verification harness lives at `scripts/verify_i25.py`. Re-run with `python scripts/verify_i25.py` from the project root. No changes were committed.*
