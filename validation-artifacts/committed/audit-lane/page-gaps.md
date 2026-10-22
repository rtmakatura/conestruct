# Page gaps for #370 (lane-closure audit oracle)

Sources read 2026-10-22, read-only:
- MUTCD 11th Ed. (Dec 2023) Part 6, `validation-artifacts/ta10_flagger/mutcd_part6.pdf` (204 PDF pages). Convention checked against the printed footer on each page: printed = PDF page + 764. All MUTCD cites below are PRINTED pages.
- CDOT S-630-1, `validation-artifacts/s630-1-2026.pdf`. Sheets 1-26 are PDF pages 149-174. Each page's title block was read: PDF 149 prints "Standard Sheet No. 1 of 26" ... PDF 174 prints "Standard Sheet No. 26 of 26". All carry "Issued by the Traffic Safety & Engineering Services: July 01, 2026" and "Last Modification Date: 07/01/26".

Method: text extracted with PyMuPDF. Drawings were rendered to PNG and read visually at 3-5x zoom. Sheet 2's text extraction reverses the line order inside each note, so the notes below were put back in reading order and checked against the rendered image.

---

## G1. MUTCD Figure 6P-10 (TA-10), Lane Closure on a Two-Lane Road Using Flaggers

- **Notes for Figure 6P-10: printed p. 878** (PDF 114). **Figure 6P-10: printed p. 879** (PDF 115).
- So the repo's "PDF 878-879" means the **printed** page numbers. The PDF page numbers are 114-115.

Notes, verbatim (p. 878):
> Option:
> 1. Positive protection devices may be used per Section 6M.02.
> 2. For low-volume situations with short TTC zones on straight roadways where the flagger is visible to road users approaching from both directions, a single flagger, positioned to be visible to road users approaching from both directions, may be used (see Chapter 6D).
> 3. The ROAD WORK AHEAD and the END ROAD WORK signs may be omitted for short-duration operations.
> 4. Flashing warning lights and/or flags may be used to call attention to the advance warning signs. A BE PREPARED TO STOP sign may be added to the sign series.
> 5. Automated Flagger Assistance Devices (see Section 6L.02) may be used in situations where there is only one lane of approaching traffic in the direction to be controlled.
>
> Guidance:
> 6. The buffer space should be extended so that the two-way traffic taper is placed before a horizontal (or crest vertical) curve to provide adequate sight distance for the flagger and a queue of stopped vehicles.
>
> Standard:
> 7. At night, flagger stations shall be illuminated, except in emergencies.
>
> Guidance:
> 8. When used, the BE PREPARED TO STOP sign should be located between the Flagger sign and the ONE LANE ROAD sign.
> 9.-12. (grade-crossing provisions; not quoted)
>
> Option:
> 13. A flagger or a uniformed law enforcement officer may be used at the grade crossing ... (grade crossing; not quoted further)

Coverage of the items you asked about, from the notes:
- **Flagger station location relative to the taper:** no note gives a distance. Note 6 puts the two-way taper before a curve (sight distance). The figure is the only source (below).
- **One-lane two-way taper length:** not in the notes. The figure dimensions it "50 to 100 ft".
- **Downstream taper:** not in the notes. The figure shows a second "50 to 100 ft" dimension at the far (north) end of the work area.
- **Signs:** note 3 (W20-1/G20-2 may be omitted for short duration), note 4 (W3-4 BE PREPARED TO STOP may be added), note 8 (W3-4 goes between W20-7 and W20-4).
- **Spacing A/B/C:** not in the notes. The figure's notes block reads: "See Table 6B-1 for the meanings of the letter codes used in this figure." See Table 6B-1 below.
- **Flagger illumination at night:** note 7 (Standard).
- **Arrow board:** **NOT FOUND.** No note mentions one and none is drawn.

What the figure shows (p. 879, read visually):
- Northbound approach (bottom), from upstream: **W20-1 ROAD WORK XX FT**, then "C", then **W20-4 ONE LANE ROAD XX FT**, then "B", then **W20-7 flagger symbol with W16-2P XX FEET**, then "A", then the **flagger station**, then the **"50 to 100 ft"** taper of channelizing devices closing the northbound lane.
- The sign closest to the work is **W20-7 (+W16-2P)**. W3-4 is **not drawn**.
- Southbound approach (top) has the same series: W20-1, then C, then W20-4, then B, then W20-7 with "W16-2P (optional)", then A, then the flagger.
- G20-2 END ROAD WORK appears once in each direction, labelled "(optional)".
- The flagger symbol sits at the upstream end of the taper. The "A" dimension runs from W20-7 to the flagger. No separate flagger-to-taper dimension is drawn.
- A second "50 to 100 ft" dimension is drawn at the north end of the work area (the downstream end for the closed lane).

