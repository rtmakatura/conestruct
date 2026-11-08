# Mission ux-queue-2-6: UX queue items 2–6

Tracking issue: #458. Run 2026-11-07/08 from `cc-queue-ux.md`, items 2–6, one sub-agent per item, one stacked chain on `issue-453-prod-check` (`2cd6d72`), no ships until all were built.

## Questions for Ryan

1. **#456 (item 2, map in view) is parked.** Both code repair cycles were used. Five gate rounds left one blocking code finding: at 390 px the pinned strip's picture is 2 px taller than the full-height picture, so the strip and the full map ask Mapbox for different sizes. Opening the tap question (or closing the card) fetches a new image, and taps stay off until it loads. That is the wait ruling 3 removes. **Recommendation:** fix it in the next session: `height: calc(var(--aerial-h) - 2px)` on the strip canvas in `globals.css`, re-walk 390x844 and 390x664, and correct M4, `checkpoint.md:29` and the commit message's "nothing redrawn" and image count. Everything else in #456 passed both gates (diff-verifier PASS, marker `14c3b11676c9`; the last review's other findings were notes).
   - Worktree: `.claude/worktrees/issue-456`, branch `issue-456-map-in-view`, base `2cd6d72`, uncommitted (left on purpose; never remove it).
   - Draft commit message: `C:\Users\rtmak\AppData\Local\Temp\claude\556f937a78fa2516\e737671f-a27b-49f6-9e2c-f7a22e43845a\scratchpad\issue-456\commit-msg.txt` (scratchpad; may not survive. The message text is not needed to finish the fix.)
   - Open review findings (round 5): the 2 px strip size (blocking, code); M8/evidence.md:91 cite a frame span from the old walk; evidence.md:12 "frame top 52 on every question"; evidence.md:19 "hidden holds through a question change" isn't walked; #460's body quotes 411-485 px; a tap during a held load is dropped silently while the bar still says "Tap…"; "well under 50,000" needs the plans/month framing; the WHAT-row state list omits the not-located branch.
   - Also for Ryan in #456: M18 drops "above" from #440 ruling 1's verbatim "Tap where the two streets cross on the map above." because your #456 ruling 1 puts the map on the left. Follow-ups #459, #460, #461.
2. **#464 (from item 6): should a bike lane that only crosses the end of the work keep the 2 M4-9a signs?** That changes a device count (Rule 8). The scan can't tell crossing from alongside. #464 lays out options (a)–(d) with sources. The recommendation there: (d) now, (b) next, (c) for you.

## Ready to ship

Top branch: **`issue-449-bike-lane-crossing`**. One `ship.ps1` run ships the chain:

| Order | Branch | Commit | Issue |
|---|---|---|---|
| base | `issue-453-prod-check` | `2cd6d72` | #453 prod-check evidence (pending) |
| 1 | `issue-457-undo-links` | `f5cec7d` | #457 |
| 2 | `issue-448-no-line-text` | `b88700b` | #448 |
| 3 | `issue-451-pdf-not-checked-count` | `0cd02e8` | #451 |
| 4 | `issue-449-bike-lane-crossing` | `872e934` + this report | #449 |

CI on `872e934`: Python tests and Frontend tests success.

## Filed

- #456 https://github.com/rtmakatura/conestruct/issues/456 (item 2)
- #457 https://github.com/rtmakatura/conestruct/issues/457 (item 3)
- #458 https://github.com/rtmakatura/conestruct/issues/458 (tracking)
- #459 https://github.com/rtmakatura/conestruct/issues/459 the status strip still says "AWAITING KIND OF WORK" after a kind is chosen
- #460 https://github.com/rtmakatura/conestruct/issues/460 closing the picker calls a plain `focus()`, scrolling the aerial off
- #461 https://github.com/rtmakatura/conestruct/issues/461 at 390 the pinned strip covers the CONFIRM question heading; the desktop sticky aerial can't hold
- #462 https://github.com/rtmakatura/conestruct/issues/462 work hours "not checked" can print a reason that says they were evaluated
- #463 https://github.com/rtmakatura/conestruct/issues/463 the page's work-hours row says "These windows are reference only" for a jurisdiction with none (plus comment 6719174558)
- #464 https://github.com/rtmakatura/conestruct/issues/464 the bike lane adjustment adds 2 M4-9a for any bike lane, crossing or alongside (plus comment 6719479469)

## Calls I made

- Run mode: `cc-queue-ux.md` has no "Run mode" section. I took it from your message, and it matches /mission.
- #456 parked under the two-cycle rule, not fixed in a third code cycle, though the fix is one line.
- #456 M18 kept ("on the map", not "above"), as following your newer ruling; flagged above.
- #457 ran in the cosmetic lane (`IN LANE: all 111 paths are frontend look-only`), so the independent reviewer was its only gate. The focus-after-Move fix moves focus, and the lane script still counts it as look-only.
- #449: "at or near the work zone" instead of the ruling's example "crosses the end". The ruling gives that wording with "e.g.", and the scan keeps one point per road, so "crosses the end" would claim a direction it never measured (Rule 10). The independent reviewer agreed.
- #451 X7: an absent schedule now prints "schedule marked Not set" on the PDF, matching the page.
- Per-item calls: each item's `rulings.md` (R145 self-ruled).

