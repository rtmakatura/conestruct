# R116 item 3 build (R117 Q3a-c): page 1's NOTES & SIGN SCHEDULE box

Rulings: `../rulings.md` (R116 item 3; R117 Q3a, Q3b, Q3c). Checkpoint: `../checkpoint.md` item 3. The change is the checkpoint's prototype (`../pdf/prototype-plan_sheet.diff`), applied as is, plus Q3c's narrowing.

## What changed (`src/rendering/plan_sheet.py`)

- **Rhythm, one-column tables only (Q3c).** Tiers 1 and 2 use `section_header_pad` (3, 12), an 8 pt gap from a title to the next line, and `footer_pads` (3, 7). A two-column advance table keeps tier 2's tighter (3, 10) / (3, 6), the room its long table needs.
- **Tier from list rows only.** `extra_note_lines` (the near-intersection note, the rightmost-lane note, the scan and corrections lines) no longer counts as advance rows. Two columns only when the advance table has more than 6 rows. A 4-row table never splits, so its column headers are never printed twice.
- **Never an empty table (Q3a).** When the fit loop cuts every advance row, one line replaces the title and column headers: "4 ADVANCE SIGNS OFF-PAGE (W4-2R, W20-5R, R2-10, W20-1). SEE CREW NARRATIVE & DEVICE LIST". In two columns the loop cuts two rows at a time, so each cut frees space.
- **Plate departures pointed to (Q3b).** The three oblique fine-print lines go. The bold line reads "…CASES 18/19: NOT DRAWN. PLATE DEPARTURES: SEE AUDIT. SEE DEVICE LIST, CREW NARRATIVE, AND AUDIT." The audit's case narrative carries all three departures (`src/api/audit.py`, `case_narrative_2`). The rightmost-lane note stays.

## Before / after (`render_notes.py`)

The checkout is named on the command line: "before" is main `4c1a324` (the main checkout), "after" is this branch. `MAPBOX_TOKEN` is empty in both runs. Crops are `notes_<plan>_<tag>.png`; measurements and line-by-line text are in `notes_<tag>.json`.

| plan | min line clearance before → after | advance rows before → after | notes |
|---|---|---|---|
| near-intersection Broadway, one-way | −0.30 pt (touching) → **1.91 pt** | 0 (empty doubled-header table + "+4 MORE") → the one line naming all 4 codes | Q3a, Q3b |
| near-intersection Broadway, two-way | −0.30 → **1.91** | same | same text as one-way: departure (2) is no longer on the page |
| shoulder (control) | 1.70 → 1.70 | 3 → 3 | unchanged |
| Case 27 stepped (two-column) | −0.30 → −0.30 | 4 → **4** | Q3c: its spacing and rows are unchanged |

Nothing runs outside the box in any render.

## Rule 5

- **Every near-intersection plan's page 1:** the notes box re-flows as above. The three plate-departure lines go, and the departure (2) wording that differed between one-way and two-way plans (R114 Q5) is no longer printed. The audit keeps it, as R117 Q3b ruled.
- **Plans whose fixed notes pushed a short advance table into tier 2:** they stay one-column now (no doubled header), with the 8 pt title gap.
- **Unchanged:** shoulder plans with short tables; long two-column tables such as Case 27.
- No placement, count, XLSX, audit or crew-sheet change.

## Tests

- **New:** `tests/test_r117_pdf_notes.py` (4), measured on the rendered page:
  - near-intersection one-way and two-way: clearance ≥ 0.5 pt, inside the box, the off-page line, no doubled header, no "+N MORE", "PLATE DEPARTURES: SEE AUDIT", no fine print, rightmost-lane note kept;
  - the shoulder control still draws 3 advance rows;
  - Case 27 keeps 4 rows in two columns.

  `test_pdf_containment`'s collision check only sees same-line overlaps, so it missed the vertical touching. This test checks the clearance between lines.
- **Changed:**
  - `tests/test_rules.py::test_notes_layout_tier_selection` takes the new pads, adds that a short tier-2 table stays one-column, and keeps two-column tier 2 at 10 / 6.
  - `tests/test_near_intersection_voice.py` (sheet fine print) and `tests/test_r114_one_way_near_intersection.py` (page 1's departure (2)) now assert "PLATE DEPARTURES: SEE AUDIT" and no departure text.
- **Watched red before the code:** both near-intersection cases (clearance −0.30). The shoulder and Case 27 controls were green before and stay green.
- **Full backend suite:** 2623 passed, 2 skipped.
