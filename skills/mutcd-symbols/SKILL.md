# Device Vocabulary — 15-Class Traffic Control Device Taxonomy

Scope: Device vocabulary for the MHT/MOT generation engine and CDOT Section 630
device-list export. Each class maps to a physical device type, a sprite for plan
sheet rendering, and one or more CDOT pay items.

Reference: MUTCD 11th Edition Part 6 — https://mutcd.fhwa.dot.gov
Visual reference: WSDOT OpenRoads Work Zone Cell Library PDF (22 pages)
Colorado Supplement: effective 2026-01-18

---

## Class Summary

| ID | Class | MUTCD Section |
|----|-------|---------------|
| 0 | `CONE` | 6F.01 |
| 1 | `DRUM` | 6F.01 |
| 2 | `TUBULAR_MARKER` | 6F.01 |
| 3 | `BARRICADE_TYPE_II` | 6F.02 |
| 4 | `BARRICADE_TYPE_III` | 6F.02 |
| 5 | `LONGITUDINAL_CHANNELIZER` | 6F.01, 6F.85 |
| 6 | `ARROW_BOARD` | 6F.03 |
| 7 | `PCMS` | 6F.03 |
| 8 | `TRUCK_MOUNTED_ATTENUATOR` | 6F.02, 6G.01 |
| 9 | `TEMPORARY_BARRIER` | 6F.85 |
| 10 | `FLAGGER_STATION` | 6E.01–6E.04 |
| 11 | `TEMPORARY_SIGNAL` | 6F.04, 6H.01 |
| 12 | `SIGN_GENERIC` | 6F.01 (general) |
| 13 | `DETOUR_MARKER` | 6F.01, M4-9 series |
| 14 | `CHANNELIZER_OPTIONAL` | 6F.01 |

---

## Class Definitions

### 0. `CONE`

| Field | Value |
|---|---|
| MUTCD Section | 6F.01 — Channelizing Devices |
| Physical specs | Standard heights: 28" (≤45 mph) and 36" (>45 mph). Orange with retroreflective white bands. Base: 14"–18" square rubber or PVC. Weight: 7–10 lb. |
| Sprite description | Plan-view: small solid orange triangle or circle. No stripes visible at plan scale. Rendered at ~4 px diameter on a 300 DPI Arch D sheet. |

Size distinction (28" vs 36") is speed-dependent per MUTCD Table 6F-1 but not
visually distinguishable on plan sheets. Both sizes use the same sprite.

---

### 1. `DRUM`

