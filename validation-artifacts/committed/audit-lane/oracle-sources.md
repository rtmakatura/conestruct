# Lane-closure audit: oracle sources

Every value `oracle.py` checks against, with a quote from the page it comes from. The oracle copies these values by hand. It imports nothing from `src/` or `audit-shoulder/`, so the audit never checks the code against itself (rulings.md R2).

**Sources** (git-ignored copies in the main checkout; page text read 2026-10-22):

- **MUTCD 11th Edition (December 2023), Part 6.** `validation-artifacts/ta10_flagger/mutcd_part6.pdf`. PDF page *n* prints as page *n* + 764. Pages below are the printed ones.
- **CDOT Standard Plan S-630-1, issued July 01, 2026.** 26 sheets, in `validation-artifacts/s630-1-2026.pdf`. Sheet *N* is PDF page 148 + *N*; each sheet prints "Standard Sheet No. N of 26".

Values are numbered L1–L20. `oracle.py` cites the same numbers. "Copied from O*n*" names the shoulder audit's item (`audit-shoulder/oracle-sources.md`) the value was copied from. Every item, copies included, gets the independent page check (`oracle-check.md`).

**Scoring words:** FLAG = the plan breaks a Standard ("shall") or a Guidance value the check names. INFO = recorded, not a finding (Options, unsourced items, and the two Lakewood rows F5 and N12, per Ryan's 2026-10-22 amendment).

## L1. Taper length L (copied from O1)

- **Value:** S ≤ 40 mph: L = W·S²/60. S ≥ 45 mph: L = W·S. W is the width of offset in feet; S is the speed in mph.
- **MUTCD Table 6B-4, p. 775:** "40 mph or less L = WS²/60 … 45 mph or more L = WS … W = width of offset in feet … S = posted speed limit, or off-peak 85th-percentile speed prior to work starting, or the anticipated operating speed in mph".
- **S-630-1 legends,** Sheets 3, 4, 7 and 14: "Speed 40 Mph or Less: L = WS²/60 … Speed 45 Mph or More: L = S X W … W = Width of Offset".
- **W for a lane closure** is the closed lane's width (the plan's lane width input).

## L2. Merging taper (near-intersection)

- **Value:** at least L.
- **MUTCD Table 6B-3, p. 775,** "Taper Length Criteria for Temporary Traffic Control Zones": "Merging Taper at least L".
- **MUTCD Fig 6P-21 Note 1 (Standard), p. 900:** "The merging taper shall direct vehicular traffic into either the right-hand or left-hand lane, but not both."
- **Check rule:** the drawn merging taper is at least L (L1), rounded down to the foot. Near side and far side alike.

## L3. One-lane, two-way traffic taper (flagger)

- **Value:** 50 ft minimum, 100 ft maximum, channelizing devices about 20 ft apart.
- **MUTCD Table 6B-3, p. 775:** "One‑Lane, Two‑Way Traffic Taper — 50 feet minimum, 100 feet maximum".
- **MUTCD §6B.08 ¶14 (Guidance), p. 776:** "A taper having a minimum length of 50 feet and a maximum length of 100 feet with channelizing devices at approximately 20-foot spacing should be used to guide traffic into the one-lane section, and a downstream taper should be used to guide traffic back into their original lane."
- **MUTCD Fig 6P-10, p. 879:** the taper is dimensioned "50 to 100 ft".
- **S-630-1 Sheet 9, Case 17:** "50'MIN. 100'MAX.", with the callout "THIS TAPER MUST BE SHORT ENOUGH TO NOT BE MISTAKEN FOR A TRANSITION."
- **Check rule:** the drawn flagger taper is 50–100 ft. Outside that range is a FLAG.

## L4. Downstream taper

