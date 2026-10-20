# #355 production check of 797485b

**PASS 5/5.** Run 2026-10-20 against www.conestruct.com through the site proxy. `healthz.txt` shows the backend sha is `797485b`. `prodcheck355.py` is the script, and `replay.txt` is its full output.

1. **`rural_divided` 65 → 60, `/render/audit` 200.**
   - Buffer is 645 ft, sourced to MUTCD Table 6B-2 and Sheet 7 Case 11. No divergence fields.
   - The lookup says Sheet 14 is drawn for freeway or expressway shoulder work.
   - Case and taper cite Case 11 (reduced work-zone speed). `narrative_2` is the R3 disclosure. No `trigger_condition`.
2. **The same plan, `/render/markdown` 200.** No "Trigger Condition" section and no "Sheet 14" in the crew sheet.
3. **`rural_divided` 75 → 65, `/render/audit` 200.** Buffer is 820 ft, with the same citations and disclosure as check 1.
4. **The same plan, `/render/markdown` 200.** As check 2.
5. **Freeway Case 26 (65 → 60), `/render/audit` 200.** Unchanged: buffer 570 ft, source "Sheet 14 (Case 26 at 65 mph)", case "Case 26 at 65 mph".

No browser check is needed: these are citations and a buffer length, with no visible design change.