Table 6B-1, "Recommended Advance Warning Sign Minimum Spacing", printed **p. 773** (PDF 9), Distance between Signs A / B / C:
> Urban (low speed)* 100 feet / 100 feet / 100 feet
> Urban (high speed)* 350 feet / 350 feet / 350 feet
> Rural 500 feet / 500 feet / 500 feet
> Expressway / Freeway 1,000 feet / 1,500 feet / 2,640 feet
> \* Speed category to be determined by the highway agency or owner of site roadways open to public travel.
> \*\* The column headings A, B, and C are the dimensions shown in Figures 6P‑1 through 6P‑54 The A dimension is the distance from the transition or point of restriction to the first sign. The B dimension is the distance between the first and second signs. The C dimension is the distance between the second and third signs. (The "first sign" is the sign in a three‑sign series that is closest to the TTC zone. The "third sign" is the sign that is furthest upstream from the TTC zone.)

---

## G2. MUTCD §6B.08 Tapers (printed p. 775 to p. 776)

Table 6B-3, "Taper Length Criteria for Temporary Traffic Control Zones", **p. 775**:
> One‑Lane, Two‑Way Traffic Taper — 50 feet minimum, 100 feet maximum
> Downstream Taper — 50 feet minimum, 100 feet maximum

**§6B.08 ¶12 (Guidance), p. 776.** The repo's ¶12 / p. 776 is correct.
> If used, a downstream taper should have a minimum length of 50 feet and a maximum length of 100 feet with devices placed at a spacing of approximately 20 feet.

- It does **not** say "per lane", and "per lane" appears nowhere in §6B.08.
- ¶11 (Support), p. 776: "A downstream taper might be useful in termination areas to provide a visual cue to the driver that access is available back into the original lane or path that was closed."

**§6B.08 ¶13 (Support) and ¶14 (Guidance), p. 776.** The repo's ¶14 guess is correct.
> 13 The one-lane, two-way taper is used in advance of an activity area that occupies part of a two-way roadway in such a manner that a portion of the road is used alternately by traffic in each direction.
> 14 A taper having a minimum length of 50 feet and a maximum length of 100 feet with channelizing devices at approximately 20-foot spacing should be used to guide traffic into the one-lane section, and a downstream taper should be used to guide traffic back into their original lane.

---

## G3. S-630-1 Case 17. Still Sheet 9 in the 2026 set.

- **Sheet 9 of 26** (PDF 157). Sheet 1's Table of Contents lists Cases 15-17 on Sheet 9.
- Title: **"Case No. 17 / Typical Application / Lane Closure, Two-Lane Highway, At Curve"**.
- Sheet 9 also holds Case 15 (Blasting Zone) and Case 16 (Ramp Construction where Partial Ramp is Closed).

As drawn, read visually (eastbound approach from the left):
- **Sign series, from upstream:** W20-1 "ROAD WORK XX FT", then \*C, then W20-4 "ONE LANE ROAD XX FT", then \*B, then W20-7 (flagger symbol), then \*A, then the **Flagger Station**.
- W20-1 and W20-4 each carry the ▲ (optional) and flashing-beacon symbols. **No W3-4 and no W16-2P are drawn.**
- R2-10 BEGIN DOUBLE FINES ZONE (★) and G20-5P WORK ZONE over R2-1(XX) SPEED LIMIT XX are placed at the "0.5B\*" points ("0.5B\* | 0.5B\*" dimensions above the road).
- **Taper:** "50'MIN. 100'MAX." starts just past the flagger station. Its devices are hollow squares, which the legend defines as "Drums or vertical panels". Filled squares (channelizing device) continue along the work area around the curve.
- Callout: "THIS TAPER MUST BE SHORT ENOUGH TO NOT BE MISTAKEN FOR A TRANSITION."
- **Downstream end:** "100' MAX." taper, then "500'" to R2-11 END DOUBLE FINES ZONE (★), then "500'" to R2-1(XX) SPEED LIMIT XX (◆).
- **Opposite flagger:** a flagger station in the opposing lane, dimensioned **"200' TO 300'"** beyond the downstream end of the work area.
- Note on the sheet: "Sign sequence is the same for the opposite direction."
- A Mobile Attenuator with ▲ (optional) is drawn beside the work area.
- **Buffer:** no buffer dimension in Case 17. The legend has no buffer entry. Sheet 2 Note 24 reads: "Buffer space is optional. Need must be determined on a project or site specific basis as directed by the Engineer. When a buffer space is used, dimensions and/or devices used are to be incorporated in the traffic control plan (TCP) or the contractor's method of handling traffic (MHT)."
- **Device spacing as drawn:** not dimensioned. Sheet 2 Note 18 governs (G9).
- **Arrow board:** none drawn in Case 17. The legend lists "Advance Warning Flashing or Sequencing Arrow Panel".

