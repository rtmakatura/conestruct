# #389 full run with the guard on, before any stub (base d116fbb + tests/conftest.py guard)

`3593 passed, 2 skipped, 2 errors in 468.92s`. Both errors are the guard's teardown (`#389: reached live Overpass`):

- tests/test_site_scan_corrections.py::test_not_run_applies_asserts_too
- tests/test_site_scan_null_geometry.py::test_generate_anyway_after_a_scan_fault_renders_with_the_disclosure

Each run alone with the guard on: the same teardown error (deterministic, not a flake). Both pass alone and in the full run once stubbed.

After the stubs: `3593 passed, 2 skipped in 272.85s`; `3595 tests collected` before and after.
