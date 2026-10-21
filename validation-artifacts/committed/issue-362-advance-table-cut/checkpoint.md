# #362 checkpoint — page 1 cuts W20-1 and the W3-5 steps

Branch `issue-362-advance-table-cut`, built on #363's evidence `06503fe`.

## What the probe found (`probes/probe362.py`, output `probes/probe-06503fe.txt`)

150 reduced-speed shoulder plans (#363's 96-plan grid plus large step-downs; 18 more are HTTP 400, divided roads with 200 ft of work). **2 of 150 cut rows on page 1**: freeway 75 → 40 at 1000 ft and at 5000 ft. Every other table fits.

Freeway 75 → 40, 1000 ft: 17 rows, two columns, page 1 draws 13.

| # | Code | Distance | Drawn today |
|---|------|----------|-------------|
| 1–2 | G20-5P, R2-6P | 500 ft | yes |
| 3–4 | W21-5aR, W7-3a | 1000 ft | yes |
| 5–6 | G20-5P, R2-6P | 1500 ft | yes |
| 7–8 | W21-5aR, W16-2a | 2000 ft | yes |
| 9–10 | G20-5P, R2-6P | 2500 ft | yes |
| 11–12 | R2-1, G20-5P | 3000 ft | yes |
| 13 | R2-10 | 3500 ft | yes |
| 14–16 | W3-5 ×3 | 4030 / 4560 / 5090 ft | **cut** |
| 17 | W20-1 | 5200 ft | **cut** |

7 of the 17 rows are plaques. The fit loop (`src/rendering/plan_sheet.py:4134-4147`) cuts from the end of the closest-first list, so the farthest signs go: W20-1 and every W3-5.

## Options

- **(a) Cut plaque rows first** — recommended. Plaques go before any warning or regulatory sign, a whole distance at a time, farthest first. On this plan that cuts the plaques at 3000, 2500 and 1500 ft (5 rows), so page 1 draws 12: all 10 signs plus the plaque pair at 500 ft. The line reads `+5 MORE ADVANCE SIGNS (G20-5P, R2-6P). SEE CREW NARRATIVE & DEVICE LIST` — the existing wording and the #235 code list, no new copy (the table's title already counts its plaque rows as "ADVANCE WARNING SIGNS"). Only plans that cut today change. If a table still doesn't fit with every plaque gone, the signs are cut from the end as now.
  - Why a whole distance: cutting exactly 4 would split the 1500 ft pair (G20-5P drawn, R2-6P cut), and a crew would read a lone WORK ZONE plaque.
- **(b) Collapse each G20-5P / R2-6P pair into one row.** Saves 3 rows: 14, still one over, so W20-1 is cut. It misses the acceptance alone, changes the row text on every plan that has filled plaques (not just the 2 that cut), and needs new description copy.
- **(c) A third column or a tighter pitch.** Needs a ruling against R117 Q3c's spacing; not recommended for 2 plans.

## Rule 5 prediction for (a)

- Plan PDF page 1 text changes on the 2 cut plans only (the drawn rows and the "+N MORE" line). The other 148 plan PDFs are byte-identical, as are every audit, audit PDF, crew sheet and XLSX (none of them reads the page-1 cap).
- `tests/test_r117_pdf_notes.py::test_case_27_keeps_its_four_two_column_rows` changes its expectation (13 → 12 rows, `+5 MORE ADVANCE SIGNS (G20-5P, R2-6P`). New tests: W20-1, every W3-5 and R2-10 are on page 1 on this plan; a fit-today plan's page 1 is unchanged.
- The branch carries #363's evidence commit `06503fe`.

## Why this stops

The issue defers the choice to a design conversation, and the cut order is new design direction for the crew's page 1 (R145 stop reason). Ryan's call: (a) as written, (a) with a different plaque order, (b), or (c).
