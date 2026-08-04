# Arc 11 phase 5 — subject verification of every citation the near_intersection path renders (Refs #117, #108)

Method: each citation verified by SUBJECT against the local sources —
`validation-artifacts/ta10_flagger/mutcd_part6.pdf` (MUTCD 11th Ed., Dec 2023)
and `validation-artifacts/s630-1-2026.pdf` (S-630-1, 26 sheets, issued
July 01, 2026; S-630-1 at PDF pp. 149–174).  Page cites are given as
printed page / PDF page.  Verified 2026-08-03.

## Verified — the NI-rendered inventory

| # | Citation as rendered | Surface(s) | Verification |
|---|---|---|---|
| 1 | TA-21 "Lane Closure on the Near Side of an Intersection" | audit `_SCENARIO_TA_CDOT` (audit.py:1482), plan-sheet TA row | Fig. 6P-21 title verbatim incl. "(TA-21)", p. 900/136; §6N.12.08's own prose names Fig. 6P-21 as the near-side depiction (p. 849/85). The figure draws the CENTER-lane variant (W9-3L, W12-1 extracted from the plate text layer) — the existing code-comment precision at audit.py:1476 is correct. |
| 2 | TA-22 "Right-Hand Lane Closure on the Far Side of an Intersection" (far-side override) | audit_projection (audit.py:1736-1740), plan_sheet.py:3697-3704 | Fig. 6P-22 title verbatim incl. "(TA-22)", p. 903/139. |
| 3 | Fig. 6P-22 note 3 — near-side right-lane train ("normal procedure of closing on the near side … any lane that is not carried through") | code-comment basis at audit.py:1477-1478, layout.py docstring | Note 3 text verified, p. 903/139. |
| 4 | Fig. 6P-22 note 7 — far-side continuous channelizers, no turn-bay signs | generator far-side tangent (layout.py step 4) | Note 7 text verified, p. 903/139: continuous channelizers from taper end to the intersection; RIGHT LANE MUST TURN RIGHT signs not installed. The emission matches this shape exactly (continuous cones taper→upstream curb, resume downstream curb→work zone, no R3-7 family emitted). **Reconciliation done this phase: the note-7 basis now lives in the layout.py comment, not only in CLAUDE.md.** |
| 5 | §6N.12.06 — per-approach advance sets on all cross streets; >40 mph extra-sign trigger | layout.py:1338/:1515, validators.py:1678/:1706, audit narrative | ¶06 verified, p. 849/85. |
| 6 | §6N.12.12 — far-side companion closure ("closed on the near-side approach to preclude merging movements within the intersection") | layout.py:1417 block, base.md.j2 companion-cones clause | ¶12 verified, p. 849/85. |
| 7 | §6N.12 items 04/05 + Part 4 — signal operation review | `signal_operation_review_required` pending item (audit.py:1846-1874), template signalized clauses | ¶04 (signal phasing/timing "as described in Part 4") and ¶05 (agency shall be contacted) verified, p. 849/85. |
| 8 | §6N.12.02 — near/far/in-intersection classification; combining features | schema/docstring basis for the along-station sign contract | ¶02 verified, p. 848/84. |
| 9 | "Case 18: Traffic control around a work area near an intersection, one lane closed" | audit case_label (audit.py:1106-1134) | Sheet 10 title block verbatim: "Traffic Control Around a Work Area Near an Intersection, One Lane Closed" — July 2026 edition, "Standard Sheet No. 10 of 26", issued 07/01/26 (PDF p. 158). |
| 10 | "CDOT S-630-1 Sheet 10, Cases 18/19" | audit source line (audit.py:1407), plan-sheet NOT-DRAWN note (plan_sheet.py:3040-3042), frontend fallback (AuditTrail.tsx:1341) | **Sheet numbering re-confirmed against the 26-sheet reissue, not assumed**: Cases 18, 19, and 20 sit on Standard Sheet No. 10 of 26 (PDF p. 158). Case 19 is the sheet's flagger variant (W20-7/W20-4 train extracted), matching the increment-2 scope statement that excludes it. "Cases 18/19" remains a true statement of what Sheet 10 typifies. |
| 11 | Sheet 10 advance-signing key (W20-1, R2-10, R2-11; A/B/C distances) | per-approach sign emission (layout.py:1515-1553), audit sign table, narrative steps | Text layer partially verifiable: W20-1 and the A/B/C distance table (100/350/500 · 100/350/500 · 100/350/500-column triplets) extract from PDF p. 158; R2-10/R2-11 are plate graphics that do not survive text extraction. Their reading is carried by the design spike's plate zoom (`validation-artifacts/intersections-spike/s630_case18_zoom.png`, spike D1: "the near leg gets W20-1 + R2-10/R2-11") and the increment-2 anchor tests that pin the hand-checked Case 18 stations exactly. Case 18's plate was verified identical across editions 2026-07-09. |
| 12 | §6B.08 downstream/reopening taper | base.md.j2 NI cone-line step | §6B.08 "Tapers" verified (p. 6B-heading/11): tapers used in transition AND termination areas — the downstream-taper subject is correct. |
| 13 | Fig. 6P-21 / Case 18 corner-extension clause | base.md.j2:51 (`ni_extend_to_corner`) | Same sources as rows 1 and 9. |
| 14 | CO Supplement §6C.04(A) — both-directions signing | audit case_narrative (audit.py:1106-1134) | Inherited literal, same source basis as the live kinds' verified batch (layout.py:399/:1008 comments). The full CO-Supplement re-verification is #70's scope (citation tail, sequenced after this arc) — recorded here, not re-litigated. |
| 15 | Frontend NI panel cite "MUTCD § 6N.12" + fallback "MUTCD § 6N.12; CDOT S-630-1 SHEET 10" | AuditTrail.tsx:1289/:1341 | Subjects verified per rows 5–8/10; the fallback renders only when the backend `source` string is absent. |

## Parked — recorded dispositions, not fixed here (#108 acceptance option b)

These render on NO near_intersection surface; each is explicitly parked on
its own kind's enablement checklist:

- **TA-19 · S-630-3 · "Case 3A"** (AuditTrail.tsx:597; audit.py:1485) — lane_closure_divided. UNVERIFIED, parked.
- **TA-1 · S-630-1 · "Case 1"** (AuditTrail.tsx:677; audit.py:1486) — work_beyond_shoulder. UNVERIFIED, parked.
- **TA-35 · S-630-1 · "Case 4A"** (AuditTrail.tsx:751; audit.py:1487) — mobile_op_2lane. UNVERIFIED, parked.
- **TA-26 · S-630-3 · "Case 4B"** (AuditTrail.tsx:820; audit.py:1488) — mobile_op_multilane. UNVERIFIED, parked.
- **"MUTCD § 6D.01 · WORKER PROTECTION" chips** (AuditTrail.tsx:652/:671) — work_beyond_shoulder panel; #108's own suspicion (likely §6C.04 by subject) stands unresolved, parked with that kind. (#108 body refs :545/:564 — drifted to :652/:671.)
- **§6F.55 / §6F.63 validator literals** (validators.py:750/:785/:809/:881/:914) — Violation citations. With the phase-2 gate these appear in NO user-facing output (error-severity violations fail closed as an internal 5xx; warnings are not rendered) — they remain internal until a kind's enablement verification or the #70/#83 citation tail reaches them.

## Line-ref drift found while verifying

- #108's AuditTrail refs :545/:564 → now :652/:671.
- The 2026-07-30 #117-comment refs :557/:637/:711/:780 → now :597/:677/:751/:820.
