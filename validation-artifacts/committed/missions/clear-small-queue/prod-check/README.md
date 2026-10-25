# Production check of bc3b7d4 (mission clear-small-queue, #392)

Run 2026-10-25 against the Modal backend
`https://rtmakatura--conestruct-render-fastapi-app.modal.run`, straight to the
backend with `Bearer MODAL_RENDER_SECRET` from `conestruct/site/.env.local`
(never printed or saved; the www gate token answers 401). Read-only: only render
POSTs.

Command, from the worktree root:

    MODAL_RENDER_SECRET=... PYTHONIOENCODING=utf-8 uv run --extra dev python \
        validation-artifacts/committed/missions/clear-small-queue/prod-check/check.py

Files: `check.py` (the script), `results.json` (one row per case, as printed),
`surfaces-raw.json` (the Advance Warning Signs row each surface returned, per case).
Result: 11 PASS, 0 FAIL, 1 N/A.

Bodies come from the tests (`tests/test_plan_sheet_device_summary.py`
FLAGGER_BODY / SHOULDER_BODY, `tests/test_r117_jurisdiction_raised.py`
`_broadway_denver()`), with the two-way and one-way shoulder variants copied
from `issue-388/churn.py`. Surfaces: device XLSX `/render/xlsx`, quote XLSX
`/render/quote`, breakdown `/render/device-breakdown`, crew sheet
`/render/markdown`.

| Check | Case | Observed | Result |
|---|---|---|---|
| #389 #391 #353 (test-only) | `/healthz` sha == bc3b7d4da50579d54c2d1c0c71ce0d9376a3e750 | `bc3b7d4da50579d54c2d1c0c71ce0d9376a3e750` | PASS |
| #388 | Thornton shoulder, two-way undivided (expect 4) | xlsx 4, quote 4, breakdown 4, crew sheet 4; all 200 | PASS |
| #388 | Thornton shoulder, divided (expect 2) | 2 / 2 / 2 / 2 | PASS |
| #388 | Thornton shoulder, one-way (expect 2) | 2 / 2 / 2 / 2 | PASS |
| #388 | Thornton flagger_lane_closure (expect 4) | 4 / 4 / 4 / 4 | PASS |
| #388 | Thornton near_intersection, two-way, 1 leg (expect 6) | 6 / 6 / 6 / 6 | PASS |
| #388 control | CDOT shoulder, two-way undivided | no Advance Warning Signs row on any surface; all 200 | PASS |
| #388 control | Lakewood shoulder, two-way undivided | no row | PASS |
| #388 control | no jurisdiction, shoulder two-way undivided | no row | PASS |
| #388 control | CDOT flagger | no row | PASS |
| #390 backend half | POST `/render/corridor-map`, broadway-sb laid_out 600x300 | 200, `content-type: image/jpeg`, first bytes `FF D8 FF`, 205686 bytes | PASS |
| #390 proxy half | a 200 with no content-type answers 502 | unreachable in production (the backend always sends a content-type); covered by tests only | N/A |

Example rows (Thornton near_intersection, from `surfaces-raw.json`): device XLSX
`[12, "Advance Warning Signs (jurisdiction-required)", ..., "EACH", 6, ...]`;
quote `[12, "Advance Warning Signs (jurisdiction-required)", ..., 6, "EACH", ...]`
(note: "NOT included in the quote total"); breakdown `qty 6, jurisdiction_added 6,
source Thornton Construction & TC Permit handout, stipulation 6`; crew sheet
`- 6× Advance Warning Signs (jurisdiction-required)`.

The numbers match the branch churn (`issue-388/churn-branch.json`) for the same
bodies.
