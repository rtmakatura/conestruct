# #456 checkpoint (written before the diff)

Branch `issue-456-map-in-view`, worktree `.claude/worktrees/issue-456`, on `origin/issue-453-prod-check` `2cd6d72` (carries #453's production-check evidence; `origin/main` `24603de` is its ancestor). No park-list item: no money, legal, safety distance, gated scenario or outside service; no device count, spacing or sign placement moves. R145 calls are in rulings.md (M1-M20, M11a and the M9 strip note).

## Baseline (unchanged tree)

- pytest: `3899 passed, 3 skipped`
- vitest: `2929 passed | 1 skipped` (270 files passed, 1 skipped)

## Measured before (local walk on the unchanged tree, Overpass stubbed)

- `.wq-stack` width: 846 px at 1440x900, 1198x930 and 1024x768; 328 px at 390x844.
- 1198x930, the kind question open: the page's own landing scroll sits at y=600; the aerial frame is at -343 to -43 (0 px of it in view). Side question: 35 px of the aerial in view.
- 390x844, the kind question: the page at y=789, aerial 0 px in view; the side question 0 px.
- Answering the side: the box went blank with "Drawing the corridor…" and the new picture came 817 ms (1198x930) / 828 ms (390x844) later (one geometry read, one aerial request; `evidence/walk/before/`).

## The plan

1. **Problem.** The CONFIRM card sits under the aerial (`components/bands/WhereBand.tsx:622-770`, one column), so the band's landing scroll puts the map off screen. Every answer clears the picture (`components/bands/BandAerial.tsx:287-308`: only a zoom step holds) and asks again (`lib/corridor-aerial.ts:84-150`, keyed by the whole scenario even for the pin picture; `lib/corridor-geometry.ts:270-311` re-reads every time). The WHAT row (`lib/scenarios/band-facts.ts:467`) and the Generate hint (`lib/scenarios/rail.ts:150,299-300`) name the kind as unchosen when it is chosen.
2. **Rulings.** Ryan's 1-5 (2026-11-07, verbatim in rulings.md); M1-M15 self-ruled.
3. **Change.** Two columns at a band width of 720 px and up, the aerial left (560 px, sticky); below, a 150 px pinned strip while a question is on screen, with Hide map / Show map, full height for the tap question. The aerial holds its old picture until the new one is decoded; pictures and geometry answers are remembered (the pin picture by pin and frame only); each choice's geometry and picture are loaded ahead when a side or kind question opens. The two strings change in the kind-chosen state only.
4. **Rule 5 churn prediction** (below).
5. **Proof.** A red test first (the status strings, and the answer that asks again for a picture already shown); vitest for each part, mounted where the bug lives (the band and the shell: the answer after a load-ahead asks Mapbox for nothing; a blank box never shows); the local walk at 1440x900, 1198x930, 1024x768, 390x844 and 390x664 with the network log, axe, the 44 px sweep and layout shift. Committed under `validation-artifacts/committed/ux-map-in-view/`.

## Rule 5 churn prediction

Deliberate behaviour changes (each stated):

- **Layout.** At a band width of 720 px and up the WHERE band is two columns while it is open: aerial left, summary row, Edit fold and CONFIRM card right. Below it, while a question is on screen, the aerial is a 150 px strip pinned under the nav (the full-height picture at its own size, `calc(var(--aerial-h) - 2px)`, clipped, so pinning and unpinning ask for no new image; M21, session 2: the first build was 2 px taller and asked for one), with Hide map; the tap question shows it full height. A new `.wq-side` wrapper holds the right-hand column; the `.wq-stack` gains state attributes (`data-aerial`, `data-card`, `data-tap`, `data-map`) inside a new `.wq-wrap` container. CSS only for the breakpoint (container query).
- **The aerial frame** gains an inner `.a-aerial-canvas` (the picture, the ring and the box) so the strip can clip the full-height picture; the frame's measured size is now the canvas's (the same numbers outside the strip). A frame that measures 0 (hidden) keeps its last size instead of falling back to 600x300.
- **Hold.** Any change keeps the old picture until the new one is decoded, with "Drawing the corridor…" as a small line at the bottom-left; a failure or refusal still replaces it. Before: every non-zoom change cleared the picture to the wait note.
- **Caches.** The pin picture is remembered by pin, frame and zoom (fewer aerial requests: a kind answer before the side asks for none). Geometry answers are remembered per scenario (fewer geometry reads) and in-flight reads are shared.
- **Load ahead.** A side or kind question on screen reads each choice's geometry and, if not remembered, its one picture. More geometry reads; Mapbox images: traced in evidence.md.
- **Strings.** WHAT row "Opens after you confirm where" and Generate hint "Confirm where the work is first", only with a kind chosen and WHERE unconfirmed. New `WHERE_BLOCKER` constant; `deriveRail` and `deriveBands` take `kindPicked`.
- **Refactor, no behaviour change:** the sidebar's kind switch moves to `lib/scenarios/kind-switch.ts` so the load-ahead builds the same scenario the click writes.

Files predicted to change: `components/bands/WhereBand.tsx`, `components/bands/BandAerial.tsx`, `components/BandStack.tsx`, `components/GeneratorSidebar.tsx`, `lib/corridor-aerial.ts`, `lib/corridor-geometry.ts`, `lib/scenarios/band-facts.ts`, `lib/scenarios/rail.ts`, `app/globals.css`, new `lib/scenarios/kind-switch.ts`, new `lib/where-load-ahead.ts`; tests: new files for the layout state, hold/cache/load-ahead and the strings, and edits to `lib/scenarios/band-facts.test.ts`, `lib/scenarios/rail.test.ts` and `GeneratorShell.kind-confirm.test.tsx` where they pin the picked-state strings (expected: only assertions in the picked state move).

Byte-identical: the backend (no `src/` change, so no pytest snapshot moves); every PDF, XLSX and audit surface; the scenario wire (no new field); `KIND_BLOCKER`'s string and every other rail rank; the WHAT row in its other states; #440 and #446's tap, bar, ring, box, label and scroll code (repair 1: the ✓ row's scroll margin no longer changes either; the tap question's map is unpinned, M8 amended); the picker modal.

## Actual churn (after the diff)

Matches the prediction, with these additions (each stated):

- `lib/scenarios/kind-switch.ts` is new as predicted; `lib/where-load-ahead.ts` was **not** needed: the load-ahead lives in `BandAerial` (it needs the frame's measured size) and the choice scenarios are built in `WhereBand`.
- Not predicted: `lib/design/type-exceptions.ts` and `lib/design/type-census.test.ts` (the census entry for the new toggle font-size site, M16; found by full run 1); `vitest.config.ts` and new `vitest.setup.ts` (cache reset per test, M17); `components/bands/BandAerial.test.tsx` (two tests asserted the old blank box: rewritten to the ruled hold, Rule 5) and `components/bands/WhereBand.kind-proposal.test.tsx` (it asserted every geometry request carries the plan's kind; load-ahead reads carry each choice's kind, so it now asserts the choice itself).
- `lib/scenarios/band-facts.test.ts`, `rail.test.ts` and `GeneratorShell.kind-confirm.test.tsx` did not move (they pin the not-chosen state, which is unchanged).
- New tests: `lib/where-map-in-view.test.ts` (8), `components/bands/WhereBand.map-in-view.test.tsx` (2).
- Backend, PDFs, XLSX, audit, wire: byte-identical (no `src/` change).
- Repair 1 (independent reviewer): `WhereQuestions.tsx` (`CROSS_WHY`, M18) and `GeneratorShell.cross-street-tap.test.tsx` (its pinned copy), both not predicted; `WhereBand.tsx` (`mapHiddenNow`, M19) and one more test; `globals.css` (the held line stays in the strip; the tap question's map unpinned, M8 amended; the M8 scroll-margin rule removed); `WhereBand.tsx` also brings the tap question's map into view when it opens (re-walk finding).
- Repair 2: `BandAerial.tsx` (`shown` follows any picture on screen, M20); `BandAerial.test.tsx` (+2 mid-load tests); `WhereBand.map-in-view.test.tsx` (+1 kind load-ahead test). No other file.
