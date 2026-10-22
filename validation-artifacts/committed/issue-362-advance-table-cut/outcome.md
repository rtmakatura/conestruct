# #362 outcome — page 1 cuts plaques before signs

## The change (R1, Ryan; R2, R145 self-ruled)

`src/rendering/plan_sheet.py`: page 1's fit loop no longer cuts a prefix of the advance table. `_next_advance_cut` picks what goes next:
- the G20-5P / R2-6P rows at the farthest distance that still has one, all at once;
- with none left, the last rows still drawn, as before (two at a time in two-column mode).

`body` draws the rows not cut. The "+N MORE" line counts and names the cut rows in table order (#235), in the same wording.

## Freeway 75 → 40, 1000 ft (crops in `crops/`)

- Before: 13 rows drawn, `+4 MORE ADVANCE SIGNS (W3-5, W20-1)`.
- After: 14 rows drawn. Every sign is on page 1 (W20-1, the three W3-5 steps, R2-10, R2-1), plus the plaque pairs at 500 and 1500 ft. The line reads `+3 MORE ADVANCE SIGNS (G20-5P, R2-6P). SEE CREW NARRATIVE & DEVICE LIST`. The cut rows are G20-5P / R2-6P at 2500 ft and G20-5P at 3000 ft.
- The 5000 ft plan is the same.

## Rule 5: prediction vs result

The prediction in `rulings.md` was amended before the diff, to 14 rows and +3 MORE. It held. `byteid-compare.txt` (base `8c4c20c` vs after, 150 plans, every surface): **2 moved, plan PDF only**, freeway 75 → 40 at 1000 ft and 5000 ft. The other 148 plans are byte-identical on the audit, audit PDF, plan PDF, crew sheet and XLSX. The same 18 plans are HTTP 400 on both runs (divided roads with 200 ft of work).

## Tests

- `test_case_27_keeps_its_four_two_column_rows`: 13 → 14 rows, `+3 MORE ADVANCE SIGNS (G20-5P, R2-6P)`.
- New `test_case_11_page_1_keeps_every_sign_and_cuts_plaques_first`: the rendered page 1 shows W20-1, R2-10 and every W3-5, with exactly two plaque pairs left.
- New `test_the_cut_order_falls_back_to_the_end_without_plaques`: the cut order, including the old prefix behavior when no plaque is left.
- Red proof against `8c4c20c`: 3 failed, 3 passed (`red-proof-8c4c20c.txt`).
