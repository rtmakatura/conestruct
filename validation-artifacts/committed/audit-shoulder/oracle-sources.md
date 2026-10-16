# Shoulder-work audit: oracle sources

Every value `oracle.py` checks against, with a quote from the page it comes from. The oracle copies these values by hand from the two PDFs below. It imports nothing from `src/`, so the audit never checks the code against itself.

**Sources** (git-ignored copies in the main checkout; page text checked 2026-10-16):

- **MUTCD 11th Edition (December 2023), Part 6.** `validation-artifacts/ta10_flagger/mutcd_part6.pdf`. PDF page *n* prints as page *n* + 764. Pages below are the printed ones.
- **CDOT Standard Plan S-630-1, issued July 01, 2026.** 26 sheets, in `validation-artifacts/s630-1-2026.pdf`. Sheet *N* is PDF page 148 + *N*.

Values are numbered O1–O16. `oracle.py` cites the same numbers.

## O1. Taper length L

- **Value:** S ≤ 40 mph: L = W·S²/60. S ≥ 45 mph: L = W·S. W is the width of offset in feet; S is the speed in mph.
- **MUTCD Table 6B-4, p. 775:** "40 mph or less L = WS²/60 … 45 mph or more L = WS … W = width of offset in feet … S = posted speed limit, or off-peak 85th-percentile speed prior to work starting, or the anticipated operating speed in mph".
- **S-630-1 legends,** Sheets 3, 4, 7 and 14: "Speed 40 Mph or Less: L = WS²/60 … Speed 45 Mph or More: L = S X W … W = Width of Offset".
- **W for a shoulder closure** is the closed shoulder's width. The plan has no shoulder-width input. The oracle reads W from the plan if it's printed. If it isn't, the oracle uses the width the backend assumed and records that as check 9.

## O2. Shoulder taper

- **Value:** at least 0.33 L, about ⅓ L.
- **MUTCD Table 6B-3, p. 775:** "Shoulder Taper at least 0.33 L".
- **MUTCD §6B.08 ¶10, p. 776:** "If used, shoulder tapers should have a length of approximately ¹⁄3 L".
- **S-630-1 legends,** Sheets 4, 7 and 14: "Shoulder Taper = 1/3 L".
- **Check rule:** PASS when the drawn shoulder taper is at least L/3, rounded down to the foot.

## O3. Advance warning sign spacing (A, B, C)

- **Values:**

  | Road type | A | B | C |
  |---|---|---|---|
  | Urban, low speed | 100 ft | 100 ft | 100 ft |
  | Urban, high speed | 350 ft | 350 ft | 350 ft |
  | Rural | 500 ft | 500 ft | 500 ft |
  | Expressway / freeway | 1,000 ft | 1,500 ft | 2,640 ft |

- **MUTCD Table 6B-1, p. 773:** "Urban (low speed)* 100 feet 100 feet 100 feet / Urban (high speed)* 350 feet 350 feet 350 feet / Rural 500 feet 500 feet 500 feet / Expressway / Freeway 1,000 feet 1,500 feet 2,640 feet". Its footnote: "* Speed category to be determined by the highway agency".
- **What the letters mean** (same table, footnote **): "The A dimension is the distance from the transition or point of restriction to the first sign. The B dimension is the distance between the first and second signs. The C dimension is the distance between the second and third signs."
- **CDOT's speed category,** S-630-1 Sheet 4, "Distance between signs" key: "URBAN (< = 40 MPH) … URBAN (> = 45 MPH) … RURAL … EXPRESSWAY/FREEWAY". The oracle uses CDOT's 40/45 split.
- **Lakewood:** `data/jurisdictions/lakewood.json` gives a 35 mph split (`urban_high_speed_breakpoint_mph`, under geometry marked "published"; its spacing rows are marked provisional), and 02-JURISDICTION-DATA.md is missing. Lakewood rows are scored on CDOT's split. A difference under Lakewood's split is recorded as a question for Ryan, not a FLAG (ruling e, 2026-10-16).
- **Check rule:** each spacing is at least the table value. The table gives minimums ("Minimum Spacing"). §6B.04 ¶07 (p. 771) allows adjusting them for field conditions.

## O4. Increased advance warning (limited sight distance)

