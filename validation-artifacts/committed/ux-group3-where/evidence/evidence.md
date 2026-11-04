# #439 WHERE band: local browser walk, 2026-11-04

Run on `issue-439-where-band`; the final run's code is the committed state at `e2aa2af` (it was measured as uncommitted edits, committed unchanged), which includes the fixes from the earlier walks (`.wq-link` min-width, the CONFIRM heading as `h2` with its question title as `h3`, the full-width "Faded" key row at ≤519 px). Local `next dev` on the worktree's `conestruct/site`, with the main checkout's `.env.local` loaded and `MODAL_RENDER_URL` pointed at a local backend (`script/serve_replay.py`, copied from #437, with `RENDER_API_SECRET` and `MAPBOX_TOKEN` set). That backend replays the recorded Overpass answer for the Denver Colfax pin (`overpass-fixture/`). Live `/api/road-bearing` returned `scan_status: "unavailable"` from this machine, so it's stubbed through a Playwright route. Each stub candidate is built from the recorded answer with its way's real geometry and tags: pin A is Franklin Street (way 492215711, `oneway=no`) and pin B is East Colfax Avenue (way 1547338997, `oneway=yes`). Both pins are placed through the picker ("1600 E Colfax Ave, Denver"). Browser is Playwright Chromium at DPR 2, 1440x900 and 390x844, with axe-core injected from `conestruct/site/node_modules/axe-core`. The script is `script/walk.mjs`, the raw record is `walk/walk.json` and the crops are in `walk/`. To keep crops readable, the page's sticky top bar is unpinned while each crop is taken. Measurements are taken before that, on the page as served.

| Check | 1440 | 390 |
|---|---|---|
| Pre-pin: "STEP 1 OF 4 WHERE", "Where is the work?", helper, then the address field + "Pick on map" under the heading | PASS | PASS |
| Ruling 1 order after a pin: header, question, aerial, summary row, CONFIRM card, nothing else (top in px) | PASS (160 / 213 / 257 / 573 / 635) | PASS (173 / 226 / 266 / 532 / 655) |
| "Edit on map" on the aerial's top-right corner, at least 44 px | PASS (108.5 x 44, 9 px in from the top and right) | PASS (108.5 x 44, same inset) |
| Ruling 7: key on the aerial, top-left (1440); below the aerial as a 2-column grid (390) | PASS (absolute, inside the frame, 92 % ground, rule border) | PASS (static grid 156 px + 156 px; "Faded" row full width, one line) |
| Side options, pin A (two-way Franklin St) | 2: "East side / Next to northbound traffic", "West side / Next to southbound traffic" | same |
| Side options, pin B (one-way E Colfax Ave) | 1: "North side / Next to westbound traffic"; still 1 with Shoulder work chosen | same |
| Question 1 of 2 (side): CONFIRM header, nothing pre-selected (both pins), the W3 sentence, Next disabled until a choice | PASS | PASS |
| Side chosen, then Next question: Question 2 of 2 (kind) with the three plain labels and "4 more kinds are coming once each is checked against its standard sheet." | PASS | PASS |
| Kind Details shows the sheet refs ("Shoulder work: TA-3/TA-5 · S-630-1; Lane closure with flaggers: TA-10 · S-630-1; Lane closure near an intersection: Cases 18/19 · S-630-1") | PASS | PASS |
| Kind chosen: the button reads "Confirm and lay out the plan" and is enabled | PASS | PASS |
| W7: kind opened first through its "Next:" row and chosen while the side is open: no `where-confirm`, the button reads "Next question" | PASS (0 `where-confirm`) | PASS (0) |
| Undo kind from its record: kind question reopens, nothing chosen | PASS | PASS |
| Undo side from its record: side question reopens, nothing chosen | PASS | PASS |
| Summary row: ✓ + values joined with " · " ("Franklin Street northbound · starts at East Colfax Avenue · 1,000 ft (default)") | PASS | PASS |
| Details toggles the provenance line (coordinates, OSM way 492215711, cross-street node, search radius) | PASS | PASS |
| Edit opens the fold: address field, Found the spot / Work starts / Extent, work-zone length field | PASS | PASS |
| `/api/render/audit` requests before Confirm | 0 | 0 |
| Confirm moves the band to WHAT | PASS (`band-what` open, WHERE closed) | PASS |
| axe with WHERE open (card visible, three states) | PASS (0 violations) | PASS (0 violations) |
| Targets under 44 px inside the WHERE band, from #439 | PASS (0) | PASS (0) |
| Targets under 44 px inside the WHERE band, pre-existing on main | 6 (list below) | 0 |

**The three fixed items, before → after:**
- Summary row "Edit" link (`[data-testid=where-edit]`): 32.9 x 44 → at least 44 x 44 at both widths. The walk records only targets under 44, and this link is no longer among them.
- axe headings: `heading-order` on `#where-confirm-h` (CONFIRM as `h3`) → with CONFIRM as `h2`, it moved to the card's question title (`h4.nyq-q`) → with the question title as `h3`, 0 violations at both widths, in all three measured states (pinned, kind question open, Edit fold open). #437's pre-existing `heading-order` on `#needs-you-h` doesn't appear on the WHERE page; that heading belongs to the results, which aren't mounted during this walk.
- 390 key, "Faded: past the mapped road": wrapped onto 2 lines in a 156 px cell (row 37.5 px) → spans the full 328 px row on one line (18.8 px), the same height as the "Work zone" row (crop `390-09-aerial-side-set.png`). The row rendered in this walk because the corridor runs past the mapped road.

**Pre-existing on main: out of scope here.** At 1440 only, six targets inside the WHERE band are under 44. None of them was introduced by #439:
- the aerial zoom "+" and "−", 32 x 32;
- the ledger buttons CHANGE / MOVE / CHANGE in the Edit fold: 66.2 x 32, 52.1 x 32 and 66.2 x 32;
- the length field's "default" info toggle (`info-toggle-worklen`), 47 x 32.

They are the same controls as on main. The zoom is rule 133's 32/44 pair, and the ledger rows moved into the fold unchanged. All six are 44 at 390.

**Side options and the wire.** Pin A (two-way) offers 2 and pin B (one-way) offers 1, each with no row pre-selected (ruling 5). Pin B still offers 1 option with Shoulder work chosen. The backend never offers the left edge here. By the checkpoint §2 trace, that's because Colfax at this pin is one carriageway of a divided pair (the median edge is never offered); this walk didn't confirm that cause directly.

**Summary timing.** The cross street ("starts at East Colfax Avenue") arrives on its own request after the pin. Ruling 3 says only items that are done are printed, so before it arrives the line omits it. The pin sits at the intersection, so the line reads "starts at …" with no distance.

**Earlier runs.** Runs 1–6 stopped on harness problems; each is described in `first-run-failures.txt`.

**Not done:**
- The full five-row key ("Warning signs", "Taper", "Buffer", "Work zone", "After the work"). It only draws once the kind is confirmed, and Confirm closes WHERE, so in the browser only the side-set state was seen ("Work zone" and "Faded: past the mapped road").
- A divided-road pin with an explicit carriageway verdict, the no-road four-heading case on purpose, and W11 (no aerial).
- Side-by-side comparison with the Option B artboard.
