# Landing page source run: E Colfax Ave, Oct 17, 2026

This folder records the generator run behind the numbers on the landing page (`/`). The page calls it "the Oct 17 run" (`Hero.tsx:121`, `Landing.tsx:234`, `:373`). The files are copied byte for byte from Ryan's capture folder, `%USERPROFILE%\conestruct-captures\landing-2026-10-17\`. They were captured 2026-10-17, 20:32–20:36 local, by a browser run of `/sandbox`.

The capture logs say `build: (no meta)`, so they don't record which deployment produced the run. This README doesn't claim one.

## The run
From `log-1440.txt` (the step ledger) and the exports:
- **Location:** East Colfax Avenue, eastbound, Denver. "Work starts 90 ft W of Williams Street". The plan's coordinates are 39.73997, -104.96632 (`01-plan.pdf` p1 title block).
- **Side and kind:** South side, eastbound traffic, confirmed. Shoulder work, confirmed.
- **Extent:** 1,000 ft, typed.
- **Speed:** 30 mph (`04-plan.md:5`; `02-plan.xlsx` Summary row 4). Daytime.
- **Case:** CDOT S-630-1 Case 11, "Shoulder closure on divided highway" (`05-plan.audit.pdf` p1). This is the divided reading tracked in **#350**. E Colfax at Williams has no median, so the sheet's median and its left-side (median) sign set come from that bug.

## Files
| File | What it is |
|---|---|
| `log-1440.txt`, `log-390.txt` | The capture run's log at each width: road picker, side options, step ledger, status strip, downloads |
| `08-deliverables/01-plan.pdf` | Plan sheet, 2 pages, 17 × 11 in |
| `08-deliverables/02-plan.xlsx` | Device list (11 line items) and Summary sheet |
| `08-deliverables/02-plan-sheet1.pdf` | The device list's first sheet printed to PDF, 1 page |
| `08-deliverables/03-plan.crew.pdf` | Crew instructions, 3 pages |
| `08-deliverables/04-plan.md` | Crew instructions as Markdown (same content as the crew PDF) |
| `08-deliverables/05-plan.audit.pdf` | Audit trail, 4 pages. There is no audit JSON export in this capture. |
| `08-deliverables/08a…08c-*-200dpi.png` | 200 dpi renders of plan sheet p1, audit p1 and device list sheet 1 |

## Every number on the landing page, against this run
Status as of main `aa481c4` (2026-10-19).
- Landing paths are under `conestruct/site/components/landing/`.
- `md` = `08-deliverables/04-plan.md`, `audit` = `08-deliverables/05-plan.audit.pdf`, `xlsx` = `08-deliverables/02-plan.xlsx`.

### Printed text
| Where | Landing says | This run says | |
|---|---|---|---|
| Hero card `Hero.tsx:62` | 2 site conditions | adjacent intersection and pedestrian sidewalks DETECTED (audit p3) | match |
| Hero card `Hero.tsx:71` | nearest 64 ft · no devices added · §6N.12 | "42 found · nearest 64 ft from anchor" (audit p3); "No devices added: the cross-street approach layout isn't generated" (md:91) | match |
| Hero card `Hero.tsx:82-83` | nearest 65.9 ft · 4 devices added · §6C.02 | "46 found · nearest 65.9 ft from anchor" (audit p3); 2 Type III barricades + 2 R9-9 (md:92) | match |
| Hero card `Hero.tsx:90` | 43 devices | Total device count 43 (xlsx Summary row 2) | match |
| Hero card `Hero.tsx:96` | 50 ft taper · Table 6B-4 | 50 ft, L/3; Table 6B-4 (audit p1) | match |
| Hero card `Hero.tsx:102` | 200 ft buffer · Table 6B-2 | 200 ft; Table 6B-2 (audit p1) | match |
| Hero caption `Hero.tsx:121` | E Colfax Ave eastbound · shoulder work | "East Colfax Avenue Eastbound", "Shoulder work" (log-1440.txt) | match |
| Step 1 `Landing.tsx:251` | Work starts 90 ft W of Williams Street | same (log-1440.txt) | match |
| Step 1 `Landing.tsx:252` | Extent 1,000 ft · typed | same (log-1440.txt) | match |
| Step 2 `Landing.tsx:289` | 3 guesses marked | 3 guessed inputs: street class, jurisdiction, road type (audit p1) | match |
| Step 2 `Landing.tsx:293` | Speed 30 mph | 30 mph (md:5) | match |
| Step 2 `Landing.tsx:294` | Lanes 2 per side · 12 ft | **not stated in the exports.** The cone line sits 24 ft from centerline (md:45), which fits 2 × 12 ft but does not state it | not in run |
| Step 3 `Landing.tsx:323-328` | TA-3 · S-630-1 · 30 mph · 50 ft · 200 ft · 1,000 ft · 43 | TA-3, S-630-1, 30 mph, 50, 200 (audit p1); 1,000 ft, 43 (xlsx Summary) | match |
| Files `Landing.tsx:344` | Plan sheet 11×17 | `01-plan.pdf` page is 17 × 11 in | match |
| Files `Landing.tsx:352` | Device list 11 line items | 11 rows (xlsx Device List rows 2–12) | match |
| Files `Landing.tsx:360` | Crew sheet 14 steps | "Crew steps 14" (audit p1) | match |
| Files `Landing.tsx:368` | Audit 15 checks | "15 checked" (audit p1, Plan status) | match |
| Audit block `Landing.tsx:397-409` | 30 mph · L = W × S² / 60 · 10 ft ⚠ assumed · 150 ft · 50 ft | "L = 10 x 30^2 / 60 = 150 ft", "L/3 = 150 / 3 = 50 ft", "Offset (shoulder width) 10 ft (assumed)" (audit p1) | match |

