# Rule 5 prediction: `r126-step2-layout` (R126's layout items; R127 Q4–Q6)

Written 2026-10-11, before any code on `r126-step2-layout` (off main `4d508e8`, where
`r126-speed-guess` shipped). Lane: normal, `frontend-only: yes`: labels, markers and the footer;
no wire field, no backend. Authority: `rulings.md` (R126, R127), the mockup `design-refs/SpeedD3.dc.html`.

## Deliberate changes (all on the WHAT band, plus Q6's two labels)

1. **Labels (R126, R127 Q4, Q6):**
   - **WHAT:** "Speed limit" → "Speed"; "Divided highway" → "Carriageway" (the existing Undivided /
     Divided control is unchanged, R127 Q0).
   - **The road-type option** `urban_arterial` reads "Urban street" wherever it is shown: WHAT's
     select (`what-cells.ts`), the detection clause and handoff-note labels (`detected-rows.ts`,
     `HandoffNotes.tsx`) and the Setup box value (`band-facts.ts`). The wire enum stays
     `urban_arterial`.
   - **Q6:** the Setup box link ("Change Speed limit" → "Change Speed") and the revision band's
     label say "Speed".
   - **Not renamed:** the gated kinds' legacy forms, the audit's math section and the crew sheet.
     R126 names Step 2, and Q6 the Setup box and the revision band.
2. **One marker per row (R126):** Lanes shows one marker, the lane count's. The width's "✓ default"
   / "✓ yours" line moves into the row's details, where it is still stated and no longer marked.
3. **No "i about" (R126):**
   - The Carriageway (divided) row's line becomes "default · undivided until you say otherwise"
     (marker "✓ default") or "your change · operator-set from here on" ("✓ yours").
   - "Yours" is read as R110 Q8's `defaultOrYours` does: a value away from the default is the
     operator's.
   - No WHAT row reaches the marker's "about" fallback any more.
4. **The windows fold into the footer (R126, R127 Q5):**
   - One line, beside File details: "Denver windows · …", in the windows check's own words.
   - The line is a control that opens the full table under the footer. The table is today's block,
     unchanged.
   - Proposed strings, from the existing per-row verdict (`ScheduleField.rowVerdict`) for the
     active street-class row:

     | State | Line |
     |---|---|
     | no dates | "Denver windows · set dates to check" (D3, verbatim) |
     | the check in flight | "Denver windows · ◌ checking your dates" |
     | inside | "Denver windows · ✓ fits your dates" (R127 Q5's example) |
     | a ban overlap | "Denver windows · ⚠ 2 h overlaps the 07:00–09:00 ban" (the backend's violation facts, as the row words them today) |
     | outside a permitted window | "Denver windows · ⚠ 3 h outside the permitted 09:00–15:00 window" |
     | no jurisdiction | "Windows · select a jurisdiction to check" |
     | block not loaded | "Windows · ◌ loading" |
     | none published | "Denver windows · ◌ none published" |

   - File details' head shortens to D3's "File details · ◌ 2 not set". The field names stay inside
     its opened panel.
5. **Header:** speed is already counted (`r126-speed-guess`); no change.
6. **D3 vs R110 Q8:** D3 shows no marker on Hours or Speed reduction, while R110 Q8 ruled "✓
   default" on both. D3 is WhatC5 with R126's changes (R127 Q0), and WhatC5 predates R110 Q8, so
   **the markers stay** (R110 Q8 is the later ruling on those rows). Flagged in the report.

## Not changing

- No wire field, no payload, no backend, no deliverable.
- Every value and every guess, which rows exist, and their order.
- The windows table's content and verdicts (only where it sits and how it opens).

## Predicted test churn

| Area | Files | Rough count |
|---|---|---|
| "Speed limit" label in WHAT, band-facts, revision | `WhatBand.declutter`, `spacing-scale`, `GeneratorShell.value-links`, `ResultsHead.grid`, `band-facts.test`, `revision.test`, `site-corrections.test`, `GeneratorShell.batch-corrections`, `GeneratorShell.disclosures` | about 15 assertions |
| "Urban arterial" display | `ResultsHead.grid`, `WhatBand.density`, `WhatBand.detection`, `DetectedVsApplied.lanes`, `provenance.test`, `provenance-marker.test` | about 10 |
| Lanes' second marker / "✓ default" | `WhatBand.declutter`, `WhatBand.detection`, `WhatBand.every-kind`, `PlanDetails.test` | about 10 |
| "median present" / "about" | `provenance-marker.test` (the about case stays, as a unit of `markerOf`) | 1 |
| Windows block placement | `ScheduleField.windows-block` (6), `GeneratorShell.class-stability` (about 7: the table is now behind the footer line) | about 13 |
| File details head | `WhatBand.declutter` | about 2 |
| New | the footer line's states (8 above), one marker per row, no "about" on any WHAT row, the Q6 labels | about 12 |

**Lane:** frontend-only; screenshots at 1440 and 390 on N Cherry St and N Broadway SB, laid beside
D3.
