# Step 1 inventory — plan-sheet bounded TEXT/TABLE regions (at base `57e201a`)

Produced 2026-08-22 during the s2-arc6 investigation; line refs are to the
pre-arc file.  Geometry: PAGE 1224x792, MARGIN 18, TITLE_H 72, footer boxes
(legend 244.8 / notes 374.4 / device summary 273.6 / title block 259.2) x 234
at y=18.

Key rows (full detail in the arc checkpoint record):

| region | site | source | protection at base | failure mode at base |
|---|---|---|---|---|
| Top banner project + speed | _draw_title_block ~1879 | meta.project (UNBOUNDED wire string) | none | bleeds off the right page edge, speed segment displaced off-page |
| Title block PROJECT/LOCATION rows | _draw_structured_title_block | project/address | _wrap_to_width(max 2) + ellipsis | protected (vertical budget theoretically consumable) |
| Legend rows | _draw_legend | device types + sign cats + site context + geometry | _bail() bare return | SILENT drop of remaining rows AND the scale footnote |
| Notes PARAMETERS values | _draw_notes | speed/closure/lengths | right-align-inside guard | overlap-not-bleed on extreme values |
| SIGN SCHEDULE rows | _draw_notes ~2958 | build_sign_schedule (UNCAPPED) | none | marches past the box bottom, off the sheet |
| ADVANCE table 1-col/2-col | _draw_advance_table_* | _build_advance_warning_table (UNCAPPED) | none | same; 2-col desc slot ~127 pt, code W21-5aR = 29.6 pt vs 30 pt offset (measured near-collision) |
| Conflict footnotes | _draw_notes ~3015 | jurisdiction conflicts | floor + aggregate collapse | protected (the model for Family 1) |
| NI citation note + rightmost-lane note + DRAFT trailer | _draw_notes tail | fixed legal text | wrap-capped, NO floor | falls below the sheet border (the headline failure, measured edge:57) |
| Device summary | _draw_device_summary | aggregated rows | row floor + "+N MORE TYPES" + per-cell truncate | protected (the sheet's template) |
| Corridor details (p2) | _draw_corridor_details_box | WorkCorridor | sized for 8+1 rows (130/144 pt measured) | fits by design |
| Aerial SITE caption | _render_aerial_page | meta.address (UNBOUNDED) | none | ~248-char headroom then bleeds (backstop added) |
| Callout discs | _draw_callout_circle | schedule numbering | none | 3 digits overflow the 10 pt disc (2 digits fit; max observed 9 codes) |
