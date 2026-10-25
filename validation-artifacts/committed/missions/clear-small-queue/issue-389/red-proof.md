# #389 red proof (scratch test, not committed)

`tests/test_zz_red_389.py` posted the test_site_scan_corrections.py scenario (scan requested) to `/render/audit` with no stub, then was deleted.

```
E           Failed: #389: reached live Overpass 2x: ['https://overpass-api.de/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter']
E       AssertionError: {"detail":{"error":"site_scan_unavailable", ... "error":"scan failed: RuntimeError: #389: this test reached live Overpass (https://overpass-api.de/api/interpreter); stub the scan (tests/_w
0.13s call     tests/test_zz_red_389.py::test_scanned_fixture_without_a_stub
1 failed, 1 error in 4.33s
```

The call fails in 0.13 s, not at the 20 s scan budget, and teardown names the mirrors it reached.
