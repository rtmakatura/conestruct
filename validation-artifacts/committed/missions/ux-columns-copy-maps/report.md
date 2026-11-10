# Mission ux-columns-copy-maps (tracking #494)

Ryan's brief, 2026-11-10. One report and one `result:` line, stacked on the pending evidence branch `mission-486-prod-check` `d432b72`.

## Questions for Ryan

1. **#492 parked (money).** The brief assumed NEEDS YOU loads a soft image for every question at once. It doesn't: `QuestionSteps` mounts only the open card (`conestruct/site/components/QuestionSteps.tsx:177-199`), so 1 soft image is requested before any answer today. The limit is `rateLimitOr429(req, "needs-you-map", 30)` (`conestruct/site/app/api/needs-you-map/route.ts:20`, 30 a minute per IP, its own bucket; the WHERE aerial is a separate `corridor-map` bucket). Worst case is a 5-question walk trying every zoom step: 5 × (1 soft + 5 sharp) = 30, margin 0, before and after the change you asked for (loading the next question early adds no request; it just asks for it sooner). Room under the limit needs either:
   - **A (recommended):** raise the cap at `route.ts:20` from 30 to 40 (CHOSEN, the #486 report's figure), margin 10. That raises the per-IP ceiling on paid Mapbox Static Images requests by a third. #483's R145-12 kept the limit unchanged, so this is your call. I can also build the next-question early load in the same branch; it doesn't change the count.
   - **B:** build only the early load and record margin 0. That doesn't meet #492's margin line.
   - **C:** fewer soft images. That reverses #483 ruling 1; not recommended.

   Worktree `.claude/worktrees/issue-492`, branch `issue-492-soft-open-and-next` on `cf5ddff`, no changes.
2. **#493 parked (two repair cycles used).** It works: the intersection map draws the cross street from the line the WHERE tap already fetched, with no new Overpass read (stubbed reads 1 → 0; one live sample of that read took 2,649 ms; the 8 s budget is the worst case). The last gate found a real regression that no one predicted. The line now rides on the cross-street record, and that line can differ between taps of the same street (it is trimmed around the snapped point, or falls back to the whole way when the stitch fails). `cross-street-apply.ts:37-39` decides whether a candidate is new by comparing `JSON.stringify(crossStreet)`; that guard keeps the operator's edited approach fields (#112). So a re-tap of the same cross street can now replace `approaches`, clear `detectionOverrides` and put the lane hold back on. **Recommendation:** leave `geometry` out of the guard's comparison (keep it on the record only) and add a test that a re-tap with a different line keeps edited approach fields. It's a few lines; `/start 493` in the existing worktree. Worktree `.claude/worktrees/issue-493`, branch `issue-493-cross-street-reuse` on `cf5ddff`, uncommitted (13 paths). Draft commit message: `C:\Users\rtmak\AppData\Local\Temp\claude\556f937a78fa2516\058cff52-0a0f-46c5-8a1d-46acf7154fc8\scratchpad\issue-493\commit-msg.txt` (copy it into the worktree before the scratchpad goes). Last gate verdicts: diff-verifier `VERDICT: PASS` (marker 4d757b9fd9d7); independent reviewer `FAIL` on the finding above.
3. **#487 known limit, accepted by me (R145-7), please confirm.** `_street_key` still strips combining marks that have no precomposed form, so some different non-Latin names share a key (e.g. "किला मार्ग" and "कुली मार्ग"). That can group two ways under one tag or drop the real cross street. I accepted it instead of parking because the product's jurisdictions are Colorado (US OSM names); filed as #502 with the fix. Say if you want it fixed before this ships.
4. **#490 200% text regression, filed (#497, priority-high).** At 200% text the band picture is scaled up to about 2.4x to cover the taller frame, and the work-start pin can leave the frame. Stated in #490's churn and filed rather than parked (both cycles were used). At 100% text the scale is 1 in every walked state.
5. **#488 and #489 not started.** The mission stopped under § 5: full test runs were killed by low memory three times this session (#492's baseline, #493's repair 2, #487's repair 1). Suggested next: `/start 489` (hand-check the Move click first), then `/start 488`.

## Ready to ship

Top branch **`issue-487-cross-street-edges`**. Chain (all pushed):

- `d432b72` `mission-486-prod-check` (the #486 production-check evidence, ships with it)
- `f3ceb4b` `issue-490-columns-end-together` #490
- `cf5ddff` `issue-491-failure-copy` #491
- `7db9251` `issue-487-cross-street-edges` #487
- this report, on the top branch

Ship note: #490 turns Mapbox's baked-in logo and attribution off on the band aerial route and draws them on the page. If the backend deploys before the frontend, the band picture is briefly unmarked (ship.ps1 deploys both in one run).

## Filed

- #490 https://github.com/rtmakatura/conestruct/issues/490 (columns end together)
- #491 https://github.com/rtmakatura/conestruct/issues/491 (failure copy)
- #492 https://github.com/rtmakatura/conestruct/issues/492 (soft images; parked)
- #493 https://github.com/rtmakatura/conestruct/issues/493 (cross-street reuse; parked)
- #494 https://github.com/rtmakatura/conestruct/issues/494 (tracking)
- #495 https://github.com/rtmakatura/conestruct/issues/495 (200% text: Confirm, Done and the Try again row overflow; predates this chain)
- #496 https://github.com/rtmakatura/conestruct/issues/496 (390 at 200%: the failed tap bar meets the logo)
- #497 https://github.com/rtmakatura/conestruct/issues/497 (200% text: cover scale crops the pin; plus minor items)
- #498 https://github.com/rtmakatura/conestruct/issues/498 (a real Try again for the failed geometry read)
- #499 https://github.com/rtmakatura/conestruct/issues/499 (three aerial sentences still in mono)
- #500 https://github.com/rtmakatura/conestruct/issues/500 (the failure note shows over a loaded pin picture during the cross-street question)
- #501 https://github.com/rtmakatura/conestruct/issues/501 (the picker drops the mainline by raw name)
- #502 https://github.com/rtmakatura/conestruct/issues/502 (`_street_key` and combining marks)
- #503 https://github.com/rtmakatura/conestruct/issues/503 (tag width checked at 8 px a character; corrected for the served font in a comment)

## Calls I made

- **Before the chain:** CLAUDE.md now sends extra (uncommitted) crops to `validation-artifacts-extra/` in the main checkout, never inside a worktree. Deleted the 11 root copies of `cc-prompt-*.md` and `cc-queue-ux.md` after a byte compare with `docs/prompts/` on `origin/main` (all 11 identical).
- **#490 C11:** Mapbox's logo and attribution must stay whole wherever the cover scale crops the picture. The band route asks Mapbox for `logo=false&attribution=false` and the page draws both on the frame (Mapbox: "If you specify `attribution=false`, you are legally required to include proper attribution elsewhere on the webpage or document", https://docs.mapbox.com/api/maps/static-images/).
- **#490 C13:** the Generate outline shows the same band picture, so it gets the marks too.
- **#490 C17:** the 200% pin crop is stated and filed (#497), not fixed.
- **#491:** the aerial line is "The map didn't load. Edit on map opens the big map at your pin." and the side line is "We couldn't load this road's sides." (Ryan's first sentence). The code trace showed "shows the work zone" is false before the side is confirmed, and that reopening the map does not retry the lookup (#498 filed for a real retry).
- **#493:** let a malformed or over-long cross-street line never refuse a plan (dropped, the lookup runs, recorded in the `x-map-cross-source` header).
- **#487 R145-7:** the combining-mark limit accepted for the Colorado scope (question 3).
- **Commit trailers** use `Co-Authored-By: Claude Opus 5.5`, this session's attribution; the diff-verifier's own reminder named another model and I overruled it.
- Each item's own calls are in its `rulings.md`.

## Flakes and process

- No test flakes. One real full-run failure each in #490 (`mapbox-wordmark.test.ts`, the R142 text scan, fixed) and #493 (the build-inputs check, fixed by adding the fixture folder to `SITE_INPUTS`), both saved to `full-run-failures.txt` before re-running.
- Low memory killed full runs three times; every gate's final suite run completed.
- Hard-rule slips, both self-reported: the #493 item agent and the #487 item agent each combined a `cd` with a write once (the write itself went to an absolute path).
- The #493 item agent skipped the vitest baseline; the diff-verifier's full runs cover it.
- The #493 diff-verifier wrote one stray, empty PASS marker in the main checkout (0 code files) before writing the real one in the worktree.
- No leftover dev servers or browsers were found after any item.

## Items

### #490 — side-by-side columns end together (`f3ceb4b`)

The two WHERE columns are one stretched row, and the right column's last box fills it. The aerial covers its column by a cover scale on one fixed-size picture, so no state asks Mapbox for a new picture. The line under the map moves to a row under both columns that grows with its text. The band starting height is re-traced to 655 px, the tallest normal state. Mapbox's marks sit on the frame's foot. The permanent check `scripts/verify-columns-end-together.mjs` measures column bottoms, mark overlaps and text past the band.

Layouts checked (1024, 1198 and 1440; 100% and 200% text, emulated by doubling font sizes because Chromium has no text-only zoom):

| Layout | Readings | Largest difference |
|---|---|---|
| WHERE band, aerial vs right column (31 states, including a 3-line road name, sides unavailable, aerial failed, tap found, failed, none and undone, Move, the Edit panel and its row, Details) | 186 | 0 px |
| WHERE frame controls vs Mapbox marks | 186 | 0 overlaps (opt-in 390 at 200%: 1, #496) |
| WHERE text vs band bottom | 186 | 0 past |
| Your plan, 3 hero cells | 6 | 0 px |
| Downloads, 4 cards, bottoms and last buttons | 6 | 0 px |
| Generate outline map placeholder | 8 | marks drawn in all runs |

Tests: pytest `3929 passed, 3 skipped`; vitest `Tests 3031 passed | 1 skipped (3032)`. #469 band spread 0, #485 band spread 0, #470 layout shift on Generate 0 at 1440, 1198 and 390.

- Diff-verifier (final): `VERDICT: PASS`
- Independent reviewer (final): `PASS`
- Two repair cycles; the third reviewer FAIL (pin crop) was resolved by stating and filing it (#497).

### #491 — plain-sentence failure copy (`cf5ddff`)

Before: "The aerial didn't load. Edit on map shows the corridor." After: "The map didn't load. Edit on map opens the big map at your pin."
Before: "the road's sides are unavailable. Reopen the map to retry". After: "We couldn't load this road's sides."
The aerial's centre note box moves from mono (`tr-prov`) to Inter (`tr-note`).

Lane check: `OUT OF LANE: 4 of 94 paths fall outside` (whole chain against main); this item's own paths are `IN LANE`. Both gates ran.

Tests: vitest `Tests 3032 passed | 1 skipped (3033)`.

- Diff-verifier (final): `VERDICT: PASS`
- Independent reviewer (final): `PASS`
- No repair cycles; one write-up fix (the cross-street exception, #500).

### #487 — cross-street tag and name match (`7db9251`)

`question_image_url` returns the lines it drew, and `cross_tag_box` walks only those, so the tag sits beside drawn dashes. The worked road is dropped through a new `_street_key` (NFKC, casefold, punctuation out, common abbreviations spelled out; table CHOSEN), so "E Colfax Ave" matches "East Colfax Avenue". The empty key never matches or groups. #484's E Colfax pick is unchanged (digest `ab130c5a7e825e32`). The `TAG_CHAR_PX` comment Ryan put in scope now states the measured Inter 600 widths (#503 for checking the real width).

Tests: pytest `3946 passed, 3 skipped`; ruff and mypy clean; 17 new cases red on base.

- Diff-verifier (final): `VERDICT: PASS`
- Independent reviewer (final): `PASS`
- Two repair cycles, then comment and write-up fixes only.

### #492 — parked (question 1). #493 — parked (question 2). #488, #489 — not started (question 5).

## Top branch, before push

pytest `3946 passed, 3 skipped`; vitest `Tests 3032 passed | 1 skipped (3033)`; mypy `Success: no issues found in 49 source files`; ruff `All checks passed!`, `240 files already formatted`.
