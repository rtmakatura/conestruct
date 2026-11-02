# #436 production check on e2629c1

2026-11-02, https://www.conestruct.com/sandbox, Playwright Chromium at DPR 2, 1440x900 and 390x844, `/api/road-bearing` stubbed as in `script/shoot.mjs` (two East Colfax roads; one road). Raw: `facts.json`; crops beside it.

| # | Check | 1440 | 390 |
|---|---|---|---|
| 1 | "East Colfax Avenue, westbound" on one line | PASS (1 line, row 407) | PASS (1 line, row 340) |
| 2 | Change: no border, 44 tall, inside the row, 13.5/600 `--act` | PASS | PASS |
| 3 | Gaps 8 / 4, line 1 24, padding 12 / 16, name 24 px in, Inter 15/600 | PASS | PASS |
| 4 | Details opens, a second click closes, Escape closes with the picker open | PASS | PASS |
| 5 | One road: same layout, no Change | PASS | PASS |
| 6 | No mono "i details" in the row; picker header's "i details" after Change | PASS | PASS |
| 7 | axe on the row, closed and open | PASS (0 / 0) | PASS (0 / 0) |

7 checks x 2 widths: 14 PASS, 0 FAIL, 0 N/A.
