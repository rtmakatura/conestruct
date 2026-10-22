# Independent check of oracle-sources.md (2026-10-22)

A fresh general-purpose agent, which wrote none of the oracle, checked each value L1–L20 against its source page by subject, and each `oracle.py` constant against `oracle-sources.md`. Tables, figures and case sheets were checked on rendered page images. Its full notes, with the correct quotes, are in `oracle-check-notes.md`. The page-gap pass that found the new quotes is in `page-gaps.md`.

**Counts:** 15 MATCH, 3 MINOR MISMATCH (L6, L11, L20), 2 MISMATCH (L14, L15); all five fixed in `oracle-sources.md`.

**Page conventions confirmed:**
- MUTCD extract: PDF page *n* prints as *n* + 764 (pp. 771–915 checked).
- S-630-1 2026: Sheet *N* is PDF page 148 + *N* and prints "Standard Sheet No. N of 26" (all 26 checked).

| Item | Verdict | Note |
|---|---|---|
| L1 | MATCH | Table 6B-4, p. 775; S-630-1 legends. |
| L2 | MATCH | Table 6B-3, p. 775, "Merging Taper at least L"; Fig 6P-21 Note 1, p. 900. |
| L3 | MATCH | Table 6B-3; §6B.08 ¶14, p. 776; Fig 6P-10 "50 to 100 ft"; Case 17 callout. |
| L4 | MATCH | §6B.08 ¶12, p. 776, no "per lane"; Fig 6P-10's second dimension; Sheet 9 "100' MAX.". |
| L5 | MATCH | Table 6B-1, p. 773, both footnotes; Sheet 9 key; Sheet 10 Note 1. |
| L6 | MINOR MISMATCH, fixed | Case 17's ◆ is on the downstream R2-1(XX). |
| L7 | MATCH | §6D.06 ¶01/03/05, p. 786; §6E.02 ¶01, p. 787; Fig 6P-10 Note 2; Case 17 "200' TO 300'". |
| L8 | MATCH | Fig 6P-10 Note 7; Sheet 2 Note 22. |
| L9 | MATCH | Table 6B-2 and footnote; §6B.06 ¶11, p. 773; Note 24. |
| L10 | MATCH | §6K.01 ¶04, p. 815; Note 18. |
| L11 | MINOR MISMATCH, fixed | Sheet 4's legend reads "one way, two-way traffic tapers". |
| L12 | MATCH | Note 15. |
| L13 | MATCH | Note 16. |
| L14 | MISMATCH, fixed | Paragraphs and pages right; Fig 6P-22 draws a second arrow board at the far-side work space. |
| L15 | MISMATCH, fixed | Case 18 closes two approaches; the eastbound (near-side) approach also carries W20-5(R) and W4-2(R). |
| L16 | MATCH | Both figure titles, pp. 901 and 903. |
| L17 | MATCH | §6E.04 ¶03/04, p. 787; Case 42 order and the 260' dimensions; no G20-4 drawn. |
| L18 | MATCH | Fig 6P-10 Note 5; Note 20. |
| L19 | MATCH | §6B.04, p. 771; ¶08 is Support (label fixed). |
| L20 | MINOR MISMATCH, fixed | §6N.04 ¶06 prints "Except for - and mobile operations"; the 48-inch sentence is now quoted on its own. |

**`oracle.py`:** every constant equals its `oracle-sources.md` value. Fixed on the checker's notes: the Case 18 100 ft constant is named for its approach; `buffer_min`'s rounding is marked CHOSEN (Rule 12); the optional-sign comment.

**Also noted:**
- CDOT's 2026 Sheets 10 and 25 send buffer space to "General Note 23"; the buffer note is Note 24. A defect in CDOT's sheet, not in Conestruct (same as the shoulder audit found on Sheets 4 and 7).
- The shoulder audit's O11/O15 quote of §6N.04 ¶06 includes "short-duration", which isn't printed. Recorded, not edited.