- **Value:** 50 to 100 ft, devices about 20 ft apart. The sources don't say "per lane".
- **MUTCD Table 6B-3, p. 775:** "Downstream Taper — 50 feet minimum, 100 feet maximum".
- **MUTCD §6B.08 ¶12 (Guidance), p. 776:** "If used, a downstream taper should have a minimum length of 50 feet and a maximum length of 100 feet with devices placed at a spacing of approximately 20 feet."
- **¶14, same page** (quoted in L3): on a flagger closure "a downstream taper should be used".
- **MUTCD Fig 6P-10, p. 879:** a second "50 to 100 ft" dimension at the far end of the work area. **S-630-1 Sheet 9:** "100' MAX." at the downstream end.
- **Check rule:** a printed downstream taper is 50–100 ft. Over 100 ft is a FLAG. A plan or audit that states the range "per lane" is a FLAG on the citation (the quote doesn't say it). On a flagger plan, no downstream taper is a FLAG (¶14 "should be used"); on a near-intersection plan it's INFO (¶12 "If used").

## L5. Advance warning sign spacing A, B, C (copied from O3)

- **Values:** urban low speed 100/100/100 ft; urban high speed 350/350/350; rural 500/500/500; expressway/freeway 1,000/1,500/2,640.
- **MUTCD Table 6B-1, p. 773:** "Urban (low speed)* 100 feet 100 feet 100 feet / Urban (high speed)* 350 feet 350 feet 350 feet / Rural 500 feet 500 feet 500 feet / Expressway / Freeway 1,000 feet 1,500 feet 2,640 feet". Footnote **: "The A dimension is the distance from the transition or point of restriction to the first sign. The B dimension is the distance between the first and second signs. The C dimension is the distance between the second and third signs. (The "first sign" is the sign in a three‑sign series that is closest to the TTC zone …)". Footnote *: "Speed category to be determined by the highway agency or owner of site roadways open to public travel."
- **CDOT's speed category,** S-630-1 Sheet 9, "Key to Advance Signing Distances" (the same key as Sheet 4): "URBAN (< = 40 MPH) 100 100 100 / URBAN (> = 45 MPH) 350 350 350 / RURAL 500 500 500 / EXPRESSWAY/FREEWAY 1000 1500 2640".
- **Lakewood:** `data/jurisdictions/lakewood.json` gives a 35 mph split, and `02-JURISDICTION-DATA.md` is missing. Lakewood rows (F5, N12) are scored on CDOT's split, and a difference under Lakewood's split is INFO (Ryan, 2026-10-22).
- **Check rule:** each spacing is at least the table value (the table gives minimums). On near-intersection plans in urban areas a shorter spacing is INFO, not FLAG: S-630-1 Sheet 10 Note 1 reads "Sign placement shown on cases 18 and 19 typifies rural applications. Urban applications require the signs to be placed within one, or perhaps two, blocks."

## L6. Flagger sign series (Fig 6P-10, Case 17)

- **MUTCD Fig 6P-10, p. 879,** each approach from upstream: W20-1 ROAD WORK XX FT, then C, then W20-4 ONE LANE ROAD XX FT, then B, then W20-7 (flagger symbol) with W16-2P XX FEET, then A, then the flagger station. W20-7 is the sign closest to the work. G20-2 END ROAD WORK "(optional)" once in each direction. The southbound W16-2P is labelled "(optional)".
- **Fig 6P-10 notes, p. 878:**
  - Note 3 (Option): "The ROAD WORK AHEAD and the END ROAD WORK signs may be omitted for short-duration operations."
  - Note 4 (Option): "… A BE PREPARED TO STOP sign may be added to the sign series."
  - Note 8 (Guidance): "When used, the BE PREPARED TO STOP sign should be located between the Flagger sign and the ONE LANE ROAD sign."
- **S-630-1 Sheet 9, Case 17:** W20-1, then *C, then W20-4, then *B, then W20-7, then *A, then the flagger station. No W3-4 and no W16-2P drawn. "Sign sequence is the same for the opposite direction." R2-10/R2-11 (★) and G20-5P over R2-1(XX) are also drawn upstream; a separate R2-1(XX) downstream carries ◆ ("These devices are not optional if the posted speed limit in the work zone is reduced").
- **Check rule:**
  - Each approach carries W20-1, W20-4 and W20-7 in that order from upstream, at C, B and A (L5). A missing sign or a wrong order is a FLAG.
  - If W3-4 is present, it sits between W20-7 and W20-4; elsewhere is a FLAG (note 8).
  - Both approaches carry the series. One approach only is a FLAG.
  - G20-2, W16-2P, R2-10/R2-11 and R2-1/G20-5P: recorded as INFO (optional, or ★ whose legend meaning isn't quoted here).

## L7. Flagger stations

- **MUTCD Fig 6P-10, p. 879:** the flagger stands at the upstream end of the "50 to 100 ft" taper; dimension A runs from W20-7 to the flagger.
- **MUTCD §6D.06, p. 786:**
  - ¶01 (Standard): "Except as provided in Paragraph 2 of this Section, flagger stations shall be located such that approaching road users will have sufficient distance to stop at an intended stopping point."
  - ¶03 (Option): "The distances shown in Table 6B-2 … may be used for the location of a flagger station. These distances may be increased for downgrades and other conditions that affect stopping distance."
  - ¶05 (Standard): "Except in emergency situations, flagger stations shall be preceded by an advance warning sign or signs. Except in emergency situations, flagger stations shall be illuminated when flagging is used at night."
- **MUTCD §6E.02 ¶01 (Guidance), p. 787:** "traffic should be controlled by a flagger at each end of a constricted section of roadway."
- **MUTCD Fig 6P-10 Note 2 (Option), p. 878:** a single flagger "may be used" for "low-volume situations with short TTC zones on straight roadways where the flagger is visible to road users approaching from both directions".
- **S-630-1 Sheet 9, Case 17:** the opposite flagger station is dimensioned "200' TO 300'" beyond the downstream end of the work area.
- **Check rule:**
  - Two flagger stations, one at each end. One station on a row that doesn't qualify for note 2 is a FLAG.
  - The upstream flagger is at the start of the taper, after W20-7.
  - The opposite flagger is 200–300 ft past the work area. Outside the range is INFO (a CDOT drawing dimension, not a note).
  - The flagger-to-W20-7 distance (A) is at least L5's A. Table 6B-2 distance to the flagger is an Option: recorded as INFO.

## L8. Night: flagger lighting

- **MUTCD Fig 6P-10 Note 7 (Standard), p. 878:** "At night, flagger stations shall be illuminated, except in emergencies."
- **MUTCD §6D.06 ¶05,** quoted in L7.
- **S-630-1 Sheet 2, General Note 22:** "Flood lights shall be used to illuminate flagger stations during the hours of darkness unless otherwise approved. A typical light should provide the following: a fully directional swivel mount quartz light source (500 watt minimum), self-supporting stand with variable light height from a minimum of eight feet above the roadway, and a power source. It shall illuminate the station area and a flagger escape path, but shall not present any glare to traffic."
- **Check rule:** a night flagger row that doesn't call for lighting the flagger stations on page 1, the crew sheet or the audit is a FLAG.

## L9. Longitudinal buffer (copied from O5)

- **MUTCD Table 6B-2, p. 775,** "Stopping Sight Distance as a Function of Speed": "20 mph 115 feet / 25 mph 155 feet / 30 mph 200 feet / 35 mph 250 feet / 40 mph 305 feet / 45 mph 360 feet / 50 mph 425 feet / 55 mph 495 feet / 60 mph 570 feet / 65 mph 645 feet / 70 mph 730 feet / 75 mph 820 feet". Footnote: "* Posted speed, off‑peak 85th‑percentile speed prior to work starting, or the anticipated operating speed".
- **MUTCD §6B.06 ¶11, p. 773:** "If a longitudinal buffer space is used, the values shown in Table 6B-2 may be used".
- **S-630-1 Sheet 2, General Note 24:** "Buffer space is optional. Need must be determined on a project or site specific basis as directed by the Engineer. …"
- **MUTCD Fig 6P-10 Note 6 (Guidance), p. 878:** "The buffer space should be extended so that the two-way traffic taper is placed before a horizontal (or crest vertical) curve to provide adequate sight distance for the flagger and a queue of stopped vehicles."
- **Check rule:** a drawn buffer is at least Table 6B-2 at the work-zone speed. No buffer is INFO. Case 17 draws no buffer dimension.
- **CDOT's stale cross-reference (not Conestruct's defect):** the 2026 Sheet 10 and Sheet 25 legends send buffer space to "General Note 23"; on the 2026 Sheet 2 the buffer note is Note 24 (Note 23 is pavement markings).

## L10. Channelizing device spacing (copied from O6)

- **MUTCD §6K.01 ¶04 (Guidance), p. 815:** "The spacing between cones, tubular markers, vertical panels, drums, and barricades should not exceed a distance in feet equal to 1 times the speed limit in mph when used for taper channelization, and should not exceed a distance in feet equal to 2 times the speed limit in mph when used for tangent channelization."
- **S-630-1 Sheet 2, General Note 18:** "Channelizing device spacing, in feet, shall be as follows: a. For tapers and transitions, spacing equals the numerical value of the speed limit. (e.g. 45 mph = 45 feet) b. For tangents along the buffer space or work area, spacing may not be greater than two times the speed limit. (e.g. 50 mph = 50 feet to 100 feet maximum)"
- **Check rule:** taper spacing at most 1·S ft, tangent spacing at most 2·S ft. On the one-lane two-way taper and the downstream taper, L3/L4's "approximately 20 ft" also applies; spacing over 1·S there is a FLAG, and a spacing far from 20 ft is INFO.

## L11. Drums or vertical panels on lane-closure tapers

- **S-630-1 case-sheet legend** (Sheets 3–11, 13, 16–20 and 25; quoted from Sheets 9 and 10): "Drums or vertical panels shall be used to delineate merging tapers, shifting tapers, and one lane, two-way traffic tapers." Sheet 4 reads "one way, two-way traffic tapers".
- **MUTCD §6K.06 ¶01 (Standard), p. 820:** "… They shall be a minimum of 36 inches in height and have at least an 18-inch minimum width regardless of orientation. Metal drums shall not be used. …"
- **Not in the MUTCD:** no paragraph says when drums must be used (§6K.06 ¶03 is an Option).
- **Check rule:** the flagger taper and the near-intersection merging taper are drums or vertical panels. Cones on those tapers are a FLAG against the S-630-1 legend. A drum spec under 36 in is a FLAG.

## L12. Cone height (copied from O13)

- **S-630-1 Sheet 2, General Note 15:** "Traffic cones shall be at least 28 inches in height. However, the minimum size shall be 36 inches when they are used on freeways and expressways, or during nighttime working hours. They should also be 36 inches when used on other high speed roadways (45 mph or more) with an ADT of 6,000 or more."
- **Check rule:** night rows with a cone spec under 36 in are a FLAG. Rows at 45 mph or more have no ADT input, so an unstated height there is INFO.

## L13. Type 1 barricades (copied from O14)

- **S-630-1 Sheet 2, General Note 16:** "Type 1 barricades shall not be used on freeways, expressways, or other high speed roadways (55 mph or more)."
- **Check rule:** a Type 1 barricade on a row at 55 mph or more is a FLAG.

## L14. Arrow boards

- **MUTCD §6L.06, pp. 832–835:**
  - ¶02 (Guidance), p. 832: "An arrow board in the arrow or chevron mode should be used to advise approaching traffic of a lane closure along major multi-lane roadways in situations involving heavy traffic volumes, high speeds, and/or limited sight distances, or at other locations and under other conditions where road users are less likely to expect such lane closures."
  - ¶17 (Standard), p. 833: "An arrow board in the arrow or chevron mode shall be used only for stationary or moving lane closures on multi-lane roadways."
  - ¶18 (Standard), p. 833: "For shoulder work, for blocking the shoulder, for roadside work near the shoulder, or for temporarily closing one lane on a two-lane, two-way roadway, an arrow board shall be used only in the caution mode."
  - ¶19 (Guidance), p. 833: "For a stationary lane closure, the arrow board should be located on the shoulder at the beginning of the merging taper."
  - ¶21 (Standard), p. 834: "When arrow boards are used to close multiple lanes, a separate arrow board shall be used for each closed lane."
- **S-630-1 Sheet 2, General Note 26:** "When arrow boards are used to close multiple lanes, a separate arrow board shall be used for each closed lane. If arrow boards are used for shoulder work, blocking the shoulder, for roadside work near the shoulder, or for temporarily closing one lane on a two-lane, two-wayroadway, use the arrow boards only in the caution mode." [sic]
- **As drawn:** Fig 6P-10 (p. 879) and Case 17 draw none. Fig 6P-22 (p. 903) draws two: one at the taper labelled "(optional)", and an unlabelled one at the far-side work space. Fig 6P-21 (p. 901) and Case 18 draw none.
- **Check rule:**
  - Flagger rows: an arrow board in arrow or chevron mode is a FLAG (¶17/¶18). Caution mode or none is PASS.
  - Near-intersection rows: an arrow board, if drawn, is at the start of the merging taper (¶19); elsewhere is INFO. No arrow board is INFO (¶02's conditions aren't inputs, and Figs 6P-21/22 and Case 18 don't require one).

## L15. Near-intersection sign series (Case 18, Figs 6P-21/22)

- **S-630-1 Sheet 10, Case 18** ("Traffic Control Around a Work Area Near an Intersection, One Lane Closed"). The work area sits in a corner and closes the right lane on two approaches:
  - Southbound: W20-1, *C, W20-5(R) RIGHT LANE CLOSED (DIST.), *C, R2-10 (★), *B, W4-2(R), *A, then the taper L, then 100' to the intersection; the work area is past the intersection.
  - Eastbound: W20-1, R2-10 (★, at ½C), W20-5(R), W4-2(R), with *C, *B, *A, then L, then "VARIES" (buffer) to the work area, which is before the intersection (near side).
  - Westbound and northbound: W20-1 and R2-10 (★), plus R2-11 (★); no W20-5 and no W4-2.
- **MUTCD Fig 6P-22, p. 903** (far side): W20-1, then C, then W20-5R RIGHT LANE CLOSED AHEAD, then B, then W4-2R, then A, then the L taper, then A, then R3-7R RIGHT LANE MUST TURN RIGHT, then the intersection. Cross streets: W20-1 at distance A on each approach (southbound "(optional)"). G20-2 "(optional)" on each approach.
- **MUTCD Fig 6P-22 Note 7 (Option), p. 902:** "If dimension "A" is not available to create a temporary right-turn lane, continuous channelizers may be installed from the end of the taper to the intersection and, as a result, the RIGHT LANE MUST TURN RIGHT signs would not be installed."
- **MUTCD Fig 6P-21, p. 901** (near side): W20-1, then B, then W9-3L, then A, then the L taper, then W12-1, then an optional buffer space and work vehicle.
- **Check rule:**
  - The closed approach carries W20-1, W20-5 and W4-2 in that order from upstream, the W20-5/W4-2 side matching the closed lane (R for right, L for left). A missing sign, a wrong order or a wrong side is a FLAG.
  - Each other approach drawn carries W20-1. A missing W20-1 on a drawn cross-street approach is a FLAG against Fig 6P-22 and Case 18; on a near-side plan that draws only the closed approach it's INFO (Fig 6P-21 draws only that approach).
  - Far side with dimension A available: R3-7R is present, or note 7's continuous channelizers are. Neither is a FLAG.
  - R2-10/R2-11, W9-3 and W12-1 are recorded as INFO (not in both sources).

## L16. Near side or far side

- **MUTCD Fig 6P-21, p. 901:** "Lane Closure on the Near Side of an Intersection". **Fig 6P-22, p. 903:** "Right-Hand Lane Closure on the Far Side of an Intersection".
- **Check rule:** the plan's near/far label matches the cross street's position: before the work zone (upstream) is near side, after it is far side. A mismatch is a FLAG. The label agrees on page 1, the audit and the crew sheet (C10).

## L17. Pilot car (F12)

- **MUTCD §6E.04 ¶03 (Standard), p. 787:** "The PILOT CAR FOLLOW ME (G20-4) sign (see Figure 6H-1) shall be mounted on the top or on the rear of the pilot vehicle (see Section 6H.37)."
- **¶04 (Standard), p. 787:** "The pilot car operation shall be coordinated with flagging operations or other methods of control at each end of the one lane section of the work zone."
- **S-630-1 Sheet 25, Case 42** ("Pilot Car - Lane Closure, Two-Lane Undivided Highway"), each approach from upstream: W20-1, then C, then R2-10 (★), then 260', then W20-4, then 260', then G20-5P over R2-1(XX); then C, R4-1 DO NOT PASS, then C, W3-4 (▲ optional), then B, W20-7, then A, the flagger station, then the "50'MIN. 100'MAX." taper. "200-300' BUFFER PILOT TURNAROUND" at the work-area end. The pilot car is a "P" vehicle symbol; no G20-4 sign is drawn.
- **Check rule:** a pilot-car row names G20-4 on the pilot vehicle (FLAG if it names another sign, e.g. R4-20) and keeps a flagger at each end (¶04). R4-1 and the 200–300 ft turnaround are INFO.

## L18. AFAD (F16)

- **MUTCD Fig 6P-10 Note 5 (Option), p. 878:** "Automated Flagger Assistance Devices (see Section 6L.02) may be used in situations where there is only one lane of approaching traffic in the direction to be controlled."
- **S-630-1 Sheet 2, General Note 20:** "Flagger station shall comprise of either a flagger or an automated flagger assistance device (AFAD). …"
- **Check rule:** an AFAD row has one approaching lane per direction (always true on a live flagger plan) and shows the AFAD at the flagger station. Anything else is INFO.

## L19. Limited sight distance (copied from O4)

- **MUTCD §6B.04 ¶04, p. 771:** "On urban streets, the effective placement of the nearest warning sign to the TTC zone, in feet, should range from 4 to 8 times the speed limit in mph".
- **¶06, same page:** rural "from 8 to 12 times the speed limit in mph".
- **¶07, same page:** the distances "should be adjusted for field conditions, if necessary, by increasing or decreasing the recommended distances".
- **¶08 (Support), same page:** "The need to provide additional reaction time for a condition is one example of justification for increasing the sign spacing."
- **Fig 6P-10 Note 6,** quoted in L9.
- **Check rule:** on limited-sight rows each sign moved farther upstream than L5's spacing. A fixed multiplier is checked for a cite or a "chosen" mark (Rule 12).

## L20. Pedestrian access (copied from O15)

- **MUTCD TA-28 Note 1, p. 914:** "A pedestrian channelizing device … that is detectable by a person with a vision disability traveling with the aid of a long cane shall be placed across the full width of the closed sidewalk."
- **TA-28 figure, p. 915,** labels: "W20-1 / R9-11a / R9-9 / SIDEWALK DETOUR SIDEWALK DIVERSION".
- **MUTCD §6N.04 ¶06 (Guidance), p. 843:** "Signs should be placed such that they do not narrow any existing pedestrian passages to less than 48 inches." (The paragraph opens "Except for - and mobile operations" [sic, as printed]; that qualifier governs its W21-5 sentence.)
- **Check rule:** on F4 the plan either shows the pedestrian closure (devices or signs from TA-28) or says plainly that it doesn't cover pedestrians. Silence is a FLAG (Rule 10).

## Not sourced in these documents

The oracle treats these as INFO, never FLAG:

- **Left-lane far side with a turn bay (N10):** session 2 found no page that sets the turn-bay storage length. The row is scored on L2, L15 and L16; the storage value is recorded.
- **School zones (F4).** No work-zone rule in either document; the audit records what the plan adds.
- **Jurisdiction rules.** `02-JURISDICTION-DATA.md` isn't in the repo. Lakewood rows are INFO (L5).
- **The ★ symbol** (R2-10/R2-11 double fines) on Sheets 9, 10 and 25: its legend text wasn't quoted in session 2.

## Corrections from the independent check (2026-10-22)

A fresh agent that wrote none of the oracle checked L1–L20 against their pages by subject, on rendered images for tables and drawings (`oracle-check.md`; full notes in `oracle-check-notes.md`). Changes made:

- **L2:** Table 6B-3's "Merging Taper at least L" confirmed on p. 775; the "to be confirmed" caveat is removed.
- **L6:** in Case 17 the ◆ sits on the separate downstream R2-1(XX), not on the upstream G20-5P/R2-1 pair.
- **L11:** Sheet 4's legend reads "one way, two-way traffic tapers".
- **L14:** Fig 6P-22 draws a second, unlabelled arrow board at the far-side work space.
- **L15:** Case 18 closes two approaches (southbound past the intersection, eastbound before it). The eastbound approach carries W20-5(R) and W4-2(R) too; the old "opposing approaches: no W20-5, no W4-2" was wrong. The 100' dimension belongs to the southbound approach.
- **L19:** ¶08 is Support.
- **L20:** §6N.04 ¶06 prints "Except for - and mobile operations", without "short-duration", and the qualifier governs the W21-5 sentence. The 48-inch sentence is now quoted on its own. The shoulder audit's O11/O15 correction added "short-duration" back; that copy is wrong the same way (recorded here, not edited: `audit-shoulder/` is closed evidence).
- **`oracle.py`:** the 100 ft constant is renamed to the approach the drawing puts it on; `buffer_min`'s round-up to the 5 mph grid is marked chosen (Rule 12); the optional-sign comment cites the figure's "(optional)" labels.