## For Ryan (open points, one line each)

- #457: Move and Undo on the cross street's row now look the same (both underlined links); Undo still drops focus when its row goes (#446's limit, ruling 4 kept behaviour).
- #448: the new sentence needs your eye: "The scan found sidewalks 57.4 ft from the work, but the map couldn't draw them. Check them at street level." At 390 a drawn card keeps a blank line (the height is held for 0 px movement). Going back to a seen question can flash the old "The map shows…" for one frame.
- #451: the PDF bullet reads "Work hours not checked (schedule marked Not set: hours not evaluated)", which says "not" twice. With no items and hours checked, "0 items not checked yet. Tracking: #19" still prints (as before).
- #449: the "MUTCD § 9C.101" source line still shows, and Part 9 isn't in the repo (#464).

## Flakes and slips

- #448 diff-verifier: the first full vitest run had 1 failure while pytest ran alongside; the test name wasn't captured. The second run was clean (2944 passed | 1 skipped). Not isolated.
- #456 builder: first full vitest run had 2 `type-census` failures (real, fixed; `evidence/vitest-failures-1.txt`).
- Rule slips: the #448 builder once wrote a file with a heredoc after a `cd` to a relative path (content correct); the #451 builder overlapped two test runs once; the #457 reviewer wrote a 0-file verdict marker in the main checkout's `.claude/last-verdict.txt`; the #448 diff-verifier first wrote its marker from the main checkout, then rewrote it from the worktree.
- #456's walk was once stopped by the memory guard; later walks ran one viewport at a time.

## Per item

### #457 Undo links (item 3), `f5cec7d`
Every Undo on the tool page (six places, U-a to U-f) goes through one `.undo-link` class sharing `.wq-link`'s font: 44 px tall, 8 px side padding, rows at least 48 px with 16 px right padding, ring inside the link. After Move, focus goes to "Use the big map instead" (#446). Evidence: `validation-artifacts/committed/ux-undo-links/`.
- Tests: affected vitest `Test Files 122 passed (122)`, `Tests 1006 passed (1006)`; tsc and eslint clean. Lane: `IN LANE: all 111 paths are frontend look-only`.
- Independent reviewer: "PASS" (marker `539024a4432f`). Diff-verifier: not run (cosmetic lane).

### #448 text when the map draws no line (item 4), `b88700b`
NEEDS YOU explanations read "The scan found … but the map couldn't draw it. Check it at street level." when the backend's `x-map-subject` says none; "The scan found …" while loading, failed or with no map; unchanged when drawn. All five question kinds are pinned. Evidence: `validation-artifacts/committed/ux-no-line-text/`.
- Tests: pytest `3899 passed, 3 skipped`; mypy no issues in 49 source files; ruff all checks passed; vitest `2944 passed | 1 skipped (2945)`; tsc clean.
- Diff-verifier: "VERDICT: PASS" (marker `c947236567e7`). Independent reviewer: "PASS".

### #451 PDF "Not checked yet" count (item 5), `0cd02e8`
The section lists the cover's own ledger entries (`pending_fact_ids` over `tier_facts`), work hours last, and prints "N item(s) not checked yet."; the #19 link prints only with no bullets. Audit JSON and the cover are byte-identical. Evidence: `validation-artifacts/committed/ux-pdf-not-checked-count/`.
- Tests: pytest `3908 passed, 3 skipped`; mypy and ruff clean.
- Gates: one code repair cycle. Diff-verifier: "VERDICT: PASS" (rounds 1–3; marker `61aa573abb4c`). Independent reviewer: "FAIL", "FAIL" (write-up only), "PASS".

### #449 bike lane that only crosses the end (item 6), `872e934`
Investigation first (`validation-artifacts/committed/ux-bike-lane-crossing/investigation.md`): the scan keeps one point per road and can't tell direction; MUTCD 11th Ed. and Denver PT-116.1 turn on whether the bike facility is closed, not on its direction, and CDOT S-630-1 has no bicycle provision; today any counted bike lane adds 2 M4-9a. Words only: "Is there a bike lane at or near the work zone?" No device count moved; the device question is #464.
- Tests: vitest `2946 passed | 1 skipped (2947)`; tsc clean; pytest `3908 passed, 3 skipped`; mypy and ruff clean.
- Diff-verifier: "VERDICT: PASS" (marker `9d71630b0e29`). Independent reviewer: "PASS".

### #456 map in view (item 2), parked
See Questions for Ryan, item 1. Diff-verifier rounds: PASS, REPAIR (commit-message CLS line), PASS, PASS, PASS. Independent reviewer rounds: FAIL (code), FAIL (write-up), FAIL (code), FAIL (write-up), FAIL (code: 2 px strip size).
