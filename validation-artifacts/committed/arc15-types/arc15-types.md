# Arc 15 — types pair: #34 + #35 (no merge; two commits, one arc)

Investigated and shipped 2026-08-05 on `issue-35-34-types`, cut from
main `34c283d`. Both issues (filed 2026-06-05 out of the #17 mypy
cleanup, `8acc82d`) were **alive and verbatim at HEAD** — neither was
drift-closed by the ~30 intervening commits to these files; only line
numbers moved. Merge question answered NO: disjoint files, disjoint
defects, coupled only through a shared future-TypedDict gating. The
full TypedDict migration was declined (M-scale churn on S issues, on a
shape whose eighth bucket is an unimplemented placeholder that will be
redesigned when curvature analysis lands).

## Scope map at HEAD (pre-fix)

| | #34 | #35 |
|---|---|---|
| Defect | `road_curvature` had `details: str` (all 7 siblings: `list[str]`) and no `count` | Handler grafted `mode` / `corridor_unavailable_reason` onto the detector's return by in-place subscript assignment |
| At HEAD | `src/rules/site_detection.py:232-235` and `:425-428` (filed 232-235/424-427 — essentially unmoved) | `src/api/render_api.py:857, 858, 861, 865` (filed 398-407 — moved ~460 lines, four sites verbatim) |
| Wire-adjacent | Yes — `/render/detect-site` response corner, consumed by nobody (audit below) | Mechanism internal; produced wire unchanged |

Consumer audit (both surfaces, pre-fix): Streamlit `app.py` reads
buckets only via `_DETECTION_TO_FLAG` (5 keys, `road_curvature`
excluded) plus one generic scan at `app.py:617` that reads only
`detected` (always False for the placeholder). Next.js
`SiteConditionsField.tsx` reads only `mode` + the 5 `DETECTION_TO_FLAG`
buckets; `road_curvature` and `corridor_unavailable_reason` are never
dereferenced. The frontend's `DetectionBucket` mirror already declared
`details?: string[]` — the pre-fix backend violated its own mirror in
this corner.

## Reproductions (fresh, at pre-fix HEAD)

**#34** — mypy-clean generic consumer (`for key, bucket:
bucket["details"].append(...)`) against the real offline path: seven
`ok:` lines, then

```
  File "...repro_34.py", line 15, in annotate_all_buckets
    bucket["details"].append(note)
AttributeError: 'str' object has no attribute 'append'
```

mypy on the repro: zero diagnostics on the consumer (the landmine is
invisible under `dict[str, Any]`, as filed).

**#35** — minimal `SiteDetectionResult` TypedDict + the handler's
verbatim graft pattern:

```
repro_35.py:26: error: TypedDict "SiteDetectionResult" has no key "mode"  [typeddict-unknown-key]
repro_35.py:27: error: TypedDict "SiteDetectionResult" has no key "corridor_unavailable_reason"  [typeddict-unknown-key]
```

The blockage is at the handler boundary, not in site_detection — as filed.

## The fixes

- **#34** (`3458bcc`): both construction sites build `road_curvature`
  via the same helpers as their seven siblings (`_empty(...)` /
  `_empty_corridor_bucket(...)`, the latter gaining the same optional
  `detail_msg` parameter `_empty` already had). Rule-12 trace: the
  shape is what the runtime's own helpers produce for every other
  bucket and what the frontend mirror already declares. **Declared
  Rule-5 wire change**, response-direction (no backend-first concern —
  that rule guards request-direction Pydantic drops): `details` becomes
  a single-element list, `count: 0` appears, and in corridor mode
  `features: []` — full within-mode sibling uniformity. Repo-wide scan:
  no schema, snapshot, or fixture pinned the old shape.
- **#35** (`c34bc2d`): the four mutation sites become
  spread-construction at the return sites (`{**result, "mode": ...}`),
  same key order the mutations produced. **No `response_model`,
  deliberately** (ruled in the GO): a Pydantic response model filters,
  so any unmodeled key (`junction_refs`, `features`,
  `nearest_distance_m`, `error`) would be silently dropped from the
  wire — the Rule-10 silent-substitution class. The test sentinel
  carries `junction_refs` to pin that unmodeled extras survive.

## Regression tests, both red-proven (Rule 10)

- `tests/test_site_detection.py` +3: per-key positive shape assertions
  on all eight buckets in both detectors, plus the exact generic
  `details`-append pattern that used to crash. Against the pre-fix
  construction (stash of the src change): **3 failed** —
  `AttributeError`/`KeyError` on `road_curvature` — then 16/16 green.
- `tests/test_render_api_detect_site.py` (new — the handler had ZERO
  coverage before): all three paths (corridor / ValueError fallback /
  point) assert response == `{**sentinel, boundary keys}` AND the
  sentinel object is unmutated after the request — the defect-class
  pin. Against the pre-fix handler (stash): **3 failed** (sentinel
  mutated) — then 3/3 green. In-arc harness fix recorded honestly: the
  first corridor-test body sent `road_type: "urban"`, which
  `_map_road_type` rejects *inside* the try — the request fell to the
  unpatched point path and hit live Overpass; fixed to the TS
  vocabulary `"urban_arterial"` so the patches govern and no test
  touches the network.

## Verification

- Python suite: **1850 passed, 2 skipped**, including the six new
  tests.
- mypy: **63 errors in 10 files before AND after** — all pre-existing,
  none in the touched region; `site_detection.py` stays 0-error. The
  slip from TYPES.md's recorded 35-in-6 baseline is **#208** (filed by
  Ryan at the Arc 15 GO); no re-baseline in this arc.
- tsc/frontend: untouched (zero frontend changes).
- Post-ship minimum (approved scope, runs after Ryan's ship): suites +
  mypy + tsc at the shipped sha, triple gate, one prod curl of
  `/render/detect-site` (Lakewood pin, point mode) asserting the new
  `road_curvature` shape + `mode: "point"`. No Playwright — nothing
  user-visible changed.
