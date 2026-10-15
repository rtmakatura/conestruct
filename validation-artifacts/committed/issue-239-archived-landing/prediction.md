# Rule 5 prediction: issue-239-archived-landing (written before any code)

Base: `issue-208-mypy-ratchet` at `b62d3e37` (stacked; #208 touches no site file).

## Deleted (11 files)

`app/(archived)/landing/page.tsx` and its ten components: `components/{Nav,SheetMeta,Hero,DimStrip,MathSection,FinalCTA,Footer,PlanSheet,ScenarioCard,TaperViz}.tsx`.

## What changes

- **Nothing served changes.** The page has been unreachable since `07777c8` (`/landing` redirects to `/`, 307), and the redirect stays. `/`, `/terms`, `/privacy`, `/404` and `/sandbox` are untouched.
- **Type census (`lib/design/type-exceptions.ts`):** 29 Tailwind size rows leave, across 9 files (FinalCTA 4, Footer 1, Hero 5, MathSection 8, Nav 4, PlanSheet 3, ScenarioCard 2, DimStrip 1, SheetMeta 1), carrying 48 uses. `CENSUS_PINS`:
  - `tsxSites` 86 → 57
  - `tsxUses` 252 → 204
  - `tsxFiles` 34 → 25
  - `cssDeclarations` 131 and `cssSizes` 24 unchanged
- **Ink census (`lib/design/ink-exceptions.ts`):** the two decorative rows leave (TaperViz 18 literals, PlanSheet 36). The scanner's sentinel test, which read TaperViz's 18, moves to `components/LocationPickerModal.tsx`'s 4. The "TaperViz and PlanSheet declare themselves decorative" test becomes a check that no decorative row remains, since only these two files had one.
- **`middleware.test.ts`:** the `/landing` row stays as a default-deny row (`file: ""`), so the gate's answer for the path is still pinned without naming a deleted file.
- **Comments that pointed at the page** (`next.config.mjs`, `lib/redirects.test.ts`, `lib/feature-flags.ts`, `README.md`, `DESIGN-SPACING.md:326`) are updated to say it was deleted under #239, and where git keeps it.
- **Tests:** `vitest run lib/design lib/redirects.test.ts middleware.test.ts` green; full site suite green, its count down by nothing (none of the deleted components has a test file).
- **Ship:** frontend-only. The prod check: `/landing` answers 307 to `/`, and `/` renders.
