# s2-arc15 — #224 phase 1: the in-generate site scan (backend)

Branch `issue-224-phase1-scan` on top of `14a06c2` (prod at branch time: healthz == origin/main == `14a06c2`).
Phase 1 of the #224 phase map of record (`../s2-arc12-scan-honesty/README.md`). Backend only; the frontend sends
nothing new this phase and the manual detect button stays. #224 stays OPEN after this arc (phases 2–4 remain).

Ryan's rulings (2026-09-02 checkpoint): all seven as recommended — precedence (scan owns the five detection keys,
manual-only pass through, discards disclosed) · one scan per Generate via a per-container memo, TTL 120 s CHOSEN ·
the scan uses the plan's own params · budget 20 s wall CHOSEN · no bearing ⇒ `not_run`/`no_bearing`, no point-mode
fallback · `sections.site_scan` always present · nothing prints this phase.

## Commits
1. `3c52adc` test: red fixtures — `tests/test_site_scan_ingenerate.py` (16 tests) + the recorded Lakewood Overpass
   payload `tests/fixtures/site_scan/lakewood_overpass.json` (146 elements, captured 2026-09-03 14:32Z, mirror
   fallback took 41.4 s; provenance sidecar). `red-run-backend.txt`: collection error — `src.api.site_scan` absent.
2. `dcb15f5` feat: `src/api/site_scan.py` (Pydantic models + `run_site_scan`), `SiteScanScenarioFields` mixin on all
   seven kinds, `audit_projection(site_scan=…)` writes `sections.site_scan` ALWAYS. Snapshot churn proven single-leaf
   (below) and re-baselined in the same commit.
3. `fd45ba3` feat: the scan in `_placements_for` — corridor from params + relayed centerline, ruling-1 precedence,
   effective flags to `apply_site_adjustments` AND `_plan_sheet_site_flags`, sixth tuple element at six call sites and
   four `_render_with` lambdas; honest 400 + proceed-anyway; `budget_s` threaded through
   `_overpass_request_with_fallback` / `detect_along_corridor`. **The planned commits 3 and 4 are this one commit** —
   the refusal is two lines at the same chokepoint as the scan; a separate commit would have been a paper split.
4. `cfedf42` docs: evidence (this folder minus the README).
5. this README.

## What generation does now
- `scenario.site_scan` absent (every request the frontend sends today) ⇒ byte-identical behavior: manual
  `meta.siteConditions` apply; the audit carries `sections.site_scan = {status:"not_run", reason:"not_requested", …}`.
- `site_scan: {}` present ⇒ `run_site_scan` builds a `WorkCorridor` from the plan's own `ScenarioParams` (speed, work
  zone, `closure_type`, `road_type`, lane + shoulder width, jurisdiction, `meta.centerline`), runs
  `detect_along_corridor` under a 20 s budget, derives the five flags, merges per ruling 1, and applies. Provenance:
  `status · reason · error · mode · measured_at · duration_ms · budget_s · memo_hit · proceeded_anyway · inputs
  (lat, lng, bearing, speed, work zone, closure, road_type, lane/shoulder width, centerline vertex count, bbox) ·
  buckets · flags · manual_flags_discarded · disclosure`.
- Overpass never answers within budget ⇒ HTTP 400 `{error:"site_scan_unavailable", message, site_scan, recovery:
  {retry:true, proceed_field:"site_scan.proceed_if_unavailable"}}` at every render surface. With
  `proceed_if_unavailable:true` the plan builds from the manual flags only; `status:"unavailable"`,
  `proceeded_anyway:true`, `disclosure:"SITE CONDITIONS NOT CHECKED — service unavailable at generation."` — the one
  backend-authored string phase 2 will print on the sheet, narrative and audit.
- No `matchRefusalAffordance` row (the matcher is predicate-on-scenario by design; a server failure has no scenario
  predicate). The existing `detail.message` path renders the 400 as PLAN DECLINED; phase 2 adds the first code-keyed
  affordance (retry + proceed) on `error === "site_scan_unavailable"`.
