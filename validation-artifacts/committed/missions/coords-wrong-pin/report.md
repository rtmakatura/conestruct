# Mission coords-wrong-pin: report

2026-11-23. Tracking issue #549. Prompt: `docs/prompts/cc-prompt-coords-wrong-pin.md` (Ryan's rulings of 2026-11-23). Two items: #548 (ruling 1) and #547 (ruling 2).

**#547 is ready to ship. #548 is parked: the wrong pin from `39° 44.4` is still on the live site.**

## Questions for Ryan

### 1. #548 is parked after two gate rounds. Allow a third round?

- Round 2: diff-verifier "VERDICT: PASS", independent reviewer "REVIEW: FAIL". The two-round limit means the findings are filed (#550, #551), not repaired.
- The work is uncommitted in `.claude/worktrees/issue-548` (branch `issue-548-refuse-half-coords`, base `6561570`, 4 code files plus its evidence folder). Never remove it.
- Draft commit message: `validation-artifacts-extra/coords-wrong-pin/issue-548/commit-msg-draft.txt` (main checkout).
- What works in it: `39° 44.4`, `(39° 44.4)` and `[39° 44.4]` show the refused line, send 0 geocode requests and place no pin at 1440x900, 1198x930 and 390x844 (0 px moved, axe 0). `39° 44.406' N, 104° 58.866' W` pins at 39.7401, -104.9811. Every format in the base test file still gives the same point (113 of 115 literals identical; the other 2 moved from refused to a point, as stated).
- What is open:
  - #551: the fix refuses real road names. `E-470`, `W-470`, `W. 6` and `S-630-1` get the coordinates line and no search. Not on main; only in the parked work.
  - #550: the comments and the commit message say more is refused than the code refuses. `39.7401N104.9811W`, `39N104W`, `39.7401 N; 104.9811 W` and `39:44:24 N` still go to the geocoder.
- **Recommended: yes, one third round**, in a fresh session (`/start 548`), folding in #550 and #551, rebased onto the shipped #547.

### 2. Which lettered inputs may still go to the geocoder? (#548 call 4)

Ruling 1 says an input with a hemisphere letter is a full pair or refused. The parked work keeps two shapes as addresses, because the parser can't tell them from Utah-style grid addresses:

- one whole number and one letter: `39 N`, `100 S`, `E 13`;
- two whole numbers, each with its own letter, one N/S and one E/W: `500 N 200 W`, and so also `39N 104W` and `39 N 104 W`.

**Recommended: accept both shapes as addresses.** Whole degrees with no decimal are a town-sized guess, not a job site, and the geocoder still has to find a match.

### 3. Two space-only forms #541 accepted are now refused in the parked work (#548 call 3)

`39.7401° -104.9811` and `39.7401 N -104.9811` (a mark or letter on one half only) are refused, as a result of refusing `39° 44.4`. Neither is in #541's or #544's format list or tests. **Recommended: accept the refusal**; the line tells the operator what to type.

### 4. A degree sign on one half of a comma pair (#550 finding 2)

`39°, 44.4` still pins at 39, 44.4. Refusing it also refuses `39.7401°, -104.9811`. **Recommended: refuse both** (the same both-or-neither rule as the space-only forms). `39° 44.4°` reads as a full marked pair; leave it.

### 5. Left as they are, for the record

- `39 44.4` with no mark at all still pins at 39, 44.4. It is #541's ruled "space alone" format and carries none of ruling 1's marks.
- Lookalike degree marks (`39˚ 44.4`, `39* 44.4`, `39d 44.4`) are geocoded, as before.

## Ready to ship

Top branch: **`issue-547-dead-bearing-note`**. One go ships the chain:

| Commit | Branch | What |
|---|---|---|
| `8024972` | `issue-546-prod-check` | ux-map-window-tidy's production-check evidence (ships with this) |
| `6561570` | `prompt-coords-wrong-pin` | the prompt file |
| `e51cda0` | `issue-547-dead-bearing-note` | #547: the dead bearing note is deleted |
| (this commit) | `issue-547-dead-bearing-note` | this report |

The product change in the branch: none visible. `LocationPickerModal.tsx` loses a state that could never show.

Not in the chain: `issue-548-refuse-half-coords` (parked, uncommitted, not pushed).

## Filed

- #548 the half-coordinate wrong pin: https://github.com/rtmakatura/conestruct/issues/548
- #549 the tracking issue: https://github.com/rtmakatura/conestruct/issues/549
- #550 #548's write-up overstates the refusal; `39°, 44.4` still pins: https://github.com/rtmakatura/conestruct/issues/550
- #551 #548's parked fix refuses `E-470`, `W. 6` and `S-630-1`: https://github.com/rtmakatura/conestruct/issues/551

## Calls I made

Orchestrator:

- The mission is named `coords-wrong-pin`; two items, both small.
- #548 parked on the two-round rule though round 2's one blocker was write-up only. The rule allows write-up fixes without a gate only after both gates pass, and the same round found a code regression (#551).
- #547 stacks on `6561570`, not on the parked branch.
- #547 ran both gates. The cosmetic lane check's first line was `OUT OF LANE: 1 of 42 paths fall outside` (the one path is the prompt file in the base commit; with `--base HEAD` it prints `IN LANE: all 17 paths are frontend look-only`).
- The report is committed before the first push, so CI runs once on the top commit.

#547 (R145 self-ruled, in `issue-547/rulings.md`): the note is dead, so the delete went ahead; the section heading comment goes with the state; no CSS rule is removed (`.mw-note`, `.mw-search-line` and `.mw-search-list` are still used); the comment above the #543 tests is reworded; #547's finding 8 is folded in; finding 4 is not (the title at `:475` has no "tap" and is true as worded); the before run is the worktree before the edit.

#548 (R145 self-ruled, in the parked `issue-548/rulings.md`, calls 1 to 11): full degrees-minutes(-seconds) pairs with both hemisphere letters are accepted; the one refusal line is reworded to "Can't read that as coordinates. Enter latitude and longitude, like 39.7401, -104.9811."; calls 3, 4, 7 and 11 are questions 2 to 5 above.

## Flakes

None. No full suite was run locally.

## #547: the dead bearing note

- **Issue:** #547, findings 1 to 3 (ruling 2). Findings 4 to 7 stay open on #547.
- **Change (`e51cda0`):** removed from `conestruct/site/components/LocationPickerModal.tsx` the `bearingWarning` state and its heading comment (`:484-485` at the base), its two `setBearingWarning(null)` calls (`:782`, `:820`) and its slot in the floating list (`:1560`). Removed the source-text slot test from `LocationPickerModal.coords-bar.test.tsx` (`:498-512`). Comments reworded in the modal, `app/globals.css:5490` and the test file. No CSS rule, string, constant or helper changed. Churn: +2/-8, +1/-1, +11/-24 (predicted +2/-8, +1/-1, about +8/-22). The list is in `issue-547/removed.md`.
- **Tests:** vitest `LocationPickerModal.*` 12 files, 133 passed (134 at the base; one test deleted). `tsc --noEmit` clean. ruff "All checks passed!"; mypy "Success: no issues found in 49 source files". No red proof: the deleted code could not run.
- **Walk:** base vs fix at 1440x900, 1198x930 and 390x844, three states each (no line, the coarse-match notice, an out-of-range line): 0 px difference, the same list HTML in 3 of 3 states, axe 0. `issue-547/walk.md`.
- **Gates, one round:**
  - diff-verifier: "VERDICT: PASS" (marker `f395a4a4883a`).
  - independent reviewer: "REVIEW: PASS" (7 lows).
- **Write-up-only fixes after PASS:**
  - `rulings.md:17`: the `git log -S` command now carries `-- conestruct/site`; "keeps one `null` call" is "keeps the two `null` calls".
  - `removed.md:20`: the deleted test block is `:498-512`.
  - `removed.md:45`: the overshoot is explained as three comment lines, not two.
  - `checkpoint.md:9`: the test range at the base is `:499-512`.
- **Not fixed:** the reviewer's low 6, a test comment that says "nothing had set it since #507" (two `null` setters remained). It mirrors the ruling's words; editing it would change the marker's code hash. Its low 7: the before run has no served-code check; the reviewer judged the comparison sound from file times and #543's committed numbers.

## #548: no pin from half a coordinate (PARKED)

- **Issue:** #548 (ruling 1). Worktree `.claude/worktrees/issue-548`, branch `issue-548-refuse-half-coords`, base `6561570`, uncommitted.
- **Change (uncommitted):** `conestruct/site/lib/search-coords.ts` +128/-26, `lib/search-coords.test.ts` +179/-2, `components/LocationPickerModal.tsx` +27/-6, `components/LocationPickerModal.coords-bar.test.tsx` +116/-3. No CSS.
- **Tests:** vitest on the two changed test files 233 passed (122 at the base; 113 tests named `#548`). `tsc --noEmit` clean. Red proof: 49 of 92 fail on the old code, the bare form among them; 13 of 20 round-2 tests fail on the round-1 code.
- **Gates, two rounds:**
  - Round 1: diff-verifier "VERDICT: PASS" (marker `ed0ebe52093b`); independent reviewer "REVIEW: FAIL" (blocker: lettered whole-number coordinates such as `39 44 24 N 104 58 51 W` went to the geocoder). Repaired.
  - Round 2: diff-verifier "VERDICT: PASS" (marker `08180ab27a90`); independent reviewer "REVIEW: FAIL" (blocker, write-up only: three statements overstate the refusal; low: the `E-470` regression). Filed as #550 and #551.

## Leftover processes

None after either item (checked by command line for `issue-547` and `issue-548`).

## After the ship

- #547 is not visible, so no browser check for Ryan.
- Production check on the shipped sha: the map window's floating list in the three walked states at 1440x900, 1198x930 and 390x844 (boxes equal to `issue-547/walk.md`), 0 served scripts naming `bearingWarning`, axe 0, console 0. Then re-scope #547 with a comment (findings 4 to 7 remain) and leave it open; #549 stays open while #548 is parked.

## Addendum, 2026-11-23: #548 after gate round 4

Written in the `/start 548` session that followed this report. After three gate rounds on a refusal rule (never committed; findings in #550, #551 and #552), Ryan approved a fourth round with a rule that replaces it (verbatim in `issue-548/rulings.md` § Ryan's ruling, round 4): the search box places a pin only for two numbers that each have a decimal point, or for a full degrees-minutes(-seconds) pair with a hemisphere letter on both halves, and everything else goes to the geocoder. `39° 44.4` is searched and no longer pinned at 39, 44.4; `E-470`, `E 470 N` and `1437 N 14` are searched; #541's "Use decimal degrees" line is gone, so text the base refused with it (a lone `39.7401°`, `39.7401° N`, `-39.7401 S, 104.9811 W`) is searched too; that is a reading of the ruling's "keep only #541's out-of-range and swapped-pair lines", flagged for Ryan in `issue-548/rulings.md` call 1. #550, #551 and #552 are folded into #548. The sections above are left as written on the day; where they say #548 is parked or describe a refused line, `issue-548/rulings.md` is the current record.
