# #360 production check of 26c5b64

**PASS 26/26.** Run 2026-10-20 against www.conestruct.com through the site proxy. `healthz.txt` shows the backend sha is `26c5b64`. `prodcheck360.py` is the script, and `replay.txt` is its full output.

1. **`rural_divided` 75 → 70 with 2,000 ft of work, `/render/audit` 200.** This is the issue's repro.
   - The advance table lists W20-1 at 3,030 ft, W3-5(70) at 2,530, R2-10 at 2,000 and the R2-1 group at 1,500 ft upstream of the taper. W3-5 used to be dropped from the table.
   - R2-10 sits 500 ft before the group.
2. **The same plan, `/render/markdown` 200.** The crew sheet says R2-10 is "2,000 ft upstream of taper (500 ft before the speed limit group)" and the entrance R2-1 is "500 ft past R2-10, on its own G20-5P plaque".
3. **Freeway Case 11 55 → 45, `/render/audit` 200.** The spacing text reads "speed limit group 3,000 ft, R2-10 3,500 ft, W20-1 5,200 ft", and R2-10's position is "R2-10 (Case 11)".
4. **`urban_arterial` 55 → 45, `/render/audit` 200.** The one `fines_double_spacing` pending item quotes Sheet 2 Note 4's "as directed by the Engineer".
5. **Freeway Case 26 (65 → 60), `/render/audit` 200.** Unchanged: R2-10 is at Sheet 14's 1,580 ft as "R2-10 (Sheet 14)", and there's no engineer-note key.
6. **Case 11 55 → 45, `/render/pdf` page 1, read from the glyph boxes.**
   - The advance title clears its headers by 1.20 pt.
   - Each W21-5aR clears its description by at least 4.57 pt.
   - R2-10 is listed at 3500 ft, and all 14 advance rows fit with no "+N MORE" line.
7. **Case 26, `/render/pdf` page 1.** The title clears the headers by 1.20 pt, and each W21-5aR clears its description by at least 4.57 pt. Both overlaps were on this sheet before #360.

**Browser check:** page 1's notes table changed visibly: the title gap, the code column, and the shrink on the entrance R2-1 row. Under R145 Ryan does the browser check on a visible design change. The before/after renders are in `../renders/`.
