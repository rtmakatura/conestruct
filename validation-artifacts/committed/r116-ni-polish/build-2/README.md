# R116 item 2 build (R117 Q2): the extent as a WHAT-style row, the five lengths in its popover

Rulings: `../rulings.md` (R116 item 2; R117 Q2 "B, the WHAT-style row with the five lengths in its popover"). Checkpoint: `../checkpoint.md` item 2. Mock: `../shots/extent-<w>-B.png` / `-B-open.png`.

## What changed

- `conestruct/site/components/bands/WhereBand.tsx`:
  - **The row.** "Work zone length (ft)" is a `FieldCell` inside `.a-cols > .a-col`, the WHAT band's own row (P2, P4): label and marker in the 132 px track, input in the control track.
  - **Marker.** "✓ yours" ("your answer · the extent the plan is built for"), or "◌ not set" before a length is typed.
  - **Validation error.** Shown under the input through FieldCell's alert path (P3), so it's never hidden behind the marker.
  - **The popover** holds `CorridorExtentLines` (new, exported):
    - "Corridor at this length", then the five rows (same `zone-*` ids and words, four lengths from the backend's `corridor_spec`, the work zone the typed extent);
    - or the one wait / unavailable note, unchanged (`corridor-extent-note`);
    - on a near-intersection plan, "the cross-street approaches lay out separately". `corridor_spec` is the mainline only, so five rows mustn't read as the whole picture (Rule 10).

  The loose six-line stack under the input is gone. The lengths are still the one place they show before Generate (#301 ruling 7).
- `conestruct/site/app/globals.css`:
  - `.a-extent-head` (ink color for the popover's head line).
  - **Stated change to the WHAT band too:** `.a-cols` tracks are now `minmax(min(340px, 100%), 1fr)`. At 390 the band's content box is 328 px, and a bare 340 px track ran every row 12 px past it. That clipped this row's marker and has done the same to the WHAT band since R107 (`477c951`). The track now shrinks to the band, and 1440 is unchanged (two columns while each has 340 px).

## Evidence (`capture_extent.cjs`)

A local build of this branch (`next dev` + this branch's backend). The plan is `../capture_r116.cjs`'s (N Broadway SB near-intersection, Denver, 500 ft). After Generate, the Setup box's Length cell reopens WHERE at the field.

| | before (`../shots/`, main `4c1a324`) | after (`build-2/`) |
|---|---|---|
| 1440 | `extent-1440-before.png`: a 260 px column, "typed · the extent the plan is built for" over five loose lines | `extent-1440.png` (closed), `extent-1440-open.png` (popover) |
| 390 | `extent-390-before.png` | `extent-390.png`, `extent-390-open.png` |

`facts-<w>.json` (both widths):
- the marker reads "✓ yours";
- the popover lines are the head, the five lengths (300 / 180 / 200 / 500 / 50 ft) and the cross-street line;
- the old line no longer sits under the input;
- the marker's hit box is 49 × 32 at 1440 and 49 × 44 at 390 (rule 15's floors).

Measured at 390 after the `.a-cols` fix: the cell spans 31–359 inside the 328 px column (before: to 371), and the page scroll width is 390.

## Rule 5

- **WHERE band, every kind:** the extent cell is a WHAT-style row; the corridor lengths move into its popover (closed by default); near-intersection plans get the cross-street line.
- **WHAT band at narrow widths:** rows fit the band instead of running 12 px past it. No change at 1440.
- No backend, wire, PDF or count change.

## Tests

- **New:**
  - `components/bands/CorridorExtentLines.test.tsx` (4): the five rows under the head; the near-intersection line; the note without lengths; `.a-cols`' `min(340px, 100%)` track.
  - `components/GeneratorSidebar.corridor-bar.test.tsx` gains "R117 Q2: the extent is a WHAT-style row; the five lengths sit in its popover" (mounted: the cell in `.a-col`, "✓ yours", popover hidden, then open on click, rows inside it, the old line gone from under the input).
- **Changed:** `components/WhatBand.density.test.tsx` (R107's grid string, now `min(340px, 100%)`).
- **Unchanged and green:** the corridor-bar row texts and order (the popover stays mounted, so the `zone-*` ids are found), and the kind-confirm wait-note tests.
- **Watched red before the code:** the 4 new tests (the missing export, the old cell), then the `.a-cols` test (the old track).
- **Full frontend suite:** 195 files, 2060 passed. `tsc` clean.
