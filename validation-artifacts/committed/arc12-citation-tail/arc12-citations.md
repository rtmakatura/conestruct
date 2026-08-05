# Arc 12 — subject verification of the CO-Supplement citation family (Refs #70, #83)

Method: every citation verified by SUBJECT against the local sources.
Verified 2026-08-04.

Sources:
- `validation-artifacts/committed/arc12-citation-tail/colorado-supplement-mutcd_final-12302025.pdf`
  — **Colorado State Supplement to the MUTCD (11th Edition), effective
  January 18, 2026** (adopted by the Transportation Commission
  2025-12-17). Added to the repo this arc (under `committed/`, the
  tracked carve-out, per the #160 ruling) as the negative-evidence
  basis. 42 pages.
- `validation-artifacts/s630-1-2026.pdf` — CDOT S-630-1, 26 sheets,
  issued July 01, 2026 (S-630-1 at PDF pp. 149–174; Sheet 2 = PDF
  p. 150, Sheet 12 = PDF p. 160).
- `validation-artifacts/ta10_flagger/mutcd_part6.pdf` — MUTCD 11th Ed.
  (Dec 2023), Part 6. Page cites printed/PDF.

## The governing finding — the Supplement contains none of the cited sections

The Supplement's own front matter (PDF p. 2) states the containment
rule verbatim: *"If a Section, Table, or Figure from the MUTCD is not
contained within this Supplement, the Section, Table, or Figure shall
remain unchanged."*

A full-text scan of all 42 pages (pypdf, every page extracted) finds
**zero occurrences** of any section this codebase attributed to the
"CO Supplement": no 2B.13, 6C.04, 6C.06, 6E.02, 6G.02, or 4D.01 —
and no 6F.55 or 6F.63. The only Part 6 sections the Supplement touches
are 6D.03, 6D.04, 6J.01, 6J.03 (+ Figure 6D-2), matching research
finding F2 (`docs/research/01-FINDINGS.md`, verified 2026-07-15).

Every `CO Supplement §…` literal was therefore a claim about a document
that does not contain the cited section. The *values* are real — they
live in **S-630-1 Sheet 2 General Notes** (below). The attributions
appear to be carryovers from the pre-11th-Edition Colorado Supplement,
the exact staleness class #70's body hypothesized (the federal §6C
renumber, second instance). Rule 10 disposition: fix-to-what-the-
source-says for all six rendered citations (every value found in
S-630-1); the unused §4D.01 comment is marked chosen.

## Per-literal dispositions