- **MUTCD §6B.04 ¶04, p. 771:** "On urban streets, the effective placement of the nearest warning sign to the TTC zone, in feet, should range from 4 to 8 times the speed limit in mph".
- **¶06, same page:** rural "from 8 to 12 times the speed limit in mph".
- **¶07, same page:** the distances "should be adjusted for field conditions, if necessary, by increasing or decreasing the recommended distances".
- **¶08, same page:** "The need to provide additional reaction time for a condition is one example of justification for increasing the sign spacing."
- **What the sources give:** a reason to increase the spacing, but no factor. The oracle checks that each sign moved farther upstream. Where a plan or audit applies a fixed multiplier, it checks whether the multiplier is cited or marked as chosen (Rule 12).

## O5. Longitudinal buffer

- **Values:**

  | Speed (mph) | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Buffer (ft) | 115 | 155 | 200 | 250 | 305 | 360 | 425 | 495 | 570 | 645 | 730 | 820 |

- **MUTCD Table 6B-2, p. 775,** "Stopping Sight Distance as a Function of Speed": "20 mph 115 feet / 25 mph 155 feet / 30 mph 200 feet / 35 mph 250 feet / 40 mph 305 feet / 45 mph 360 feet / 50 mph 425 feet / 55 mph 495 feet / 60 mph 570 feet / 65 mph 645 feet / 70 mph 730 feet / 75 mph 820 feet".
- **The buffer is optional:**
  - **MUTCD §6B.06 ¶11, p. 773:** "If a longitudinal buffer space is used, the values shown in Table 6B-2 may be used".
  - **S-630-1 Sheet 2, General Note 24:** "Buffer space is optional. Need must be determined on a project or site specific basis".
- **CDOT freeway minimums,** S-630-1 Sheet 14 (checked on the rendered sheet):
  - Case No. 26, 65 mph speed limit: "570' MIN". Signed down to 60 mph, R2-1(60).
  - Case No. 27, 75 mph speed limit: "650' MIN". Signed down to 65 mph, R2-1(65).
- **The speed the buffer is scored at:** 570 ft is Table 6B-2 at 60 mph, and 650 ft is about the 645 ft at 65 mph. So CDOT sizes the buffer at the reduced work-zone speed. Table 6B-2's footnote allows that speed: "* Posted speed, off-peak 85th-percentile speed prior to work starting, or the anticipated operating speed".
- **Check rule** (R145 self-ruled, see "Corrections" below):
  - If the plan draws a buffer, it's at least Table 6B-2 at the work-zone speed (the posted speed when there's no reduction).
  - On Case 26/27 freeway rows, it's also at least Sheet 14's 570 or 650 ft.
  - No buffer is INFO, not FLAG.

## O6. Channelizing device spacing

- **Value:** in the taper, at most 1·S feet. On the tangent, at most 2·S feet.
- **MUTCD §6K.01 ¶04, p. 815:** "should not exceed a distance in feet equal to 1 times the speed limit in mph when used for taper channelization, and should not exceed a distance in feet equal to 2 times the speed limit in mph when used for tangent channelization."
- **S-630-1 Sheet 2, General Note 18:** "a. For tapers and transitions, spacing equals the numerical value of the speed limit. (e.g. 45 mph = 45 feet) b. For tangents along the buffer space or work area, spacing may not be greater than two times the speed limit."

## O7. Downstream taper

- **Value:** optional; 50 to 100 ft, with devices about 20 ft apart.
- **MUTCD §6B.08 ¶12, p. 776:** "If used, a downstream taper should have a minimum length of 50 feet and a maximum length of 100 feet with devices placed at a spacing of approximately 20 feet."

## O8. Shoulder sign legends and side

- **MUTCD §6H.22 ¶02, p. 807:** "The Shoulder Work sign shall have the legend SHOULDER WORK (W21-5), RIGHT (LEFT) SHOULDER CLOSED (W21-5a), or RIGHT (LEFT) SHOULDER CLOSED XX FT or AHEAD (W21-5b)."
- **Check rule:** a right closure carries W21-5aR and a left closure W21-5aL, and no plan carries both.

## O9. Signs on both sides

