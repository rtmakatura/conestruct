# Mission ux-group8-map-window — report

Tracking #508. One large item: #507 (from `docs/prompts/cc-prompt-ux-group8-map-window.md`, folds in #506). 2026-11-11.

## Questions for Ryan

1. **#507 is PARKED after two gate rounds.** Round 2: the diff-verifier gave PASS, the independent reviewer gave FAIL. Under the gate budget, the findings are filed as #511, #512 and #513, and nothing is committed.
   - **Recommendation:** allow a third round for #507 only. The three follow-ups are small and sit in files the diff already touches: a picked mark on the four direction tiles; honest words for untagged motorways and reversible ways; plain words for the preview panel and geocode strings; two stale comments; the checkpoint's lists. That round would fold #511–#513 into #507, run both gates once, and commit.
   - **Alternative:** `/start 511`, then 512 and 513, in the parked worktree; that's the same work under the rule as written.
   - Either way, this needs your go, because a third round goes past the two-round rule.
2. **Where the grouping runs (R145-1).** Ruling 2 says "the backend decides the grouping". The grouping runs in the Next server's road-list route (`lib/road-detection/group.ts`, called by `/api/road-bearing`). The Python backend decides which side goes with which carriageway. The diff-verifier didn't count this as a Rule 3 break. Say so if you want the grouping moved to Python.

## Ready to ship

Nothing new. The top branch is `mission-mwsl-prod-check`, and it holds evidence and docs only:
- `121eb57`: the #488 production check.
- `dc9fcba`: this prompt, now tracked.
- This report.

Evidence never ships alone (R154), so don't ship this branch by itself; it stays the base for #507's commit.

## Parked

- **#507:**
  - Worktree `C:\Users\rtmak\Documents\traffic-control-tool\.claude\worktrees\issue-507`, branch `issue-507-map-window`, base `dc9fcba`. Uncommitted: 49 tracked files plus untracked tests, `group.ts`, `carriageway-swap.ts`, and the evidence folder with 50 crops. Never remove it.
  - Draft commit message: `validation-artifacts-extra\ux-group8-map-window\commit-msg-draft.txt` (main checkout).
  - Open gate findings: #511, #512, #513.

## Filed

- #507, the item: https://github.com/rtmakatura/conestruct/issues/507
- #508, tracking: https://github.com/rtmakatura/conestruct/issues/508
- #509, PDF page 2 words a diagonal road's traffic in four directions: https://github.com/rtmakatura/conestruct/issues/509
- #510, the permanent checks can't reach the new window states (re-scoped after round 1): https://github.com/rtmakatura/conestruct/issues/510
- #511, the direction tiles show the picked one by colour alone (Rule 13): https://github.com/rtmakatura/conestruct/issues/511
- #512, "Traffic both ways" on untagged motorways and reversible ways (Rule 12): https://github.com/rtmakatura/conestruct/issues/512
- #513, untraced preview and geocode strings, stale comments, checkpoint lists: https://github.com/rtmakatura/conestruct/issues/513

## Calls I made

- The prompt is committed on `mission-mwsl-prod-check`, not on `main` (branch-first). The untracked copy in the main checkout stays.
- #507's agent's R145-1 to R145-12 are in the parked worktree's `rulings.md`. The ones to look at:
  - R145-1: where the grouping runs (question 2).
  - #300's left curb is kept, so shoulder work on a one-way street still asks for the side.
  - The fallback also covers "no road found".
  - #498 is a different problem (the band's geometry retry), so it stays open.
  - R145-11: a divided road's lone carriageway reads "Divided road", never "One-way".
  - R145-12: no Undo on a side picked for you.
- I didn't apply the diff-verifier's round 1 note asking to change the commit trailer; this session's attribution is `Claude Opus 5.5`.

## Flakes

None. No full suite was run (CI owns them).

## #507 — map window (parked)

- **Change** (uncommitted):
  - The W1 look.
  - One entry per street.
  - The side question with the traffic beside each side.
  - A one-way side picked for you, with a line saying why.
  - The F1 failure panel, with a working Try again and four directions.
  - The F2 sides.
  - Diagonal side names.
  - Save only with an answer (#506).
  - `verify-columns-end-together.mjs` passes again: 31 states, 6 runs, 0 px; band 793.25.
- **Device counts:** unchanged. No fixture or snapshot changed; `test_the_twin_relay_moves_no_device` and the diagonal-vs-cardinal device test pass.
- **Tests** (changed files only):
  - vitest `1769 passed | 1 skipped`, gate run `127 files, 1227 passed`.
  - pytest `296 passed`, gate run `28 passed`.
  - tsc, ruff and mypy clean.
  - Red proof: 5 new tests fail on `dc9fcba`.
- **Walk:** axe 0 across 36 window and 18 band readings. 44 px: 0 at 390. At desk widths the Latitude and Longitude boxes are 43 px; that predates this change (D3).
- **Gate rounds used:** 2 of 2.
  - Round 1 diff-verifier: "VERDICT: PASS" (marker hash `9f1123e79eaf`).
  - Round 1 independent reviewer: "FAIL". Eight findings: a direction named before the side was picked; a divided road called one-way; an Undo that did nothing; the commit message overclaimed default lengths; walk.md and crop mismatches; crops missing at 1198 and 390; the D1 line never walked; the columns check regressed. All eight were repaired.
  - Round 2 diff-verifier: "VERDICT: PASS" (marker hash `866c57b5f7b3`).
  - Round 2 independent reviewer: "FAIL". Findings: (1) Rule 13, the direction tiles signal the pick by colour alone, `globals.css:5611` (#511); (2) Rule 12, `roadRowLine` `LocationPickerModal.tsx:1942` says "Traffic both ways" for an untagged motorway and for reversible ways (#512); (3) rulings 1 and 4, the `CorridorPreviewPanel` strings and the geocode notice were never traced (#513); (4) stale "saveable" comments at `:1419` and `:1426-1428` (#513); (5) checkpoint.md's R145 range and string list are incomplete (#513); (6) a note, not a defect: the after-Try-again crop looks the same as the failed one.
- **Write-up-only fixes after PASS:** none (it never reached PASS from both gates).
- **Processes:** the walk helper started and stopped a stub backend, a Next dev server and Playwright browsers. Checks after each step found none left.
