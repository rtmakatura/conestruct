# issue-323-far-side — 📋 checkpoint: TA-23's turn-bay layout (stopped on one unsourced length)

**Base:** `main` `bc7280c` (the near side live). Investigation only: no code.

## R152 (Ryan, 2026-10-15), verbatim

> #323 answers (Ryan, 2026-10-15), R152:
> Q1 far side: (a). Build TA-23's turn-bay layout (left-turn bay, R3-7L) as its own branch. Every length and sign from TA-23 (notes p. 904, figure p. 905) or S-630-1, cited by subject with page; stop on any unsourced value.
> Q2 mid-block: (a). File a separate Rule 8 enablement issue for mid-block lane closures on one-way streets (both sides), with the evidence bar spelled out (TA-33 Note 1, S-630-1 Cases 5 and 10). Park it; don't build it.
> Then #325: triage it under R145 and build it after TA-23 if you can self-rule it; otherwise add its question to your next report.
> Usual loop to a backticked result: line.

Q2 is filed as #326 and parked.

## What TA-23 draws (Fig 6P-23, p. 905, read at 3× from the PDF: `sources/mutcd11-p905-fig6P-23-*-3x.png`)

**Approach (near side of the intersection), signs on the right, in order toward the intersection:**

| element | from TA-23 | value source |
|---|---|---|
| W20-1 ROAD WORK AHEAD | drawn | — |
| C | dimension W20-1 → W20-5L | Table 6B-1 (by speed; already in the tool) |
| W20-5L LEFT LANE CLOSED AHEAD | drawn | — |
| B | dimension W20-5L → W4-2L | Table 6B-1 |
| W4-2L (lane ends) | drawn | — |
| A | dimension W4-2L → taper start | Table 6B-1 |
| channelizing devices along the centerline | drawn from about the W4-2L station up to the taper | device spacing, Table 6B-1/6B-2 (already in the tool) |
| merging taper closing the left lane | dimension **L** | Table 6B-4 (already in the tool) |
| R3-7L LEFT LANE MUST TURN LEFT, at the taper end, on the right; repeated on the channelized island on the left (Note 5) | drawn | — |
| **100 ft** | dimension from the taper end (R3-7L) to the start of the lane-line channelizers | **the figure: 100 ft** |
| channelizers along the lane line, from there to the stop line: the reopened left lane is the **left-turn bay** | drawn | **no dimension** |

**Far side:**

| element | from TA-23 | value source |
|---|---|---|
| work space in the left lane, starting at the far curb | drawn | the work zone length (input) |
| barricade + optional arrow board (right arrow) at its upstream end | drawn | — |
| W20-1 on each cross street at A from the intersection | drawn | Table 6B-1 |
| G20-2 END ROAD WORK (optional), on both sides | drawn | — |
| no taper and no buffer on the far side | as drawn | — |

**Notes p. 904:**
- **Note 4 (Option):** "...the left-hand lane may be reopened as a turn bay for left turns only, as shown."
- **Note 5 (Support):** "...A left-turn bay that is long enough to accommodate all turning vehicles during a traffic signal cycle will provide the maximum benefit for through traffic. Also, an island is created with channelizing devices that allows the LEFT LANE MUST TURN LEFT sign to be repeated on the left adjacent to the lane that it controls."

## The stop: the turn bay's storage length has no source

The bay runs from the end of the 100 ft gap to the stop line. TA-23 gives no dimension for it. Note 5 sizes it only by traffic ("all turning vehicles during a traffic signal cycle"), which the tool doesn't know. With the 100 ft fixed, this one length also places the whole taper and sign series upstream of the intersection. So every station on the approach depends on it.

**Searched and not found:**
- S-630-1 (no left-turn bay case; its only R3-7 is R3-7b, PDF p. 159);
- MUTCD Part 6 (the only bay-length language is TA-23 Note 5 and TA-22 Note 8).

**The nearest sourced analog:** TA-22 (Fig 6P-22, p. 903, `sources/mutcd11-p903-fig6P-22-near-side-3x.png`) dimensions its temporary right-turn lane as **A**, the span between its two R3-7R signs up to the stop line. TA-23 doesn't. Using A for the left bay would be a mirror of TA-22, CHOSEN, not TA-23's own value.

## Question for Ryan

**Q3. The left-turn bay's storage length (TA-23, the channelizer run from the 100 ft point to the stop line):**
- **(a) Recommended:** **A** from Table 6B-1, by the approach speed, mirroring TA-22's dimensioned right-turn lane. Marked CHOSEN, with a pending-verification item saying TA-23 sizes the bay by signal-cycle demand (Note 5) and the Engineer should confirm.
- **(b)** The operator enters the storage length (from the agency's signal timing or counts), with no default, and the plan won't build without it. This is a new input on the WHAT band, a design change.
- **(c)** Keep the left far side refused (as live today).

Nothing else in TA-23 is unsourced. With Q3 answered, the build is the table above.
