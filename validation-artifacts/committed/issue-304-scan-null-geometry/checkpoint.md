# issue-304-scan-null-geometry — checkpoint (written before Ryan rules)

**Issue:** #304 — the site scan's crash takes down the whole plan (HTTP 500) when Overpass returns a road
point with no coordinates. **Rulings carried:** R58, R59 (ship loop, ride along). `rulings.md` beside this.
**Base:** `3fe27c3` = `origin/main` = prod `healthz`, 2026-09-30. Probes and read-only runs only; no product
code. Evidence: `probes/` (every number below is printed by a committed probe, named where used).

## The answer, in brief

1. **It isn't bad OSM data. One Overpass mirror has a corrupt copy of one far-away street.** The
   crash happens only when the scan's mirror chain falls through to `overpass.openstreetmap.fr`,
   which happens when the primary (`overpass-api.de`) doesn't answer in time. Hence the 17–21 s
   failures and the 3–6 s successes.
   - For the Federal pin's exact query, that mirror returns one extra road way the primary
     doesn't: **way 42125193, "Лермонтов көшесі", a secondary street in Pavlodar,
     Kazakhstan** (52.29° N, 76.94° E).
   - Its geometry has **null points at indices 15 and 39**.
   - The primary mirror has the same way, at the same data timestamp, with 40 points and no nulls.
2. **Everything else in the fallback answer is correct.** Same query, both mirrors, same
   `osm_base`: the scan half is **257 of 257 elements identical**, and the road half differs only
   by that one way (`probes/compare.txt`).
3. **Two defects compound.**
   - **(a) The parse:** `_bearing_from_elements` (`src/rules/site_detection.py:977-982`) reads
     `a["lat"]` on every geometry point.
   - **(b) The guard:** `run_site_scan` (`src/api/site_scan.py:645-650`) promises "Never raises",
     but nothing wraps `detect_along_corridor` (`:792-800`).
   - Before #256's fold, the same bearing derivation ran on its own trip inside a
     `try/except → check_unavailable` (`site_detection.py:1106-1115`). The fold moved it onto the
     unguarded path, so **this is a regression from the #256 fold.**
4. **Recommendation: fix both, in two commits.**
   - **(a)** A geometry point without coordinates isn't a point. Skip any segment with such an
     endpoint. The Federal fallback answer then yields exactly the primary's result: the scan
     answers, and the plan renders with the real scan.
   - **(b)** Any exception inside the scan becomes the scan's existing `unavailable` state, with
     the error named. That's the ruled no-answer flow, never a 500.
   - **The departure:** the issue's acceptance says the scan should report "didn't answer" in this
     case. With (a) it doesn't, because the answer is good (question Q1).

---

## 1. Reproduction (local, at `3fe27c3`, the prod code)

