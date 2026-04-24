# Colorado Sources

> **Terminology:** CDOT uses "MHT" (Method of Handling Traffic); municipalities
> often use "TCP" (Traffic Control Plan). The tool should accept both terms in
> user input and prefer "MHT" for CDOT output, "TCP" for municipal output.

---

## Primary References

### CDOT MUTCD Hub

Main landing page for Colorado's adoption of the federal MUTCD, including the
Colorado Supplement and all state-specific amendments.

- **URL:** https://www.codot.gov/safety/traffic-safety/assets/documents/mutcd
- **Use:** Entry point for verifying Colorado-specific sign codes, device
  requirements, and deviations from the federal MUTCD.

### Colorado Supplement to the MUTCD

The official Colorado Supplement modifying the federal MUTCD 11th Edition.
Effective January 18, 2026.

- **URL:** https://www.codot.gov/safety/traffic-safety/assets/documents/mutcd/colorado-supplement-mutcd_final-12302025.pdf
- **Format:** PDF
- **Use:** Authoritative source for Colorado-specific sign codes (W1-13q_CO,
  W1-4a_CO, W8-49, W8-52, W11-53, D5-50_CO), spacing overrides, and device
  requirements that differ from federal MUTCD.

### CDOT S-630-1 — Standard Plans for MHT

The 26-sheet, 39-case standard plan set defining typical traffic control
layouts for CDOT highway work zones. This is the core reference for the
generation engine.

- **URL:** https://www.codot.gov/safety/traffic-safety/assets/s-standard-plans/2019/s-630-1/S-630-01%20(19-Page%20Set).pdf
- **Format:** PDF (26 sheets)
- **Use:** Each case defines a road type, lane configuration, closure type,
  and the required device placement layout. The generation engine implements
  these 39 cases programmatically.

### CDOT Traffic Signs Library

Official CDOT sign image library — vector and raster versions of all
Colorado-adopted traffic signs.

- **URL:** https://www.codot.gov/safety/traffic-safety/assets/traffic-signs
- **Use:** Source for sign sprites in the `assets/sprites/` directory. Download
  individual sign images for plan sheet rendering.

### CDOT Section 630 Specifications (2023)

Construction specifications for Method of Handling Traffic. Defines pay items,
measurement methods, and payment basis for all traffic control devices.

- **URL:** https://www.codot.gov/business/designsupport/cdot-construction-specifications/2023-construction-specifications/2023-specs-book/2023-index
- **Format:** Web index linking to individual spec sections (PDF)
- **Use:** Authoritative source for pay item numbers, units (EACH, LF, SF,
  HOUR), and measurement rules referenced in `skills/device-list-export/`.

### CDOT Form 568 — Temporary Speed Reduction Portal

Online portal for requesting temporary speed reductions in CDOT work zones.

- **URL:** https://sites.google.com/state.co.us/cdot-mta/programs/flagging-traffic-control/form-568-cdot-temporary-speed-limit-reduction
- **Use:** When the generation engine needs to include a speed reduction zone,
  this form defines the approval process and required signage sequence.

---

## Secondary References

### Federal MUTCD 11th Edition

The base national standard. Colorado Supplement modifies this.

- **URL:** https://mutcd.fhwa.dot.gov
- **Use:** Fallback when the Colorado Supplement doesn't override a federal
  provision. All MUTCD Part 6 formulas (taper length, spacing tables) come
  from here unless Colorado specifies otherwise.

### CDOT M&S Standards

CDOT Miscellaneous and Standard plans — includes sign panel details, barrier
end treatments, and device mounting standards.

- **URL:** https://www.codot.gov/business/designsupport/standard-plans
- **Use:** Reference for physical device dimensions, mounting heights, and
  sign panel sizes when building sprites or validating layouts.

---

## Data Freshness

| Source | Last Verified | Notes |
|--------|--------------|-------|
| Colorado Supplement PDF | 2026-04-24 | Effective 2026-01-18, v1 |
| CDOT S-630-1 | 2026-04-24 | 2019 edition (current as of check date) |
| CDOT 2023 Specs Book | 2026-04-24 | 2023 edition |
| CDOT Traffic Signs | 2026-04-24 | Ongoing library |
| CDOT Form 568 | 2026-04-24 | URL confirmed |

---

## Superseded

This skill replaces `skills/dot-data-sources/` which covered TxDOT, WSDOT,
and ODOT sources for the detection-era product. That file is archived at
`legacy/skills/dot-data-sources/SKILL.md`.