| # | Literal (as rendered pre-arc) | Claim | Source found | Verification | Disposition |
|---|---|---|---|---|---|
| 1 | `CO Supplement Sec 6C.04(A)` | Signs on both sides of divided highway | **S-630-1 (July 2026) Sheet 2, General Note 8** (PDF p. 150): *"All warning and regulatory signs shall be posted on both sides of the roadway on divided highways, multi-lane ramps, one-way streets, and as directed by the Engineer, except where only one shoulder is closed (ex: Case 11 on Sheet 7)."* | Value ✓ (also verifies `both_sides_signage_required_on = (multi_lane_ramp, one_way_street)` and the Case-11 single-side-shoulder exception the narratives lean on); attribution ✗ (not in the current Supplement) | **Fixed-with-provenance** → `CDOT S-630-1 (July 2026) Sheet 2, General Note 8` |
| 2 | `CO Supplement Sec 6C.06(A)` | G20-5P plaques every 2,640 ft | **Sheet 2, General Note 4**: *"Work Zone (G20-5p) and Fines Double (R2-6p) signs shall be provided every 2640' between R2-10 and R2-11 signs. The spacing of these signs may be changed as directed by the Engineer."* | Value ✓; attribution ✗. Additional wrong-subject: the tables.py comment called this the *"CONSTRUCTION ZONE plaque (G20-4a)"* — the sheet names it the **Work Zone (G20-5p)** sign; the audit label "construction plaques" carried the same misnomer | **Fixed-with-provenance** → `CDOT S-630-1 (July 2026) Sheet 2, General Note 4`; label/comments recited to "Work Zone (G20-5p)" |
| 3 | `CO Supplement Sec 2B.13(A)` | Speed reduction ≤ 15 mph per sign installation | **Sheet 2, General Note 3** (final ¶): *"The regulatory or advisory speed reduction displayed shall not exceed 15 mph per sign installation."* (Note 3 also carries the Form 568 requirement and the W13-1p advisory-plaque option) | Value ✓; attribution ✗ | **Fixed-with-provenance** → `CDOT S-630-1 (July 2026) Sheet 2, General Note 3` |
| 4 | `CO Supplement Sec 6E.02(A)` | Flagger station lighting 500W @ 8 ft | **Sheet 2, General Note 22**: *"Flood lights shall be used to illuminate flagger stations during the hours of darkness unless otherwise approved. A typical light should provide the following: a fully directional swivel mount quartz light source (500 watt minimum), self-supporting stand with variable light height from a minimum of eight feet above the roadway, and a power source. It shall illuminate the station area and a flagger escape path, but shall not present any glare to traffic."* Note number identified by subject in the Sheet 2 layout extraction (the audit's existing "Sheet 2 Note 22" half was already correct) | Values ✓ (500W min, 8 ft min, night-only); attribution ✗ | **Fixed-with-provenance** → `CDOT S-630-1 (July 2026) Sheet 2, General Note 22` |
| 5 | `CO Supplement Sec 6G.02(A)` | Mobile ops with AADT ≥ 2,000 require shadow vehicle w/ TMA | **S-630-1 (July 2026) Sheet 23 (PDF p. 171), Case 38 Note 1**: *"In roadway where the aadt is 2,000 or less, a single work vehicle with appropriate warning devices on the vehicle may be used."* The drawn Case 38 configuration above the note is the mobile-attenuator train (legend: *"Mobile attenuator truck, two 360-degree yellow flashing beacons"*; TRUCK-MOUNTED IMPACT ATTENUATOR callout) — the note is the below-threshold exception to it. Not in the current Supplement (no §6G at all); not in MUTCD Part 6 (only temporary-raised-island ADT ranges, printed p. ~838) | Threshold value ✓ (2,000, matching the audit label's "<= 2,000" framing); attribution ✗. Scope caveat recorded: the note is stated on Case 38 (mobile striping, multi-lane); the field gates all mobile kinds — generalization noted in the tables.py comment | **Fixed-with-provenance** → `CDOT S-630-1 (July 2026) Sheet 23, Case 38 Note 1` |
| 6 | `CO Supplement Sec 2B.13 + S-630-1 Sheet 12 Fines Double Signing Notes` | Fines Double envelope | **Sheet 12** (PDF p. 160): *"Fines Double in Work Zone" Signing Typical Application*, Case No. 24 — R2-10/R2-11 envelope, G20-5P/R2-6P every 2640', the 500' placements; other sheets defer to it ("See Fines Double Signing Notes on Sheet 12"). The §2B.13 half is unsupported (not in the Supplement) | Sheet-12 half ✓; §2B.13 half ✗ | **Fixed-with-provenance** → `CDOT S-630-1 (July 2026) Sheet 12, Fines Double Signing Notes` (the §2B.13 prefix dropped everywhere, incl. narrative prose and base.md.j2) |
| 7 | tables.py `§4D.01` comment (horizontal signal faces) | CO permits horizontal faces only for bicycle signals | Not in the current Supplement (no 4D.01; the Supplement's Part 4 revisions are 4A.02/4A.06/4C.01…). Field has **no consumer** anywhere in src/ | Unverifiable | **Marked-chosen** in the comment; field retained, unused |
| 8 | `§6F.55` (validators.py G20-1/G20-2 pair; layout.py comments) | Begin/end road work bookends | 11th Ed: **§6H.35 ROAD WORK NEXT XX MILES Sign (G20-1)** and **§6H.36 END ROAD WORK Sign (G20-2)**, printed p. 810 / PDF p. 46: *"When used, the END ROAD WORK (G20-2) sign … should be placed near the downstream end of the termination area."* §6F.55 does not exist in the 11th Ed (zero hits, full Part 6 scan) — stale pre-renumber number | Subject ✓ under new numbers | **Fixed-with-provenance** → `MUTCD 11th Ed. §6H.35 / §6H.36`. Naming note below |
| 9 | `6F.63` (validators.py arrow board, mutcd_section + docstring) | Arrow boards | 11th Ed: **§6L.06 Arrow Boards**, printed p. 832 / PDF p. 68: *"An arrow board shall be a sign with a matrix of elements capable of either flashing or sequential displays."* §6F.63 does not exist in the 11th Ed | Subject ✓ under new number | **Fixed-with-provenance** → `6L.06` |

## G20-1 naming, subject-verified (disposition rider on row 8)

The 11th-Ed name for G20-1 is **ROAD WORK NEXT XX MILES** (§6H.35).
The validator docstring/message call it "G20-1 BEGIN ROAD WORK"
(internal surfaces — recited in the 6F commit). Observed adjacent,
NOT changed this arc: `sign_codes.py:47` renders G20-1 as "ROAD
CONSTRUCTION (NEXT XXX FT)" on live sign tables — a device-description
question (CDOT plate usage vs federal name), not a citation literal;
flagged for a dedicated look rather than absorbed here.

## Verification defect caught in-arc (diff-verifier, repair cycle 1)

The first draft of this file claimed "zero AADT/volume-threshold hits"
in S-630-1 and disposed row 5 as marked-chosen. That scan was
case-sensitive and missed Sheet 23's lowercase "aadt" — the
diff-verifier's independent re-scan caught it before commit, and row 5
is now fixed-with-provenance instead. Recorded here because the
defect class (a negative claim from a flawed scan) is exactly what
this arc exists to prevent; **citation-defect counter: #17, caught
pre-commit**.

## Upstream-miscite rule

S-630-1's own internal legend errors stay upstream (the known
notes-17/23-vs-24 legend case). All note numbers above were identified
by reading the note text on Sheet 2 itself (layout-mode extraction),
not by trusting any legend cross-reference.

## Line-ref drift found while verifying

- phase5-citations.md recorded the §6F.55/§6F.63 validator literals at
  validators.py:750/:785/:809/:881/:914 → at this arc's HEAD: 6F.63 at
  :768 (docstring) /:803/:827 (mutcd_section); 6F.55 at :899
  (docstring); CO §6C.04(A) mutcd_section at :886.
- #83's tables.py refs ~242-284 → :246-288 pre-migration.

## Surfaces

User-visible today (shoulder / flagger_lane_closure / near_intersection
live): the AuditTrail Colorado panel (4 checks + AADT info row), the
audit case_narrative strings, the Fines Double section + narrative
clause (base.md.j2), the AuditTrail fines-double fallback strings.
Latent (gated kinds): plan_sheet.py divided-median both-sides box.
Internal only: validators mutcd_section/message literals (fail-closed
gate: error-severity → 5xx, warnings unrendered), layout.py/spacing.py
comments and docstrings.