`probes/capture_null_geometry.py` replays #243's Federal request (`issue-243-note-8/recheck-2f27be3/prod/
federal-audit-request.json`: shoulder, 65 mph, rural divided, **no confirmed road**, pin 39.7342642691076,
−105.02504468168067) through the backend six times, with the Overpass fetch wrapped (`probes/capture.txt`):

| Run | HTTP | Time | Mirror that answered | Answer |
|---|---|---|---|---|
| 1, 2, 5 | 200 | 5.9 / 4.2 / 4.1 s | overpass-api.de | 265 elements, 8 road ways, no null points |
| 3, 4, 6 | **500** `render failed: 'NoneType' object is not subscriptable` | 21.5 / 18.1 / 18.4 s | **overpass.openstreetmap.fr** | 266 elements, 9 road ways; way 42125193: 2 of 41 points null, first at index 15 |

- **The traceback** (`issue-243-note-8/recheck-2f27be3/federal-traceback.txt`):
  `render_audit` → `_placements_for` → `run_site_scan` → `detect_along_corridor:794` →
  `_bearing_from_elements:981`, `mid_lat = (a["lat"] + b["lat"]) / 2.0`, which raises
  `TypeError`. `render_api` turns it into `HTTPException(500)`, and the proxy into 502
  "Audit trail failed".
- **The same crash hits `/render/device-breakdown`,** which shares `_placements_for`. The prod
  page showed both failing.
- **Prod** (#243 re-check, 16:02Z): 3 of 3 502s. The Modal log shows `/render/audit` and
  `/render/device-breakdown` 500 at 17.1–17.8 s, the fallback timing.

**The mirror comparison** (`probes/compare_mirrors.py` → `probes/compare.txt`) posted the exact
folded query (`probes/out/federal-folded-query.txt`) straight to both mirrors:
- `overpass-api.de`: 257 scan elements and 8 road ways, no null points.
- `overpass.openstreetmap.fr`: 257 scan elements and 9 road ways, nulls at `{42125193: [15, 39]}`.
- Both report `osm_base 2026-09-30T17:52:53Z`.
- **The scan half: 257 of 257 shared elements identical, none only on either side.** The road
  half: fallback-only `[42125193]`.

**The way itself, asked of each mirror by id** (`probes/way-42125193.txt`):
- `overpass-api.de`: "Лермонтов көшесі", bounds 52.290–52.291° N, 76.940–76.966° E, **40 points,
  no nulls**.
- `overpass.openstreetmap.fr`: same name and bounds, **41 points, nulls at [15, 39]**, same
  `osm_base`.
- `overpass.kumi.systems`: ReadTimeout.
- **Reading:** the fr mirror's copy of this way references two nodes it can't resolve. Its
  spatial index evidently places something of this way near Denver, because an `around:` query
  at the Federal pin returns it. None of the way's resolvable points is within ~1 km of the pin;
  all are in Pavlodar.

**Captured answers kept:** `probes/out/answer-3-0-overpass.openstreetmap.fr.json` (from the scan),
`probes/out/folded-overpass-api.de.json` and `probes/out/folded-overpass.openstreetmap.fr.json`
(direct).

**Disclosure:** runs 1, 4 and 6 of the capture also saved their fr answers. The four had 3 distinct
hashes at equal size (58,874 B each in `capture.txt`; the difference wasn't examined). I deleted
three of them as duplicates before checking. `capture.txt` keeps each run's mirror, size, stray way
and null indices.

## 2. What the code does today

| Where | What | With a null point |
|---|---|---|
| `site_detection.py:642-643` `split_folded_elements` | a road element = one with truthy `geometry` | the stray way lands in the road half |
| `site_detection.py:977-993` `_bearing_from_elements` | midpoints of every consecutive pair; the nearest segment gives the bearing | `TypeError` on `None["lat"]` |
| `site_detection.py:794` (folded path) | calls it with no guard | the exception escapes `detect_along_corridor` |
| `site_detection.py:1106-1115` (standalone path, `validate_corridor_against_osm` without a folded result) | `try/except` → `reason: check_unavailable` | guarded |
| `site_scan.py:645-650` `run_site_scan` | docstring: "Never raises" | raises |
| `site_detection.py:130-136` `_element_coord` (the scan half) | `float(el["lat"])` when the key is present | would raise on a present-but-null value. Not observed; same hazard class |

**Also affected:** `/render/device-breakdown`, the PDF, and every endpoint that builds
`_placements_for` with a scan. The corridor bearing check reads the same `road_bearing` result
(`audit.py:1398-1410`).

## 3. The options

| | Change | Federal via the fallback mirror | Other parse faults | Churn |
|---|---|---|---|---|
| **(a) Skip point-less segments** | `_bearing_from_elements`: a segment counts only if both endpoints carry numeric `lat`/`lon`; the chosen segment is always a valid pair | scan **ok**, flags and bearing = the primary's (the stray way's valid points are ~10,000 km away and never win) | still crash | 0 recorded |
| **(b) The scan never raises** | `run_site_scan`: an exception from `detect_along_corridor` becomes `status: "unavailable"`, `error: "<Type>: <message>"`, not memoised, the #251 refusal path | honest refusal (400 `site_scan_unavailable`, Retry / Generate anyway), losing a good answer | honest refusal | 0 recorded |
| **(c) Harden `_element_coord`** | a present-but-null coordinate is `None` (no coordinate), like a missing one | — | covers the scan half's version of the hazard | 0 recorded |
| (d) Reject the mirror's answer | a malformed answer counts as that mirror's failure and falls through | fr is last in the chain → unavailable; discards an answer measured correct | — | 0 |

**Recommendation: (a) + (b) + (c), in commits in that order.**
- (a) fixes the observed case at its source, and the result is the correct plan (§1: the fallback
  answer is otherwise identical).
- (b) restores the "Never raises" contract. #256's fold broke it, and the standalone path kept
  it. Any future parse fault becomes the ruled no-answer state, never a 500.
- (c) is the same hazard one function over, cheap to close now.
- (d) throws away good data and rests on mirror order.

**Rule 10 on (a):** dropping a point without coordinates isn't a silent substitution, because there
is no point to substitute; the segment doesn't exist. I propose recording the count internally
(`road_bearing["points_skipped"]`, no wire field), so a test can assert it. Not surfaced (Q2).

## 4. Proof plan

**New regression fixtures,** cut from the real captures:
`tests/fixtures/site_scan/federal_fallback_null_points.json` (the fr answer) and
`tests/fixtures/site_scan/federal_primary.json` (the overpass-api.de answer, same query).

- **(a):** the Federal request with Overpass stubbed to the fr answer gives **200**, scan `ok`,
  and effective flags, buckets and `road_bearing` (bearing, way id) **equal to the same request
  stubbed to the primary answer**. That's the issue's "a regression fixture replays the
  empty-point response and asserts a 200 plan".
- **(a), unit:** `_bearing_from_elements` over ways with null, missing-key and non-dict points
  skips them. A way with only one valid pair still yields that pair; a way with none yields no
  bearing.
- **(b):** `detect_along_corridor` stubbed to raise gives HTTP 400 `site_scan_unavailable`, with
  `site_scan.error` naming the exception and `recovery` present. With `proceed_if_unavailable`
  it gives 200, scan `unavailable`, and the not-checked disclosure: today's wording, untouched.
  Nothing is memoised.
- **(c), unit:** `_element_coord({"lat": None, "lon": None})` is `None`, and
  `{"center": {"lat": None, ...}}` is `None`.
- **Unchanged when geometry is complete:** the full suite plus the site-scan recordings (every
  `scanned-*` fixture replays through the real API in `test_tier_ledger`), expected 0 changes.
- **Red first:** each new test fails on `3fe27c3`.
- **Prod after the ship:** the Federal pin through `/sandbox`. The fallback mirror is only reached
  when the primary is slow, so a prod run may well take the primary path. The fixture test is the
  proof for the fallback path, and the prod run proves only that nothing regressed. Stated, not
  hidden.

## 5. Rule 5 churn, predicted

| Item | Change |
|---|---|
| Recorded audits, snapshots, tiering fixtures | **0.** No fixture holds a null geometry point (scanned all `tests/fixtures/**/*.json`: 0) |
| Wire | none: no field added or renamed. `points_skipped` is internal to `road_bearing`, which isn't on the wire (`_NON_BUCKET_KEYS`, `site_scan.py:127`) |
| Existing tests | none expected. The unavailable path's tests already cover the refusal and proceed shapes, and (b) reaches that path from a new cause |
| New files | 2 fixtures (~49 KB and ~47 KB), 1 test module |
| Behaviour | (a) Federal-type answers: 500 → the correct plan. (b) Any other scan exception: 500 → the honest refusal. Everything else unchanged |

## 6. R58 and R59 (ruled; the plan, before building)

**R58: wait for a running CI** (`scripts/ci-check.ps1`, `scripts/ship.ps1` step 1d):
- `ci-check.ps1` gains `-WaitMin` (the ship passes 15) and `-PollSec` (default 30; the tests pass 0).
- Each pass reads both workflows. Any red → stop at once, as today. Only "still running" → print
  one line (`CI still running on <sha> (<workflow>); waiting, <m> of 15 min`), sleep, read again.
  All green → pass. Still running at 15 min → stop, naming what's still running.
- A **missing** run stops at once, as today (Q4).
- **Tests** (`tests/test_ci_check.py`, the stand-in gh): running → running → green passes;
  running → red stops, naming the red; running past the limit stops; red first stops without
  waiting. The stand-in needs a per-call answer sequence (a counter file in its tmp dir).

**R59: fast-forward the main checkout's `main` after SHIP VERIFIED:**
- A new `scripts/sync-main-checkout.ps1 -RepoDir <main checkout>`, called from `Complete-Ship`
  after the cleanup.
- It acts only if the checkout is on `main` and has no modified tracked files (the same "clean"
  the ship uses for its own worktree; untracked and ignored files don't count). Then it runs
  `git -C <repo> merge --ff-only origin/main` and prints `main checkout: <old> -> <new>`.
- Otherwise it prints one line and skips: `main checkout not fast-forwarded: <reason>
  (modified tracked files: <list> | on branch <b> | not a fast-forward)`.
- A failure never un-verifies the ship.
- **Tests:** scratch repos with a clone standing in for the main checkout (the
  `test_branch_cleanup.py` idiom). Clean → fast-forwarded; modified tracked file → skipped, one
  line; on another branch → skipped; diverged → skipped; untracked files present → still
  fast-forwarded.
- **The one thing that blocks R59 today:** the main checkout has a modified tracked file,
  **`.gitignore`**. It adds `.vercel` and `.env*`, is uncommitted, and has been there since
  before this session. Under R59's "only if clean" every ship would skip with that one line
  until it's resolved (Q3).

## 7. Questions (surfaced, not decided)

- **Q1. The acceptance's "didn't answer".** With (a) the Federal fallback answer is used,
  because it's correct apart from the unresolvable street (§1). So the scan reports `ok` and the
  plan renders with real scan data, rather than "didn't answer".
  - **Recommend (a) as proposed.**
  - The alternative is (d) on top: refuse any answer with a malformed road element, i.e. the
    issue's literal wording.
- **Q2. Disclose the skipped points?**
  - **Recommend internal only** (`road_bearing.points_skipped`, asserted in tests, no wire field).
  - The alternative, a provenance field on the wire, is a three-hop change with churn in every
    recorded scan fixture.
- **Q3. `.gitignore` in the main checkout.**
  - **Recommend committing those two lines on this branch.**
  - After the ship the checkout's copy equals `main`'s. The first sync still sees it as modified
    until the fast-forward lands, and git refuses a fast-forward that would overwrite a local
    change, even an identical one (measured, git 2.47.1: `probes/ff-identical-change.txt`). So
    the first R59 run after this ship skips with its one line, and I restore the file once, on
    your word.
  - The alternative is that you tell me to discard the local change.
- **Q4. R58 and a missing run.** A just-pushed tip can take a few seconds to list its runs.
  - **Recommend: stop at once, as today.** The go comes minutes after the push.
  - The alternative is to also wait while a run is missing, within the same 15 minutes.
- **Q5. Commit order.** (a), (b), (c), then R58, then R59, each with its tests in the same commit
  after a red-first check. The regression fixtures land with (a). OK?
