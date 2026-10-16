# Independent check of oracle-sources.md (ruling a, 2026-10-16)

A fresh general-purpose agent, which wrote none of the oracle, checked each value O1–O15 against its source page by subject. Tables and figures were checked on rendered page images.

**Page conventions confirmed:**
- MUTCD extract: PDF page *n* prints as *n* + 764.
- S-630-1 2026: each page carries its own "Standard Sheet No. N of 26".

| Item | Verdict | Note |
|---|---|---|
| O1 | MATCH | Table 6B-4, p. 775. Legends on Sheets 3, 4, 7 and 14. |
| O2 | MATCH | Table 6B-3, p. 775; §6B.08 ¶10, p. 776. "Shoulder Taper = 1/3 L" is on Sheets 4, 7 and 14. |
| O3 | MATCH | Table 6B-1, p. 773. Sheet 4 key, by eye: Urban ≤40 mph 100/100/100; Urban ≥45 mph 350/350/350; Rural 500/500/500; Expressway/freeway 1000/1500/2640. |
| O4 | MATCH | §6B.04 ¶04, ¶06, ¶07 and ¶08, p. 771. |
| O5 | MATCH, with a conflict | Table 6B-2, p. 775; §6B.06 ¶11, p. 773; Note 24. Sheet 14, by eye: Case 26, 65 mph, 570' MIN; Case 27, 75 mph, 650' MIN. These are below Table 6B-2 at the posted speed. Resolved in oracle-sources.md under Corrections. |
| O6 | MATCH | §6K.01 ¶04, p. 815; Note 18 a/b. |
| O7 | MATCH | §6B.08 ¶12, p. 776. |
| O8 | MATCH | §6H.22 ¶02, p. 807. |
| O9 | MATCH | Note 8 verbatim; TA-3 Note 1, p. 864; §6N.06 ¶03, p. 845. |
| O10 | MATCH | §6N.06 ¶09, p. 845; TA-4 Note 8, p. 866; Note 26. |
| O11 | MINOR MISMATCH, fixed | TA-3 Note 8's wording differs slightly from §6N.06 ¶02. The §6N.04 ¶06 qualifier "Except for short-duration and mobile operations" had been dropped. |
| O12 | MISMATCH, fixed | The TA-5 figure is on p. 869, not 868. The ¶03 quote had dropped the condition on the plaque. Case 11's signs were confirmed by eye. |
| O13 | MATCH | Note 15. |
| O14 | MATCH | Note 16. |
| O15 | MISMATCH, fixed | The TA-28 figure is on p. 915, not 914. |

**O16 (added during the run):** a second fresh agent checked it on zoomed crops of Sheet 7.
- **Verdict:** MISMATCH in the upstream groups, fixed.
- **What it scores:** the three distances (W5-1 500 ft, W21-5aR with W7-3a(X) 1,000 ft, W21-5aR with W16-2a "1500 FT" 2,000 ft) match.
- **Corrected:**
  - The fourth dimension ("1000'") ends at the G20-5P / R2-1(XX) group, not the R2-6P group.
  - R2-10 sits 500' (MIN.) upstream of that group; R2-6P sits "VAR." downstream of it.
  - W20-1 is 5,200 ft from the taper.

**Also noted:** in CDOT's 2026 sheet, the Sheet 4 and Sheet 7 legends send buffer space to "General Note 23 on Sheet 2". Note 23 on Sheet 2 covers pavement markings; the buffer note is Note 24. That's a defect in CDOT's sheet, not in Conestruct. The oracle cites Note 24.
