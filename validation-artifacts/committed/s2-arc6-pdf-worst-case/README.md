# s2-arc6 — #216 worst-case PDF layout, evidence

Branch `issue-216-pdf-worst-case`, base `57e201a`.  Commits:
`cc0cc5e` (fixtures + word-box containment harness, red baseline
pinned) → `d98a627` (Family 1, notes box) → `aba8689` (Family 2,
width guards) → `b1018f1` (Family 3, geometry clamps) → `3b1c84b`
(Family 4 + dead-code deletion) → this evidence.

## The method (worst-case-first, per Ryan's framing)

Region inventory (below) → adversarial fixtures maximizing every
region simultaneously (committed at `tests/fixtures/pdf_worst_case/`,
all values wire-schema-reachable) → failures measured from **word
bounding boxes** (pdfium char boxes; page-edge escapes, footer-box
crossings, same-baseline collisions >55%) → per-region policy ruled by
family → implemented → pinned at zero by
`tests/test_pdf_containment.py` (the containment test, PDF edition —
renders through the real API path per test run, no network).

## The red → zero ratchet (each state pinned in its commit)

| fixture | red (HEAD@base) | after F1 | after F2 | after F3+F4 |
|---|---|---|---|---|
| adv-shoulder | edge 6, coll 4 | edge 6, coll 4 | edge 1, coll 4 | **0 / 0 / 0** |
| adv-near-intersection | **edge 57** | edge 6 | edge 1 | **0 / 0 / 0** |
| adv-flagger | edge 6, coll 3 | edge 6, coll 3 | edge 1, coll 3 | **0 / 0 / 0** |
| control-typical | 0 / 0 / 0 | unchanged | unchanged | unchanged |
| flowing PDFs (audit + crew), all fixtures | **0** margin failures at every maximum — pinned, no fixes needed | | | |

Red headline (renders/prefix-*.png): the NI sheet drew the
**rightmost-lane legal note and the DRAFT trailer below the sheet
border**; the banner ran "…Joint Project — 45 MPH" off the page edge on
every adversarial sheet; "L/3 = 150 ft" × "BUFFER = 360 ft (NTS)"
overprinted at 80–100%; the SCHOOL box straddled the frame edge.

## The policies as shipped (rulings 1–4)

- **Family 1 — reserve-then-continue** (`_draw_notes`): the exact draw
  path dry-runs on a throwaway canvas; list rows are cut (advance
  first, then schedule) with "+N MORE SIGNS — SEE DEVICE LIST (XLSX)" /
  "+N MORE ADVANCE SIGNS — SEE CREW NARRATIVE & DEVICE LIST" pointers
  until the fixed-obligation text fits.  Legal text is never cut.
- **Family 2 — truncate-with-ellipsis**: banner project segment (speed
  segment's width reserved first), aerial SITE caption, legend row
  labels.  **No font shrinks anywhere** (CHOSEN, ruled: variable-size
  text on a construction document reads as unreliable; continuation is
  more honest.  The existing 6 pt oblique remains the sheet's floor).
- **Family 3 — geometry clamps**: SCHOOL box fully in-frame (x and y;
  the y ceiling keeps it below the dim band so the two ceilings can't
  invert); dim band PLAN_TOP ceiling + greedy raised-tier assignment;
  `_clamp_sign_positions` extended to undivided sheets (previously NO
  clamp) with the 16 pt callout clearance (`_CALLOUT_CLEARANCE_PTS`,
  CHOSEN pure geometry: inline offset 11 + radius 5); median fan
  x-clamped; post-clamp coincidence fan (the clamp used to collapse
  de-overlapped stacks back onto the boundary, overprinting callouts).
- **Family 4 — rule-10 repairs**: the legend joins measure-then-draw —
  overflow renders "+N MORE — SEE DEVICE LIST (XLSX)" and the scale
  footnote is reserved up front and always renders (the old `_bail()`
  bare-return dropped both silently); callout discs assert the
  measured 2-digit bound.  Dead code deleted per ruling 4:
  `_draw_label_with_halo`, `_layout_callout_strip` + orphaned
  constants (zero callers, verified incl. tests).

## The typical-content proof (rulings 7–8)

`control-wordset-proof.txt`: control-typical rendered at base
`57e201a` vs the arc tip — **341 words vs 341 words, sets identical
including positions** (same-day render, DATE equal).  Zero churn at
typical content, exactly as predicted.

## Verified-fits (arithmetic, no code needed)

Aerial SITE caption ~248-char headroom (guard added as backstop);
corridor-details 9 rows = 130 of 144 pt (fits by design); callout
discs fit 2 digits (7.8 vs 10 pt), 3 digits (11.7 pt) would not — max
observed distinct codes 9 (asserted).  The twin diagonals on heavy
sheets are the scale-break glyph (legitimate).  The drawable-half-road
validator and WORK_LEN_MAX_FT bound the road-band and corridor-length
classes upstream (honest 422, measured).

## Inventory

`inventory-text-regions.md` and `inventory-symbols-flowing.md` — the
full region × drawing site × content source × bounds × overflow tables
for the plan sheet (text/table regions; symbols/labels/de-overlap) and
the flowing PDFs (Platypus tables, narrow-cell token risks,
`normalize_glyphs` coverage).

## #217/#218 handoff (ruling 6)

The adversarial fixtures (`tests/fixtures/pdf_worst_case/*.json`) and
the heavy-plan renders in `renders/` are the design exploration's raw
material: `fixed-adv-shoulder.png` / `fixed-adv-near-intersection.png`
show the maximum-content sheet as it now lays out — every region at
its policy limit (continuation lines visible, conflict footnotes at
full depth, legend at +N overflow).  Regenerate any render with
`step2-failure-map-harness.py` (fixtures in, PDFs + failure JSON out).

Refs #216.
