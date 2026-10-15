# Rule 5 outcome: issue-239-archived-landing

Prediction: `prediction.md`, committed in `b240d136` before any code. Base: `b62d3e37` (#208's tip).

| Predicted | Outcome |
|---|---|
| 11 files deleted (the page and ten page-only components) | 11 deleted: `app/(archived)/landing/page.tsx` and `components/{Nav,SheetMeta,Hero,DimStrip,MathSection,FinalCTA,Footer,PlanSheet,ScenarioCard,TaperViz}.tsx` |
| type census: 29 rows leave; `tsxSites` 86 → 57, `tsxUses` 252 → 204, `tsxFiles` 34 → 25; CSS figures unchanged | 29 rows removed; `CENSUS_PINS` restated to those values, and `type-census.test.ts` ("CENSUS_PINS equal the figures read from the sources") passes, so the scanner reads the same numbers from the tree |
| ink census: TaperViz (18) and PlanSheet (36) rows leave; the sentinel moves to LocationPickerModal (4); the decorative test becomes "none remains" | as predicted; `ink-literals.test.ts` 16/16 |
| `/landing` row in `middleware.test.ts` becomes default-deny | `{ path: "/landing", method: "GET", file: "" }`; 331/331 |
| the 307 redirect stays | `lib/redirects.test.ts`: "/landing redirects to / as a 307" passes |
| comments updated (`next.config.mjs`, `lib/redirects.test.ts`, `lib/feature-flags.ts`, `README.md`, `DESIGN-SPACING.md`) | done; each names #239 and where git keeps the page (`4c52c492`) |
| full site suite green, no test file deleted | `vitest run`: 2252 passed (the deleted components had no tests); `tsc --noEmit` clean; `next lint` shows only the existing `react-hooks/exhaustive-deps` warning |
| nothing served changes | no route file other than the unreachable page changed; checked on prod after the ship |

Measured before deleting: none of the ten components had an importer outside the page and each other (`grep` over `conestruct/site` and `scripts/`). PlanSheet, ScenarioCard and TaperViz were imported only by Hero and MathSection.

`globals.css` rules that only these components used were left in place (rulings.md 4).
