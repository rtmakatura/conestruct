# #443 production check on eff48e0 (2026-11-06)

SHIP VERIFIED: `/healthz` sha and the served frontend are both `eff48e0907a0120089c44d220bc43be8998709f3`, which is main HEAD.

Run: `script/walk-prod.mjs` against https://www.conestruct.com/sandbox with the gate token from `.env.local` (never printed or saved). No stubs: the one Playwright route only adds the gate header to requests for the site. Live geocoding, live `/api/road-bearing`, live backend. Chromium at DPR 2, 1440x900 and 390x844. 1600 E Colfax Ave, Denver, East Colfax eastbound, kind Shoulder, One-way, Generate through the page. Crops and raw numbers: `walk/`, `walk/walk.json`.

**Live road detection was up.** The one `/api/road-bearing` call at each width answered `200 ok` with 4 candidates.

| Check | 1440 | 390 |
|---|---|---|
| All three sections closed by default | PASS | PASS |
| Summaries: "13 checks, each cited", "3 items for the TCS", "For reference, never blocks the plan" | PASS | PASS |
| With everything open: rows at least 48 px, search box 48 px, nothing nested in a detail | PASS | PASS |
| Targets in the sections at least 44 px, in every state measured | PASS (0 small) | PASS (0 small) |
| axe scoped to the sections: idle, opened, every search state, no match | PASS (0) | PASS (0) |
| Search counts, same as the local walk: sidewalk 5, 6B 4, cone 3, sign 11, $500 2, flagger 1, taper 4 | PASS | PASS |
| No `/api/` request during any search or the chip tap | PASS (0) | PASS (0) |
| No match: heading, sentence, 5 chips (taper, buffer, sidewalk, work hours, fines), clear link | PASS | PASS |
| Chip tap runs the search: taper, 4 lines | PASS | PASS |
| Restore is exact after ×, Escape, emptied box and "Clear search and show everything" | PASS | PASS |
| × returns focus to the box | PASS | PASS |
| Mark background `rgb(41, 64, 86)` | PASS | PASS |
| Horizontal overflow | 0 | 0 |
| Page errors | 0 | 0 |

By eye: `walk/1440-02-option-a-sections-open.png` and `walk/390-04-search-sidewalk.png`. The other crops were not opened one by one. Ryan's browser check is still the visual gate.

**Earlier attempts, both the walk's own faults.**

- Run 1 looked for the Colfax button before the live road list arrived, so it picked no road and Save & Close stayed disabled. The walk now waits for the button.
- Runs 1 and 2 raised "Failed to load Clerk" at both widths. They sent the gate header to every origin, which is the cause the provenance-marks check recorded. The Clerk script answered 200 on its own, and with the header limited to the site, run 3 had 0 page errors. Every number above is run 3's.

**Not done in production:** the failed audit and its Retry (it needs a forced 500; local evidence covers it), axe on the restored states and after the chip tap, a road other than East Colfax eastbound, and a PDF (this issue didn't change the sheet).