- Not-run reasons: `not_requested` · `no_coords` · `no_bearing` · `corridor_unbuildable` (a closure type the corridor
  math does not know — unreachable for the enabled kinds; the fourth reason was not in the checkpoint's draft and is
  disclosed here).

## Parity (acceptance bullet 1)
`test_parity_detect_then_generate_equals_auto_scan`: Path A = `/render/detect-site` with the plan's corridor inputs →
the button's flag rule → `/render/audit` + `/render/device-breakdown` with those manual flags. Path B = the same
scenario with `site_scan:{}` and no manual flags. Both see the recorded Lakewood payload. `sections.site_adjustments`
byte-equal (3 records: adjacent_intersection, pedestrian_facility, bicycle_facility); device rows equal. Live
(outS2A15Local C2/C3): the same equality against real Overpass, 41 == 41 devices.

**Parity is claimed for corridor mode only** (ruling 5). The case is the shoulder-divided kind because
`/render/detect-site` has no shoulder-width field: divided ⇒ `params.shoulder_width_ft` (10 ft) == `build_corridor`'s
default, so both paths' corridor inputs are identical without a new field on the manual endpoint.

### The manual button's two input drifts — on the record (ruling 3)
The button (`SiteConditionsField.tsx`) builds its corridor from inputs that differ from the plan's own params:
1. **closure type** — `SCENARIO_KIND_TO_CLOSURE_TYPE` sends `flagger_lane_closure → "flagger"` (one-lane-two-way
   taper, `one_lane_two_way_taper_length()`), while the plan's `params.closure_type` is `"lane"` (merging taper L);
   the corridor taper — and the scan bbox — differ for flagger plans.
2. **shoulder width** — the button omits it, so `build_corridor` uses 10 ft; the plan carries 8 ft for the undivided
   kinds (`schemas.py` bridge), and the shoulder taper is L/3 of that.
The in-generate scan uses the plan's params (Rule 12: the sourced values). No button fix is filed — the button retires
in phase 2; this note is the disclosure. The TS map is untouched this arc (zero frontend commits).

## Rule 5 — churn predicted vs actual
Predicted: `sections.site_scan` on every audit ⇒ 74 corpus + 8 endpoint baselines move by one additive leaf; six
`_placements_for` call sites; zero visible changes; zero frontend commits.
Actual: **70** corpus grid cases (`GRID_CASES`; the other 4 corpus files are near-intersection PLACEMENT snapshots,
untouched) + **8** live-compared endpoint baselines = 78, each by EXACTLY one leaf — `check-only-corpus.txt` is the
CHECK_ONLY run before re-baselining (`rebaseline_check.py` / `rebaseline_endpoint.py`, the s2-arc12 pair adapted; the 8
`*_pre_*` history snapshots untouched). Six call sites plus the four `_render_with` lambdas (the write callback gained
the scan argument — an implementation detail the prediction did not name). Two existing tests edited, both key-set
pins meeting an additive key: `test_audit_endpoint.py` (sections key set gains `site_scan`) and `test_audit_pdf.py`
(`_SKIP_KEYS` gains `site_scan` — see phase-2 debt). One new-suite correction after the red run: the Overpass stub
counts SCAN queries only, because the audit already makes one Overpass round trip per request today
(`validate_corridor_against_osm` → `detect_road_bearing`, an `around:` query) and the red commit's stub counted that
too. Zero visible changes on any surface. Zero frontend commits.

## Latency
Before (`before-prod-14a06c2/timings.txt`, prod, 2026-09-02): audit 3.0 / 13.0 / 36.2 s · breakdown 0.54–0.59 s ·
pdf 1.5 / 1.8 s · manual corridor detect 2.7 / 3.5 / 16.3 s. The audit's variance today is the corridor-validation
Overpass trip (no budget; 25 s × 3 mirrors worst case), not layout.