Sheet 9 legend, verbatim:
- "Drums or vertical panels shall be used to delineate merging tapers, shifting tapers, and one lane, two-way traffic tapers."
- "Flagger Station"
- "▲ These devices are optional. Their need shall be determined by detour design and/or scope of construction activity and are required when they are included in the schedule of consturction control devices." [sic]
- "◆ These devices are not optional if the posted speed limit in the work zone is reduced."

"Key to Advance Signing Distances" (A / B / C):
| Road type | A | B | C |
|---|---|---|---|
| URBAN (< = 40 MPH) | 100 | 100 | 100 |
| URBAN (> = 45 MPH) | 350 | 350 | 350 |
| RURAL | 500 | 500 | 500 |
| EXPRESSWAY/FREEWAY | 1000 | 1500 | 2640 |

- Case 17 has no "Notes:" block of its own.

---

## G4. S-630-1 Case 42 (pilot car). Still Sheet 25 in the 2026 set.

- **Sheet 25 of 26** (PDF 173). Title: **"Case No. 42 / Typical Application / Pilot Car - Lane Closure, Two-Lane Undivided Highway"**. Sheet 1's TOC agrees.
- **No G20-4 PILOT CAR FOLLOW ME and no R4-20 is drawn on Case 42.** The pilot car is shown only as a vehicle symbol marked "P", which the legend defines as "Pilot Car".
- In S-630-1 the text "G20-4" appears only on Sheet 26 (PDF 174), the sign sheet. That page was not examined beyond the text hit.

As drawn, eastbound approach from upstream (read visually):
- W20-1 ROAD WORK AHEAD, then C, then R2-10 BEGIN DOUBLE FINES ZONE (★), then 260', then W20-4 ONE LANE ROAD AHEAD, then 260', then G20-5P WORK ZONE over R2-1(XX).
- Then C, then R4-1 DO NOT PASS, then C, then **W3-4 BE PREPARED TO STOP (▲ optional)**, then B, then **W20-7**, then A, then the **flagger station**, then the taper **"50'MIN. 100'MAX."** of hollow squares (drums or vertical panels), then the work area.
- The westbound approach (top of the drawing) mirrors it: W20-1, R2-10, W20-4, R2-1/G20-5P, R4-1, W3-4, W20-7.
- At the work-area end, before the westbound flagger station: **"200-300' BUFFER PILOT TURNAROUND"**. The pilot car is drawn there.
- Downstream signs are 500' and 500' in each direction: R2-11 END DOUBLE FINES ZONE (★) and R2-1(XX) (◆).
- The sheet carries a SPEED REDUCTION CHART "(SEE GENERAL NOTE 3)".
- A note sits between Case 41's title and Case 42's drawing. Which case it belongs to is ambiguous, but it cites Case 17:
  > Note: Follow applicable standards as shown in Case No. 17 on Sheet 9, Case No. 19 on Sheet 10, and Part 6 of the latest MUTCD for lane closure in work area. Signing may stay while lanes are reopened.
- Sheet notes (top right):
  > 1. All night hazards will be marked and delineated.
  > 2. All speed limit signs conflicting with work zone speed shall be covered during speed reduction.

MUTCD for comparison: §6E.04 ¶03 (Standard), **p. 787**:
> The PILOT CAR FOLLOW ME (G20-4) sign (see Figure 6H-1) shall be mounted on the top or on the rear of the pilot vehicle (see Section 6H.37).

