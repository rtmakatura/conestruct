# Step 1 inventory — plan-sheet SYMBOLS/LABELS + flowing PDFs (at base `57e201a`)

## Symbols / on-drawing labels

| subject | site | failure mode at base |
|---|---|---|
| Sign glyphs | _draw_sign | pure shapes, no text inside — no overflow; codes go to callouts + schedule |
| Callout circles | _draw_devices (y -/+ 11) | a floor-clamped work-side glyph put its callout inside the footer band (fixed: 16 pt clearance) |
| De-overlap passes | _deoverlap_* | vertical pushes unbounded; median fan unbounded in x; pairwise max_iters=6 can exit unresolved; UNDIVIDED sheets had zero clamp |
| Dim labels | _draw_dim/_draw_landmarks | tier-2 raise had no cross-segment check (measured 80-100% overprint) and no PLAN_TOP ceiling (band walked into the title strip at max road stacks) |
| SCHOOL context box | _draw_site_context | x_of unclamped -> box straddled the frame edge (measured on every adversarial sheet) |
| Scale break | _draw_scale_break | the twin diagonals — legitimate engineering mark, not a defect |
| Dead code | _draw_label_with_halo, _layout_callout_strip | zero callers (deleted in-arc per ruling) |

## Flowing PDFs (audit + crew narrative, Platypus)

Letter portrait, 0.7 in margins, avail 511.2 pt; all tables Paragraph-cell
proportional-width.  Narrowest cells: [2,1,1,3] weights -> ~63 pt (advance
sign table cols 2-3, Colorado citation col); flagger table columns are
data-driven (even split).  Residual risk is a long UNBREAKABLE token in a
narrow cell (Paragraph breaks at spaces only) — measured ZERO failures at
every adversarial maximum; pinned by test_flowing_pdfs_stay_inside_margins.
normalize_glyphs covers ->, Delta, >= only; em-dash renders fine in WinAnsi
(no change needed).
