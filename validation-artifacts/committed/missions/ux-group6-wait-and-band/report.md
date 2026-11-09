# Mission ux-group6-wait-and-band (tracking #471)

Prompt: `cc-prompt-ux-group6-wait-and-band.md` (Ryan, 2026-11-08). Base: `mission-466-prod-check` `385b6c0`. Run 2026-11-09.

## Questions for Ryan

### #469 (Part 2, the WHERE band), PARKED: what happens when Details opens on the kind question?
With Details closed, the band is the same height (762.5 px, 0 px change) in all 16 CONFIRM states at 1440 and 1198. The action row is pinned to the card's bottom at 835.5 in every state. The 390 strip is unchanged. Opening Details on the kind question is the one case the rulings don't settle:
- (a) Repair 1: the action row stays pinned and the Details text opens about 141 px above its link. The band still grows +27 / +72 px.
- (d) Current build: the action row returns to the normal flow while Details is open. The text opens under its link, but the link and Next question jump 114.2 px up, and the band grows +3 / +48 px. That misses P1's "a control that appears on click appears in room that was already allocated", and narrows rulings 1 and 4.
- **(b) Recommended:** count the open Details text in the band's height trace. `--wq-band-h` becomes about 721 px (band about 835.5 px on every state, about 73 px taller than now). The link stays pinned, the text opens in reserved room, and nothing moves anywhere. This is the literal reading of ruling 1 and P1.

Parked after two code repair cycles. Work uncommitted in `.claude/worktrees/issue-469`, branch `issue-469-band-one-height`, base `385b6c0`. Draft commit message at `C:/Users/rtmak/AppData/Local/Temp/claude/556f937a78fa2516/2b7d6e18-faf6-4fb4-9242-b655236adf5f/scratchpad/commit-469.txt` (scratchpad; `checkpoint.md` in the worktree names it). Open gate finding: the third independent review's B4b finding, above. Its write-up findings are fixed.

### #470 (Part 1, the Generate wait), shipped-ready, with 10 open questions
Each one is in `issue-470/evidence.md` § Open questions and in the commit message.
1. **NEEDS YOU reserve.** NEEDS YOU's size isn't known before the call returns. On one question the sections land 89 px higher than their outlines (50–52 at 390). On an empty scan they land up to 954 px higher (1052 at 390). Layout shift reads 0 only because the sections mount new at the swap. How much room should the outline hold?
2. **The bar is an indeterminate sheen.** The page observes one step, so there's no real fraction to show, and #281 rule 14 bans indeterminate progress. Keep the bar, drop it, or add a backend progress signal?
3. **The 14 s road-slow threshold** (CHOSEN): cold scanned audits of 12.2 s (cause unknown) and 26.5 s (which included the old corridor check) are on record.
4. **Ruling 7 deferred to #474.** The backend sends no deltas or reasons today. The answer still shifts the page 0.2465 / 0.3606 / 0.6427 (was 0.3829 / 0.5591 / 0.7711).
5. **Blank map frame.** Right after the swap the NEEDS YOU map frame is blank and dark until `/api/needs-you-map` lands.
6. **Ruling 9.** Six raw px spacing values in the #470 CSS (14, 38, 10, 24, 12, 16) sit outside the spacing tokens. Do they count as ruled sizes?
7. **R145-10.** An Apply from the S7 column on a re-build keeps the old band-stack swap, with its shift unmeasured, until #475's race is found.
8. **R145-11.** The press now scrolls the strip's slot into view, which leaves #152 E's settle scroll nothing to do.
9. **R145-15.** The spinner's 0.9 s turn is CHOSEN, taken from the board.
10. **#452.** Ruling 8 says "(closes #452)". This branch does not close it: the after-answer shift is via #474, and the production measurement is still pending. Close #452 now, or keep it open?

