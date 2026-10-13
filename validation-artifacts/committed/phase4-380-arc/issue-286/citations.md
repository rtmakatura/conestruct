# Citations this branch touches, verified by subject (R144 Q2)

Source: `validation-artifacts/ta10_flagger/mutcd_part6.pdf`, an untracked local copy in the main checkout (MUTCD 11th Edition, December 2023,
Part 6), page text extracted with pypdf on 2026-10-13. "PDF p." is the file's page; "printed p." is
the page number printed in its header.

| Citation the audit panel shows | Subject it must carry | Where the subject is | Verdict |
|---|---|---|---|
| Taper: `MUTCD § 6B.08` · `TABLE 6B-3` | taper length and the shoulder L/3 / merging L criteria | PDF p. 11, printed p. 775: "Section 6B.08 Tapers"; "Table 6B‑3. Taper Length Criteria for …"; "Table 6B‑4. Formulas for Determining …": "40 mph or less L = WS²/60", "45 mph or more L = WS" | correct (also `../../s2-arc13-demo-fixes/p775-verification.md`) |
| Buffer: `MUTCD § 6B.06` · `STOPPING SIGHT DISTANCE` (lookup text `MUTCD Table 6B-2`) | longitudinal buffer sized by stopping sight distance | PDF p. 9, printed p. 773, Sect. 6B.06 ¶11: "If a longitudinal buffer space is used, the values shown in Table 6B-2 may be used to determine the length of …"; PDF p. 11, printed p. 775: "Table 6B‑2. Stopping Sight Distance" | correct |
| Device spacing: `MUTCD § 6K.01` · `CHANNELIZING DEVICE SPACING` | 1× speed in tapers, 2× speed on tangents | PDF p. 51, printed p. 815, §6K.01 ¶04: "The spacing between cones, tubular markers, vertical panels, drums, and barricades should not exceed a distance in feet equal to 1 times the speed limit in mph when used for taper channelization, and should not exceed a distance in feet equal to 2 times the speed limit in mph when used for tangent channelization." | correct |
| Advance signs, header: `MUTCD TABLE 6B-1` | the A/B/C advance warning sign spacing | PDF p. 9, printed p. 773: "Table 6B‑1. Recommended Advance Warning Sign Minimum Spacing", rows Urban (low speed) 100/100/100, Urban (high speed) 350/350/350, Rural 500/500/500, Expressway / Freeway 1,000/1,500/2,640 | correct; unchanged |
| Advance signs, footer, **was** `MUTCD § 6B-1 · ADVANCE WARNING SIGN SPACING` | a section | there is no § 6B-1; 6B-1 is the table above | **defect (counter 19 → 20)** |
| Advance signs, footer, **now** `MUTCD § 6H.02 · TABLE 6B-1 · ADVANCE WARNING SIGN SPACING` | the section that places advance warning signs by Table 6B-1 | PDF p. 34, printed p. 798 (Sect. 6H.01 to 6H.02): "Section 6H.02 Position of Advance Warning Signs … 01 Where highway conditions permit, warning signs should be placed in advance of the transition and activity areas at varying distances depending on roadway type, condition, and posted speed. Table 6B-1 contains information regarding the spacing of advance warning signs." | correct |
| Flagger sight distance: `MUTCD § 6D.06` · `TABLE 6B-2` · `STOPPING SIGHT DISTANCE` | flagger station location by stopping sight distance | PDF p. 22, printed p. 786: "Section 6D.06 Flagger Stations … 03 The distances shown in Table 6B-2, which provides information regarding the stopping sight distance as a function of speed, may be used for the location of a flagger station." | correct |

**Why § 6H.02 for the footer, over § 6B.04.** §6B.04 Advance Warning Area (PDF p. 7, printed
p. 771) also points to Table 6B-1 (¶04, ¶06, ¶07), but its subject is how far the warning area
extends. The calculation row lists each sign's position and the A/B/C gaps between them, which is
§6H.02's subject ("Position of Advance Warning Signs").

**#281 §2.8's 2009 numbers** (§6C.08, §6C.06, Table 6C-1) are superseded by the rows above (R144
Q2). They are 2009-edition numbers; the backend has used the 11th edition since #97/#98.