The sign is G20-4, not R4-20. ¶04 (p. 787):
> The pilot car operation shall be coordinated with flagging operations or other methods of control at each end of the one lane section of the work zone.

---

## G5. Drums

- **MUTCD: drums are §6K.06, not §6K.05.** §6K.05 is Vertical Panels (p. 819). §6K.06 is on **printed p. 820** (PDF 56).
- §6K.06 ¶01 (Standard):
  > Drums (see Figure 6K-1) used for road user warning or channelization shall be constructed of lightweight, deformable materials. They shall be a minimum of 36 inches in height and have at least an 18-inch minimum width regardless of orientation. Metal drums shall not be used. The markings on drums shall be horizontal, circumferential, alternating orange and white retroreflective stripes 4 to 6 inches wide. Each drum shall have a minimum of two orange and two white stripes with the top stripe being orange. Any non-retroreflectorized spaces between the horizontal orange and white stripes shall not exceed 3 inches wide. Drums shall have closed tops that will not allow collection of construction debris or other debris.
- ¶02 (Support):
  > ... They are portable enough to be shifted from place to place within a TTC zone in order to accommodate changing conditions, but are generally used in situations where they will remain in place for a prolonged period of time.
- **No MUTCD paragraph sets *when* drums must be used.** ¶03 is an Option: "Although drums are most commonly used to channelize or delineate road user flow, they may also be used alone or in groups to mark specific locations."
- §6K.01 ¶04 (Guidance), **p. 815**, on spacing:
  > The spacing between cones, tubular markers, vertical panels, drums, and barricades should not exceed a distance in feet equal to 1 times the speed limit in mph when used for taper channelization, and should not exceed a distance in feet equal to 2 times the speed limit in mph when used for tangent channelization.
- **S-630-1: no Sheet 2 General Note on drums (NOT FOUND in Notes 1-30).**
- The "when" rule is in the **legend** of the case sheets: Sheets 3-11, 13, 16-20 and 25 (PDF 151-159, 161, 164-168, 173):
  > Drums or vertical panels shall be used to delineate merging tapers, shifting tapers, and one lane, two-way traffic tapers.

---

## G6. MUTCD §6L.06 Arrow Boards (printed pp. 832-835)

- ¶01 (Standard) and ¶02 (Guidance) are on **p. 832**. ¶03-¶20 are on **p. 833**. ¶21-¶22 and Figure 6L-3 are on p. 834. ¶23-¶26 are on p. 835.
- The repo's "p. 832" fits only ¶01-¶02. **The two-lane rule (¶17-¶18) is on p. 833.**

> ¶02 (Guidance, p. 832): An arrow board in the arrow or chevron mode should be used to advise approaching traffic of a lane closure along major multi-lane roadways in situations involving heavy traffic volumes, high speeds, and/or limited sight distances, or at other locations and under other conditions where road users are less likely to expect such lane closures.
>
> ¶17 (Standard, p. 833): An arrow board in the arrow or chevron mode shall be used only for stationary or moving lane closures on multi-lane roadways.
>
> ¶18 (Standard, p. 833): For shoulder work, for blocking the shoulder, for roadside work near the shoulder, or for temporarily closing one lane on a two-lane, two-way roadway, an arrow board shall be used only in the caution mode.
>
> ¶19 (Guidance, p. 833): For a stationary lane closure, the arrow board should be located on the shoulder at the beginning of the merging taper.
>
> ¶20 (Guidance, p. 833): Where the shoulder is narrow, the arrow board should be located in the closed lane.
>
> ¶21 (Standard, p. 834): When arrow boards are used to close multiple lanes, a separate arrow board shall be used for each closed lane.
>
> ¶25 (Standard, p. 835): Arrow boards shall only be used to indicate a lane closure. Arrow boards shall not be used to indicate a lane shift.

- The MUTCD does **not** say arrow boards shall not be used on two-lane two-way roads. It says they may be used there **only in caution mode** (¶18).
- S-630-1 Sheet 2 **Note 26** mirrors ¶21 and ¶18:
  > When arrow boards are used to close multiple lanes, a separate arrow board shall be used for each closed lane.
  > If arrow boards are used for shoulder work, blocking the shoulder, for roadside work near the shoulder, or for temporarily closing one lane on a two-lane, two-wayroadway, use the arrow boards only in the caution mode. [sic "two-wayroadway"]

---

## G7. MUTCD §6D.06 Flagger Stations (printed p. 786)

