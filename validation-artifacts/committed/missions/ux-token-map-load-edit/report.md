# Mission ux-token-map-load-edit — report

Tracking issue: #486. Asked by Ryan 2026-11-10: one report and one `result:` line, stacked on `mission-478-prod-check` (`b02fd02`). First, the cc-prompt files and `cc-queue-ux.md` go into `docs/prompts/`, and CLAUDE.md points there. Then the six items below. Nothing was parked.

## Questions for Ryan

None of these block the ship. Each one is a call I made, or one that is yours.

1. **Rotate `GATE_BYPASS_TOKEN`?** This is still yours to decide (#478's harness crash printed it to local stderr). #481 now keeps the token and header lines out of every harness's output, crashes included. Recommendation: rotate once this ships. The fix stops new leaks but can't undo the one from #478.
2. **#483 uses the whole map rate limit in the worst case.** Soft images add one request for each question. A full pass of all 5 questions with every zoom step is now 30 requests, exactly the existing limit of 30 a minute per IP (it was 25). A 429 on a soft image skips straight to the full image. A 429 on a full image shows the failure line. Recommendation: keep the limit, and raise it to about 40 if Ryan's browser check ever hits the failure line.
3. **#484 adds one Overpass read for the intersection question.** It fetches the cross street's line and runs after the subject read, with its own 8 s budget. Worst case, the first full image of an intersection map arrives up to about 8 s later. The read is memoized for 600 s. Recommendation: keep it, and look at the timing in the prod check.
4. **#485 E8: how I read "The band's height never changes".** I read it as #469's one height for the two-column band (1440 and 1198), where it holds at 762.5 px through all 12 steps. On a phone the band has no fixed height and follows its content, as in every CONFIRM state today (it ranges from 737.5 to 903.3 px at 390). The 150 px strip never moves. Recommendation: keep. If the phone band should be one height too, that is a new ruling.
5. **#485 lane: I overrode the lane check.** `cosmetic_lane_check.py` said IN LANE because the check reads paths only. But the change alters UI behaviour: Cancel restores the scenario, and an answer the edit cleared is asked again. So both gates ran.
6. **The root copies of the prompt files.** `cc-prompt-*.md` and `cc-queue-ux.md` are still untracked in the main checkout's root, byte-identical to the copies in `docs/prompts/`. Recommendation: delete the root copies after the ship lands them on main. I didn't delete them, because they are your files.
7. **Your crops rule.** It came through a permission denial in #484's sub-agent ("Don't delete crops, ever. Move any you're not committing into crops/extra/ (gitignored)…"). It is now in CLAUDE.md, and `.gitignore` gains `**/crops/extra/` in #484.

## Ready to ship

Top branch: **`issue-485-edit-questions-turns`** (this report's commit sits on it). CI is green on `c7ef8b1` (Python tests, Frontend tests).

Chain, bottom to top:
- `b02fd02` `mission-478-prod-check`: the #478 production-check evidence. It ships with this chain.
- `d5b6899` `mission-ux-token-map-load-edit-prompts`: the prompt files, now in `docs/prompts/`.
- `e2c8a3f` `issue-481-gate-token-never-printed`: #481.
- `7324da2` `issue-482-wait-copy-gap`: #482.
- `0c9e38d` `issue-479-needs-you-details-float`: #479.
- `0fe778a` `issue-483-map-soft-sharp`: #483.
- `17009e3` `issue-484-crossing-line`: #484.
- `c7ef8b1` `issue-485-edit-questions-turns`: #485, then this report.

## Filed

- #482 https://github.com/rtmakatura/conestruct/issues/482: drop the outline's 20 s note; the 40 px gap becomes 24.
- #483 https://github.com/rtmakatura/conestruct/issues/483: NEEDS YOU maps load soft, then sharpen.
- #484 https://github.com/rtmakatura/conestruct/issues/484: the crossing is a named line.
- #485 https://github.com/rtmakatura/conestruct/issues/485: editing and the questions take turns.
- #486 https://github.com/rtmakatura/conestruct/issues/486: the tracking issue.
- #487 https://github.com/rtmakatura/conestruct/issues/487: follow-up from #484's review. The tag can sit beside a part the URL budget left undrawn, and the name match uses raw strings, so a mainline that curves more than 25° could be picked as the cross street. Also the `TAG_CHAR_PX` comment's overclaim.
- #488 https://github.com/rtmakatura/conestruct/issues/488: follow-up from #485. A Save through "Edit on map" clears the side with no line saying why.

## Calls I made

- **The prompts commit.** The files were copied byte for byte, not moved. CLAUDE.md (gitignored) now says prompts live in `docs/prompts/`.
- **Items 2 and 3 became one issue (#482),** so the mission stays at six issues. Both are your answers to questions 3 and 4 of the #478 report.
- **#481 R145-4:** `disposed-guard.cjs` stays in the #478 evidence, since archived evidence is never edited. Its behaviour now lives in `gate.cjs`.
- **#482 R145-3:** the settled reference group also moves to 24 px. Otherwise the outline and the settled page would sit 15 px apart, which breaks #470's no-move swap.
- **#482 and #479 lane check:** both ran against their own base (`--base <previous tip>`). Without it, the default check against origin/main counts #481's script files and says OUT OF LANE.
- **#479 fold-in R6:** "0.1 s" no longer wraps, via one scoped `nowrap` class (`nyq-dur`).
- **#483 R145-11:** the Generate wait keeps #477's stand-in. The first question's frame comes from the scan, which runs inside Generate, so it can't be known earlier.
- **#483 decode failure:** an image that won't decode now reads as a failed map (Rule 10). This is the reviewer's point 1.
- **#484 has no tag for an unnamed road,** and a road number stands in for a missing name. 30 m and 25° are CHOSEN, traced to existing constants, and not safety numbers.
- **#484's three edge cases went to #487** instead of a code repair.
- **#485 E1/E2:** only the side is asked again. A crossing the person cleared shows as unanswered, with no line (this was the reviewer's blocking finding).
- **#485 E4:** Cancel over a length still owed closes the panel, as the old Edit toggle did.

## Flakes

None. Every full-run failure was real, caused by the change, and recorded before any re-run:
- #481: `build-inputs.test.ts`.
- #483: 9 tests from the first two-request build.
- #484: the motion allow-list.
- #485: 18 tests rewritten as predicted.

Each one's `full-run-failures.txt` is in its folder.

**Process slips:**
- #481's sub-agent ran its pytest and vitest baselines at the same time.
- #484's first pytest baseline overlapped its first edits, so it is not a clean baseline.

## Per item

Evidence for each item is in `validation-artifacts/committed/missions/ux-token-map-load-edit/issue-<N>/` (`rulings.md`, `checkpoint.md`, evidence, red proofs, crops).

### #481: the gate token and request headers never print (`e2c8a3f`)

- **Request handler:** `gate.cjs`'s handler never rejects. A request cut off because the browser closed is dropped. Any other failure prints one redacted line and the request is aborted.
- **`guardOutput()`:** redacts every stdout and stderr write, and prints any crash as one redacted line. All six harnesses that load `gate.cjs` call it.
- **`verify-generate-cls.mjs`:** its ERROR line no longer uses `String(e)`.
- **Tests:** five new vitest cases run real `node` processes with a fake token. They are red-proved against the old code.
- **Results:**
  - vitest `Tests 2999 passed | 1 skipped (3000)`.
  - `test_preview_url.py` + `test_gate_helper.py`: `29 passed`.
  - Lane: `OUT OF LANE: 21 of 45 paths fall outside`.
- **diff-verifier:** "VERDICT: PASS". Marker: "wrote PASS marker for 0 code file(s), hash f56f24f9d124".
- **Independent reviewer:** "PASS". One wording note on ruling 3 was fixed, then re-gated: "PASS — The new ruling 3 matches the code."

### #482: the 20 s note goes; the gap is 24 px (`7324da2`)

- **Note:** `ROAD_SLOW_NOTE` is removed. After 14 s the note's slot is empty but keeps its room.
- **Gap:** `.ro-refs` uses `var(--space-section)` (24 px), and the settled group sits at 24 too.
- **Walk:** gap 24/24 (was 40/39); CLS 0 / 0.0001 / 0.0002, the same as the baseline.
- **Tests:**
  - Red proof: `2 failed | 8 passed`.
  - Affected vitest: `Tests 540 passed (540)`.
  - Lane: `IN LANE: all 19 paths are frontend look-only` (`--base e2c8a3f`).
- **Independent reviewer (only gate, R156):** "PASS". It wrote the marker.

### #479: NEEDS YOU's Details floats like #469's (`0c9e38d`)

- **Change:** NEEDS YOU sets #469's `detailsTip`. The panel anchors to the card's foot, inside the screen at 390, and grows from 280 to 360 px wide (328 at 390).
- **Walk:** opening Details moves nothing (1024.8 / 1024.8 / 1135.3); axe 0; nothing under 44 px; Esc puts focus back on the toggle.
- **Tests:**
  - Red proof: `1 failed | 15 passed`.
  - Affected vitest: `Tests 307 passed (307)`.
  - Lane: `IN LANE: all 22 paths are frontend look-only`.
- **Independent reviewer (only gate):**
  - First round: "PASS", with notes on the quote, the width and "0.1 s".
  - After the fixes: "FAIL — The repair holds up everywhere except one sentence in the commit message, which the fold-in made false." That was the new class; a write-up fix.
  - Then: "PASS — The three corrected lines read as you quoted…". The marker was rewritten.

### #483: NEEDS YOU maps load soft, then sharpen (`0fe778a`)

- **Backend:** `/render/needs-you-map` takes `soft: true`. It returns the same frame at @1x with no lines drawn, and both answers carry `x-map-frame` (Rule 3).
- **Card:** a blurred soft image with "Loading the map of this spot", then the sharp image fades in over 200 ms, in the same box and frame. The key appears with the sharp image.
- **Permanent check:** `verify-generate-cls.mjs` fails if the box or frame changes between soft and sharp.
- **Mapbox:** a typical plan goes from 8 images to 10; the free 50,000 a month now covers about 5,000 plans instead of about 6,000.
- **Tests:**
  - pytest `3913 passed, 3 skipped`.
  - vitest `3008 passed | 1 skipped (3009)`.
  - mypy and ruff clean.
  - Lane: `OUT OF LANE: 9 of 42 paths fall outside`.
- **diff-verifier:**
  - First round: "VERDICT: PASS".
  - After repair cycle 1 (decode failure, rate-limit record): "VERDICT: PASS". Marker hash `36f5d4c26808`.
- **Independent reviewer:** "PASS", then "PASS" after the repair, then "PASS" on the evidence-number fix.

### #484: the crossing is a named line (`17009e3`)

- **Backend:** one memoized Overpass read finds the cross street within 30 m. The dashed `#3fd3a8` line is drawn in the full image only, and the backend picks the tag's spot.
- **Card:** the dashed circle and the "Crossing on the map" chip are gone. The key reads "The cross street the map knows about".
- **No geometry:** no line and no tag, with #448's sentence.
- **Tests:**
  - pytest `3926 passed, 3 skipped`.
  - vitest `3012 passed | 1 skipped (3013)`.
  - mypy and ruff clean.
  - Lane: `OUT OF LANE: 9 of 39 paths fall outside`.
- **diff-verifier:** "VERDICT: PASS". Marker hash `fc728ccb78f7`.
- **Independent reviewer:** "PASS", with four minor findings. Two were write-up fixes; two went to #487. Re-gate: "PASS — The code diff stat is unchanged since my review…".

### #485: editing and the questions take turns (`c7ef8b1`)

- **Edit panel:** once the questions have shown, Edit, Change, Move or the length field turn the right column into one Edit panel. The CONFIRM card collapses to "◌ Questions wait while you edit · N of M answered", which is not a control.
- **Cancel and Done:** Cancel restores the exact scenario and the picker memory (P15). Done asks the side again, with one line, when a move or a road change cleared it.
- **Height:** the band stays at 762.5 px at 1440 and 1198 through all 12 steps.
- **Tests:**
  - Red proofs: 7/7, then 2 permanent-check tests, then 1 for the repair.
  - vitest `Tests 3020 passed | 1 skipped (3021)`.
  - tsc clean.
  - Lane: `IN LANE: all 38 paths are frontend look-only`, overridden (Question 5).
- **diff-verifier:** "VERDICT: PASS", then after repair cycle 1, "VERDICT: PASS". Marker hash `9c410dee99d7`.
- **Independent reviewer:**
  - First round: "FAIL — Blocking: the re-ask line gives a false reason on the cross-street question (Rule 10…)".
  - After repair cycle 1: "PASS — The repair fixes the blocking finding and all three should-fixes."

## Top-branch checks before the push

Run in `.claude/worktrees/issue-485`:
- pytest `3926 passed, 3 skipped in 351.95s`.
- mypy `Success: no issues found in 49 source files`.
- ruff `All checks passed!`.
- vitest `3020 passed | 1 skipped (3021)` (the diff-verifier's run).

CI on `c7ef8b1`: Python tests success, Frontend tests success.

## After the ship

- **Production check:**
  - #481: the permanent check runs on prod with no `--require` guard, and the token appears 0 times in output.
  - #482: the 14 s line alone, and the gap is 24.
  - #479: Details floats at 1440, 1198 and 390.
  - #483: soft then sharp, box and frame unchanged.
  - #484: the line and its tag on a live intersection question.
  - #485: Edit, then Cancel and Done, with the band height kept.
  - axe and the 44 px measure at each step.
- **Evidence branch:** put the prod check on a new evidence branch and record it in handoff.md § Next.
- **Close:** #481, #482, #479, #483, #484, #485 and #486.
- **Ryan's browser check:** #479's panel, #483's soft load, #484's line and tag, and #485's Edit panel (all visible design, R145).
