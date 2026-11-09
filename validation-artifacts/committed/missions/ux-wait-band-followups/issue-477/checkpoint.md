# #477 checkpoint: the plan and the Rule 5 prediction (written before the diff)

Baseline on `a239a0e` (this worktree): vitest `2989 passed | 1 skipped`. Backend not touched, so no pytest.

## The plan

1. **The problem.** #470 left ten open questions; Ryan answered them on 2026-11-09 (#477). The code they touch: the NEEDS YOU reserve `--ro-needs-h` 1025 / 1135 (`app/globals.css`, #470 block), sized to the 3-question card; `WaitLine`'s "Step 1 of 1" and bar (`components/StatusBar.tsx:299-318`); `WAIT_ROAD_SLOW` (`StatusBar.tsx:291`); the blank `.nyq-map-frame` while `/api/needs-you-map` loads (`components/NeedsYouMap.tsx:84-127`); raw px in the #470 block; the #152 E settle scroll (`components/GeneratorShell.tsx:1212-1290`).
2. **The rulings.** Ryan's answers 1-7 (rulings.md, verbatim). Self-rulings R145-1 to R145-7.
3. **The change.** Answers 1-6 as rulings.md says; the permanent check fails on an outline left after the settle and on the one-question fixture's tops (it now comes in at the reserve).
4. **Rule 5 churn prediction** (below).
5. **The proof.** Red-proved vitest (StatusBar, generate-wait, NeedsYouMap, post-generate-scroll); affected vitest then the full run; the permanent check against the stub at 1440/1198/390 for the recorded (3-question), signals (1 question) and empty (no question) scans, plus `REDUCED=1`; a slow pass (`HOLD_MS=16000`) for the 14 s line's height; axe 0 and the 44 px measure. All in this folder.

## Rule 5: predicted churn

**Changes:**
- `conestruct/site/components/StatusBar.tsx`: `WaitLine` loses the count and bar spans; `WAIT_ROAD_SLOW` is Ryan's sentence; comments.
- `conestruct/site/components/ResultsOutline.tsx`: the map placeholder's aerial-or-grey block and sheen move into an exported `OutlineAerial`; the outline's markup is byte-identical.
- `conestruct/site/components/NeedsYouMap.tsx`: `OutlineAerial` in the frame while no map is shown and none failed.
- `conestruct/site/components/GeneratorShell.tsx`: the settle's `scrollIntoView` (post and declined) and the landing check go (`landingRef`, the `armLandingCheck` import and re-export, its `settle()` and `cancel()`); focus at the settle stays; comments.
- `conestruct/site/app/globals.css`, #470 block only: `--ro-needs-h` 934 / 1082; the six raw values per R145-4; the count, bar and bar-run rules and their reduced-motion entries removed; the 600 px count rules removed.
- Tests: `StatusBar.test.tsx` (no count), `GeneratorShell.generate-wait.test.tsx` (no bar or count, the 14 s line, the settle adds no scroll, the reserve), `NeedsYouMap.test.tsx` (the stand-in), `GeneratorShell.post-generate-scroll.test.tsx` (the #152 E cases now pin no settle scroll and the focus; the `armLandingCheck` unit cases import from `@/lib/landing`). Possibly `StatusBar.a11y.test.tsx` and `GeneratorShell.a11y-focus.test.tsx` if they count settle scrolls.
- `scripts/verify-generate-cls.mjs`: an outline-left check, comments for the one-question reserve.
- Evidence: this folder.

**Amendment (before its diff, R154 fold test, rulings.md R145-8):** `globals.css` `--ro-dl-h` 340 → 359 at desktop (one line). The first walk found the settled Downloads 19 px taller than its outline at 1440 and 1198 on both question fixtures, on this branch and on the base sources alike (`walk/probe-downloads.txt`): its "These files match the plan before your answer…" row is in every answer with a question. With the one-question reserve that leaves the reference group 17 px low and fails the outline check. 390 measured 0 and stays 283. The generate-wait CSS test gains the value.

**Repair cycle 1 (before its diff):** R145-8 is withdrawn: `--ro-dl-h` goes back to 340 and its test line goes (the re-walk measured 340; rulings.md R145-8). `scripts/verify-generate-cls.mjs` relabels its `.nyq-card` count "visible question card(s)" (the card shows one question at a time). Docs: rulings.md R145-6, R145-7; evidence.md.

**Byte-identical:** the backend and every request body; device counts, spacing and placement in the plan; the settled sections' markup (NEEDS YOU's frame differs only before its map loads); WorkingBand; BandStack and its landing; `lib/corridor-aerial.ts` (`shownAerialFor` already exists; no change needed); `lib/landing.ts`.
