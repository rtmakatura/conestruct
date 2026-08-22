# s2-arc6 live checks — production at `0f24bc1`, 2026-08-22

Runner: `s2a6-live-checks.py` (raw log `outS2A6-live/s2a6-live-raw.md`).
READ-ONLY; all requests through the public Vercel proxy
(`/api/render/{pdf,audit-pdf,crew-pdf}`), no secrets.  The containment
measurement on served bytes is the SAME word-box method the committed
regression test uses (`tests/test_pdf_containment.measure_containment`).

Runner defect disclosed (fixed; the logged run is the complete one):
the first attempt POSTed the bare scenario — the proxy's allowlist
route wants `{"scenario": ...}` and answered an honest 400.

## Gate

healthz `0f24bc1…` == `git rev-parse origin/main` == served bundle
(`/_next/static/chunks/720-b958402d99fabc2c.js`).  Passed first probe.

## Results — 14 checks (gate + 13): ALL PASS, zero FAIL

| # | check | result |
|---|---|---|
| gate | healthz == origin/main == served bundle | PASS |
| L1 ×4 | the three adversarial fixtures + the control POSTed to prod `/api/render/pdf`; containment measured from the **served bytes**: edge 0 / box_cross 0 / collisions 0 on every sheet | PASS ×4 |
| L2 ×8 | all four fixtures through prod `/api/render/audit-pdf` + `/api/render/crew-pdf`: zero characters outside the margins on any page | PASS ×8 |
| L3 | the typical control: prod-served PDF vs a local HEAD render — **341 words vs 341, sets identical including positions** (same-day DATE) | PASS |

## What this means

The three sheets that at base `57e201a` measured 62 layout failures —
the rightmost-lane legal note below the sheet border, the banner off
the page edge, the dim-label overprint, the SCHOOL box straddling the
frame — now serve from production with **zero** words outside any
boundary, while the typical plan serves byte-equivalent at the word
level to what it served before the arc.  Served artifacts are all
committed beside this doc (`outS2A6-live/*.pdf`).  Refs #216.
