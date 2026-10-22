# #362 rulings

## R1 (Ryan, 2026-10-21): option (a) as written

"(a) as written. Predict the churn first (Rule 5); only the two 75→40 freeway plans should change. Commit a page-1 crop of the advance table on the 1000 ft plan for me to check, then report when it's ready to ship."

When page 1's advance table doesn't fit, the fit loop cuts G20-5P / R2-6P rows first, a whole distance at a time, farthest first. Once no such plaque is left, it cuts signs from the end of the table as it does now (pairs in two-column mode). The "+N MORE" line keeps its wording and names the cut codes in table order (#235).

## R2 (R145 self-ruled): the plaque set is G20-5P and R2-6P only

`sign_codes.PLAQUE_CODES` also holds W16-2a and W7-3a. Those ride under W21-5aR, and the checkpoint counted them among "all 10 signs" page 1 keeps. So (a) as written cuts only G20-5P and R2-6P first, the two codes the issue's option (a) names.

## Rule 5 prediction (amended before the diff)

The checkpoint said page 1 would draw 12 rows and print "+5 MORE". That was wrong. The loop stops at the first fit, and a 14-row two-column table is 7 rows tall (`(14 + 1) // 2`), the same height as the 13 rows that fit today. Cutting G20-5P at 3000 ft (17 → 16, 8 tall, no fit) and then the 2500 ft pair (→ 14, 7 tall) fits.

- **Freeway 75 → 40 at 1000 ft and at 5000 ft:** page 1 draws 14 rows. That's all 10 signs (W20-1, every W3-5, R2-10 among them) plus the plaque pairs at 500 and 1500 ft. The line reads `+3 MORE ADVANCE SIGNS (G20-5P, R2-6P). SEE CREW NARRATIVE & DEVICE LIST`.
- **The other 148 plans in the probe grid:** plan PDF text is byte-identical. Every plan's audit, audit PDF, crew sheet and XLSX is byte-identical; none of them reads page 1's cap.
- **A plan that cuts with no G20-5P / R2-6P rows:** cuts exactly as before. With no plaque left, the "from the end" step is the old prefix cap.
- **Tests:** `test_case_27_keeps_its_four_two_column_rows` moves from 13 rows / "+4 MORE (W3-5, W20-1" to 14 rows / "+3 MORE (G20-5P, R2-6P". A new test checks that W20-1, every W3-5 and R2-10 are on page 1 for this plan.
- The branch carries #363's evidence commit `06503fe`.
