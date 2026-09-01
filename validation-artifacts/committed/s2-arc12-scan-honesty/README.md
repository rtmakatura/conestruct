# s2-arc12 — scan honesty (#213, phase 0 of #224)

Failure and measured absence are distinct end-to-end.  An all-mirrors
Overpass failure at `/api/road-bearing` used to serialize byte-identical
to a measured empty result (`{candidates: [], isUrban: false,
placeName: null}` at HTTP 200), so the modal narrated an outage as
"No road detected within 30 m" and the silent `isUrban:false` biased
road-type classification rural.  The corridor validation's
`checked:False` conflated three causes and the audit PDF asserted
"no site coordinates supplied" for all of them.

## Rulings (Ryan, 2026-08-31, on the s2-arc12 📋 checkpoint — all six as recommended)

1. gh is the sole source of truth for issue counts; the hand counter
   (65→69, unreconstructable provenance) is retired.  handoff.md
   corrected in this arc's docs commit.
2. V4/V5 land in phase 0 (the reason split + honest copy per surface).
3. Wire vocabulary: `scan_status: "ok" | "unavailable"` — one shared
   enum, adopted by road-bearing now, reused verbatim by phase 1's
   `site_scan`.
4. The s2a1 record reinterpretation is on the record (below).
5. Phase split as proposed (phases 3 and 4 separate).
6. SiteConditionsField checkbox rows survive as-is until phase 3
   replaces them with tier rows in one motion.

## The phase map of record (#224, ruled 2026-08-31)

- **Phase 0 — s2-arc12 (this arc), closes #213**: the honest-failure
  substrate.  `scan_status` on the road-bearing wire; unavailable
  claims nothing; picker + NI cross-pin guards; corridor-validation
  reason split (`not_run_no_coords` | `check_unavailable`) with honest
  copy on PDF and panel; one committed regression fixture per
  distinguishable outcome.
- **Phase 1 — the in-generate scan (backend)**: generation runs
  `detect_along_corridor` server-side against final geometry (the
  s2-arc5 chain); Pydantic-first `site_scan` provenance
  (status reusing the phase-0 enum, error, mode, measured_at, buckets);
  scan failure → honest 400 + recovery (relay-fact pattern) with an
  explicit proceed-anyway; parity fixture detect-then-generate ≡
  auto-generate; Generate latency measured before/after and committed.
  Frontend still uses the button — no UI change ships here.
