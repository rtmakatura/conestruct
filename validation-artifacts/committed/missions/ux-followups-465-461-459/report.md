# Mission ux-followups-465-461-459: report

Tracking issue: #466. Run 2026-11-08. Base `origin/main` `b3e8457` (no evidence branch was pending).

## Questions for Ryan

Nothing parked. No item touched a device count, a payload, an API or the backend.

Three things want your eye at the preview check:

1. **#459's new strip words: "◌ AWAITING WHERE CONFIRMATION".** #459 says the strip's words are ruled strings and the new ones want your eye. The item self-ruled the issue's own recommended wording under R145 (S1); copy is not on the park list. Recommendation: keep it. Alternative: any wording you prefer is a one-string change in `StatusBar.tsx`.
2. **#461 narrows its own acceptance (N3a).** The acceptance says "on every CONFIRM question". One walked state misses it: at 390x664, after answering the near-intersection question (the answer sits below the window, so you scroll down to it), the heading stays under the strip (heading top 136.5, strip bottom 202). It was the same before the fix. Scrolling on an answer would move the chip you just tapped, so the item doesn't. Filed as #468 with three options. Recommendation: leave it as built and decide #468 later.
3. **#465 changes only the armed bar.** The "failed" and "none" bars still say "Tap again" / "Tap closer" during a held load. Changing them is a design call (focus on Try again, or hiding the lookup's answer), so it was filed as #467.

## Ready to ship

Top branch: **`issue-459-strip-where-confirm`**. One ship.ps1 run ships the chain:

| Order | Branch | Commit | Issue |
|---|---|---|---|
| base | `origin/main` | `b3e8457` | — |
| 1 | `issue-465-held-tap-bar` | `401d761` | #465 |
| 2 | `issue-461-strip-clears-question` | `5e6f44c` | #461 |
| 3 | `issue-459-strip-where-confirm` | `7732d99` (+ this report) | #459 |

Top-branch checks on `7732d99`: pytest `3908 passed, 3 skipped`; mypy `Success: no issues found in 49 source files`; ruff `All checks passed!`; vitest `Tests 2974 passed | 1 skipped (2975)` (diff-verifier run on that exact code); tsc clean. CI on `7732d99`: Python tests success, Frontend tests success.

## Filed

- #466 mission tracking issue: https://github.com/rtmakatura/conestruct/issues/466
- #467 failed and none bars still invite a tap during a held load (from #465): https://github.com/rtmakatura/conestruct/issues/467
- #468 the 12@664 near-intersection answer leaves the heading under the strip (from #461): https://github.com/rtmakatura/conestruct/issues/468

## Calls I made