The repo's §6D.06 ¶03, p. 786 is confirmed. All of §6D.06 is on p. 786 (PDF 22).

> 01 (Standard) Except as provided in Paragraph 2 of this Section, flagger stations shall be located such that approaching road users will have sufficient distance to stop at an intended stopping point.
>
> 02 (Option) If sufficient stopping sight distance is not achievable, the location of the flagger station may be modified based on engineering judgment.
>
> 03 (Option) The distances shown in Table 6B-2, which provides information regarding the stopping sight distance as a function of speed, may be used for the location of a flagger station. These distances may be increased for downgrades and other conditions that affect stopping distance.
>
> 04 (Guidance) Flagger stations should be located such that an errant vehicle has additional space to stop without entering the work space. The flagger should identify an escape route that can be used to avoid being struck by an errant vehicle.
>
> 05 (Standard) Except in emergency situations, flagger stations shall be preceded by an advance warning sign or signs. Except in emergency situations, flagger stations shall be illuminated when flagging is used at night.

- **There is no separate flagger-distance table** in Chapter 6D or 6E (no "Table 6D-x" or "Table 6E-x" exists in the 11th Ed. Part 6). §6D.06 ¶03 points to **Table 6B-2**.
- Table 6B-2, "Stopping Sight Distance as a Function of Speed", **p. 775**:

| Speed* | Distance |
|---|---|
| 20 mph | 115 feet |
| 25 mph | 155 feet |
| 30 mph | 200 feet |
| 35 mph | 250 feet |
| 40 mph | 305 feet |
| 45 mph | 360 feet |
| 50 mph | 425 feet |
| 55 mph | 495 feet |
| 60 mph | 570 feet |
| 65 mph | 645 feet |
| 70 mph | 730 feet |
| 75 mph | 820 feet |

> \* Posted speed, off‑peak 85th‑percentile speed prior to work starting, or the anticipated operating speed

Chapter 6E (p. 787), for context:
> §6E.02 ¶01 (Guidance): Except as provided in Paragraph 2 of this Section, traffic should be controlled by a flagger at each end of a constricted section of roadway. One of the flaggers should be designated as the coordinator. ...
>
> §6E.02 ¶03 (Guidance): When a single flagger is used, the flagger should be stationed on the shoulder opposite the constriction or work space, or in a position where good visibility and traffic control can be maintained at all times. ...

---

## G8. S-630-1 Case 18 (Sheet 10) and MUTCD Figs 6P-21 and 6P-22

**S-630-1 Case 18**
- Confirmed on **Sheet 10 of 26** (PDF 158). Title: "Case No. 18 / Typical Application / Traffic Control Around a Work Area Near an Intersection, One Lane Closed".
- Sheet 10 also holds Case 19 ("Typical Application of Traffic Control Around a Work Area Near an Intersection") and Case 20 ("Typical Signing For Road Closure").
- Case 18 is a four-lane by four-lane intersection (two lanes each way on both streets). The work area is in the corner, across the right lane of both the southbound and eastbound departures, with a Type III barricade (⬢ = "Required when work occupies the location for more than 3 days") and "10' MIN." offsets.

Southbound (from the top), read visually:
- Signs, upstream to downstream: W20-1 ROAD WORK AHEAD; W20-5(R) RIGHT LANE CLOSED (DIST.); R2-10 BEGIN DOUBLE FINES ZONE (★); W4-2(R) lane-reduction symbol. W20-1, W20-5(R) and W4-2(R) carry ▲ (optional) and flashing beacons.
- Dimension chain, upstream to downstream: \*C, \*C, \*B, \*A, then the taper L (hollow squares), then **100'** to the intersection.
- Departure side (bottom): 100', then 500' to R2-11 END DOUBLE FINES ZONE, then 500'.

Eastbound (from the left):
- Signs: W20-1, R2-10 (★), W20-5(R), W4-2(R).
- Dimensions: \*C, \*½C, \*B, \*A, then "VARIES", then L. R2-11 END DOUBLE FINES ZONE is also on this side.
- I could not tell from the leader lines exactly which post each sign sits on. Re-read the crop before citing a per-sign offset.

Opposing approaches (northbound from the bottom, westbound from the right):
- R2-10 (★) and W20-1 ROAD WORK AHEAD (▲, beacon), plus R2-11.
- No W20-5 and no W4-2 on these approaches.

