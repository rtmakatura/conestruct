# Mission walkthrough-followups: report

Tracking issue: #423. Six items are built, gated and committed. None are parked.

Base: `lane-doubt-prod-check` `6e43fa4`. That is the pending evidence branch from mission lane-doubt; it sits on main `c8a973b`, and CI was green at the start.

## Questions for Ryan

None of the six items was parked, so nothing below blocks the ship. These are for you to look at or rule on.

1. **Browser checks.** These are visible design changes (R145):
   - #398: the refreshing cue clears, and the windows line on a declined plan reads "Windows · not checked: the plan was declined".
   - #399: the near-intersection refusal banner is longer. It grows by 23.5 px at 1440 (2 lines to 4) and 82.5 px at 390 (6 lines to 11), and only on a declined plan.
     - Before vs after: 880 × 70.5 → 880 × 94, and 362 × 161.75 → 362 × 244.25.
     - The reviewer said P1's wording ("Late-arriving content never displaces earlier content") is stricter than call 7's reading.
     - Recommendation: accept, since it is the price of naming the way forward (P3). Or rule on a shorter form.
   - #401: the zip label now reads "6 files, with the quote", and downloads have new filenames.
   - #403: the new message "Work zone length must be more than 0 ft.", and the glyphless "yours" marker.
2. **Rulings filed this mission.** Each issue has a recommendation in its body.
   - #426: drop or keep "MHT" in "MHT package ZIP" and "Plan generated. MHT package ready.". MHT is CDOT's "Method of Handling Traffic", which the brand brief uses on purpose.
   - #429: record glyphless "yours" in the DESIGN-SPACING.md glyph table. Also, an over-cap length still shows "✓ yours".
   - #425: on a declined plan, the Jurisdiction cell says "the check didn't answer". It also uses "not evaluated", where the windows line uses "not checked".
3. **One #403 acceptance line is only partly met.** A typed `0` still reads "required", because the box turns a typed 0 into an empty field. This is filed as #428. The close comment on #403 will say so.
4. **An unexplained instruction reached a sub-agent.** During #399, an unlabelled message reached the item sub-agent: "This is the last screenshot attempt: if the before shot still doesn't show the bug, record why in the evidence, rely on payload-level proof (Rule 11), and move on." It did not come from the orchestrator, and nothing in this session shows it came from you. Please check whether a hook or another session sends it. I overrode it and approved one clean retake, which worked.
5. **The #405 production result is still to come.** The 19.4 s → 3–4 s gain was measured with the route running locally under `next dev`. The < 8 s target is checked in the production check.

## Ready to ship

Top branch: **`issue-403-negative-length`** at `54621e4`, with this report on top. CI is green on `54621e4`: Python tests and Frontend tests.

The chain is stacked and pushed:

```
lane-doubt-prod-check           6e43fa4  (pending evidence from #421)
└ issue-405-road-detection      63f2d42  #405
  └ issue-398-wait-cues         4301b86  #398
    └ issue-409-default-length-audit  994d2ee  #409
      └ issue-399-ni-refusal-station  982c544  #399
        └ issue-401-download-package  27f69c2  #401
          └ issue-403-negative-length 54621e4  #403  (+ this report)
```

Worktrees: `.claude/worktrees/issue-405`, `issue-398`, `issue-409`, `issue-399`, `issue-401`, `issue-403` (top), and `lane-doubt-prod-check`.

Top-branch tests:
- pytest: 3612 passed, 2 skipped (254.87 s)
- mypy: "Success: no issues found in 49 source files"
- ruff: "All checks passed!", and 261 files already formatted
- vitest: 249 files passed, 1 skipped; 2639 tests passed, 1 skipped
- tsc: clean

The production-check list is posted on #423: https://github.com/rtmakatura/conestruct/issues/423#issuecomment-6462328492. It includes timing #401's six-render zip against `maxDuration = 60`, and the #403 line below.

## Filed

- #423: mission tracking. https://github.com/rtmakatura/conestruct/issues/423
- #424: the cue slot is 1.75 px taller with the cue in it than empty, a pre-existing P1 shift (from #398, corrected by comment). https://github.com/rtmakatura/conestruct/issues/424
- #425: the Jurisdiction cell's wording on a declined plan, and its verb mismatch (from #398). https://github.com/rtmakatura/conestruct/issues/425
- #426: the "MHT" wording in the render band and its announcement (from #401, quote corrected by comment). https://github.com/rtmakatura/conestruct/issues/426
- #427: a field's error prints twice, in caps under the field and in sentence case under Generate (from #403). https://github.com/rtmakatura/conestruct/issues/427
- #428: the work-zone length box turns a typed 0 into an empty field and says "required" (from #403). https://github.com/rtmakatura/conestruct/issues/428
- #429: the glyphless "yours" marker isn't in the glyph vocabulary, and an over-cap length still shows "✓ yours" (from #403's reviewer, filed by the orchestrator). https://github.com/rtmakatura/conestruct/issues/429

