# Rule 5 outcome: `phase4-floor-320` (Phase 4 branch 4, R143)

Prediction: `prediction.md` (committed `daa4b4b`, before any change). Before = production at
`aeaced4` (main). After = the Vercel Preview of `4849c94` (this branch's tip), which runs on the
production backend, so both sides plan the same road with the same data. Probes: `sizes143.cjs`
(results with every disclosure open) and `scripts/verify-phone-fit.cjs` (every stage).

## The fit check, every stage (page scroll width; ✗ = scrolls sideways)

| Stage | before 320 | before 360 | after 320 | after 360 |
|---|---|---|---|---|
| empty | 320 | 360 | 320 | 360 |
| picker | 320 | 360 | 320 | 360 |
| picker-moved | 320 | 360 | 320 | 360 |
| where | 320 | 360 | 320 | 360 |
| what-shoulder | 320 | 360 | 320 | 360 |
| results | 334 ✗ | 360 | 320 | 360 |
| what-flagger | 320 | 360 | 320 | 360 |
| what-near | 320 | 360 | 320 | 360 |

Before: `FIT CHECK FAILED: 320 results` (the audit row's chevron at 334). After: `FIT CHECK PASSED
at 320 and 360 px`.

## Sizes, results with every disclosure open

| | 320 before | 320 after | 360 before | 360 after |
|---|---|---|---|---|
| Page scroll width | **334** | **320** | 360 | 360 |
| Audit rows: cite under the title | 0 of 5 | 5 of 5 | 0 of 5 | 5 of 5 |
| Audit row heights (px) | 96/91.5/96/91.5/132 | 110/110/128/110/146 | 91.5/91.5/96/91.5/132 | 87.5/87.5/110/87.5/105.5 |
| Pricing inputs (8) | 123 × 37.5 | **123 × 44** | 143 × 37.5 | **143 × 44** |
| Download Quote (XLSX) | 258 × 43.5 | **258 × 44** | 298 × 43.5 | **298 × 44** |
| Preview breakdown | 258 × 45.5 | 258 × 45.5 | 298 × 45.5 | 298 × 45.5 |

## Prediction vs. outcome

| Predicted | Outcome |
|---|---|
| 320 results: page 320 (was 334) | ✓ 320; the fit check passes every stage at 320 and 360 |
| The cite drops under the title; number, title, result, chevron stay on the first row | **Changed during the build.** With only the cite moved, long results ("22 devices · 30/60 ft o.c.", "Case 11: Shoulder closure on one-way street") squeezed the title's column narrower than its words, and title and result overlapped at 320. The result drops too: the title has the row, then the result, then the cite (`after/audit-320.png`). |
| 360: unchanged fit; rows taller where the cite wrapped | ✓ 360 fits; rows 87.5–110 px (were 91.5–132), shorter because the title no longer shares its row |
| Pricing inputs 38 → 44; Download ≥ 44 | ✓ 37.5 → 44; 43.5 → 44 (both widths) |
| 1440 unchanged | Every rule this branch adds is inside `@media (max-width: 480px)` (guarded by `components/floor-320.test.ts`); not re-measured at 1440 |

The build also found that a site test reading `scripts/verify-phone-fit.cjs` would make it a
Vercel build input (`tests/build-inputs.test.ts`); the guard reads DESIGN-SPACING.md, which names
the script, instead.
