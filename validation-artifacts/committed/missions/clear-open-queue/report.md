# Mission clear-open-queue, report (2026-10-24)

Tracking issue: #387. Six issues, one stacked chain on `origin/main` `5853151`. No pending evidence branch was carried.

## Questions for Ryan

None. No item was parked.

Before item 1, CLAUDE.md (untracked) was updated, as asked:
- Line 16 now reads "Every issue, or every mission (/mission), runs in a fresh foreground session".
- Line 27 now reads "CC works its one issue, or its one mission's issues, to done; the next issue or mission starts in a fresh session".

## Ready to ship

Top branch: `issue-367-lane-buffer-cite`. One ship.ps1 run fast-forwards main through the whole chain:

| # | Branch | Commit |
|---|---|---|
| #385 | `issue-385-scenario-defaults-comment` | `486a364` |
| #381 | `issue-381-crew-sheet-delta-rows` | `9548379` |
| #383 | `issue-383-footer-scan-stub` | `4f76a8e` |
| #380 | `issue-380-overspan-tick-tolerance` | `418a16e` |
| #369 | `issue-369-aerial-content-type` | `70213f7` |
| #367 | `issue-367-lane-buffer-cite` | `f43ae27`, plus this report's commit |

End checks on the top branch (`f43ae27`, Windows):
- pytest: `3580 passed, 2 skipped`
- ruff check: `All checks passed!`
- ruff format: `259 files already formatted`
- mypy: `Success: no issues found in 49 source files`
- CI on `f43ae27`: Python tests success, Frontend tests success.
- vitest: see Flakes. The first full run gave `10 failed | 2521 passed | 1 skipped`, the second `9 failed | 2522 passed | 1 skipped`. The failing file passes alone, `13 passed (13)`.

## Filed

- #387: the tracking issue, https://github.com/rtmakatura/conestruct/issues/387
- #388: every surface prints Thornton's advance warning sign row as 1 EACH, but stipulation 6 asks for two per direction of travel affected. Needs a ruling on how to count directions per plan kind. https://github.com/rtmakatura/conestruct/issues/388
- #389: a network-layer guard against live Overpass in tests. https://github.com/rtmakatura/conestruct/issues/389. Its Reference line cited the wrong lines; corrected in https://github.com/rtmakatura/conestruct/issues/389#issuecomment-6388260188
- #390: the site proxy falls back to `image/png` when the backend sends no content-type. https://github.com/rtmakatura/conestruct/issues/390
- #391: `test_ci_check.py::test_still_running_at_the_limit_stops_and_says_how_long` depends on timing. https://github.com/rtmakatura/conestruct/issues/391

## Calls I made

All R145 self-ruled and recorded in each item's `rulings.md`:
- **#385 R1–R2:**
  - R1: the defaults comment says the three live kinds and names the four gated kinds.
  - R2: folded in the `DEFAULT_NEAR_INTERSECTION` "GATED" comment.
- **#381 R1–R5:**
  - The crew sheet builds its equipment list from the device XLSX's rows.
  - Thornton stipulation 6 is quoted, and no station is given (none is sourced).
  - One `delta_row_name` helper serves the XLSX, the quote and the crew sheet.
  - The replication snapshot passes the rule rows.
  - R4: folded in the pilot car the snapshot left out.
  - The 1-vs-2-per-direction count is filed as #388, not decided.
- **#383 R1–R2:**
  - R1: one shared `stub_worst_case_scan` helper.
  - R2: the optional conftest guard is filed as #389. With it on, a full run broke 95 tests.
- **#380 R1–R2:**
  - R1: the fix belongs in the test.
  - R2: the tolerance is the clock's own resolution, so no CHOSEN number. It is 1 ns on Linux, so CI's bound doesn't change.
  - The production `OVERSPAN_HEAD_START_S` (4.0 s) is unchanged.
- **#369 R1–R5:**
  - R1: content-type comes from the image bytes. The issue's "fall back to `image/jpeg`" was not taken, because a guessed label is the bug.
  - R2: bytes that are neither PNG nor JPEG get a 502 instead of a 200. This is a deliberate behavior change; the site shows its existing "The aerial didn't load" message.
  - R3: `fetch_png` is renamed `fetch_image`. Three committed probe scripts from past arcs still patch the old name. They are left unedited and can't be re-run as they are.
  - R4: the site fallback is filed as #390.
  - R5: folded in the route docstring fix.
- **#367 R1–R2:**
  - The buffer cite becomes MUTCD 11th Ed. §6B.06, Table 6B-2, using #361 R3's wording.
  - The buffer stays 645 / 820 ft.
- **Orchestrator:**
  - Tightened #380's commit wording to "as low as 0.296 s", per the reviewer.
  - Posted the #389 citation fix.

## Flakes