Also confirm at the hand check: R145-2 drops the locked band stack (#281 §2.4 State 4, rule 117) at the Generate press, on the basis of your 2026-11-08 board, which draws none.

## Ready to ship
- Top branch: `issue-470-generate-wait` `ff7b9a26` (plus this report's commit on top).
- Chain: `385b6c0` (`mission-466-prod-check`, pending evidence, contains main `69d7cc0`) → `ff7b9a26` #470.
- #469 is not in the chain (parked).

## Filed
- #469 WHERE band height: https://github.com/rtmakatura/conestruct/issues/469
- #470 Generate wait: https://github.com/rtmakatura/conestruct/issues/470
- #471 tracking: https://github.com/rtmakatura/conestruct/issues/471
- #472 no CI check measures layout (Playwright in CI is your call): https://github.com/rtmakatura/conestruct/issues/472
- #473 "Finish without it" needs a no-scan path that still asks every question: https://github.com/rtmakatura/conestruct/issues/473
- #474 ruling 7, backend deltas and reasons, and the answer shift: https://github.com/rtmakatura/conestruct/issues/474
- #475 S7-column Apply race in the announce test: https://github.com/rtmakatura/conestruct/issues/475

## Calls I made
- **#469:** B1–B8 in `issue-469/rulings.md`. The band is 648 px (CHOSEN, from the tallest question at 647.8). The action row is pinned at the card's own inset. B4a's focus order was ruled acceptable under WCAG 2.4.3. B5 was withdrawn.
- **Orchestrator, #469 B4b:** I chose option (d) in repair 2. Review then showed it narrows rulings 1 and 4, so the item parks.
- **#470:** R145-1–R145-15 in `issue-470/rulings.md`. The main ones:
  - one status-line step, "Step 1 of 1", because one `POST /api/render/audit` call fills every section;
  - the band stack leaves at the press (R145-2);
  - every section is an outline block, and the real sections mount at the swap;
  - the press scrolls the strip's slot into view;
  - the label sits on a `--panel-ground` chip (11.18:1; on the bare aerial it was 3.0:1);
  - "Finish without it" is left out (#473).
- **Orchestrator:** a lint-only fix to `scripts/verify-generate-cls-stub.py` (the pre-commit ruff hook flagged two lines over 100 characters; one docstring line wrapped, and ruff format reformatted the other). It is not a code path for the verdict marker.

## Flakes
- `GeneratorShell.a11y-announce.test.tsx > clears at the click so a repeat Generate with identical counts re-announces` failed 3 of 6 runs on the first #470 build and passed 6 of 6 on the base. After the R145-10 fix: 10 of 10, then 6 of 6 (twice). The race isn't isolated: #475.
- #470's first full vitest run had 20 failures, saved to `issue-470/full-run-1-failures.txt`. Its second had 8, saved to `full-run-2-failures.txt`, and all 8 failed again on their own, so none was flaky. Each was a real failure from the change, resolved as recorded in `issue-470/tests.txt`.

## Per item

### #469 WHERE band keeps one height (PARKED)
- **Change:** CSS only, the #456 block of `globals.css` (+50/-1), plus one new test, `WhereBand.one-height.test.tsx` (6 passed).
- **Red proofs:** 2 failed / 4 passed against the base CSS, and 1 failed / 5 passed against the repair-1 CSS. Affected vitest: 23 files, 247 passed. tsc clean.
- **Lane:** `IN LANE: all 60 paths are frontend look-only`.
- **Gate (independent reviewer, cosmetic lane):**
  - Review 1: `FAIL`. The action row wasn't at the card's bottom, `red-vitest.txt` was stale, and one number was wrong.
  - Review 2: `FAIL`. Details text placement was unrecorded.
  - Review 3: `FAIL`: "B4b, open Details: the button the operator just pressed jumps away from the pointer ... B4b narrows them using ruling 2's list of moves, which makes it a possible 'reversing a Ryan ruling' call, and that is on the park list."
- No marker written. Parked.

### #470 Generate wait (`ff7b9a26`)
- **Change:**
  - **Components:** `GeneratorShell.tsx`, `StatusBar.tsx` (`WaitLine`), the new `ResultsOutline.tsx`, and `lib/corridor-aerial.ts`.
  - **CSS:** a #470 block in `globals.css`, existing tokens only.
  - **Tests and checks:** the new test `GeneratorShell.generate-wait.test.tsx`, and the permanent check `scripts/verify-generate-cls.mjs` with its stub.
- **Layout shift on Generate, 1440 / 1198 / 390:** 0.554 / 0.344 / 0.866 before, and 0 / 0 / 0 after, on the recorded Colfax, signals-only and empty-scan fixtures. Under reduced motion: 0.002 / 0.0024 / 0.0007.
- **Other measures:** axe 0 violations, no target under 44 px. Device counts identical (40 devices, 12 types).
- **Tests:** full vitest 2982 passed / 1 skipped (277 files). tsc clean. pytest 3909 passed / 2 skipped. mypy: no issues in 49 source files. ruff clean.
- **Lane:** `OUT OF LANE: 3 of 94 paths fall outside`.
- **diff-verifier:**
  - First run: `VERDICT: REPAIR` (the flaky announce test).
  - Then `VERDICT: PASS` three times. The last: "Marker: 'wrote PASS marker for 15 code file(s), hash fb42abb13e38', written from the worktree."
- **Independent reviewer:**
  - Five runs returned `FAIL`. The first two raised code findings: reduced motion, the no-question case, the status line off screen, the permanent check, contrast, the map placeholder. The last three were write-up only.
  - Final run: `PASS`: "I checked the full write-up against the committed walk outputs and source files and found nothing wrong."

## Permanent checks
- **Band (#469, not shipped):** the committed `walk469.mjs` and `WhereBand.one-height.test.tsx`.
- **Generate layout shift (#470), from the repo root:**
  1. Start the stub backend: `uv run --extra dev python scripts/verify-generate-cls-stub.py . "validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture;validation-artifacts/committed/ux-site-map/evidence/overpass-fixture" 8000`. Optionally set `WALK_SCAN_MODE=empty|signals`.
  2. Run the site with `MODAL_RENDER_URL=http://127.0.0.1:8000`, then `node scripts/verify-generate-cls.mjs`. Add `REDUCED=1` for the reduced-motion pass.
  3. On production: `SITE=https://www.conestruct.com HOLD_MS=0 GATE_BYPASS_TOKEN=... node scripts/verify-generate-cls.mjs`. This checks layout shift only: the outline box check needs `HOLD_MS >= 2000`.
