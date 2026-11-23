# Mission ux-map-window-tidy: report

2026-11-22. Tracking issue #546. Prompt: `docs/prompts/cc-prompt-ux-map-window-tidy.md` (Ryan's rulings of 2026-11-22). Three items, all committed; nothing parked.

## Questions for Ryan

Nothing is parked. These are for the hand check and for a ruling when you have one:

1. **The bearing note can never show (#543).** Nothing has set it since #507 moved its messages to the right panel. Ruling 2 says "move", so only its empty slot moved into the floating list; there is no crop or 0 px measure for it, because it can't be made to appear. Recommended: delete the dead state (about 5 lines), filed in #547.
2. **The floating notice covers the top of the map (#543).** While the coarse-match notice shows, it lies over the top 23.5 px (1440), 41 px (1198) or 58.5 px (390) of the map, and that strip can't be tapped. A tap below it places the pin and clears the notice. Recommended: accept; judge it on `issue-543/shots/390-coarse-notice-window.png`.
3. **"Did you mean" at 390 is two lines (#544).** "Did you mean" on the first, "39.7401, -104.9811?" whole on the second. The sentence needs 237.17 px and the button has 234.16 px. This meets ruling 3 (the pair doesn't wrap in the middle) but not #544's older "one line" acceptance. Recommended: accept; judge it on `issue-544/shots/390-did-you-mean.png`.
4. **A new wrong-pin input (#544).** `(39° 44.4)` and `[39° 44.4]` were refused before and now place a pin at 39, 44.4, the same as the bare `39° 44.4` has since #541. That is #544's finding 3, which ruling 3 sent to the spacing round, so it was not fixed here. Recommended: fix the bare and bracketed forms together in the spacing round (handoff.md names both).
5. **The attribution button's tap area with the line open (#545).** At 1198 with the line closed the tap area is the full 44 x 44. With the line open it is 44 x 44 less a 6 x 20 px notch, left so taps there still reach Mapbox's "© Maxar" link. The button is not added to #505's exception. Recommended: accept the notch.
6. **Hover on the attribution button (#545).** A mouse in the 10 px band round the 24 px button now shows Mapbox's own hover ground. Nothing changes at rest. Found by the reviewer, not measured in the walk; filed in #547. Recommended: accept.

## Ready to ship

Top branch: **`issue-545-ring-attribution`**. One go ships the chain.

| Commit | Branch | What |
|---|---|---|
| `3de63cf` | `issue-542-prod-check` | #541's production-check evidence (ships with this) |
| `5ab1032` | `prompt-ux-map-window-tidy` | the prompt file |
| `52b8067` | `issue-543-notices-float` | #543 |
| `5737d8d` | `issue-544-brackets-nowrap` | #544, two fixes |
| `86712cd` | `issue-545-ring-attribution` | #545 |
| (this commit) | `issue-545-ring-attribution` | this report |

The untracked prompt copy in the main checkout moved to `validation-artifacts-extra/ux-map-window-tidy/cc-prompt-untracked-copy.md`.

Lane check on every item: OUT OF LANE (the chain carries `lib/search-coords.ts` and the prompt file), so both gates ran on each.

## Filed

- #545 the no-pin mark and the "Toggle attribution" button (item 3; rulings 1 and 4): https://github.com/rtmakatura/conestruct/issues/545
- #546 tracking: https://github.com/rtmakatura/conestruct/issues/546
- #547 follow-up, the reviewers' lows not repaired in the mission: https://github.com/rtmakatura/conestruct/issues/547

The rest of #544 (trailing punctuation and `lat`/`lng` prefixes, the lone degrees-and-minutes value in bare and bracketed form, the ordinal sign, the hidden live region) is on the spacing round list in handoff.md, per ruling 3. #544 itself closes after the ship with a comment saying so.

## Calls I made

Orchestrator:
- Four rulings, three items (the mission cap): rulings 1 and 4 share #545, with the Cancel and Close measure.
- #544's `(39° 44.4)` consequence is recorded, not fixed: fixing it is #544 finding 3, which ruling 3 defers.
- The reviewers' code-level lows went to #547, not into the commits, so the verdict markers stand.

Per item (each recorded as "R145 self-ruled" in the item's `rulings.md`):
- #543: the bearing note's slot moves, no deletion and no faked evidence; the notice keeps its words and its quiet `--ink-faint` colour and comes first in the list; it is now announced through the list's `role="status"`; the covered strip of map is accepted as the cost of floating; tests live in the coords-bar suite.
- #544: "in brackets" means one matching pair, round or square, round the whole text; CHOSEN: a mismatched pair, one bracket alone, two pairs, brackets round each number, curly, angle or full-width brackets and text outside the brackets stay an address; the "?" sits inside the no-wrap span so the button's accessible name is unchanged; the two-line choice at 390 stands.
- #545: ruling 4's CSS-only branch; the open-line notch leaves Mapbox's link its taps; `data-pin` on the existing mark, with the ring as the base rule so a missing state draws as "no pin"; the 2 px stroke is CHOSEN (the ruling gives no width); Escape was walked beside Cancel and Close as the control.

## Flakes

None. No full suite ran locally. One measurement oddity: in #545's walk, 1 pixel of 6,360 on Mapbox's full attribution line at 1440 differs by one colour step between the base run and the fix run; the button isn't shown at 1440 and no rule of the change draws there.

Process: the first push hung on the Windows credential prompt and was stopped; the second, through gh's credential helper, went through.

## #543: the coarse-match notice floats

- **Change:** the notice "That search found a town or area. Tap the map on the road where the work starts." and the bearing note's slot render inside #541's floating list. `globals.css` changes a comment only. No string is new or changed.
- **Measure:** the map, search row, right panel and bar move 0 px between the notice not shown and shown, at 1440x900, 1198x930 and 390x844. On the base the map moved 17.5 px at 1440 and 1198, and the map, bar and panel moved 35 px at 390 (`issue-543/before-walk.json`).
- **Tests:** red proof `4 failed | 1 passed` (the pass is a control); after, `Tests 63 passed (63)`; tsc clean. axe 0 in 9 runs; smallest control 79.84 x 44.5.
- **Gates, one round:** diff-verifier "VERDICT: PASS" (marker `1b257d739b0e`); independent reviewer "REVIEW: PASS".
- **Write-up-only fix after PASS:** the base-run numbers were committed as `before-walk.json` and `walk.md` points to them (the reviewer's low 1).
- **Evidence:** `issue-543/` (rulings.md, red-proof.txt, walk.md, strings.md, shots/).

## #544: brackets parse; the 390 pair stays whole

- **Change:** `lib/search-coords.ts` drops one matching pair of round or square brackets round the whole text before reading it, at both geocode senders. The choice's two numbers and "?" are one no-wrap span. No string is new or changed.
- **Measure:** `(39.7401, -104.9811)` and `[39.7401, -104.9811]` place the pin with 0 geocode requests at all three sizes. The numbers take 1 line at every size; the choice is 1 line at 1440 and 1198 and 2 at 390; the choice is 44 px high; the map, search row, panel and bar move 0 px.
- **Tests:** 25 new (19 parser, 6 mounted); red proof `13 failed | 12 passed` (the 12 are controls); after, `Tests 123 passed (123)`; tsc clean. axe 0 in 12 runs.
- **Gates, two rounds:**
  - Round 1: diff-verifier "VERDICT: PASS" (marker `3906b10ff001`); independent reviewer "REVIEW: FAIL", on the write-up only: "Before, it was geocoded" was false for bracketed text with a degree sign. The builder corrected the write-up; no code changed.
  - Round 2: diff-verifier "VERDICT: PASS" (marker `3906b10ff001`, the same hash); independent reviewer "REVIEW: PASS".
- **Write-up-only fix after PASS:** one more "before" case added to `rulings.md` (b) and the commit message: a bracketed pair with a degree sign that is out of range or swapped got the "Use decimal degrees" line before.
- **Evidence:** `issue-544/` (rulings.md, red-proof.txt, walk.md, strings.md, shots/).

## #545: the no-pin ring; the attribution button's tap area; Cancel and Close

- **Change:** the mark beside the bar's text carries `data-pin`; with no pin it is a ring (2 px `--ink-faint` outline, no fill), with a pin the `--dim` dot. A transparent 44 x 44 `::after` on Mapbox's compact attribution button takes the taps, with a 6 x 20 px notch while the line is open. No string is new or changed.
- **Measure:** the bar is 44 px high and the mark 10 x 10 at the same place in both states at all three sizes. Ring contrast 6.47:1, dot 7.32:1. At 1198 the points of the 44 x 44 square that reach the button go from 625 to 1,936 of 1,936 with the line closed, and to 1,816 with it open. The attribution's pixels: 0 differ with the `::after` on against off. Cancel, Close and Escape, 9 of 9: the window closes, focus returns to "Pick on map", the page moves 0 px, no non-GET request goes to the site.
- **Tests:** 9 new (5 mounted, 4 static); red proof `8 failed | 1 passed` (the pass is a control); after, `Tests 56 passed (56)`; tsc clean. axe 0 in 6 runs; no control under 44 px apart from Mapbox's logo and attribution links (#505).
- **Gates, one round:** diff-verifier "VERDICT: PASS" (marker `d5da56f73c62`); independent reviewer "REVIEW: PASS".
- **Write-up-only fixes after PASS:** the `outcome.md` cite moved from line 68 to 70; the bar crops' width at 390 stated (388); the hover finding and the unwalked widths added to `walk.md`; the commit message says "no non-GET request" and names the hover.
- **Evidence:** `issue-545/` (rulings.md, red-proof.txt, walk.md, compare.json, strings.md, before/, shots/, first-build/).

## Top-branch checks before the push

ruff "All checks passed!"; mypy "Success: no issues found in 49 source files"; the four changed test files `149 passed (149)`; tsc exit 0. CI green on `86712cd` (Python tests and Frontend tests); the run on this commit is in the tracking issue's summary comment.

## After the ship

Production check at 1440, 1198x930 and 390, read-only, on a new evidence branch:
- #543: search "Lafayette, CO"; the notice floats; the map, search row, panel and bar move 0 px; a tap below it places the pin.
- #544: both bracket forms place the pin at 39.7401, -104.9811 with 0 `/api/geocode` requests; "-104.9811, 39.7401" at 390 shows the pair whole.
- #545: the ring with no pin, the dot with one, the bar 44 px; the attribution button's tap area at 1198, closed and open; Cancel and Close.
- axe, the 44 px measure, console, the token scan.

Then close #543, #544 (naming what went to the spacing round), #545 and #546. Browser check for Ryan: the map window (visible design).
