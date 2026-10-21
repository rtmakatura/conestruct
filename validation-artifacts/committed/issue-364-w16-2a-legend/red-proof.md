# #364 red proof

`tests/s630/test_cross_surface.py::test_w16_2a_reads_distance_to_taper_on_every_surface` run with `src/rules/sign_codes.py` restored from HEAD (`08ed8a7`, before the fix), then with the fix.

Before the fix:
```
E       AssertionError: [{'Code': 'W16-2a', 'Distance from Taper (ft)': 'NEXT 2,678 FT (under first W21-5aR)', 'Position': 'First W21-5aR plaque', 'Station (ft)': '3,678'}]
E       assert ([{'Code': 'W16-2a', 'Distance from Taper (ft)': 'NEXT 2,678 FT (under first W21-5aR)', 'Position': 'First W21-5aR plaque', 'Station (ft)': '3,678'}] and False)
E       AssertionError: [{'Code': 'W16-2a', 'Distance from Taper (ft)': 'NEXT 2,107 FT (under first W21-5aR)', 'Position': 'First W21-5aR plaque', 'Station (ft)': '3,107'}]
E       assert ([{'Code': 'W16-2a', 'Distance from Taper (ft)': 'NEXT 2,107 FT (under first W21-5aR)', 'Position': 'First W21-5aR plaque', 'Station (ft)': '3,107'}] and False)
2 failed, 87 deselected in 1.85s
```

After the fix: `2 passed, 87 deselected`.

## Amendment 1 (R2, "¼ MILE")

The same test, now with four cases, run with `src/rules/sign_codes.py` restored from `aaca583` (R1 only):
```
FAILED tests/s630/test_cross_surface.py::test_w16_2a_reads_distance_to_taper_on_every_surface[case-26]
FAILED tests/s630/test_cross_surface.py::test_w16_2a_reads_distance_to_taper_on_every_surface[case-27]
FAILED tests/s630/test_cross_surface.py::test_w16_2a_reads_distance_to_taper_on_every_surface[case-26-undivided]
3 failed, 1 passed, 87 deselected in 4.42s
```

With R2: `4 passed, 87 deselected`.