- **S-630-1 Sheet 2, General Note 8:** "All warning and regulatory signs shall be posted on both sides of the roadway on divided highways, multi-lane ramps, one-way streets, and as directed by the Engineer, except where only one shoulder is closed (ex: Case 11 on Sheet 7)."
- **MUTCD TA-3 Note 1, p. 864:** "A SHOULDER WORK sign should be placed on the left-hand side of the roadway for a divided or one-way street only if the left-hand shoulder is affected."
- **MUTCD §6N.06 ¶03, p. 845:** "On multi-lane, divided highways, signs advising of shoulder work or the condition of the shoulder should be placed only on the side of the affected shoulder."
- **House rule, #243 R54:** a shoulder closure takes Note 8's single-shoulder exception, so the both-sides check reads "Not required". The divided generator still mirrors its signs, a house choice.
- **Check rule:**
  - On divided rows, a plan that mirrors signs is INFO when it says so (R54). It's a FLAG if it calls the mirror required.
  - On one-way rows, a shoulder sign on the unaffected side is a FLAG, per TA-3 Note 1.

## O10. Arrow board mode

- **MUTCD §6N.06 ¶09, p. 845:** "When used for shoulder work, arrow boards shall operate only in the caution mode."
- **MUTCD TA-4 Note 8, p. 866:** "If an arrow board is used for an operation on the shoulder, the caution mode shall be used."
- **S-630-1 Sheet 2, General Note 26:** "If arrow boards are used for shoulder work, blocking the shoulder, … use the arrow boards only in the caution mode."
- **Check rule:** any arrow-board mode other than caution is a FLAG, wherever it shows: page 1, notes, crew sheet or audit.

## O11. Shoulders 8 ft or wider

- **MUTCD §6N.06 ¶02, p. 845:** "When paved shoulders having a width of 8 feet or more are closed, at least one advance warning sign shall be used. In addition, channelizing devices shall be used to close the shoulder in advance to delineate the beginning of the work space and direct motor vehicle traffic to remain within the traveled way."
- **MUTCD TA-3 Note 8, p. 864,** the same rule in nearly the same words: "… to delineate the beginning of the work space and to direct vehicular traffic to remain within the traveled way."
- **MUTCD §6N.04 ¶06, p. 843:** "Except for short-duration and mobile operations, when a highway shoulder is occupied, a SHOULDER WORK (W21-5) sign should be placed in advance of the activity area."
- **Check rule:** the plan has at least one advance warning sign, and channelizing devices on a shoulder taper.

## O12. Freeway sign set

- **MUTCD §6N.06 ¶03, p. 845:** "An initial general warning sign, such as ROAD WORK AHEAD (W20-1), should be used, followed by a RIGHT or LEFT SHOULDER CLOSED (W21-5a) sign. Where the downstream end of the shoulder closure extends beyond the distance that can be perceived by road users, a supplementary plaque bearing the message NEXT XX FEET (W16-4P) or MILES (W7-3aP) should be placed below the SHOULDER CLOSED (W21-5a) sign."
- **MUTCD TA-5:** notes on p. 868; the figure on **p. 869** has the labels "W21-5aR / W21-5aR / W20-1 / W7-3aP / W16-2P", plus "1/3 L", "A", "B", "C".
- **S-630-1 Sheet 7, Case No. 11,** "Shoulder Work - Freeway/Expressway" (checked on the rendered sheet): W20-1 or W21-5; W21-5aR with W16-2a; W21-5aR with W7-3a(X); W5-1.
- **Check rule:**
  - A freeway plan has W20-1, then W21-5aR. Its spacing uses the expressway/freeway row of O3.
  - A distance or miles plaque (W16-2, W16-4P or W7-3aP) is expected on Case 11 plans. Its absence is INFO, because ¶03 makes it conditional on sight.

## O13. Cone height

- **S-630-1 Sheet 2, General Note 15:** "Traffic cones shall be at least 28 inches in height. However, the minimum size shall be 36 inches when they are used on freeways and expressways, or during nighttime working hours. They should also be 36 inches when used on other high speed roadways (45 mph or more) with an ADT of 6,000 or more."
- **Check rule:**
  - On night and freeway rows, any cone spec under 36 in is a FLAG.
  - Rows at 45 mph or more have no ADT input, so an unstated height there is INFO.

## O14. Type 1 barricades

- **S-630-1 Sheet 2, General Note 16:** "Type 1 barricades shall not be used on freeways, expressways, or other high speed roadways (55 mph or more)."
- **Check rule:** a Type 1 barricade on a row at 55 mph or more is a FLAG.

