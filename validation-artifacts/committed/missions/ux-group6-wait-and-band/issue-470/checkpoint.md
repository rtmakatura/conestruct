# #470 checkpoint (written before the diff)

Branch `issue-470-generate-wait` off `origin/mission-466-prod-check` (385b6c0). No park item hit, so no stop (R145).

## The trace (what the page waits on after Generate)

- **One call.** `GeneratorShell.tsx:525-651` (base 385b6c0): after Generate the wire scenario carries `site_scan`, and one `POST /api/render/audit` with `include_breakdown` and `include_scan_token` goes out (the code comment at `GeneratorShell.tsx:529` (branch; 517 on base): "one Generate, one request, one scan"; #306: "Generate sends one request, so it runs one scan (R64/R65)"). The backend runs the Overpass road scan, the layout, the MUTCD/jurisdiction check and the device list inside that one request (`src/api/site_scan.py:14-23`, `:897`). The page can't see where one ends and the next starts.
- **That one answer fills every section:** the strip (`StatusBar`, `stripAudit`), NEEDS YOU and "N other conditions checked" (`needsYouScan` = `sections.site_scan`), Setup (`ResultsHead`, the scenario), Your plan (`ResultsHero`, `breakdown`), Downloads (`OutputCards`, `breakdown`) and the search and reference sections (`ReferenceSections`, the audit ledger). They all swap at the same moment.
- **After it:** `POST /api/needs-you-map` (the NEEDS YOU picture) fires only once a question with a map has mounted, inside its own fixed-size frame. The quote waits for the operator to open it. Neither one is a step the status line waits on.
- **Timings:**
  - A warm check measures 0.5–0.7 s and a Modal cold start about 5.5 s (`GeneratorShell.tsx:138-145`, base; 140-147 on the branch).
  - Warm production Generates with the scan, in the browser: 4.7 s (`s2-arc18-corrections/README.md:254`), 4.8 s and 6.2 s (`s2-arc19-correction-controls/README.md:185`), 5.6 s (`s2-arc17-counted-conditions/README.md:182`), 5.7 s (`s2-arc18-corrections/README.md:218`) and 8.4 s (`s2-arc18-corrections/README.md:117`).
  - The 12–22.8 s figures in s2-arc31-scan-budget predate #256. They included the corridor check's own 20 s budget, so they don't stand for today's scan alone.
  - The scan budget is 20 s (`SCAN_BUDGET_S`, `site_scan.py:73`). Locally (stubbed) the audit answers in about 0.2 s.
- **The shift (#452), reproduced locally** (walk470.mjs, audit held 4 s): 0.554 at 1440, 0.344 at 1198, 0.866 at 390 on Generate; 0.383, 0.559 and 0.771 on the answer. These match #452's production numbers (0.55 / 0.87; 0.39 / 0.77). The setup zone, `section.zone`, holds the locked band stack (Where / What's the job? / Generate, 200 px) through the whole wait and collapses to 8 px when the plan lands. Per width (from `walk/before/summary.txt`):
  - **1440:** the largest entry is 0.5518, `section.zone` moving 371 → 145 (226 px).
  - **1198:** the largest is 0.2342, `div.results-disc` with the footer and the draft notice. `section.zone`'s entry is 0.1077.
  - **390:** the largest is 0.8655, `section.zone` moving 446 → 74 (372 px). The 02 · RESULTS placeholder swapping for the real stack is the rest.

## Plan (5 bullets)

1. **The problem:** `GeneratorShell.tsx:1909` (base) keeps the locked band stack mounted while `genState === "generating"`, and it unmounts at the settle. `:2133` (base) shows a small placeholder where the stack will be. Both move the plan after the press (P1).
2. **Rulings:** Part 1 rulings 1–9 (Ryan, 2026-11-08, quoted in rulings.md). Calls are in rulings.md as R145 self-ruled.
3. **The change:**
   - The setup zone empties at the press. The band stack shows only in `pre` or while revising.
   - `ResultsOutline` replaces the placeholder in two parts around `ResultsHead`'s reserved row: NEEDS YOU (with the WHERE aerial dimmed, a sheen and "Checking this stretch of road"), the other-conditions row, Your plan and Downloads, each at a reserved height.
   - StatusBar's empty band-voice slot gets the status line: spinner, one step, "Step 1 of 1", a bar, the 2 s cold-start sentence and the 14 s warn.
   - CSS for the sheen (1.4 s), the 420 ms / 6 px arrival and reduced motion, with tokens only.
   - A pin-keyed lookup for the last aerial (`lib/corridor-aerial.ts`).
   - "Finish without it" stays out (rulings.md). Ruling 7 (backend deltas) is parked and filed.
4. **Rule 5 churn prediction:**
   - **Changes:**
     - During a generated flight the band stack is no longer on screen.
     - The "02 · RESULTS / No package yet. The plan is being built." placeholder is deleted and replaced by the outline.
     - The strip's slot shows the status line instead of nothing while an audit for the generated plan is in flight. That includes a re-build after an answer, which today also leaves it empty.
     - Sections fade in on mount.
     - Tests that pin the placeholder change: `GeneratorShell.scan-wire.test.tsx:349-372`, `GeneratorShell.regenerate-mounted.test.tsx:133` and `GeneratorShell.scan-refusal.test.tsx:281` if it reads the placeholder. So do tests that expect the band stack during the flight, if any (found by the full run, listed in evidence.md).
   - **Byte-identical:**
     - Every request body, the audit and breakdown fetch effect, every device count and the backend. No Python changes.
     - The verdict strip's settled branches, the WorkingBand, the pre-Generate column, the refusal container and the regenerate stale dim.
     - The draft notice, the downloads and every settled section's markup.
5. **The proof:**
   - `GeneratorShell.generate-wait.test.tsx` (mounted flow plus a CSS pin). It was red before the build: red-vitest.txt, 5 of 6 failing; the no-hex case is vacuously green on an empty block.
   - The affected and full vitest runs, and tsc.
   - `walk470.mjs` at 1440x900, 1198x930 and 390x844: CLS before and after, frames, the slow step forced, reduced motion, an answer, axe and the 44 px measure.
   - The device counts compared before and after from the walk's Your plan text at the same inputs.
   - Everything is committed under this folder.

## Repair cycle 1 (diff-verifier REPAIR, reviewer FAIL): churn added before the diff

- **A:** an APPLY from the S7 column keeps today's locked stack for its own flight (R145-10). Unmounting the column mid-flight dropped the repeat announcement in `GeneratorShell.a11y-announce.test.tsx` 3 of 6 runs. Restoring the stack for that flight alone made it pass every run. The first Generate and the NEEDS YOU Apply still empty the setup zone.
- **B:**
  - Under the outline, ResultsHead's reserved row and the search and reference group are not mounted. Setup and the reference group get outline blocks instead (`--setup-box-h` and `--ro-refs-h` 257 / 284, CHOSEN and measured).
  - Nothing that stands through the wait sits among the outlines.
  - The stub gains `WALK_SCAN_MODE=empty|signals`, for the no-question and ledger-only fixtures.
- **C:** the press scrolls the strip's slot into view (`window.scrollTo`, scroll only, R145-11). Focus and the settle's landing are unchanged, and #152 E's and #193's pins pass as written.
- **D:** `scripts/verify-generate-cls.mjs` and `scripts/verify-generate-cls-stub.py`, the permanent check.
- **E:** the label "Checking this stretch of road" gets a `--panel-ground` chip.
- **F:** the slow note reads "The road check stops after 20 seconds. If it does, the page will say so and offer a retry."
- **Tests:**
  - `generate-wait` is updated: the outline's order now includes setup and refs, and there's a new case for the press scroll.
  - No other pin changes.

## Repair cycle 2 (diff-verifier PASS, reviewer FAIL): churn

Written while the cycle's first code edits were in progress, not before them. Recorded as it happened.

1. **Reduced motion:** the reset now uses the animated selectors verbatim (`.status-slot > .status-bar:not(.wait-line)`, `.wait-bar-run`), so it wins at equal specificity. The selector-string test is replaced by a cascade test (every animated selector has a later reset with the same selector). It's red-proved in `red-vitest-cycle2.txt`. The permanent check's reduced pass also asserts `animation-name: none` on 6 settled elements, not Setup.
2. **The permanent check:** adds an outline-vs-settled box comparison with an 8 px tolerance (CHOSEN, `--space-tight`) and a `REDUCED=1` pass.
3. **The map placeholder:** takes the real frame's CSS size (2 / 1 inside the card's padding and border; 4 / 3 at 480 px and below) and a measured top (`--ro-map-top` 157 / 221, CHOSEN). The reference group's outline sits 38 px under Downloads (measured).
4. **The race:** not isolated; filed as #475.
5. **The stale comment** at the outline mount is fixed.
6. **`shownForPin`:** now written in an effect, called before any return so hook order is kept.