Orchestrator:
- Base `origin/main`: handoff.md § Next lists no pending evidence branch (#460 shipped in the light lane), and the old `ux-group2-prod-check` is already in main.
- #465 ran in the cosmetic lane (`IN LANE: all 4 paths are frontend look-only`), so the independent reviewer was its only gate and wrote the marker.
- #461 was OUT OF LANE because of a comment-only edit in `lib/cross-street-reveal.ts`, so both gates ran.
- #459 ran both gates. The lane check measures the whole chain against main, and the chain is out of lane because of #461.
- I took the reviewer's optional test addition on #459 (the strip leaves the state after Confirm). That used #459's one code repair cycle.
- I rejected the diff-verifier's advisory that the commit trailer should read "Sonnet". This session's attribution is Opus 5.5.
- I added the repair-1 asserts to #459's commit-message Tests bullet, per the reviewer's write-up note.
- Re-gates after each repair resumed the same gate agents rather than fresh ones. Each re-gate re-ran the tests and re-checked every claim.

Item calls (R145 self-ruled, in each item's rulings.md):
- **#465:** W1 only the armed line gives way to the wait (failed/none filed as #467). W2 the finding-arc glyph, not the crosshair. W3 no queued taps. W4 the corner held line hides while the bar says the same words. W5 the no-`bar` fallback stays mounted as the wait (WhereBand always passes `bar`, so no shipped screen changes).
- **#461:** N1 scroll clearance of nav + 150 + 8 px with the strip and nav + 44 + 8 px with the map hidden (M4's strip height, ruling 184's 8 px gap). N2 the scroll runs only on a question change or Show map. N2a a move from no question to a question doesn't count. N3 a hand scroll is left alone. N3a an answer doesn't scroll (acceptance narrowed, #468). N4 no desktop change (the walk shows the aerial whole on all 11 states at 1440, 1198 and 1024).
- **#459:** S1 the words "AWAITING WHERE CONFIRMATION". S2 ranked right after the kind state. S3 a separate boolean prop, shaped like `sideUnconfirmed`. S4 #456's evidence table records the strip's states.

## Flakes

None. No full test run failed in this mission.

## Process note

The #461 item agent broke one of your hard rules once: it appended the churn section to `rulings.md` with `cd <worktree> && cat >> <relative path>`. The content went to the right file and nothing else was touched. The agent reported it itself, and the reviewer confirmed it from the transcript. The #459 prompt named that form as forbidden, and #459 reported no breach.

No leftover node, browser or python processes were found after any item.

## Per item

### #465: a tap during a held picture load is dropped while the bar still invites a tap (`401d761`)

**Change.** While a held picture loads, the tap question's own bar (`WhereBand.tsx:587`) now reads "Drawing the corridor…" (the existing `AERIAL_WAIT`), with the finding-arc glyph and `data-bar="waiting"`. It goes back to the tap line when the new picture lands. `BandAerial.tsx` +15/−3, `BandAerial.test.tsx` +67/−1.

**Tests.**
- Baseline: vitest 2966 passed, 1 skipped; pytest 3908 passed, 3 skipped.
- Red proof: 3 failed, 21 passed.
- Affected: 18 files, 243 passed.
- Full vitest: 2968 passed, 1 skipped.
- tsc clean.
- axe on the mounted bar, armed and waiting: `AXE armed=[] waiting=[]`. Contrast was off, no real browser.

**Lane.** `IN LANE: all 4 paths are frontend look-only`. No diff-verifier, per R156.

**Independent reviewer.**
- First pass: `PASS`, with three write-up notes: the lane line said 3 paths, not 4; the test-count prediction was amended late; there was no axe record. All fixed.
- Re-gate: `PASS`. The marker was written by the reviewer: "wrote PASS marker for 2 code file(s), hash 5dcd5dce0cd0".

### #461: at 390 the pinned map strip covers the CONFIRM card's question heading (`5e6f44c`)

**Change.** At 390, while the strip (or the Show map row) is pinned, opening a different question or pressing Show map scrolls the page by the least amount that puts the question just under the strip. It reuses #446's helper. The clearance comes from CSS in the narrow layout only. `globals.css` +9, `WhereBand.tsx` +20, `cross-street-reveal.ts` +3/−1 (comment only). A new mounted test file has 5 tests.

**Tests.**
- Baseline: vitest 2968 passed, 1 skipped; pytest 3908 passed, 3 skipped.
- Red proof: 3 failed, 1 passed. The tap-question case added in repair 1 was red-proved separately: 1 failed, 4 passed.
- Full vitest: 2973 passed, 1 skipped.
- tsc clean.

**Walk.** Local, before and after at 390x844 and 390x664: the heading sits 8 px under the strip (209.5 vs 202). The 12@664 state misses (#468). Desktop needs no change.

**Diff-verifier.**
- First pass: `VERDICT: PASS`.
- After repair 1: `VERDICT: PASS` ("Test Files 275 passed | 1 skipped (276)", "Tests 2973 passed | 1 skipped (2974)", marker hash 4cf16ec80d7f).

**Independent reviewer.**
- First pass: `FAIL`, with four findings:
  1. The acceptance miss was excused with a rationale that contradicted N3.
  2. Rule 5 timing.
  3. A claimed tap-question guard test didn't exist.
  4. A wording error.
- Repair cycle 1 of 2 fixed findings 1, 3 and 4.
- On finding 2, the item agent showed from its transcript that the churn prediction was written at 17:56:23, before any code (18:01:13). The reviewer withdrew the finding.
- Re-gate: `PASS`. One non-blocking process note: the hard-rule breach above.

### #459: the verdict strip says AWAITING KIND OF WORK after the kind is chosen, while WHERE awaits its confirm (`7732d99`)

**Change.** "AWAITING KIND OF WORK" now shows only when no kind is chosen. A chosen kind with WHERE unconfirmed shows "◌ AWAITING WHERE CONFIRMATION", in the same chromeless gray and ranked right after the kind state. The strip, the WHAT row ("Opens after you confirm where") and the Generate hint ("Confirm where the work is first") now name the same state. Churn:
- `StatusBar.tsx` +21
- `GeneratorShell.tsx` +3/−1
- `StatusBar.test.tsx` +22
- `GeneratorShell.no-location.test.tsx` +16
- one line in #456's evidence table

**Tests.**
- Baseline: vitest 2973 passed, 1 skipped; pytest 3908 passed, 3 skipped.
- Red proof: 2 failed, 44 passed. The post-confirm assert was red-proved in repair 1 (2 failed, 3 passed).
- Affected: 2 files, 46 passed.
- Full vitest: 2974 passed, 1 skipped.
- tsc clean.

**Diff-verifier.**
- First pass: `VERDICT: PASS`.
- After repair 1: `VERDICT: PASS` ("Tests 2974 passed | 1 skipped (2975)", marker hash 8008e33d422a).

**Independent reviewer.**
- First pass: `FAIL`. It found two citation defects:
  1. A quote attributed to #456 ruling 4 wasn't in #456.
  2. The no-pin strip was cited as "AWAITING LOCATION · NO SITE CHOSEN YET", but it renders only "NO SITE CHOSEN YET".
- It also suggested an optional assert.
- Repair cycle 1 of 2 fixed all three.
- Re-gate: `PASS`. Both quotes were checked against `gh issue view 456` and #435. The one write-up note (the commit message's Tests bullet) is fixed.