- **Phase 2 — the honest Generate flow (frontend)**: scan stage
  disclosed in Generate's progress; refusal UX with retry +
  proceed-anyway; the NOT-CHECKED disclosure on panel + section 03 +
  audit PDF (containment stays zero); the manual detect section
  retires (#186 doctrine carried; #198 family-2 unaffected); any rail
  surface speaks only through deriveRail (#228 sentinel enforces).
- **Phase 3 — conditions become tier facts**: applied conditions as
  tier rows (▲ added/modified, ✓ checked-and-clear) with s2-arc4
  margin evidence, pinned via the lib/tiering.ts ⟷ tier_ledger.py
  expectation JSON; the checkbox rows retire here, in one motion.
- **Phase 4 — corrections/overrides, closes #224**: dismiss-with-reason
  + operator-asserted conditions in the #179 undo family + #227
  resolved-record shape; overrides re-generate; both kinds disclosed
  on the plan.

## The s2a1 record correction (ruling 4)

`validation-artifacts/committed/s2-arc1-sandbox-honesty/live-checks/
s2a1-live-verification.md:5-7` records "one transient no-candidate
flake" during the 2026-08-17 prod run, dispositioned as a runner defect
(the script was changed).  Given the mechanism proven in this arc — a
transient zero-candidate response at a pin that returns candidates on
retry is exactly `buildResponse(null)`'s signature — that observation
was plausibly #213 live on prod.  **Superseded as to cause; the script
change stands.**  Same date, same class as #213's own capture: the
identical `POST /api/road-bearing` at 39.71466, -104.94071 returning
`{candidates: [], isUrban: false, placeName: null}` then 5 candidates
seconds later.

## Failure taxonomy → fixtures

Road-bearing (`conestruct/site/app/api/road-bearing/route.test.ts`):

| Outcome | Wire now | Fixture |
|---|---|---|
| Success, N candidates | 200 `scan_status:"ok"` + candidates | "the 0-then-5 capture" (request 2) |
| Success, 0 in reach | 200 `"ok"`, empty candidates, place facts kept | "a genuine empty scan stays a measurement" |
| Timeout/network/5xx all mirrors | 200 `"unavailable"`, claims nothing | "all-mirrors outage" |
| 4xx (hard stop, one fetch) | 200 `"unavailable"` | "a 4xx is unavailable" |
| 5xx then a mirror answers | 200 `"ok"` | "a 5xx falls through" |
| Extension-query failure | own-way geometry, silent (phase-1+ scope) | "the Colfax transient, pinned" (green by design) |

Site detection (`tests/test_site_detection.py`): outage → all buckets
empty + `error` (`stub_overpass_down`); every mirror tried; 4xx hard
stop (`stub_overpass_4xx`); corridor variant identical.  The two
`error` branches (`site_detection.py` detect_site_conditions /
detect_along_corridor) had zero coverage before this arc — the branches
were CORRECT at baseline; those four tests are coverage pins, green in
the red run, and labeled so.  `/render/detect-site` error pass-through:
`tests/test_render_api_detect_site.py::test_detector_error_key_passes_through`
(also a green pin — the spread already preserved it).

Corridor validation (`tests/test_site_detection.py` validate_* tests,
red at baseline): error result → `check_unavailable` (+ error detail);
exception → `check_unavailable`; bearing missing →
`not_run_no_coords`; success carries no reason key.
PDF copy per cause: `tests/test_audit_blocks_corridor.py` (red at
baseline).  Panel: `conestruct/site/components/AuditTrail.corridor.test.tsx`
("▲ CHECK UNAVAILABLE" renders; not-run and legacy dicts stay silent).

## Runs

- `red-run-frontend.txt` — the commit-1 fixtures against the pre-fix
  tree: 10 failed / 5 passed (the 5 are the behavior pins that touch
  no new field).
- `red-run-backend.txt` — 6 failed / 29 passed (the reds: 3 validate
  reason + 3 audit-blocks copy; the greens include the four
  error-branch coverage pins, correct at baseline as investigated).
- `green-run-frontend.txt` — full vitest suite, 845/845.
- `green-run-backend.txt` — full pytest, 1942 passed / 2 skipped
  (pre-existing skips), containment harness included and zero.
- Snapshot re-baseline: `rebaseline_check.py`'s CHECK_ONLY run proved
  the drift on all 70 corpus grid cases is EXACTLY
  `+ sections.corridor_validation.reason = 'not_run_no_coords'`;
  the same leaf was applied to the 8 live-compared endpoint baselines
  (`rebaseline_endpoint.py`).  The 8 `*_pre_*` history snapshots have
  no consumer and were left untouched.

## Live checks (local; prod re-run after ship)

`live-checks/s2a12-live-checks.js` against this worktree's dev server —
**ALL PASS 12/12** (`live-checks/outS2A12LC/s2a12-live-checks.md`):

- L1 real Overpass at the E Bayaud pin (the #213 triage coordinate):
  candidates render, neither failure copy shows.
- L2 the lake pin: the absence copy renders — a completed empty scan is
  still a measurement (#213 acceptance bullet 2), never the
  unavailable copy.
- L3 the unavailable wire shape through the served modal bundle
  (Playwright fulfills `/api/road-bearing` with
  `{scan_status:"unavailable",…}` — Overpass itself cannot be downed
  on demand; the route's own mirror handling is proven at
  route.test.ts level): unavailable copy + ↻ Re-detect roads, no
  absence claim, panel names the failure, no Rural verdict in the
  modal.
- L4 interception dropped, ↻ Re-detect roads clicked: real detection
  recovers.

Honesty note: the unavailable state cannot be produced against real
Overpass on demand; L3 is a served-bundle rendering proof, not an
upstream-outage proof.  The upstream mirror behavior is fixture-proven
(route.test.ts).

## Contracts held

- Suggest-never-set untouched (the fix only withholds false claims).
- No #198 strings moved.  Audit copy changes (rule 5, old → new):
  "Corridor check not run (no site coordinates supplied)." →
  "Corridor check not run (no site coordinates or bearing supplied)."
  (not-run; the old sentence was also wrong when coords existed but
  bearing was missing) | NEW "Corridor check unavailable — OpenStreetMap
  could not be reached at generation; road-network warnings were not
  evaluated. Re-generate to retry." (unavailable).  New picker strings:
  "Road detection is unavailable right now — use ↻ Re-detect roads to
  retry, or enter bearing manually." (warning strip).
- Rule 13: "▲ CHECK UNAVAILABLE" word + glyph, existing warn/none ink
  only — no new colors, nothing to re-measure; the modal's outcome
  card keeps the chromeless ◌ for no-verdict per rule 13's own
  no-verdict clause.
- Rail and tier expectation JSON untouched.
- No Pydantic changes (the road-bearing route is Next-side; the
  corridor reason rides the existing audit-section dict per the
  Arc-15 no-response_model convention).

## Prod-run provenance (added 2026-09-01, post-close)

- `live-checks/outS2A12LC-prod/` is the run performed at ship time
  (2026-09-01T15:58Z).  Its md self-titles "(local)" because the
  script's report template was not updated for the prod run — the
  `BASE = "https://www.conestruct.com/sandbox"` line in the committed
  scripts (`s2a12-lc-prod.js`, `s2a12-lc-prod-l2rerun.js`) is the prod
  tie.  It recorded 2 failures, both on L2 at the lake pin: the two
  asserts ("absence copy renders" and "never the unavailable copy")
  failed together, meaning the deployed picker rendered the
  UNAVAILABLE copy ("Road detection is unavailable right now…") — the
  honest #213 state — during a real upstream Overpass transient.  This
  is NOT the 0-then-5 signature (#213's dishonest absence-on-an-
  unmeasured-frame); it is the shipped fix rendering an outage
  honestly, and the FAIL is the harness's expectation of a completed
  empty scan, not a product defect.  The L2 re-run ~4 minutes later
  (Ryan's disposition) measured the genuine absence: `L2 RE-RUN PASS`.
  The archive pins no sha; its association with `a7bc4ac` rests on the
  #213 close comment and timing.
- `live-checks/outS2A12Prod-pinned/` is the definitive record
  (`s2a12-lc-prod-pinned.js`): sha-gated in its own output — first
  lines quote the live `/healthz` JSON
  (`{"status":"ok","sha":"a7bc4ac…"}`) and `git rev-parse origin/main`
  with a PASS/FAIL gate that aborts on mismatch.  Run
  2026-09-01T19:23–19:24Z, result **ALL PASS 13/13** (the gate + the
  full L1–L4 set, 12 checks), first attempt, no re-runs.
