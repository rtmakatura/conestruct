# Shoulder-work audit: findings for review

Production `1f08f49`, 2026-10-16. Each finding below is a candidate issue (label `audit-shoulder`). None is filed yet; Ryan reviews the gallery first. Row names link to their section in [index.md](index.md), where page 1 and the full check table are shown.

**Severity:**
- **High:** the plan tells a crew to do something the sources don't support, or describes the road wrongly.
- **Medium:** a sourced value is missed, or two documents disagree.
- **Low:** the API or the wording.

## High

### F1. The limited-sight-distance adjustment moves signs by the wrong distance, and the audit describes it wrongly (C3, 16 of 16 rows)
- **What it says:** "Moved 3 advance warning sign(s) 50% farther upstream from the taper", citing "MUTCD §6B.04".
- **What it does:** it multiplies each sign's station, measured from the work zone's far end, by 1.5. So the first sign's distance from the taper grows with the work zone's length. Predicted and served distances match to the foot on every row:

  | Row | Zone | Speed | Table A | "50% farther" | Served |
  |---|---|---|---|---|---|
  | `e14-r-25-night` | 200 ft | 25 mph | 100 ft | 150 ft | 341 ft |
  | `bway-l-30-night` | 1,500 ft | 30 mph | 100 ft | 150 ft | 1,020 ft |
  | `canyon-r-45-night` | 1,500 ft | 45 mph | 500 ft | 750 ft | 1,740 ft |
  | `hartsel-r-65-night` | 5,000 ft | 65 mph | 500 ft | 750 ft | 3,681 ft |

- **The factor itself:** §6B.04 ¶07–¶08 (p. 771) allow an increase for reaction time but give no factor, and the 1.5 isn't marked as chosen (Rule 12).
- **Code:** `src/rules/site_adjustments.py:47-73` (`station_ft * 1.5`).

### F2. Two-lane trunk highways are drawn as divided highways with a median (C15 and C7; `hartsel-r-65`, `hartsel-r-65-night`)
- **The road:** US 24 near Hartsel is one two-way OSM way (`oneway` unset).
- **What the site does:** its classifier marks every `trunk` divided (`conestruct/site/lib/road-detection/classify.ts`, `roadTypeAndDivided`).
- **What the plan does:**
  - It reads "SHOULDER CLOSURE · DIVIDED HIGHWAY".
  - It draws a hatched "MEDIAN (separates carriageways)".
  - It notes "Left-side advance signs sit in the median by choice", and puts 7 signs on the left.
- **Result:** the crew is told to put signs in a median the road doesn't have.

### F3. The buffer has no channelizing devices (C5, 32 of 32 rows)
- **What the plans do:** every plan lines the work zone with cones but leaves the buffer bare, from the work zone to the taper. Examples:
  - `bway-r-30`: cones from station 0 to 200; taper at 400–440.
  - `hartsel-r-65`: a 645 ft gap at 65 mph.
- **The rule:** S-630-1 Sheet 2 Note 18b: "For tangents along the buffer space or work area, spacing may not be greater than two times the speed limit."
- **Page 1 and the crew sheet agree with each other.** So this is the layout itself, not a drawing slip.

## Medium

### F4. Freeway shoulder-closed signs are closer than Case 11 and Table 6B-1 (C2, C2c; `e470-r-75`, `i25-r-65-night-3lanes`)

| Sign | Case 11 (Sheet 7, O16) | Plan |
|---|---|---|
| W5-1 | 500 ft | 500 ft |
| first W21-5aR | 1,000 ft | 750 ft |
| second W21-5aR | 2,000 ft | 1,000 ft |
| W20-1 | 5,200 ft | 5,140 ft |

Table 6B-1's freeway row is 1,000 / 1,500 / 2,640 ft.

### F5. A 4-lane freeway has no way to a plan, and the refusals point at each other (`i25-r-65-night`, X11)
The site fits I-25's 4 lanes at 10.5 ft (52 ft half-road less a 10 ft shoulder). Then:

1. The backend refuses: "Lane width 10.5 ft is below the 11 ft minimum … Increase lane width to at least 11 ft".
2. At 11 ft it refuses again: "4 lanes x 11.0 ft + 10 ft shoulder = 54.0 ft exceeds … Use a lane width of 10.5 ft or less, or reduce the lane count."

The only way through is drawing 3 lanes (row 30b), and the first message doesn't say so.

