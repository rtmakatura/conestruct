# #348 — the edition a Denver plan names

**Issue:** #348. Also settles the open edition half of #265 (C9c); #265 stays open for C9d only.
**Base:** `47940d6` = `origin/main` (read 2026-10-18).

This file is the arc's authority; every commit on this branch cites it.

---

## Ryan's rulings (2026-10-18), verbatim

> Rulings for #348:
> 1. Option A.
> 2. Yes, cite the mandate from outside sources, with quotes and page cites, recorded in rulings.md. Start with CDOT's Colorado Supplement (codot.gov, colorado-supplement-mutcd_final-12302025.pdf). Then the Colorado statute that binds local agencies (check C.R.S. 42-4-104 and confirm or correct it) and the federal adoption rule (check 23 CFR 655.603). If a source doesn't say what we need, stop and tell me. Don't stretch it.
> 3. Option B becomes a new low-priority issue: "One name for the MUTCD edition across nav, audit trail and sheet". Post it; it doesn't block the ship.
> Close #348 on this ruling and keep #265 open for C9d only, as you proposed. Don't ship.

Option A, as tabled: Denver plans cite the 11th everywhere, and the 2009 R2 pin appears only as a fact about Denver. Concretely, `denver.json:11` becomes something like "PT-116.1 cites 2009 R2; 11th governs". The sheet, nav and landing stay byte-identical. A test checks that the results row and the sheet name the same edition.

## The sources (retrieved 2026-10-18)

### 1. CDOT, Colorado State Supplement to the MUTCD (11th Edition)

URL: https://www.codot.gov/safety/traffic-safety/assets/documents/mutcd/colorado-supplement-mutcd_final-12302025.pdf (42 pages; SHA-256 `cd5a778fd5d637d43b0c54dc6f63bf91d76ad028db9fe1e5a32c9992ca0377fd`).

Cover (PDF p. 1):
> Adopted by the Transportation Commission of Colorado
> Effective January 18, 2026

Foreword (PDF p. 3, unnumbered):
> On December 17, 2025, the Transportation Commission of Colorado (TC) adopted the 11th Edition of the Manual on Uniform Traffic Control Devices for Streets and Highways, (MUTCD) for use in Colorado per TC Resolution 20251203. […] Use of the MUTCD is mandatory on all public highways, roads and streets in Colorado. This is pursuant to section 42-4-104 and 42-4-105 of the Colorado Revised Statutes.

CDOT's Signing & Pavement Markings page (https://www.codot.gov/safety/traffic-safety/design/signing-and-markings, no page numbers) states the compliance date:
> Effective January 18, 2026, all new transportation projects, designs, and maintenance operations must comply with the standards set forth in the 11th Edition MUTCD and the Colorado Supplement to the 11th Edition MUTCD.

### 2. Colorado statute: §42-4-105 binds local agencies, §42-4-104 does not (correction)

Text from colorado.public.law's reprint of the 2024 C.R.S. (marked current through Fall 2025). Statutes have no page numbers; the cite is the section. Each section is a single unnumbered paragraph.

C.R.S. §42-4-104 ("Adoption of traffic control manual") puts the duty on CDOT, not on local agencies:
> The department of transportation shall adopt a manual and specifications for a uniform system of traffic control devices consistent with the provisions of this article for use upon highways within this state. Such uniform system shall correlate with and insofar as possible conform to the system set forth in the most recent edition of the "Manual on Uniform Traffic Control Devices for Streets and Highways" […] Said state manual or supplement shall be made available to all municipal and county road authorities […]

C.R.S. §42-4-105 ("Local traffic control devices") is the section that binds local agencies:
> Local authorities in their respective jurisdictions shall place and maintain such traffic control devices upon highways under their jurisdiction […] All such traffic control devices shall conform to the state manual and specifications for statewide uniformity as provided in section 42-4-104.

So the ruling's "check C.R.S. 42-4-104" is corrected to §42-4-104 together with §42-4-105. The Supplement's foreword cites both sections.

### 3. Federal: 23 CFR 655.603

eCFR, current text (amended at 88 FR 87695, Dec. 19, 2023):
> (a) National MUTCD. The MUTCD approved by the Federal Highway Administrator is the national standard for all traffic control devices installed on any street, highway, or bicycle trail open to public travel in accordance with 23 U.S.C. 109(d) and 402(a). […]
> (b)(3) States and other Federal agencies shall adopt changes issued by the FHWA to the National MUTCD within two years from the effective date of the final rule. […]

CDOT's signing page gives the 11th Edition's federal effective date as January 18, 2024. Two years from that is January 18, 2026, the Supplement's effective date.

### What the sources do and do not say

They say: the 11th Edition plus the Colorado Supplement is Colorado's state manual, in effect since January 18, 2026, and local devices "shall conform to the state manual" (§42-4-105).

They do not mention Denver, PT-116.1, or home-rule status. None of them says how DOTI reviews a permit that cites 2009 R2. So the change states the pin as a fact about Denver ("PT-116.1 pins 2009 R2") and does not claim it is void. That fact comes from the record's own title (`denver.json:10`), not from these sources.

## R145 self-ruled (2026-10-18)

- **The label wording.** `denver.json` chain[0].display_name changes from "MUTCD 2009 R2 (pinned)" to "MUTCD 11th (PT-116.1 pins 2009 R2)". The schema (`data/jurisdiction.schema.json`) requires the display name to be an abbreviation of the title and "never new information". The title, kept verbatim, already says both "pinned by PT-116.1" and "the statewide 11th-Ed mandate applies regardless". The new name is 34 characters, within the 40 maximum. It leads with "MUTCD 11th", the same token as the baseline "MUTCD 11th + CO Suppl.". It doesn't add "+ CO Suppl." because the record's title doesn't name the Supplement.
- **The recorded fixture stays as recorded.** `tests/fixtures/tiering/adv-ni-denver.json:368` keeps the old display name. It's a recording of a past response, used for tiering, and doesn't assert the edition.
- **`references.py` docstring.** The "ruling #265 leaves open" sentence is replaced with this ruling's outcome. `REFERENCE_LINE` itself is byte-identical.