### The drawings
The hero, step 1 and step 3 drawings (`plan-art.ts`, generated from `design/landing-v2/*.svg`) come from `design/landing-v2/illus.py`. Its values are typed in by hand. The SVGs say "ILLUSTRATION · NOT TO SCALE" (`illus.py:149`).

| Drawing element | Drawn | This run | |
|---|---|---|---|
| Dimension labels (`illus.py:122-124`) | L/3 50 ft · buffer 200 ft · work zone 1,000 ft | 50, 200, 1,000 (audit p1) | match |
| Advance signs (`illus.py:130`) | W20-1 300 ft · W20-2 200 ft · W21-5AR 100 ft | W20-1 300, W20-2 200, W21-5aR 100 ft upstream of the taper start (md:52-54) | match (the plan writes the code "W21-5aR") |
| Intersection flag (`illus.py:136-139`) | ▲ INTERSECTION · 64 FT, drawn at Williams St | 64 ft from the corridor anchor. The plan does not name the nearest intersection (audit p3). | the number matches; the plan doesn't support the location |
| Sidewalk flag (`illus.py:141-144`) | ▲ SIDEWALK CLOSED · +4 DEVICES | 2 barricades + 2 R9-9 (md:92) | match |
| Taper devices (`illus.py:99-101`) | 6 cones | **3 drums** at 25 ft (audit p2) | differs |
| Buffer devices (`illus.py:102-103`) | 4 cones | **3 cones** at 50 ft (audit p2) | differs |
| Work-zone devices (`illus.py:104-105`) | 21 cones | **18 cones** at 58.8 ft (audit p2) | differs |
| Downstream taper (`illus.py:106-107`) | 2 cones | 2 cones (audit p2) | match |
| Arrow board (`illus.py:109-112`) | 1, alternating | 1, caution mode (md:41) | match |
| Signs | 3 advance signs, one side only | 2 each of W20-1, W20-2, W21-5aR, plus G20-1, G20-5P and G20-2 (2 each) and 2 R9-9 (md:14-21) | differs |
| Sidewalk devices (`illus.py:94-95`) | 2 barricade marks | 2 barricades **+ 2 R9-9** (md:92) | differs (no R9-9 drawn) |
| Road (`illus.py:70-71`) | two-way, undivided, double yellow | divided highway with a median (#350) | differs; the drawing is right about the road |

The phone crop of step 3 (`STEP3_NARROW`) shows only the 50 / 200 / 1,000 ft dimension labels. It carries no sign, intersection or sidewalk labels.

Every number printed as text on the page matches this run, except the lane count, which the run doesn't state. The drawings' dimension labels match too. Their device counts and sign set are drawn for looks and differ from the plan.

## Where each device sits in this run
- **Stations:** the plan counts station 0 at the downstream end of the work zone, increasing upstream (md:45).
- **Taper start:** the upstream end of the shoulder taper, at station 1,250 (md:41, 49).
- **Position:** feet from the taper start, which is 1,250 − station. Negative means upstream.

| Device | Qty | Position | Where | Source |
|---|---|---|---|---|
| W20-1 | 2 | −300 (sta 1,550) | right side + matching left | md:54-55 |
| W20-2 | 2 | −200 (sta 1,450) | right + left | md:53-55 |
| W21-5aR | 2 | −100 (sta 1,350) | right + left | md:52-55 |
| Arrow board, caution mode | 1 | 0 (sta 1,250) | shoulder, upstream end of the taper | md:41 |
| 36-in drums | 3 | 0 to +50, 25 ft apart | shoulder edge (34 ft from centerline) to lane edge (24 ft) | md:49 |
| 28-in cones, buffer | 3 | between +50 and +250, 50 ft apart; exact stations not in the plan | lane edge, 24 ft from centerline | md:45 |
| 28-in cones, work zone | 18 | +250 to +1,250, 58.8 ft apart | right lane edge, 24 ft from centerline | md:45; audit p2 |
| 28-in cones, downstream taper | 2 | between +1,250 and +1,300, ~25 ft apart | lane edge back to shoulder edge | md:45 |
| G20-1 | 2 | not in the plan's text (drawn as callout 1 on the sheet) | not in the plan | md:15 |
| G20-5P | 2 | "within the work zone at approximately 1,000 ft intervals"; station not in the plan | right + left | md:47; audit p2 |
| G20-2 | 2 | +1,400 (sta −150) | right side 28 ft from centerline + left | md:43 |
| R9-9 | 2 | +250 and +1,250 (the work zone's ends) | sidewalk | md:92 |
| Type III barricade | 2 | +250 and +1,250 | sidewalk closure points | md:79, 92 |

The detail line beside the 64 ft figure, "unnamed at 39.7400, -104.9648 [work_zone @ 666 ft]" (audit p3), is the first detected intersection, not necessarily the nearest one (`src/rendering/audit_blocks.py:343-355`). The plan places no devices for any intersection.
