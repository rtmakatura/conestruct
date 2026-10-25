# Mission clear-small-queue: report

Tracking issue: #392 (https://github.com/rtmakatura/conestruct/issues/392). Run 2026-10-24/25 in one `/mission` session.
Base: `mission-clear-open-queue-prod-check` at `7266a62` (the pending evidence branch, on origin/main `0ea3e8a`).

## Questions for Ryan

No item was parked. Two calls on #388 are worth your eye, because they set what a Thornton plan prints:

1. **#388, which directions count as "affected".** I ruled (R7) that a direction of travel is affected when its traffic passes the work on the same carriageway. So a two-way undivided shoulder plan counts both directions, 4 signs, even though the drawing signs only the work direction. A one-way or divided shoulder plan counts 1 direction (2 signs), and a flagger plan counts 2 (4 signs). The item agent's first reading was "affected = the plan signs it", which gives 2 signs on every shoulder plan. The reviewer pointed out that under that reading none of your road facts (two-way, one-way, single carriageway) ever changes the count, so I went with R7. **Recommendation:** keep R7. If you want the other reading, it's a one-line change in `mainline_directions_of_travel` (`src/api/schemas.py`).
2. **#388, near_intersection.** Each cross-street leg counts as one more affected direction, because the plan places an advance set on every approach (§6N.12.06, `src/generation/layout.py:1927-1929`). A two-way mainline with one leg prints 6 signs, and with two legs 8. **Recommendation:** keep it.

Also for you: stipulation 6 is quoted from `data/jurisdictions/thornton.json:53`, the repo's record of it. The Thornton handout itself isn't committed (`BLOCKED.md:63` calls it undated), so there is no page cite. Your ruling is the authority for the count. #394 asks for the handout to be committed.

## Ready to ship

Top branch: **`issue-353-redirects-flake`**. One ship.ps1 run ships the whole chain:

| # | Branch | Commit |
|---|---|---|
| base | `mission-clear-open-queue-prod-check` | `7266a62` (#387's production-check evidence) |
| #388 | `issue-388-thornton-sign-count` | `d116fbb` |
| #389 | `issue-389-overpass-guard` | `ae4feaf` |
| #390 | `issue-390-proxy-content-type` | `692de98` |
| #391 | `issue-391-ci-check-wait` | `857c3f8` |
| #353 | `issue-353-redirects-flake` | `06306b4`, then this report |

Production checks after the go:
- #388: a Thornton shoulder plan (two-way and divided) and a flagger plan, posted to `/render/xlsx` and `/render/audit`. Check the "Advance Warning Signs (jurisdiction-required)" count is 4 / 2 / 4 on the device list, quote, breakdown and crew sheet. A CDOT and a Lakewood plan still print 1.
- #390: `POST /render/corridor-map` through www still answers `image/jpeg`. The no-header path can't be hit in production; it's covered by tests only.
- #389, #391, #353: test-only. Check healthz = HEAD.

## Filed

- #393 Lakewood's double-posting rule and CDOT General Note 11 print 1 advance warning sign with no sourced count: https://github.com/rtmakatura/conestruct/issues/393
- #394 Thornton TC permit handout isn't committed, so stipulation 6 can't be cited with a page: https://github.com/rtmakatura/conestruct/issues/394
- #395 BandAerial comment still says PNG, and JSON proxies default a missing content-type to application/json: https://github.com/rtmakatura/conestruct/issues/395

## Calls I made

- **#388 not parked.** The item agent first returned PARK because the handout isn't in the repo. Your instruction says #388 "is sourced, not parked", so parking would have reversed your ruling. I sent it back to quote `thornton.json:53` as the repo's record and to say plainly that there is no page cite.
- **#388 R7** (above), replacing the agent's first reading, after the cycle-0 review.
- **#388, no carriageway facts.** When the verdict comes back `not_applicable`, the count follows the plan's own `divided` flag, the same fact the drawing is built on, rather than refusing. Only `undecided`, which the request gate already refuses, gives no count.
- **#388 R1–R6** (item agent, R145 self-ruled): the count lives in the data file (`qty_per_direction: 2`); gated kinds get no direction count and refuse; the delta panel reads the backend's count, and a per-direction rule with no count on the wire shows "—" / "per direction", never "+1"; Lakewood and CDOT are left byte-identical (filed as #393).
- **#389:** the guard sits on `httpx.AsyncClient.send`, for Overpass URLs only. It raises a RuntimeError, so the mirror race can't score it as one mirror down, and it fails the test at teardown so a swallowed hit still fails. The two tests that tripped it get the "mirrors down" stub. Sync `httpx.Client` is not patched, since no src/ path uses it for Overpass (reviewer note 8; not folded).
- **#390:** reuse the existing "Corridor map failed" 502 body, so there's no new copy. Filed the reviewer's out-of-diff notes as #395.
- **#391:** 0.1 min (6 s) CHOSEN, about 12 times a measured warm read. I didn't fold the reviewer's nit: the test comment says the read overran "under full-suite load", but the #369 evidence shows it also failed alone. Fixing a comment would have meant running both gates again. The commit message states it correctly.
- **#353:** fixed inside the test file, not with a global timeout; 30 s CHOSEN (about 22 times the slowest measured load). The failure never reproduced, and the fix is labelled a likely, code-level cause.

## Flakes

None. No test failed in any full run this mission: 7 pytest runs, the last on the top branch, and 7 full vitest runs, 3 of them base runs for #353. GeneratorShell.value-links and redirects.test.ts, both known local flakes, passed every time.

## Per item

### #388: Thornton stipulation 6 counts two signs per direction of travel affected (`d116fbb`)
- **Change:** `thornton.json` gets `qty_per_direction: 2`, and the schema accepts it (not together with `qty`). The new `ScenarioParams.directions_of_travel_affected` comes from the plan's road facts, and `_effect_qty` multiplies; with no direction count it refuses. The same count appears on the device XLSX, quote, page 1, breakdown, crew sheet, replication snapshot and delta panel.
- **Churn:** 516 bodies checked, base vs branch. Only the 36 Thornton bodies moved, and the audit didn't move: divided shoulder 1→2, two-way shoulder 1→4, one-way shoulder 1→2, flagger 1→4, two-way near_intersection with 1 leg 1→6, one-way near_intersection with 1 leg 1→4.
- **Tests:** `3593 passed, 2 skipped`; ruff, ruff format and mypy clean; vitest `JurisdictionSection*` 41 passed; tsc clean.
- **diff-verifier (cycle 1):** "VERDICT: PASS" — "wrote PASS marker for 9 code file(s), hash 1d765560090b".
- **Independent reviewer (cycle 1):** "**PASS**, with three minor notes. None of them blocks the commit." Notes 1 and 3 (R7's leg basis; checkpoint §3/§4 marked superseded) were fixed as doc-only edits before the commit. Note 2 (the "—" placeholder) is kept as house style.
- **Cycle 0:** diff-verifier PASS; reviewer "**Verdict: PASS.** ... Two findings need doc or test fixes. One reading needs to go to Ryan in the report." Those findings were sent back as repair cycle 1.

### #389: no test can reach live Overpass (`ae4feaf`)
- **Change:** an autouse guard in `tests/conftest.py`, plus stubs on the 2 tests that tripped it. Both reached Overpass through the audit's bearing check. Test code only.
- **Tests:** guard on, no stubs: `3593 passed, 2 skipped, 2 errors`, the same two tests failing alone too. After the stubs: `3593 passed, 2 skipped`. 3595 test IDs before and after. A red-proof scratch test failed in 0.13 s.
- **diff-verifier:** "VERDICT: PASS" — "wrote PASS marker for 12 code file(s), hash c4598a1500c2".
- **Independent reviewer:** "**PASS**", with two non-blocking notes (sync `httpx.Client` isn't covered; say "Overpass unplugged" in the close comment).

### #390: the band aerial proxy forwards the backend's content-type (`692de98`)
- **Change:** `render-proxy.ts` passes the header through as-is, and a 200 with no `content-type` answers 502 "Corridor map failed" (it used to be relabelled `image/png`). Latent: no production answer changes.
- **Tests:** red on base `1 failed | 5 passed (6)`, after `6 passed (6)`; full site suite `238 passed | 1 skipped` files, `2536 passed | 1 skipped` tests; tsc clean, lint 0 errors.
- **diff-verifier:** "VERDICT: PASS" — "The verdict is unchanged, so I did not rewrite the marker. The earlier PASS marker still stands (hash e4975e09a76e)."
- **Independent reviewer:** "**Verdict: PASS.** I found nothing that blocks the commit." Its out-of-diff notes are filed as #395.

### #391: the ci-check limit test waits 6 s (`857c3f8`)
- **Change:** `-WaitMin 0.1` (CHOSEN), with "(waited 0.1 min)" expected. The script is untouched.
- **Tests:** alone 10 of 10 (7.48–7.60 s); red proof with the `waiting` line deleted fails; `tests/test_ci_check.py` 19 passed; full suite `3593 passed, 2 skipped`; ruff and mypy clean.
- **diff-verifier:** "VERDICT: PASS" — "wrote PASS marker for 15 code file(s), hash b3b6c19233d3".
- **Independent reviewer:** "**PASS.** I found one wording nit and nothing that blocks the commit." (Not folded; see Calls.)

### #353: redirects.test.ts loads the config once in beforeAll (`06306b4`)
- **Change:** `next.config.mjs` (which imports @sentry/nextjs) loads in `beforeAll` with a 30 s timeout (CHOSEN), not inside the first test's 5 s budget. The tests and assertions are the same.
- **Tests:** never reproduced (0 failures in 6 full runs). Red proof at a scaled 500 ms budget: base `1 failed | 1 passed`, fixed `2 passed`. Full suite `238 passed | 1 skipped` files, `2536 passed | 1 skipped` tests, three fixed runs in a row; tsc clean.
- **diff-verifier (cycle 1):** "VERDICT: PASS" — "wrote PASS marker for 16 code file(s), hash 1738e00c17ec".
- **Independent reviewer (cycle 1):** "**PASS**, with two small findings that don't block." Both were fixed as doc-only edits before the commit.
- **Cycle 0:** diff-verifier "VERDICT: PASS"; reviewer "**FAIL.** One wording defect in the permanent code comment. The fix itself is sound." (the comment stated the never-reproduced timeout as observed). Fixed in repair cycle 1.

## Top branch, before push (CI green on `06306b4`: Python tests and Frontend tests)

On `issue-353-redirects-flake` at `06306b4`:
- pytest: `3593 passed, 2 skipped in 232.46s`
- ruff check: `All checks passed!`
- ruff format: `260 files already formatted`
- mypy: `Success: no issues found in 49 source files`
- vitest: `Test Files 238 passed | 1 skipped (239)`, `Tests 2536 passed | 1 skipped (2537)`
- tsc: clean