After, local (`latency-after-local.txt`, uvicorn on `fd45ba3`, real Overpass from this machine — NOT the Modal
network; the prod after-table lands with the post-ship live check): plain audit 37–40 s in those minutes (Overpass
mirrors slow; the validation trip); cold scanned audits 3.9 / 32.5 / **400** / **400** / 13.1 s with scan time 2.3 /
13.5 / — / — / 3.8 s; memo-hit audits 13.4 / 13.6 / 6.7 s (the scan cost nothing — the residual is the validation
trip); breakdown 0.39–0.43 s plain and scanned-with-memo alike; cold breakdown **400** at 21.1 s; markdown after the
memo expired: **400** at 21.1 s. The 400s are the budget working: `latency-after-local-cold-sample.txt` is one in
full — `site_scan.error: "scan budget exceeded (20 s)"`, `duration_ms: 20748`, the recovery pointer. Honesty note:
this run also hammered Overpass from one IP (each cold scan + each validation = two queries), which plausibly
slowed the mirrors; the prod number is the one that counts.

Observation for the phase-2 latency ruling: the scan under budget is bounded at ~21 s; the UNBUDGETED corridor
validation next to it is not (37–40 s measured) — the audit's worst case is now the old check, not the new one.

## Response size (`response-size.txt`)
Audit JSON: plain 5467 B (leaf 277 B) · scanned ok 11707 B (leaf 4999 B; +6240 B) · proceed-anyway 5689 B ·
refusal 400 body 885 B. Request grows by 15 B (`"site_scan":{}`) against the 32 KB proxy request cap.

## Live check (`s2a15-lc-prod.js`)
s2-arc12 prologue (UTC, BASE, healthz verbatim, `git rev-parse origin/main`, gate that aborts on mismatch; local mode
records HEAD and states the served build is the working tree). A always-present `not_run` · B the scan at the
Lakewood control · C live parity vs the manual endpoint · D memo hit via `measured_at` (prod caveat: another Modal
container is a legitimate miss — INFO, not FAIL) · E `no_bearing` / `no_coords` · F forced failure stated as
test-proven, not faked (Overpass cannot be downed on demand) · size and timing lines.
- `outS2A15Local/` — **ALL PASS 14/14 (+1 INFO)**, 2026-09-03 14:49Z, real Overpass.
- `outS2A15Prod/` — post-ship (next prompt).

## Contracts held
- #104 `site_adjustments` byte-identical (parity fixture; `test_site_adjustments*` untouched).
- Phase-0 (#213) tests untouched and green; the TS road-bearing enum never sees `not_run`; the phase-0 `lambda q:`
  stubs still work (positional call when unbudgeted).
- Suggest-never-set: the scan writes flags into the apply path and the sheet's context flags, never into the wire
  scenario (`test_scan_never_writes_the_wire_scenario`), never a form or jurisdiction field.
- Rule 3 backend owns corridor build, flag derivation, precedence, verdict · Rule 10 three statuses + four reasons,
  key always present · Rule 12 `SCAN_BUDGET_S = 20.0`, `MEMO_TTL_S = 120.0` marked CHOSEN in code and here ·
  Rule 5 above · three-hop unchanged (the proxy spreads the scenario whole, so `site_scan` rides through).
- Containment harness green and zero — it does not exercise the scanned path (its fixtures carry no coordinates).

## Phase-2 debt (recorded)
- A scanned-path containment fixture when the NOT-CHECKED disclosure prints.
- `tests/test_audit_pdf.py::_SKIP_KEYS` drops `site_scan` when the provenance prints, so the single-source proof covers it.
- The first code-keyed `matchRefusalAffordance` row (`error === "site_scan_unavailable"`: retry + proceed-anyway).
- The corridor-validation trip is unbudgeted (37–40 s measured locally); a budget there is a separate item.

## Not run
- Prod live check (post-ship). Prod after-table (post-ship). `next build` (frontend untouched; vitest 863/863 recorded).
