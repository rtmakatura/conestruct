# #382 production check of f506935: 7/7 PASS

Run 2026-10-24 on www.conestruct.com through `/api/render/*` (the site proxy) with `check.py`. healthz `f506935`. Per-row details are in `results.json`.

| Case | Route | Before (`777e3e7`) | Now | Result |
|---|---|---|---|---|
| F17 flagger, 50 ft | audit | 400 `WORK_ZONE_SHORTER_THAN_TAPER` (`audit-lane/runs/F17`) | 200, `all_pass` true, only `WORK_ZONE_SHORT_VS_BUFFER` | PASS |
| F17 flagger, 50 ft | pdf | 400 | 200, application/pdf, 884,993 bytes | PASS |
| N12 near-intersection 45 mph, 50 ft | audit | 400 (540 ft taper) | 200, `all_pass` true, only the buffer warning | PASS |
| N12 near-intersection 45 mph, 50 ft | pdf | 400 | 200, application/pdf, 755,495 bytes | PASS |
| N14 near-intersection 55 mph, 50 ft | audit | 400 (660 ft taper) | 200, `all_pass` true, only the buffer warning | PASS |
| N14 near-intersection 55 mph, 50 ft | pdf | 400 | 200, application/pdf, 704,785 bytes | PASS |
| Freeway shoulder, 10 ft lanes (control) | audit | 400 `LANE_WIDTH_BELOW_FREEWAY_MIN` | 400 with the same rule, and no `WORK_ZONE_SHORTER_THAN_TAPER` | PASS |

The bodies are the render check's `request.json` files (`../render-check/<case>/`). The "Before" column for N12 and N14 rests on the validator at `777e3e7` and on the red-on-base run (`../red-on-base.txt`). Production before the fix recorded the F17 refusal, and N12/N14 at 500 ft (audit-lane R5).

No browser check is needed: the fix changes which requests build, not how any page looks.