Other features:
- **Arrow board: none drawn in Case 18.** The legend lists "Advance Warning Flashing or Sequencing Arrow Panel".
- A Mobile Attenuator (▲) is drawn.
- Case 18 Notes, verbatim:
  > 1. Sign placement shown on cases 18 and 19 typifies rural applications. Urban applications require the signs to be placed within one, or perhaps two, blocks.
  > 2. Truck-mounted attenuators (TMA) optional for all cases as determined by the Engineer.
- The legend has the same drums sentence as G5. It also reads "VARIES Buffer Space (see General Note 23 on Sheet 2)". Note: buffer space is actually **Note 24** on the 2026 Sheet 2. Note 23 is pavement markings, so this legend reference is stale.

**MUTCD Figure 6P-21 (TA-21), Lane Closure on the Near Side of an Intersection**
- **The repo's p. 900 is the notes page. The figure is on printed p. 901.**
- Drawn (northbound): W20-1 ROAD WORK AHEAD, then B, then W9-3L, then A, then the L taper, then W12-1, then an optional buffer space, then an optional work vehicle and high-level warning device.
- No arrow board is drawn. No arrow-board note exists. Notes 1-9 on p. 900 cover the taper direction, crosswalk, positive protection, flashing lights, shadow vehicle and the work vehicle's lights.
- Note 1 (Standard): "The merging taper shall direct vehicular traffic into either the right-hand or left-hand lane, but not both."

**MUTCD Figure 6P-22 (TA-22), Right-Hand Lane Closure on the Far Side of an Intersection**
- **The repo's p. 903 is the figure. Its notes are on printed p. 902.**
- Note 7 (Option, p. 902):
  > 7. If dimension "A" is not available to create a temporary right-turn lane, continuous channelizers may be installed from the end of the taper to the intersection and, as a result, the RIGHT LANE MUST TURN RIGHT signs would not be installed.
- No note on p. 902 mentions an arrow board.
- Drawn, northbound approach (p. 903): W20-1 ROAD WORK AHEAD, then C, then W20-5R RIGHT LANE CLOSED AHEAD, then B, then W4-2R, then A, then the L taper with an **arrow board labelled "(optional)"**, then A, then R3-7R RIGHT LANE MUST TURN RIGHT, then the intersection.
- A second arrow board (no "(optional)" label of its own) is drawn at the work area on the far side, next to G20-2 "(optional)".
- Cross streets: W20-1 at distance A on the westbound and eastbound approaches. The southbound W20-1 is labelled "(optional)". G20-2 END ROAD WORK appears on each approach, labelled "(optional)".

---

## G9. S-630-1 Sheet 2 General Notes (Sheet 2 of 26, PDF 150). Verbatim, checked against the image.

**Note 15 (cones):**
> Traffic cones shall be at least 28 inches in height. However, the minimum size shall be 36 inches when they are used on freeways and expressways, or during nighttime working hours. They should also be 36 inches when used on other high speed roadways (45 mph or more) with an ADT of 6,000 or more.

**Note 18 (device spacing):**
> Channelizing device spacing, in feet, shall be as follows:
> a. For tapers and transitions, spacing equals the numerical value of the speed limit. (e.g. 45 mph = 45 feet)
> b. For tangents along the buffer space or work area, spacing may not be greater than two times the speed limit. (e.g. 50 mph = 50 feet to 100 feet maximum)

**Note 22 (flagger lighting):**
> Flood lights shall be used to illuminate flagger stations during the hours of darkness unless otherwise approved. A typical light should provide the following: a fully directional swivel mount quartz light source (500 watt minimum), self-supporting stand with variable light height from a minimum of eight feet above the roadway, and a power source. It shall illuminate the station area and a flagger escape path, but shall not present any glare to traffic.

Related Sheet 2 notes, verbatim:
> 20. Flagger station shall comprise of either a flagger or an automated flagger assistance device (AFAD). See the most recent CDOT Standard Specifications for Road and Bridge Construction for additional guidance regarding AFAD.
>
> 21. Flagging operations shall not override visible regulatory signing or traffic signals, even when traffic signals have been disabled or set to flash mode. Only a uniformed police officer may direct traffic in a signalized intersection. Flagging is not permitted on interstates unless approved by the Region Traffic Engineer.
>
> 24. Buffer space is optional. (full text in G3)
>
> 26. Arrow boards. (full text in G6)