| Field | Value |
|---|---|
| MUTCD Section | 6F.01 — Channelizing Devices |
| Physical specs | 36" height minimum. 18" diameter. Orange and white retroreflective horizontal bands (4" bands, alternating). HDPE construction, ballasted base. Weight: 25 lb empty. |
| Sprite description | Plan-view: squat rectangle or cylinder with 2–4 horizontal orange/white bands. Wider than a cone at plan scale (~6 px wide). |

---

### 2. `TUBULAR_MARKER`

| Field | Value |
|---|---|
| MUTCD Section | 6F.01 — Channelizing Devices |
| Physical specs | 36" height, 2"–3" diameter tube on a weighted base. Orange with retroreflective white bands. Flexible — deforms on impact and returns to upright. Weight: 8–12 lb with base. |
| Sprite description | Plan-view: small solid dot, smaller than a cone (~2 px diameter). Often used in tight spacing along tapers. |

---

### 3. `BARRICADE_TYPE_II`

| Field | Value |
|---|---|
| MUTCD Section | 6F.02 — Barricades |
| Physical specs | Two horizontal rails, each 8"–12" wide. Overall height: 36"–42". Rail pattern: alternating orange/white diagonal stripes at 45°, sloping downward toward traffic. Freestanding A-frame or sawhorse legs. Width: 24"–36". |
| Sprite description | Plan-view: narrow horizontal rectangle with diagonal orange/white stripes on two stacked rails. ~12 px wide at plan scale. |

---

### 4. `BARRICADE_TYPE_III`

| Field | Value |
|---|---|
| MUTCD Section | 6F.02 — Barricades |
| Physical specs | Three horizontal rails, each 8"–12" wide. Overall height: 48"–60". Width: 48"–96" (spans most of a lane). Diagonal stripe pattern same as Type II. Heavy-duty; used for road closures. |
| Sprite description | Plan-view: wide horizontal rectangle with diagonal stripes on three rails. Spans most of a lane width (~25 px wide at plan scale). |

---

### 5. `LONGITUDINAL_CHANNELIZER`

| Field | Value |
|---|---|
| MUTCD Section | 6F.01, 6F.85 — Channelizing and Barrier Devices |
| Physical specs | Continuous linear guide elements: plastic water-filled barriers (42" height, 24" base width, interlocking), flexible delineator posts, or low-profile plastic barriers. Deployed parallel to traffic flow in connected segments. |
| Sprite description | Plan-view: continuous line drawn parallel to traffic flow, 2–4 px wide. May show repeating segment marks. Thinner than temporary barrier. |

---

### 6. `ARROW_BOARD`

| Field | Value |
|---|---|
| MUTCD Section | 6F.03 — Arrow Boards and Portable Changeable Message Signs |
| Physical specs | Type A: 24"×48" (15 lamps). Type B: 30"×60" (25 lamps). Type C: 48"×96" (>25 lamps). Trailer-mounted, solar or generator powered. Modes: flashing arrow (left/right), sequential chevron, caution (4-corner flash). |
| Sprite description | Plan-view: horizontal rectangle containing a directional arrow symbol. ~20 px wide at plan scale. Trailer hitch visible. |

---

### 7. `PCMS`

| Field | Value |
|---|---|
| MUTCD Section | 6F.03 — Arrow Boards and Portable Changeable Message Signs |
| Physical specs | Full-size: 4'×8' display, trailer-mounted. mPCMS (mini): 3'×6', truck-mountable or trailer. LED matrix, 3-line display, solar powered. Both variants use the same class. |
| Sprite description | Plan-view: large horizontal rectangle, often labeled "PCMS" or "CMS". Larger than arrow board (~25 px wide). May show text area grid. |

---

### 8. `TRUCK_MOUNTED_ATTENUATOR`

| Field | Value |
|---|---|
| MUTCD Section | 6F.02, 6G.01 — Shadow Vehicles and Truck-Mounted Attenuators |
| Physical specs | NCHRP 350 or MASH-rated crash cushion mounted on a shadow/protection vehicle (typically 15,000+ lb truck). Variants: standard TMA, full-matrix arrow board TMA, scorpion-type. Deployed 50'–100' upstream of work space. |
| Sprite description | Plan-view: vehicle silhouette (truck cab + bed) with rear-facing chevron or crash cushion pattern. ~20 px long at plan scale. |

All TMA sub-types (SLED, ACZ-350, Scorpion, etc.) use this single class.

---

### 9. `TEMPORARY_BARRIER`

| Field | Value |
|---|---|
| MUTCD Section | 6F.85 — Temporary Traffic Barriers |
| Physical specs | Concrete: F-shape (32" height, New Jersey profile), single-slope (42" height). Steel: W-beam on temporary posts. Zipper barrier (movable median). Segments: 10'–20' connected by pin joints. Weight: 4,000–8,000 lb per 10' segment (concrete). |
| Sprite description | Plan-view: heavy linear element drawn along lane edges, thicker than lane stripes (4–6 px wide). Solid or hatched fill. Heavier visual weight than longitudinal channelizers. |

---

### 10. `FLAGGER_STATION`

| Field | Value |
|---|---|
| MUTCD Section | 6E.01–6E.04 — Flagging |
| Physical specs | Human position, not a physical device. Equipped with STOP/SLOW paddle (24"×24"), safety vest (ANSI Class 3), hard hat. Station includes a safe standing zone, escape route, and sight distance to approaching traffic. |
| Sprite description | Plan-view: crossed red flags (X shape) or star-in-a-box icon. ~10 px diameter. Placed at the point where the flagger stands. |

---

### 11. `TEMPORARY_SIGNAL`

| Field | Value |
|---|---|
| MUTCD Section | 6F.04, 6H.01 — Temporary Traffic Control Signals |
| Physical specs | Portable signal heads on trailer or pole mount. Standard: 3-head (R/Y/G). AFAD (Automated Flagger Assistance Device): gate arm with signal head. RDTS (Residential Driveway Temporary Signal): compact signal for driveway intersections. Solar or generator powered. |
| Sprite description | Plan-view: cluster of stacked circles (signal heads) on a mast, or gate-arm icon for AFAD. ~12 px diameter. |

All temporary signal variants (standard, compact, AFAD, RDTS) use this class.

---

### 12. `SIGN_GENERIC`

| Field | Value |
|---|---|
| MUTCD Section | 6F.01 (general temporary sign provisions) |
| Physical specs | Catch-all for any traffic sign not covered by other classes. Includes all W-series (warning), R-series (regulatory), and G-series (guide) signs used in work zones. Standard sizes per MUTCD Table 6F-1 (e.g., W20-1 "Road Work Ahead": 48"×48" diamond). Mounted on portable sign stands or temporary posts. |
| Sprite description | Plan-view: shape depends on sign type — diamond (warning), rectangle (regulatory/guide), octagon (stop). Rendered as outlined shape with abbreviated MUTCD code label. ~15 px at plan scale. |

---

### 13. `DETOUR_MARKER`

| Field | Value |
|---|---|
| MUTCD Section | 6F.01, M4-9 series — Detour Directional Signs |
| Physical specs | M4-9, M4-9a, M4-9b, M4-9c signs. 24"×18" to 36"×24" rectangle. Black directional arrow on orange background. Mounted on barricade or portable sign stand. |
| Sprite description | Plan-view: small horizontal rectangle with arrow symbol. ~12 px wide. Placed at decision points along detour routes. |

---

### 14. `CHANNELIZER_OPTIONAL`

| Field | Value |
|---|---|
| MUTCD Section | 6F.01 — Channelizing Devices |
| Physical specs | Generic placeholder — the specific device type (cone, drum, tubular marker) is left to contractor judgment. Bid as probability-weighted quantity (e.g., 50% of count) because deployment depends on engineer's field decision. |
| Sprite description | Plan-view: neutral placeholder symbol (open circle or dashed-outline device). Distinguished from mandatory channelizers by dashed outline or lighter fill. |

---

## Colorado Additions

Colorado-specific signs that must be in the sprite library for CDOT plan
generation. These are not part of the 15-class device taxonomy (they're all
`SIGN_GENERIC` instances with specific MUTCD codes) but they require dedicated
sprites because they appear frequently on Colorado MHT plans.

### W1-13q_CO — Truck Rollover

| Field | Value |
|---|---|
| Colorado Supplement Section | Section 2C.04 (Colorado Supplement to MUTCD) |
| Visual description | Diamond warning sign, yellow-green background. Silhouette of a truck tilting/rolling on a curved road. |
| When used | Placed in advance of curves on mountain highways where truck rollover risk is elevated due to grade + curvature combination. Common on I-70 mountain corridor, US-6, US-40. |

### W1-4a_CO — Reverse Curve (Horseshoe)

| Field | Value |
|---|---|
| Colorado Supplement Section | Section 2C.04 (Colorado Supplement to MUTCD) |
| Visual description | Diamond warning sign, yellow background. Stylized horseshoe/hairpin curve arrow. |
| When used | Placed in advance of tight reverse curves (switchbacks) on mountain passes. Common on US-550 (Million Dollar Highway), CO-82 (Independence Pass). |

### W8-49 — Icy Conditions May Exist

| Field | Value |
|---|---|
| Colorado Supplement Section | Section 2C.04 (Colorado Supplement to MUTCD) |
| Visual description | Diamond warning sign, yellow background. Snowflake/ice crystal symbol with text "ICY CONDITIONS MAY EXIST". |
| When used | Seasonal deployment on mountain passes and north-facing grades where black ice or frost is common. Often paired with speed advisory plates. |

### W8-52 — Falling Rock

| Field | Value |
|---|---|
| Colorado Supplement Section | Section 2C.04 (Colorado Supplement to MUTCD) |
| Visual description | Diamond warning sign, yellow background. Silhouette of rocks falling onto a roadway from a cliff face. |
| When used | Placed in rock cut zones and canyon highways. Common on I-70 through Glenwood Canyon, US-24 through Tennessee Pass area. |

### W11-53 — Open Range

| Field | Value |
|---|---|
| Colorado Supplement Section | Section 2C.04 (Colorado Supplement to MUTCD) |
| Visual description | Diamond warning sign, yellow background. Silhouette of a cow/cattle. |
| When used | Placed on rural highways crossing unfenced grazing land (open range). Common on eastern plains and western slope ranch country. |

### D5-50_CO — Chain Law Information

| Field | Value |
|---|---|
| Colorado Supplement Section | Section 2D (Colorado Supplement to MUTCD) |
| Visual description | Rectangular guide sign, green background with white text. Shows chain law requirements and traction device information. |
| When used | Deployed at chain law enforcement points on I-70 mountain corridor and other designated chain law highways. Seasonal (typically September–May). |

---

## Device-to-Pay-Item Mapping

Mapping from the 15-class taxonomy to CDOT Standard Specifications Section 630
pay items. Pay item numbers marked TODO will be filled from the CDOT 2023
Specs Book.

| Class | CDOT Pay Item Name | Pay Item Number | Unit |
|-------|-------------------|-----------------|------|
| `CONE` | Traffic Cone | TODO | EACH |
| `DRUM` | Channelizing Drum | TODO | EACH |
| `TUBULAR_MARKER` | Tubular Marker | TODO | EACH |
| `BARRICADE_TYPE_II` | Barricade (Type II) | TODO | EACH |
| `BARRICADE_TYPE_III` | Barricade (Type III) | TODO | EACH |
| `LONGITUDINAL_CHANNELIZER` | Longitudinal Channelizing Device | TODO | LF |
| `ARROW_BOARD` | Arrow Board | TODO | EACH |
| `PCMS` | Portable Changeable Message Sign | TODO | EACH |
| `TRUCK_MOUNTED_ATTENUATOR` | Truck Mounted Attenuator | TODO | EACH |
| `TEMPORARY_BARRIER` | Temporary Barrier | TODO | LF |
| `FLAGGER_STATION` | Flagger | TODO | HOUR |
| `TEMPORARY_SIGNAL` | Temporary Traffic Signal | TODO | EACH |
| `SIGN_GENERIC` | Construction Sign | TODO | SF |
| `DETOUR_MARKER` | Detour Marker | TODO | EACH |
| `CHANNELIZER_OPTIONAL` | Channelizing Device (Optional) | TODO | EACH |

**Notes:**
- `FLAGGER_STATION` is bid by the hour, not per device.
- `SIGN_GENERIC` is bid by square foot of sign face area.
- `TEMPORARY_BARRIER` and `LONGITUDINAL_CHANNELIZER` are bid by linear foot.
- `CHANNELIZER_OPTIONAL` quantities should be probability-weighted (e.g., 50%)
  in the device list to reflect uncertainty about field deployment.

---

## Decisions Log

Audit trail of taxonomy changes as the class list evolves.

### 2026-04-23 — #1: Added FLAGGER_STATION

Flagger stations (crossed red flags, star-in-a-box police variant)
appear dozens of times per sheet on flagger-controlled plans (TC-320,
TC-420, TC-18). Too frequent and visually distinct to lump into
SIGN_GENERIC.

### 2026-04-23 — #2: Added TUBULAR_MARKER, skipped QWS

Portable tubular markers appear as small solid dots on WSDOT typical
TCPs. Visually distinct from cones. QWS Traffic Sensor skipped — too
rare, low pricing impact; label as SIGN_GENERIC.

### 2026-04-23 — #3: Expanded to 14-class taxonomy

Expanded from 10 to 14 classes after reviewing WSDOT OpenRoads Work
Zone Cell Library (22-page PDF). Changes:
- **Added:** BARRICADE_TYPE_II, LONGITUDINAL_CHANNELIZER,
  TRUCK_MOUNTED_ATTENUATOR, TEMPORARY_BARRIER, TEMPORARY_SIGNAL,
  DETOUR_MARKER
- **Merged:** CONE_28 + CONE_36 → CONE (not visually distinguishable
  on plan sheets)
- **Renamed:** TMA → TRUCK_MOUNTED_ATTENUATOR (clearer scope),
  CHANNELIZER → LONGITUDINAL_CHANNELIZER (distinguishes from tubular
  markers)
- **Documented:** "Explicitly Excluded" list to prevent scope creep
- **Breaking change:** Class IDs renumbered. All prior label data
  invalid (none existed).

### 2026-04-23 — #5: Added CHANNELIZER_OPTIONAL

WSDOT's "optional channelization device" legend entry represents a
generic placeholder whose specific device type (cone, drum, etc.)
is left to contractor judgment. The distinction matters for
estimating because contractors bid optional devices at
probability-weighted quantities (e.g., 50% of count) rather than
100%, reflecting uncertainty about whether the engineer will
require deployment.

Originally considered naming this DRUM_OPTIONAL, but the legend
itself does not commit to a specific device type — the symbol is
intentionally generic. Choosing a broader name prevents systematic
mis-labeling if the same legend entry appears with different
underlying device intent on other sheets or other DOTs' plans.

Downstream implication: CSV export and quantity rollup code should
treat CHANNELIZER_OPTIONAL as a related-but-separate line from
CONE, DRUM, and TUBULAR_MARKER. For v1, listing them as separate
rows is sufficient. For v2, consider letting the user apply a
probability weight (e.g., 50%) to CHANNELIZER_OPTIONAL counts when
producing final bid quantities.

No migration needed — no existing labels use this class.

### 2026-04-24 — #6: Scope shift from detection labeling to generation vocabulary

Taxonomy unchanged (still 15 classes, same IDs). Intended use changed:
classes now serve as the device vocabulary for the MHT/MOT generation
engine and CDOT Section 630 device-list export, rather than as labeling
categories for YOLO training.

Changes to this skill file:
- Removed Label Studio hotkey references and labeling confusion pairs
- Removed DPI notes and plan-view pixel size references for labeling
- Added physical specifications (heights, widths, weights) for each device
- Added MUTCD Part 6 section references (11th Edition)
- Added sprite rendering descriptions (for plan sheet generation, not labeling)
- Added "Colorado Additions" section with 6 CO-specific signs
- Added "Device-to-Pay-Item Mapping" section for CDOT Spec 630

Labeling-era content preserved in `legacy/skills/` and the Label Studio
database (1,038 labeled bounding boxes across 203 WSDOT typical TCP images).
