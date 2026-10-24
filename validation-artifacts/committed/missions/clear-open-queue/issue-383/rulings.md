# #383 rulings: the footer tests stub the site scan

Issue: https://github.com/rtmakatura/conestruct/issues/383. Branch `issue-383-footer-scan-stub`, stacked on `issue-381-crew-sheet-delta-rows` (`9548379`). Mission tracking issue #387.

## R1 (R145 self-ruled): one shared stub helper
This is the issue's proposed solution. The stub now lives in `tests/_worst_case_scan.py` as `stub_worst_case_scan(name, monkeypatch)`. It clears the scan memo, then routes the fixture's Overpass trip by its `_provenance.overpass`: "recorded" serves `tests/fixtures/site_scan/lakewood_overpass.json`, "down" serves "stub: mirrors down", and no key installs nothing. The logic is the same as the two copies it replaces.
- `tests/test_pdf_containment.py`: `_scan_stub` calls the helper for each parametrized fixture. `SCAN_PAYLOAD` moved to the helper; no other file imported it.
- `tests/s630/test_cross_surface.py`: `_stub_scan` is now the helper under its old name, so `tests/s630/test_cone_size_note15.py` keeps importing it unchanged. `_SCAN_PAYLOAD` moved to the helper.
- `tests/test_plan_sheet_footer_235.py`: a new autouse fixture stubs `broadway-left` ("down") for every test in the file. `test_every_cut_line_names_its_codes` stubs each fixture inside its loop with `pytest.MonkeyPatch.context()`, so each fixture's stub is undone before the next one.

## R2 (R145 self-ruled): the conftest guard is filed, not built
The issue lists it as optional. A full-suite run with the red-proof plugin (`unplug_overpass.py`) as that guard gives `49 failed, 3520 passed, 2 skipped, 46 errors`. Most of the hits test the fallback chain itself and stub a layer below it, so the guard needs a different hook point. That needs new files and is more than about 20 lines, so it fails the R154 fold test. Filed: #389.

## Rule 5 churn (predicted before the diff, measured after)
Prediction: test code only. No `src/` file changes, so every API response is byte-identical. The collected test IDs stay the same, and every existing assertion is unchanged. The containment BASELINE counts don't change. The footer file's `broadway-left` renders now use "mirrors down" instead of whatever live Overpass answered.

Measured: `git diff --stat` touches 3 test files and adds `tests/_worst_case_scan.py`. No `src/` file changes. `pytest --collect-only` lists the same 3571 test IDs on base and branch. No assertion line changed. Matches the prediction.

## Evidence
- Red proof, `unplug_overpass.py` (this folder): a pytest plugin that patches `_overpass_request_with_fallback` to raise and fails any test that calls it. Run as `-p unplug_overpass` with this folder on `PYTHONPATH`.
  - Base `9548379`, `tests/test_plan_sheet_footer_235.py tests/test_pdf_containment.py`: `1 failed, 51 passed, 4 errors`. Every footer test fails (`test_every_cut_line_names_its_codes` gets the 400 `site_scan_unavailable`; all four renders error at teardown for reaching Overpass). Containment passes.
  - Branch, same two files: `52 passed`.
  - Branch, `tests/s630/test_cross_surface.py tests/s630/test_cone_size_note15.py`: `106 passed`.
- Full suite on the branch: `3569 passed, 2 skipped`.
- `ruff check .`: `All checks passed!`. `mypy`: `Success: no issues found in 49 source files`.
