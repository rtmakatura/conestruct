# #364 production check of 9650dd9

**PASS 3/3.** Run 2026-10-21 against www.conestruct.com through the site proxy. `healthz.txt` shows the backend sha is `9650dd9`. `prodcheck364.py` is the script, and `replay.txt` is its full output. Each plan was checked on four surfaces (audit, PDF page 1, crew sheet, device list), and all 12 requests returned 200.

1. **Case 11 (55 → 50).** W16-2a reads "2,000 FT" on every surface (R1). The audit row reads "2,000 FT (under first W21-5aR)", and the crew sheet reads "| W16-2a | 2,000 FT (under upstream W21-5aR) | 2,000 ft upstream |".
2. **Case 26 (65 → 60).** W16-2a reads "¼ MILE" (U+00BC) on every surface (R2). The audit row reads "¼ MILE (under first W21-5aR)", and the crew sheet reads "| W16-2a | ¼ MILE (under upstream W21-5aR) | 1,320 ft upstream |".
3. **Case 27.** Same as Case 26: "¼ MILE" on every surface, 1,320 ft upstream.

No surface reads "W16-2a … NEXT" on any of the three plans.
