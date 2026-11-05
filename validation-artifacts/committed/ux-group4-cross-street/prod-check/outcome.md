# #440 production check on a978e73 (2026-11-05)

SHIP VERIFIED: `/healthz` sha and the served frontend are both `a978e7354cb2f7fccd9e602b7328de3efdda1297`, which is main HEAD.

Run: `script/walk-prod.mjs` against https://www.conestruct.com/sandbox with the gate token from `.env.local` (never printed) and no Playwright routes or stubs. Live geocoding, live `/api/road-bearing`, live backend. Playwright Chromium at DPR 2, 1440x900 and 390x844. Raw record: `walk.json` (both widths, pin 1550 E Colfax, eastbound candidate) and `pdf-run/walk.json` (1440, same pin, westbound candidate).

**Live road detection was up.** Every `/api/road-bearing` answer in the two-width run was `200 ok`, so this covers the road path #439's check could not.

| Check | 1440 | 390 |
|---|---|---|
| The card opens on the kind, "Question 1 of 2" | PASS | PASS |
| Near-intersection chosen, Next: "Question 2 of 3", "Which intersection is the work near?", aerial armed, bar "Tap the intersection nearest the work" | PASS | PASS |
| X23 line: "The plan counts signs for the cross street. The sheet points to CDOT's standard drawing for where they go." | PASS | PASS |
| Tap at the crossing: "✓ Near Franklin Street / Two-way street · 230 ft east of where the work starts", Move and Undo | PASS | PASS |
| X22: the marked aerial reads only "Edit on map", "Franklin Street" and zoom; no side caption | PASS | PASS |
| Move arms the aerial and reads Cancel; Cancel restores the row | PASS | PASS |
| Undo clears the row, rearms the aerial, and the next scenario has no intersection | PASS | PASS |
| "Use the big map instead": the picker opens armed on "Click the intersection on the map", no detected paragraph, Save & Close returns a ✓ row | PASS | PASS |
| Side is "Question 3 of 3"; answering it enables "Confirm and lay out the plan" | PASS | PASS |
| Confirm moves the band to WHAT | PASS | PASS |
| axe at armed, marked and side | PASS (0) | PASS (0) |
| The new controls at those steps are at least 44 px | PASS | PASS |

PDF through the page (`pdf-run/`, 1440 only, westbound, Franklin behind the work):

| Check | Result |
|---|---|
| Generate, then "Download plan sheet PDF" | PASS: 200, 758,745 bytes, 2 pages (`pdf-run/1440-plan.pdf`) |
| The render request carries Franklin Street and `cross_a` / `cross_b` | PASS |
| Page 1 prints "CROSS-STREET CONTROL PER CDOT S-630-1 SHEET 10, CASES 18/19: NOT DRAWN" | PASS (the sheet's design, #117 Option C; not drawing it is expected) |

The backend's decline, seen live twice, both correct:

- 1550 E Colfax, eastbound: Franklin is 232 ft ahead, inside the 1,000 ft zone. The banner asks for more than 244 ft with traffic or more than 780 ft against (`1440-declined-1550-e-colfax.png`).
- 39.74005, -104.96705, westbound: Franklin is 395 ft ahead. The banner asks for more than 407 ft or more than 617 ft (`1440-declined-pin-east-of-franklin.png`).

**Seen in this check, not a failure of a listed row:** at 390, a crossing near the aerial's right edge puts the mark under the zoom control and at the frame's edge (`390-05-aerial-marked.png`). The label stays readable. Filed as #442.

**Earlier attempts.** Run 1's PDF step used the first Colfax button (eastbound) and hit the decline above. Run 2's "1700 E Colfax" geocoded more than 30 m from any road, and the picker correctly said no road was detected. Run 3 used manual coordinates and declined (above). Run 4 picked the westbound button at 1550 and generated.

**Not done in production:** the failed lookup and Try again (they need a forced failure; local evidence covers them), "Finding the street name…" (not captured; the live answer is quick and the local walk holds it), the kind change that clears the side (local evidence), and a PDF at 390. The big-map step clicks 60 px off the pin on purpose, so its "Park Avenue" row only proves the round trip; the walk retaps Franklin before Confirm.