- `tests/test_overspan_mirror.py::test_a_slow_overspan_lets_the_free_mirrors_in_after_its_head_start`: the #380 failure, fixed on this chain at `418a16e`.
  - Before the fix it failed once in a full run and once alone (the diff-verifier's run during #385).
  - It passed alone 3/3 on base and 3/3 on the branch.
- `tests/test_ci_check.py::test_still_running_at_the_limit_stops_and_says_how_long`: failed once in #369's full run and 4/4 alone in that session.
  - It passed in the diff-verifier's full run, `3572 passed, 2 skipped`.
  - Filed #391.
- `components/GeneratorShell.value-links.test.tsx`, 9 tests: these failed in the end-of-mission full vitest runs on the top branch. The errors were timeouts (`Test timed out in 5000ms`) and missing elements (`Unable to find ... "Generate plan"`).
  - The file passes alone, `13 passed (13)`.
  - The chain's only site change is #385's comments, and #385's own vitest runs were `2531 passed | 1 skipped`.
  - The machine was low on memory all session; the system stopped two shells for it. This is the same pattern as #353, which is on another file.
  - **Slip:** the first full run went through `tail`, so its 10 names weren't saved before the re-run. The 9 names above are from the second run.
- #380's base full run was also piped through `tail -1`, so its failing name wasn't saved. Recorded in `issue-380/failing-tests.md`.

## Per item

### #385: per-scenario defaults comment
- **Change:** comments only, in `conestruct/site/lib/scenarios/index.ts` (+12/-10).
- **Tests:** vitest `2531 passed | 1 skipped`, pytest `3554 passed, 2 skipped`.
- **Repair cycles:** two.
  - Cycle 0: the verifier returned REPAIR because the pytest count missed the #380 flake.
  - Cycle 1: the reviewer returned FAIL; the flake story didn't agree across the files, and there was a 122-char line.
- **diff-verifier:** "VERDICT: PASS"
- **Independent reviewer:** "PASS"

### #381: crew sheet leaves out jurisdiction-added devices
- **Change:** 6 files (+92/-21), plus the new `tests/test_crew_sheet_rule_rows.py`: 15 tests, 11 of which fail on base.
- **Churn:** predicted matches measured.
  - The crew sheet changed on 25 plans and the snapshot on 62.
  - 282 of 344 are byte-identical.
- **Tests:** pytest `3569 passed, 2 skipped`; ruff and mypy clean.
- **diff-verifier:** "VERDICT: PASS"
- **Independent reviewer:** "PASS"

### #383: footer test renders scanned fixtures without the scan stub
- **Change:** test code only, with a new `tests/_worst_case_scan.py`. Same 3571 test IDs.
- **Red proof:** with Overpass unplugged, base gave `1 failed, 51 passed, 4 errors` and the branch `52 passed`.
- **Tests:** pytest `3569 passed, 2 skipped`; ruff and mypy clean.
- **diff-verifier:** "VERDICT: PASS"
- **Independent reviewer:** "PASS"

### #380: overspan head-start test on Windows
- **Change:** test only, `tests/test_overspan_mirror.py` (+6/-1). The bound is now `>= 0.3 - time.get_clock_info("monotonic").resolution`.
- **Red proof:** the old bound missed 27/100 runs and the new one 0/100. The verifier's own run of the script gave 16/50 against 0/50.
- **Tests:**
  - Base: `1 failed, 3568 passed, 2 skipped`.
  - Branch: `3569 passed, 2 skipped`.
  - ruff and mypy clean.
- **diff-verifier:** "VERDICT: PASS"
- **Independent reviewer:** "PASS"

### #369: band aerial served as image/png
- **Change:**
  - `POST /render/corridor-map` labels the image by its bytes: JPEG goes out as `image/jpeg`, PNG as `image/png`.
  - Bytes that are neither get a 502.
  - 5 files (+83/-10), with 3 new payload-level tests that fail on base.
- **Tests:** pytest `3572 passed, 2 skipped`; ruff and mypy clean.
- **Gates:** both passed, then both passed again after the docstring fold-in.
- **diff-verifier:** "VERDICT: PASS"
- **Independent reviewer:** "PASS"

### #367: lane closures at 65/75 mph cite Sheet 7 Case 11 for their buffer
- **Change:** `src/api/audit.py` (+23) adds a lane-only buffer branch. The cite is now "MUTCD 11th Ed. Sec 6B.06, Table 6B-2 (stopping sight distance)."
  - The buffer is unchanged: 645 ft at 65 mph, 820 ft at 75 mph.
  - New `tests/s630/test_lane_buffer_cite_367.py`: 8 tests, 4 of which fail on base.
- **Churn:** 4 lane audits moved (`lookup_text` and `source`); 32 snapshot files are byte-identical.
- **Tests:** pytest `3580 passed, 2 skipped`; ruff and mypy clean.
- **Reviewer note:** Sheet 7's legend says "General Note 23" for the buffer, but Sheet 2's buffer note is Note 24. The code's "Note 24" is right. This is the sheet's own error and predates this branch.
- **diff-verifier:** "VERDICT: PASS"
- **Independent reviewer:** "PASS"

## Production checks after the ship (§ 7)

- **#385, #383, #380:** comments and tests only. Check healthz sha = HEAD.
- **#381:** a Thornton plan's crew sheet lists `1× Advance Warning Signs (jurisdiction-required)` and quotes stipulation 6. A CDOT plan's crew sheet is unchanged.
- **#369:** `POST /render/corridor-map` answers `image/jpeg` for the Mapbox aerial.
- **#367:** a 65 mph and a 75 mph CDOT lane-closure audit cite Table 6B-2 for the buffer at 645 / 820 ft. A shoulder plan still cites Sheet 7 Case 11.
