# #354 production check of 914e48d

**PASS 3/3.** Run 2026-10-20 against www.conestruct.com through the site proxy. `healthz.txt` shows the backend sha is `914e48d`. `prodcheck354.py` is the script, and `replay.txt` is its full output.

1. **Case 26 (freeway shoulder, 65 → 60), `/render/markdown` 200.** The crew sheet's sign schedule reads "| W20-1 | ROAD WORK ½ MILE | 2,640 ft upstream |" and "| G20-5P | WORK ZONE plaque | Within work zone |". "ROAD WORK AHEAD" and "CONSTRUCTION ZONE" are absent.
2. **Case 26, `/render/pdf` 200.** Page 1's text layer reads "ROAD WORK ½ MILE 2640 ft" (U+00BD) and "WORK ZONE plaque". "ROAD WORK AHEAD" and "CONSTRUCTION ZONE" are absent.
3. **Case 11 (freeway shoulder, 55 → 50), `/render/markdown` 200.** W20-1 keeps "ROAD WORK AHEAD" (rulings S1 is Sheet 14's alone). G20-5P reads "WORK ZONE plaque" (S2). "½ MILE" and "CONSTRUCTION ZONE" are absent.
