# Rule 5 outcome: `issue-235-surface-d` build (#235 surface D, R150 pick: option B)

Prediction: `prediction.md` (`d79e7d6`). The visual target was mockup `b` (`b-band.png`).

## Built as predicted (`src/rendering/plan_sheet.py`)

- **One type ramp.**
  - `FOOTER_TITLE_SIZE = 9` sets the LEGEND, NOTES & SIGN SCHEDULE and TRAFFIC CONTROL DEVICE SUMMARY titles on
    one baseline (box top − 12).
  - `_draw_footer_title_rule` draws a 0.4 pt #888 hairline 4 pt under each title.
  - The device summary's table starts 2 pt higher.
- **Air above the disclosures.**
  - In `_draw_notes_footers`, every footer step goes through `step()`.
  - The first disclosure line drops `footer_pads[0] + 3` and draws a 0.3 pt #BBB hairline 7 pt above itself.
  - With no disclosure line there is no rule. The N Broadway SB plan has none. The near-intersection plan shows it.
- **The legal trailer at the title block's foot.**
  - `_title_block_trailer` holds `REFERENCE_LINE`, `DRAFT_TRAILER` and `VERIFY_LINE`, all with unchanged text.
  - It is drawn bottom-anchored under a 0.3 pt #BBB hairline, at 6.5 pt with an 8.5 pt pitch.
  - Reference and GENERATED each wrap to 2 lines.
  - `_finish` no longer draws any of the three lines in NOTES.
- **The title block fits by construction.**
  - `_title_block_row_pitch` takes the first of `TITLE_BLOCK_ROW_PITCHES = (11, 10, 9, 8.5)` whose last row clears
    the hairline.
  - The prediction listed (11, 10, 9). The worst case (18 value lines) misses at 9 pt by 0.5 pt, so 8.5 was added.
    Nothing is cut at any pitch.

## Measured

**N Broadway SB plan** (`broadway-left`):

| | today (`today-band.png`) | built (`built-band.png`) |
|---|---|---|
| advance signs | 2 of 5, "+3 MORE" | **5 of 5** (W21-5aL, W20-2, R2-10, W20-1, W3-5) |
| device types | 17 of 19, "+2 MORE TYPES" | **19 of 19** |
| containment | 0 / 0 / 0 | **0 / 0 / 0** |
| title block pitch | 11 | 11 (13 lines; 14 with production's AERIAL row, still 11) |

`built-band.png` matches mockup `b-band.png` except for one 2 px strip at band y ≈ 223 pt. That strip is the
mockup's always-drawn disclosure hairline, which the build omits when no disclosure follows.

**Containment** (`built-containment.json`, `measure_containment`): 0 / 0 / 0 on all 17 renders.
- The 13 harness fixtures.
- The usual plan sample, `scripts/render_test_pdfs.py`: I-25 freeway, US-85 rural, 25 mph urban, 45 mph rural.

**Worst-case title block** (new test): long project and location, no bearing (an ORIENTATION row) and an aerial
page (an AERIAL row).
- Pitch steps to 8.5.
- No word straddles the trailer's hairline.
- Containment is 0 / 0 / 0.

## Where this differed from the prediction: look at these

1. **The near-intersection N Broadway plan** (`ni-before-band.png` → `ni-after-band.png`).
   - Today every advance row is cut, so R117 Q3a's single line prints:
     > 4 ADVANCE SIGNS OFF-PAGE (W4-2R, W20-5R, R2-10, W20-1). SEE CREW NARRATIVE & DEVICE LIST
   - With the freed room, one row fits, so the table prints `W4-2R RIGHT LANE ENDS 100 ft` and then
     "+3 MORE ADVANCE SIGNS. SEE CREW NARRATIVE & DEVICE LIST".
   - The fit rule is unchanged. The all-cut line still fires on the denser speed-guessed near-intersection
     sheets (`test_approach_speed_guess` road / cross / both).
   - The cost: this sheet now names 1 advance code plus a count, where it named all 4. The crew narrative and the
     device list carry the full series either way.
2. **Case 27** (two-column advance table) now draws all 8 entries. It drew 4 and printed "+4 MORE".
3. **Prediction errors.**
   - `test_reference_line` and the `test_rules.py` cursor simulation did not fail. Text extraction joins the
     wrapped Reference lines at a space, and the simulation only checks a floor.
   - Both were updated anyway: the first now pins the title-block placement, and the second drops the 3 trailer
     lines.
   - `test_approach_speed_guess[neither]` and `test_r117_pdf_notes` near-intersection (both variants) failed;
     neither was predicted. The cause is item 1.

## Churn (tests)

| test | edit |
|---|---|
| `tests/test_r117_pdf_notes.py` `_advance_rows` | ends at the table's first line with no distance, no longer at "Reference" |
| `tests/test_r117_pdf_notes.py` near-intersection reads clean | 1 row, then "+3 MORE ADVANCE SIGNS…"; no all-cut line; no doubled header |
| `tests/test_r117_pdf_notes.py` Case 27 | 8 entries, no "+N MORE"; still two columns |
| `tests/test_approach_speed_guess.py` | the schedule slice ends at the all-cut line or the advance table's title; new positive pin: road / cross / both print the all-cut line, neither prints the table |
| `tests/test_reference_line.py` | rewritten: once on page 1, wrapped in the title block, joined text unchanged |
| `tests/test_rules.py` | cursor simulation drops the trailer lines; a stale comment fixed |
| `tests/test_site_scan_corrections_surfaces.py` | comment only |

New tests are in `tests/test_plan_sheet_footer_235.py` (4 tests):
- the trailer prints once, under STATUS, in the title block;
- broadway-left lists all 5 advance signs with containment 0;
- the pitch steps at 13, 14 and 18 lines;
- the worst-case title block clears the hairline.
