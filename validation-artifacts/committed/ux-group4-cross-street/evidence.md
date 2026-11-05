# #440 evidence: the cross street on the WHERE band (local)

Local `next dev` on the issue-440 worktree (port 3440), with the local backend (`ux-group3-where/evidence/script/serve_replay.py`, port 8765, recorded Overpass answer). `/api/road-bearing` is stubbed (it answers `unavailable` from this machine). Everything else is live: the aerial, the tap's `POST /render/aerial-point`, the geometry read, Generate and the PDF. Script: `evidence/script/walk.mjs`. Playwright Chromium, DPR 2, 1440x900 and 390x844. Run 2026-11-04 (session 3), on the tree that removes the aerial's side caption (X22).

## The walk, both widths: `evidence/local/` (20 crops + `walk.json`)

| Step | 1440 | 390 |
|---|---|---|
| CONFIRM opens on the kind, question 1 of 3 (ruling 2) | ok | ok |
| Next: the cross street, question 2 of 3, aerial armed (bar, outline, crosshair, "Use the big map instead") | ok | ok |
| Tap → "Finding the street name…" → "✓ Near Franklin Street / Two-way street · 60 ft west of where the work starts" | ok | ok |
| Move → Cancel; Undo re-arms the aerial | ok | ok |
| Failed lookup → Try again reuses the same point (`retrySamePoint: true`) | ok | ok |
| "Use the big map instead" opens the picker armed; no detected paragraph (`pickerDetectedParagraph: false`) | ok | ok |
| Next: the side, question 3 of 3, asked last (ruling 2 / X20) | ok | ok |
| The aerial carries no "Say which side is occupied to lay out the work" caption at the marked or side step (X22; 0 hits in `walk.json`) | ok | ok |
| Confirm opens WHAT (`openBand: band-what`) | ok | ok |
| axe on the WHERE band at 01/03/07/10 | 0 violations | 0 violations |
| New controls at least 44 x 44 px | all | all |

Re-cropped this session: `*-05-03-marked.png`, `*-06-aerial-marked.png`, `*-09-10-side.png`, `*-10-11-side-answered.png` (and the rest of the set).

**The stub's geometry (session 3).** The live route extends a candidate's own-way geometry along the road's next ways (`route.ts` `trimChain`). The session-2 stub sent way `1547338997` alone, and that way ends at the work-start snap. So the Franklin tap clamped onto the line's end: it read "at where the work starts" and the plan was declined. The stub now sends the westbound chain the live route would send (`1547338997, 1547338998, 223788857, 600545918, 791808880`). The clamp itself is real when the live extension fails, and it predates #440: filed as #441.

## The PDF through the page: `evidence/local-pdf/` (1440 only)

`PDF=1 WIDTHS=1440 ADDR="1550 E Colfax Ave, Denver"`. The walk's pin at 1600 E Colfax sits 57 ft east of Franklin on a westbound one-way, so the 1,000 ft work zone runs through the crossing. There the backend declines, correctly:

> PLAN DECLINED · THE MARKED CROSS STREET IS INSIDE THE WORK ZONE, 57 FT PAST THE PIN WHERE THE WORK STARTS. … MOVE THAT PIN MORE THAN 69 FT WITH TRAFFIC, PAST THE CROSS STREET, OR MORE THAN 955 FT AGAINST TRAFFIC …

The 1550 E Colfax pin's Overpass reads were recorded by `serve_replay.py` into `ux-group3-where/evidence/overpass-fixture/` (`a514c63bd242f32a`, `b2ef9de82fc04eec`, `d5d215a8c5f7a1a4`, `e69fd638649d4f91`, each `.json` + `.query.txt`), so the pass replays. At 1550 E Colfax, Franklin is 200 ft upstream ("200 ft east of where the work starts"). The page's own flow: One-way, "Lane count is right", Generate plan, then "Download plan sheet PDF". Result: HTTP 200, 756,175 B, 2 pages (`1440-plan.pdf`, page 1 rendered as `1440-plan-p1.png`). The render request (`1440-pdf-request.json`) carries `meta.intersection` = Franklin Street (`39.7400546, -104.9684549`) and both approaches, `cross_a` and `cross_b`.

**Page 1 does not draw the cross street or any cross-street signs.** It draws the Colfax closure (G20-1, W20-1, W20-5R, W4-2R, R2-10, R2-11, R9-9, G20-5P, M4-9a) and prints:

> CROSS-STREET CONTROL PER CDOT S-630-1 SHEET 10, CASES 18/19: NOT DRAWN. PLATE DEPARTURES: SEE AUDIT. SEE DEVICE LIST, CREW NARRATIVE, AND AUDIT.

That is the sheet's existing design, #117 Option C (`src/rendering/plan_sheet.py:4024-4037`: "the sheet cites the plate instead of drawing the cross street"). #440 changes nothing on the PDF path; the branch's only rendering change is `src/rendering/static_aerial.py`, the tap's un-projection. The cross street #440 collects reaches the backend, which acts on it (the decline above). Drawing cross-street signs on page 1 is new work under #117, not part of #440.