## O15. Sidewalk closures

- **MUTCD TA-28 Note 1, p. 914:** "A pedestrian channelizing device … that is detectable by a person with a vision disability traveling with the aid of a long cane shall be placed across the full width of the closed sidewalk."
- **TA-28 figure, p. 915,** labels: "W20-1 / R9-11a / R9-9 / SIDEWALK DETOUR SIDEWALK DIVERSION".
- **MUTCD §6N.04 ¶06, p. 843:** "Signs should be placed such that they do not narrow any existing pedestrian passages to less than 48 inches."
- **Check rule:** on rows with a sidewalk to close, the plan either shows the pedestrian closure (devices or signs from TA-28) or says plainly that it doesn't cover pedestrians. Silence is a FLAG (Rule 10).

## O16. Case 11 sign dimensions (freeway)

Added during the run, after E-470's plan cited Case 11. It was checked separately (see oracle-check.md, O16).

- **S-630-1 Sheet 7, Case No. 11,** "Shoulder Work - Freeway/Expressway", read on the rendered sheet. Dimensions run upstream from the start of the ⅓ L shoulder taper:
  - "500'" to W5-1 ROAD NARROWS;
  - "500'" more to W21-5aR, with W7-3a(X) "NEXT X MILES";
  - "1000'" more to W21-5aR, with W16-2a "1500 FT";
  - "1000'" more to the G20-5P WORK ZONE / R2-1(XX) SPEED LIMIT group;
  - "2200'" more to W20-1 ROAD WORK 1 MILE (or W21-5 SHOULDER WORK).
- **The upper-row dimensions:**
  - R2-10 BEGIN DOUBLE FINES ZONE sits "500' (MIN.)" upstream of the G20-5P / R2-1(XX) group.
  - The G20-5P / R2-6P FINES DOUBLE group sits "VAR." downstream of it.
- **Cumulative distances from the taper:** W5-1 at 500 ft; the first W21-5aR at 1,000 ft; the second W21-5aR at 2,000 ft; W20-1 at 5,200 ft.
- **Check rule:** on a freeway plan that cites Case 11, W5-1, both W21-5aR signs and W20-1 are each at least their Case 11 distance from the taper. The Table 6B-1 freeway row (O3) is scored too.

## Corrections from the independent check (ruling a, 2026-10-16)

A fresh agent checked every value against its page by subject, using rendered images for tables and figures. Its notes are under the job's `tmp/aud/verify/`. O1–O4, O6–O10, O13 and O14 matched as written. Changes made:

- **O11:**
  - The TA-3 Note 8 wording is now quoted separately ("to direct vehicular traffic").
  - The §6N.04 ¶06 quote gets back its opening qualifier, "Except for short-duration and mobile operations".
- **O12:**
  - The TA-5 figure is on p. 869, not 868.
  - The ¶03 quote gets back the condition on the plaque, so a missing plaque is INFO.
  - Case 11's signs are now listed as read off the rendered sheet.
- **O15:** the TA-28 figure is on p. 915, not 914.
- **O5 (R145 self-ruled):** CDOT's Sheet 14 minimums (570 ft, Case 26, 65 mph; 650 ft, Case 27, 75 mph) are lower than Table 6B-2 at the posted speed. They equal Table 6B-2 at the reduced speeds those cases sign (60 and 65 mph). The oracle scores the buffer at the work-zone speed, which the table's footnote allows ("the anticipated operating speed"). It fits the sources, so it's self-ruled, not stopped.
- **O3 wording:** Lakewood's 35 mph value sits under geometry marked "published". Only its spacing rows are marked provisional.
- **Shortened quotes:** the O3 footnote, O5's Note 24 and O6's Note 18b are shortened where marked. Nothing dropped changes a value.

## Not sourced in these documents

The oracle treats these as INFO, never FLAG:

- **School zones.** Neither document's work-zone pages give a school-zone rule. The audit records what the plan adds (S1-1 and the rest).
- **Night lighting** beyond O13. The audit records what the plan says.
- **Jurisdiction rules.** 02-JURISDICTION-DATA.md isn't in the repo. Edition findings (the Denver MUTCD 2009 pin in `data/jurisdictions/denver.json`) go to #265 (ruling d, 2026-10-16).
