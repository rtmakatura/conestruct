# #389 plan (R145, no stop)

Base `d116fbb` (issue-388-thornton-sign-count tip). Branch `issue-389-overpass-guard`.

1. Problem: nothing stops a test from reaching live Overpass (#383). The #383 guard on `site_detection._overpass_request_with_fallback` (`src/rules/site_detection.py:398`) broke 49 + 46 tests that stub a layer below it (`_mirror_post`, `:197`, or the client `site_detection.httpx.AsyncClient`, as `tests/test_overspan_mirror.py` does).
2. Rulings: none yet. Self-ruled R1-R3 in rulings.md.
3. Change: an autouse fixture in `tests/conftest.py` patches `httpx.AsyncClient.send` and refuses any request whose URL (query stripped) is one of `site_detection.OVERPASS_MIRRORS` or `OVERSPAN_URL`: it raises a `RuntimeError` (not an `httpx.HTTPError`) and fails the test at teardown. Every test that still trips it gets a stub.
4. Rule 5 churn: test code only; no `src/` change. Same 3595 test IDs before and after (`pytest --collect-only -q`). Two tests gain a stub (`test_not_run_applies_asserts_too`, `test_generate_anyway_after_a_scan_fault_renders_with_the_disclosure`); their assertions are unchanged. Every other test is unchanged.
5. Proof: full suite with the guard on, before and after stubs (failing-tests.md); red proof with a scratch unstubbed test, not committed (red-proof.md); ruff and mypy.
