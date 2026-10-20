# #364 rulings: what the W16-2a plaque's "XX FT" measures

## R1 (R145 self-ruled, 2026-10-20): W16-2a is a Distance Ahead plaque. It reads "XX FT", measured from its host W21-5aR to the start of the shoulder taper, with no "NEXT".

**Sources (read by subject):**
- MUTCD 11th Ed. §2C.61 ¶01 (p. 197): "The Distance Ahead (W16-2 series and W16-3 series) plaques (see Figure 2C-16) may be used to inform the road user of the distance to the condition indicated by the warning sign." ¶02: "The Next Distance (W7-3aP and W16-4P) plaques ... may be used to inform road users of the length of roadway over which the condition indicated by the warning sign exists." Excerpt: `sources/mutcd11-printed197-sect2C61.txt`.
  - So "NEXT" belongs to W16-4P and W7-3aP, never to W16-2a. The W16-2 series gives a distance to the condition.
- The host sign is RIGHT (LEFT) SHOULDER CLOSED (W21-5aR/L). The condition it warns of is the closed shoulder, which starts where the shoulder taper starts.
- CDOT S-630-1 Sheet 14, Cases No. 26 and 27 (PDF p. 162, July 2026; `sources/s630-1-2026-pdf162-sheet14.png`): the first W21-5aR carries a plaque labelled "W16-2aP OR W16-3aP OR W16-9P" that reads "1/4 MILE". Read on the 4x zoom (`sources/s630-1-2026-pdf162-sheet14-case26-zoom.png`), following each sign's leader to its tick, the dimensions run upstream from the "1/3 L" taper start:
  - "530'" to the second W21-5aR (W7-3aP).
  - "530'" more to the R2-1(60) group. The "VAR." to the FINES DOUBLE group sits inside this span.
  - "260'" more to the first W21-5aR.
  - The other "260'" is R2-10 → first W21-5aR, upstream of the sign.

  So the first W21-5aR sits 530 + 530 + 260 = 1,320 ft from the taper start, which is ¼ mile. That is the shipped `SHEET_14_FREEWAY_SIGN_FT["A"]` (#344 S1). A distance plaque that matches its own drawn station to the foot, measured from the taper start, corroborates the reference point. (The same sheet's W20-1 "ROAD WORK ½ MILE" sits 2,640 ft from the taper start; #344.)
- CDOT S-630-1 Sheet 7, Case No. 11 (PDF p. 155; `validation-artifacts/committed/issue-300-left-side-oneway/sources/s630-1-2026-pdf155-sheet7-cases10-11.png`): the first W21-5aR's plaque is labelled "W16-2a" and reads "1500 FT", with no "NEXT". This confirms the legend form. Its number doesn't match its own dimensions: the sign is "1000'" + "500'" + "500'" = 2,000 ft from the taper start. That makes it an example legend, not a value to copy (Rule 12). Options (b) and (c) in the issue are rejected:
  - (b) changes the sign code to W16-4P, which neither Case 11 nor Sheet 14 draws.
  - (c) would print a distance that is false at the plan's own station.

**Change:** `substitute_sign_description` (`src/rules/sign_codes.py`) prints W16-2a as `f"{station_ft - taper_start_station:,} FT"`. It uses the same taper start W20-2 already uses. Case 11 plans read "2,000 FT" and Sheet 14 plans read "1,320 FT". The template is "XXX FT plaque". The code stays W16-2a (Case 11's label), and the comma formatting is kept from the current W16-2a legend.

**Not changed:** W7-3a's "NEXT X MILES" value, every other sign, and every station.