### F6. Night plans use 28-inch cones (C12a, 10 rows: every night row under 45 mph)
- **The rule:** S-630-1 Sheet 2 Note 15: "the minimum size shall be 36 inches when they are used … during nighttime working hours."
- **The plans:** night plans at 45 mph and over, and freeway plans, already use 36-inch cones. Night plans below 45 mph don't.

### F7. The crew sheet calls the divided-road mirror "required" by Note 8 (C7, 16 rows: every divided row)
- **The crew sheet says:** "Divided highway: All warning and regulatory signs must be posted on BOTH sides of the roadway per CDOT S-630-1 Sheet 2 General Note 8."
- **The rule:** Note 8 excepts "where only one shoulder is closed". The plan's own audit says "Not required: one shoulder closed (Note 8's Case 11 exception)".
- **R54's position:** the mirror is a house choice. So this is one voice per fact (P2) and Rule 10.

### F8. Page 1 never states the shoulder width its taper is built on (C9a, 32 of 32 rows)
- **The gap:** the taper uses W = 8 ft (10 ft on divided roads), and there's no shoulder-width input.
- **Where it's disclosed:** only the audit, and only for one-way streets (#308).
- **What page 1 shows:** "L/3 = 40 ft" with no W.
- **Why it matters:** a shoulder of a different width changes the taper, and TA-3 Note 8 changes the requirements at 8 ft. Ryan's checkpoint decision 2 makes this a finding.

## Low

### F9. The scan closes a sidewalk on I-25 (`i25-r-65-night-3lanes`)
- **What the scan saw:** 43 sidewalk features, one of them "work_zone @ 281 ft" at 39.6846, -104.9597. That's a crossing street's sidewalk, not one along the interstate.
- **What the plan draws:** a SIDEWALK strip along I-25, with two R9-9 SIDEWALK CLOSED signs and Type III barricades.

### F10. Out-of-range refusals don't name the field (X1, X2, X9)
- **What comes back:** "Input should be less than or equal to 75", "… greater than or equal to 20", "… less than or equal to 4". Nothing names `speed` or `lanes`.
- **Who sees it:** the form's own controls keep operators inside these ranges, so only API callers see them.

### F11. "Drawn as 3 lanes … plans draw at most 4" reads as a sheet limit when the operator chose 3 (`i25-r-65-night-3lanes`)
Page 1: "DRAWN AS 3 LANES PER DIRECTION; THE ROAD HAS 4. PLANS DRAW AT MOST 4 LANES PER DIRECTION, SO THE DEVICE OFFSETS ARE MEASURED AGAINST 3 LANES."

## Edition (goes to #265, ruling d)
- **C9d:** every audit links "S-630-01 (19-Page Set)" (`sections.case.url`), while page 1 cites the July 2026, 26-sheet edition.
- **C9c:** Denver's record pins MUTCD 2009 R2 (PT-116.1), and the plans cite the 11th Edition. #265 already tracks that.

## Question for Ryan (ruling e)
**Q1. Lakewood's 35 mph breakpoint** (`alameda-r-35`, `alameda-r-40-night`, `kipling-r-35`):
- Under CDOT's split these 35–40 mph roads are urban-low, so 100 ft spacing, and the plans pass.
- Under Lakewood's split (`data/jurisdictions/lakewood.json`, 30/35) they're urban-high, so 350 ft, and the plans fall short.
- The engine always uses CDOT values (`src/api/schemas.py:1519`), and 02-JURISDICTION-DATA.md is missing. Which split should Lakewood plans use?

## Recorded, not findings
- **Clean on every plan:**
  - taper (C1), buffer length (C4), the shoulder sign legend and side (C6a);
  - caution-mode arrow board (C6b), the freeway sign set (C6c);
  - device counts on all five surfaces (C8, C8b), notes against the drawing (C10);
  - containment 0/0/0 (C11), no Type 1 barricades at 55 mph and over (C12b), sidewalk handling (C12c), shoulders 8 ft and wider (C13).
- **Refusals that pass (8 of 11):** wrong way, left side on two-way and on divided roads, median, too short a zone, work-zone speed over posted, a narrow freeway, and 4 × 11 ft.
- **The road picker isn't steady.** The same E Colfax point returned two candidates once and none twice. Geocoded building points, 30–60 m off the road, return nothing. Three pins had to be moved onto the road (matrix.json records each one).
- **Lookout Mountain Rd** is spaced as urban (100 ft), because the picker calls the pin urban ("Golden"). MUTCD leaves the speed category to the agency, so this is INFO.
- **Two-way pin:** E 6th Ave and E 17th Ave are mapped as one-way carriageways, so the two-way rows use Ogden St (residential). The audit has no two-way arterial row.
