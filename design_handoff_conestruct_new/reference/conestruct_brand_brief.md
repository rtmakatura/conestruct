# Conestruct — Brand Brief & Design Context

## What is Conestruct?

Conestruct is a web-based tool that generates MUTCD-compliant traffic control plans (called "MHT" — Method of Handling Traffic — in Colorado). A certified Traffic Control Supervisor (TCS) describes a work zone scenario and the tool produces a complete MHT package in under two minutes: a PDF plan sheet, an Excel device list, and crew setup/takedown instructions.

### One-sentence description
Generate MUTCD-compliant traffic control plans in seconds — describe the work zone, get a PDF, device list, and crew instructions.

### Tagline options
- "Describe the zone. Download the plan."
- "From scenario to MHT in seconds."
- "The fastest way to generate Colorado-compliant traffic control plans."

---

## Brand Identity

### Name
**Conestruct** — a portmanteau of "cone" (the iconic traffic control device) and "construct" (what the industry does).

### Domain
conestruct.com

### Tone
- Professional and trustworthy (this tool's output gets stamped by a licensed supervisor)
- Modern and approachable (differentiate from legacy CAD tools)
- Efficient and no-nonsense (the buyer values speed, not flash)
- Industry-native (use the right vocabulary: MHT, TCS, MUTCD, CDOT, S-630-1)

### Target audience
- **Primary user:** Certified Traffic Control Supervisors (TCS) at Colorado traffic control subcontractors (5–50 employees)
- **Decision maker:** Operations manager or company owner at the sub
- **Industry context:** Construction / road work / traffic control — blue-collar professionals who value reliability and clarity over aesthetic polish

---

## Color Palette

### Primary colors
| Role | Hex | RGB | Usage |
|------|-----|-----|-------|
| Primary Orange | `#E8710A` | rgb(232, 113, 10) | Logo, buttons, CTAs, active states, primary brand color |
| Dark Navy | `#1B2838` | rgb(27, 40, 56) | Navigation, headings, body text, dark backgrounds |
| Accent Blue | `#2D9CDB` | rgb(45, 156, 219) | Links, info badges, selected states, secondary actions |

### Semantic colors
| Role | Hex | Usage |
|------|-----|-------|
| Success Green | `#27AE60` | Validation pass, audit checkmarks, "all checks pass" |
| Error Red | `#EB5757` | Validation errors, failed checks |
| Warning | `#E8710A` | Same as primary (orange = warning in construction context) |

### Neutral colors
| Role | Hex | Usage |
|------|-----|-------|
| Warm Beige BG | `#F5F0EB` | Page background |
| White | `#FFFFFF` | Card backgrounds, input fields, sidebar |
| Light Gray | `#E0E0E0` | Borders, dividers |
| Medium Gray | `#828282` | Placeholder text, captions |
| Dark Text | `#1B2838` | Same as Dark Navy — body text |

### Color rationale
The orange (`#E8710A`) is the exact shade of MUTCD-standard construction orange — the color every TCS sees on cones, drums, and work zone signs daily. It signals "construction industry tool" instantly. The dark navy provides strong contrast without the harshness of pure black. The warm beige background evokes plan paper / blueprint stock without being literally beige.

---

## Typography

### Recommended fonts
- **Headings:** Inter (or system sans-serif) — weight 600
- **Body:** Inter (or system sans-serif) — weight 400
- **Monospace (for technical values):** JetBrains Mono or system monospace
- **Fallback stack:** -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif

### Type scale
- Hero title: 48px / weight 700
- Section heading: 24px / weight 600
- Subheading: 18px / weight 600
- Body: 16px / weight 400 / line-height 1.6
- Caption: 14px / weight 400
- Small / legal: 12px / weight 400

---

## Logo Concept

No logo has been designed yet. When designing:
- The name "Conestruct" should be the primary mark (wordmark)
- Consider incorporating a subtle cone silhouette into a letter (the "o" in Cone, or as a standalone icon mark)
- The cone should be simple and geometric — not a realistic 3D rendering
- Colors: primary orange (#E8710A) on dark navy (#1B2838) background, or reversed
- Must work at small sizes (favicon, mobile nav)

---

## Product Screenshots / Current UI State

The current product is a Streamlit web app with:

### Sidebar (left)
- "Scenario Parameters" header
- Speed limit slider (25–75 mph)
- Lanes per direction dropdown
- Lane width input
- Closure type dropdown (shoulder, lane, full_road, mobile)
- Road type dropdown
- Work zone length input
- Divided highway checkbox
- Night operation checkbox
- Location inputs (address, lat/lng for Mapbox aerial)
- Project name text input
- Orange "Generate MHT Package" button

### Main area (after generating)
- Info bar showing validation warning count
- Three columns with download buttons:
  - Plan Sheet (PDF download + device count metric)
  - Device List (Excel download + unique types metric)
  - Crew Instructions (Markdown download)
- "Verification & Audit Trail" section with expandable panels:
  - Taper Length Calculation (shows formula + MUTCD citation)
  - Buffer Space Calculation (shows table lookup + citation)
  - Channelizing Device Spacing (counts + spacing formulas)
  - Advance Warning Sign Placement (sign schedule table)
  - Colorado Supplement Requirements (pass/fail checklist)
  - S-630-1 Case Reference (case match + CDOT PDF link)
- "Plan Details" section with expandable panels:
  - Preview: Crew Instructions (rendered Markdown)
  - Validation Results (warning/error list)
  - Device Breakdown (table by device type)
- Footer disclaimer about TCS review requirement

### Generated PDF (plan sheet)
- 11x17 landscape layout
- Title block: "METHOD OF HANDLING TRAFFIC" + scenario type + sheet number
- Schematic road drawing with:
  - Gray travel lanes, pink fill on closed lane/shoulder
  - Yellow median lines (divided) or yellow centerline (undivided)
  - Devices rendered as colored geometric shapes (orange triangles = cones, orange rectangles = drums, green diamonds = signs, yellow rectangle = arrow board, red X = flagger)
  - Dimension lines showing taper length, buffer space, work zone length
  - Sign code labels (W20-1, G20-5P, etc.)
- Legend panel (bottom-left)
- Notes panel (bottom-right) with specs and advance warning sign table
- Optional Mapbox satellite aerial embed (bottom-right of plan view)

---

## Supported Scenarios (current V1)

1. **Shoulder closure on divided highway** — right shoulder closed, traffic continues in travel lanes
2. **Lane closure on divided highway** — right travel lane closed, merging taper
3. **Flagger-controlled alternating traffic on 2-lane undivided** — one lane closed, flaggers at both ends alternate traffic through the open lane

---

## Competitive Positioning

| Us (Conestruct) | Them (RapidPlan / Invarion) |
|---|---|
| Describe a scenario → get a plan | Draw a plan manually on a canvas |
| MUTCD math is automated | User calculates spacing/tapers themselves |
| Full audit trail with citations | No formula transparency |
| $149–349/mo target pricing | $540–799/year |
| Colorado-first, CDOT-native vocabulary | Generic US/international |
| PDF + Excel + crew narrative in one click | PDF export only |

---

## Design Principles for Any Conestruct Touchpoint

1. **Trust over flash.** This tool's output gets stamped by a licensed professional. Every pixel should communicate reliability.
2. **Show the math.** Transparency is the differentiator. Don't hide calculations behind a "Generate" button — surface them.
3. **Industry-native language.** Use "MHT" not "traffic plan." Use "TCS" not "user." Use "CDOT S-630-1" not "standard template."
4. **Construction orange is the hero color.** It's the single most recognizable color in the traffic control industry. Use it boldly but not overwhelmingly.
5. **Clean and scannable.** A TCS reviewing a plan at 6:30 AM on a job site needs to find information fast. Dense walls of text lose to clear headers, tables, and whitespace.

---

## Pages Needed (current and planned)

1. **Landing page** (conestruct.com) — hero section, value props, CTA to generator
2. **Generator** (conestruct.com/app or /generator) — the Streamlit tool itself
3. **About** (future) — who built this, why, credibility
4. **Pricing** (future) — tier cards
5. **Docs / Help** (future) — how to use, MUTCD reference links

---

## Files in This Package

When uploading to a design tool, include:
- This brand brief (conestruct_brand_brief.md)
- The generated PDF plan sheet (test_plan_v3.pdf or test_plan_flagger_v1.pdf) for visual reference of the product output
- The Excel device list (device_list.xlsx) for reference of the data output
- Screenshots of the current Streamlit UI if available