## Calls I made (orchestrator)

1. **Item order.** I picked #405, #398, #409, #399, #401 and #403 from the named set, by priority. #400, #404 and #419 each need a ruling first. #402, #406, #410 and #418 are priority-low and past the cap.
2. **What counts as a repair cycle.** I counted a code-comment edit (#405's `overpass.ts:10`) and an added test assertion (#398) as repair cycles, to be safe. Rounds that touched only the write-up used no cycle, per /mission § 2.2.
3. **The #399 screenshot retake.** I approved a clean retake, which isn't a park item, against the unexplained "last screenshot attempt" message (Question 4).
4. **A rewording I didn't fold.** I didn't fold #399's test-file comment rewording (a copy of the formula, not the production one), because it would have used a repair cycle for wording. The write-up states it instead.
5. **Co-Authored-By trailer.** I kept it as "Claude Opus 5.5 (1M context)", per this session's attribution instruction. Several diff-verifier runs flagged it against a different model name; that note doesn't apply to this session.
6. **The production-check list.** I posted it on #423 so that #401's latency check has a real home (R154).
7. **Cleanup.** I stopped a dev server left running by the #398 sub-agent: port 3399, from the issue-398 worktree.

Each item's own calls are in its `rulings.md` (`walkthrough-followups/<N>/rulings.md`), marked R145 self-ruled.

## Flakes

- `GeneratorShell.a11y-announce.test.tsx` (during #403). It failed once in a full run. It passed when re-run with the new test file, passed alone (1 file, 8 tests), and passed in the next full run. The record is in `403/full-run-fails.txt`.
- The #405 full-run failure in `tests/build-inputs.test.ts` was not a flake. It was a real gap, fixed by the one-line `vercel-ignore.sh` fold, and is recorded in `405/full-run-fails.txt`.

## Rule 5 misses (recorded in each item's rulings.md)

- #401: no churn prediction was written before the repair cycle 1 diff. The three existing UI test files came in at +98/-21 against ~+10/-10 predicted.
- #403: no prediction was written before the test-only import repair, which removed 5 duplicate import lines and a blank. The new test file came in at +149 against ~+110.

## Per item

Gate verdicts below are each gate's final-round verdict line, quoted verbatim, plus the reviewer's opening sentence. The earlier rounds are summarised. The full reports are in the session transcript; they weren't saved to disk.

### #405: road detection is slow and fails on the live site (`63f2d42`)

- **Change:** the picker's `/api/road-bearing` now asks the backend's two Overpass mirrors at the same time (`lib/road-detection/overpass.ts`), and the first good answer wins.
  - A 4xx, 429, 5xx or remark from one mirror is that mirror's failure only.
  - A mirror that sends a 429 rests for its Retry-After, or 60 s.
  - kumi is dropped, so the list matches `site_detection.py`, with a test that fails if the two drift apart.
  - There is a 10 s deadline per round trip (CHOSEN).
  - There is one log line per trip.
- **Measured:** the median was 19.4 s on the live site (before-2), and is 3.1 s and 4.1 s with the route running locally (after-1 and after-2).
- **Tests:** vitest 2607 passed, 1 skipped. 7 route tests are red on the base.
- **Gates:** 3 rounds, 1 repair cycle (a code-comment fix).
  - Diff-verifier, final: "VERDICT: PASS"
  - Reviewer, final: "PASS"
  - Earlier rounds: reviewer FAIL ×2 (write-up: medians, the claimed cause, the R74 quote, the comment's wait time).

### #398: two wait cues that never end (`4301b86`)

- **Change:**
  - `GeneratorShell.tsx:925` compares `wireScenario`, not `scenario`, with the debounced fetch scenario. So "◌ previous answer, refreshing…" clears after Generate. The cause is confirmed: after #224 the wire scenario is `withSiteScan(scenario)`.
  - On a declined plan, `windowsSummary` reads "not checked: the plan was declined". A check that failed without a decline reads "not checked: the check didn't answer".
- **Tests:** vitest 2612 passed, 1 skipped. 4 tests are red on the base.
- **Gates:** 2 rounds, 1 repair cycle (an added assertion).
  - Diff-verifier, final: "VERDICT: PASS"
  - Reviewer, final: "PASS"
  - Earlier rounds: reviewer FAIL ×1 (test count, the before-shot proof, #424's wording, the call 3 claim, the assertion guard).

### #409: the audit records a defaulted work-zone length (`994d2ee`)

- **Change:**
  - The render proxy relays `guesses.work_length = { startFt: 1000 }` while the length is untouched.
  - The backend owns `WORK_LEN_START_FT = 1000.0` (CHOSEN). It records the length as `source: "default"`, `operator_confirmed: false`, and refuses a mismatch with 400 `guess_stale`.
  - The audit PDF lists "Work zone length: 1,000 ft. Defaulted to the tool's starting length (nobody entered a length for this plan). The operator did not confirm it. Confirm the work zone length on site." under "Defaulted inputs".
- **Tests:** pytest 3603 passed, 2 skipped; mypy and ruff clean; vitest 2618 passed, 1 skipped.
- **Gates:** 2 rounds, 0 repair cycles.
  - Diff-verifier, final: "VERDICT: PASS"
  - Reviewer, final: "PASS"
  - Earlier rounds: reviewer FAIL ×1 (a line cite off by one, an overstated edge on the mobile kinds).

### #399: the near-intersection refusal names the station wrongly and gives no way forward (`982c544`)

- **Change:** only the message text changed. No check, station or placement changed.
  - The refusal now gives the distance from the work-start pin, and names two moves with numbers that clear it. Each move includes the cross street's half-width, now one shared helper, `cross_street_half_width_ft`.
  - The cause is confirmed: the station was printed in a frame where 0 is the work's downstream end.
  - Five other refusals also name a move now.
  - Message length is 344 characters, up from 167.
- **Tests:** pytest 3612 passed, 2 skipped; mypy and ruff clean. 6 tests are red on the base.
- **Gates:** 5 rounds, 0 repair cycles. The code hash was unchanged from round 1 (`5f490634cda4`).
  - Diff-verifier, final: "VERDICT: PASS"
  - Reviewer, final: "PASS. Nothing is blocking."
  - Earlier rounds: reviewer FAIL ×4, all on the write-up (character and line counts, which script took which shots, the no-pointer reasoning, a stale first-draft quote).

### #401: the download package's file count and filenames (`27f69c2`)

- **Change:**
  - The zip holds all six files: plan PDF, devices XLSX, crew PDF, crew MD, audit PDF and quote. It is labelled "6 files, with the quote".
  - Sandbox downloads are named `<road>_<kind>_<date>_<fingerprint>`, where the fingerprint is 6 hex characters of the plan as sent (CHOSEN). The zip is `<base>_package.zip`.
  - The quote saves as `.quote.xlsx`.
  - The zip waits on the audit, like the audit card does.
  - Saved plans and the quote's contents are unchanged.
- **Tests:** vitest 2631 passed, 1 skipped.
- **Gates:** 4 rounds, 2 repair cycles.
  - Diff-verifier, final: "VERDICT: PASS"
  - Reviewer, final: "PASS. I found nothing blocking: no false claim, no rule broken, and no acceptance line claimed but unmet."
  - Earlier rounds:
    - Diff-verifier REPAIR ×1, on a cite range. Its trailer note doesn't apply to this session.
    - Reviewer FAIL ×3: the acceptance line on name collisions, the quote/device name clash, an unfiled note, stale "4 files" text, and the latency check's home.

### #403: a negative length is reported as "required" (`54621e4`)

- **Change:**
  - `validateWorkZone` splits its check. A length below 0 reads "Work zone length must be more than 0 ft.", mirroring the backend's `Field(gt=0.0)` at `schemas.py:592`. An empty field or 0 still reads "required".
  - "◌ not set" shows only for 0.
  - A negative length's marker reads a plain "yours" with no glyph.
  - The manual-entry panel shows the new message too, since it uses the same validator.
- **Tests:** vitest 2639 passed, 1 skipped. 3 tests are red on the base.
- **Production-check line:**
  - On /sandbox, pin a road and pick a side and kind. Type -5 in "Work zone length (ft)" and tab out.
  - Expect: the field keeps "-5", and the marker reads "yours". "⚠ WORK ZONE LENGTH MUST BE MORE THAN 0 FT." shows under the field, and "Work zone length must be more than 0 ft." under Generate, with Generate disabled.
  - Clear the field: it reads "◌ not set" and "Work zone length is required."
  - Type 99999: it gives the 20,000 ft cap message.
  - Do this at 1440 and 390.
- **Gates:** 3 rounds, 0 repair cycles.
  - Diff-verifier, final: "VERDICT: PASS"
  - Reviewer, final: "PASS. Nothing is blocking. Six minor findings are listed at the end."
  - Earlier rounds: reviewer FAIL ×2, on the write-up (a false sentence about NaN, the flake not recorded as run alone).
