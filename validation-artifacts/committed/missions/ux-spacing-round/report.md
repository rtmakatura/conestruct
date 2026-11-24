# Mission ux-spacing-round: report

*2026-11-24. Tracking issue #558. Prompt: `docs/prompts/cc-prompt-ux-spacing-round.md` (Ryan's rulings, 2026-11-24).*

## Questions for Ryan

Nothing is parked. Five calls to judge in the hand check; each is recorded and none blocks the ship.

1. **The hours row is 8 px taller (100 to 108 px), and so is the What section** (#557, S6). Ruling f asks for 8 px more space above the hours link; "All items" says rows don't change height. The build keeps the row the same height in each of its states and lets it grow by the 8 px. Recommendation: accept; the only other way is to take the 8 px from inside the row.
2. **"Change" was restyled on both collapsed rows (Where and What)** (#557, S2). The ruling names the Where row. Both rows share one link. Recommendation: accept, so the two rows match.
3. **The week note sticks to the bottom of the window body** (#556, S12). It is whole at rest in every reading, but while a view runs long it covers 8 to 80 px of the chart's bottom until scrolled, with no sign that more is below (#561). Worst case: 390x600 with no street class, where it hides the "6 am" tick, the "No record" caption and the bars' ends. Recommendation: accept for now and take #561 next.
4. **The work-hours window is 640 px tall at 600 px wide and under** (#556, S10, CHOSEN; it was 600).
5. **A shift that crosses 6 am draws as two pieces on one day** (#555, S2), e.g. 4 am to 2 pm. The scale is cut only at 6 am, and hours before 6 am draw on the day the backend scores them against (`src/rules/jurisdiction.py:537-543`). Crops: `issue-555/crops/555-early-start-*.png`.

Also for the hand check: with no street class the bars are hollow while the key's "Your hours" swatch is solid (#561); at 390 the aerial's Reset ends 9 px above the Mapbox logo; the aerial's zoom controls sit in a row under the bar in one column above 480 px (#557, S11).

## Ready to ship

Top branch: **`issue-557-page-fixes`**. One go ships the chain.

| Commit | Branch | What |
|---|---|---|
| `53cd8ee` | `issue-554-prod-check` | #554's production-check evidence (ships with this) |
| `aca2d8bd` | `prompt-ux-spacing-round` | the prompt, tracked in `docs/prompts/` |
| `d46b0914` | `issue-555-six-to-six-chart` | #555 |
| `c7fc482e` | `issue-556-hours-window-fixes` | #556 |
| `a55a232b` | `issue-557-page-fixes` | #557 |
| this commit | `issue-557-page-fixes` | this report |

The untracked prompt copy moved to `validation-artifacts-extra/ux-spacing-round/cc-prompt-untracked-copy.md` (untracked, main checkout, not committed).

## Filed

- Items: #555, #556, #557. Tracking: #558.
- Follow-ups: #559 (Loveland's labels an hour apart overlap on the ruler; computed, not walked), #560 (#555's review lows), #561 (no key entry for the hollow bar; no "more below" sign; plus #556's round-2 lows as a comment), #562 (a source line's focus ring crosses the field label above it), #563 (the columns check is red on the base), #564 (#557's review lows).

## Calls I made

Orchestrator:
- The prompt went on its own branch under the items, as in the last four missions.
- All three items ran both gates. The lane check said OUT OF LANE for each: #555 only because the prompt file on the base branch falls in the check's default range; #556 and #557 because their strings live under `lib/scenarios/`.
- The "also" items (the stale S9 comment and the ▾ marks) stayed in item 3, as the prompt lists them.
- The spacing-round list's #438 rows and #544 rest were not built: `validation-artifacts-extra/spacing-round-before/index.md` (untracked, main checkout, not committed) notes 1 to 4 record that they are already fixed on the live site, and the prompt does not rule on them.

Per item: each item's `rulings.md` (R145 self-ruled S-numbers): `issue-555/rulings.md` S1 to S11, `issue-556/rulings.md` S1 to S12, `issue-557/rulings.md` S1 to S11.

## Flakes

None seen. No full suite was run locally. One discarded run: #557's first walk used a dev server started outside `conestruct/site` (no styles) and was redone.

## Per item

### #555: both views on a 6 am to 6 am day (large)

- **Change:** the week view and the weekday ruler run 6 am to 6 am, ticks at 6 am, noon, 6 pm, midnight, 6 am; midnight is stronger with a dashed line across each day; spans that cross midnight draw as one piece. Placement only: three code files, no backend or `lib/` change.
- **Tests:** baseline 2 files, 47 passed; red proof on the base 15 failed, 31 passed (46); final 2 files, 58 passed; tsc clean. Walk: 30 readings at 1440, 1198 and 390, axe 0, 0 controls under 44 px in the 28 readings measured.
- **Diff-verifier:** "VERDICT: PASS" (marker `23316e3af8cd`).
- **Independent reviewer:** "REVIEW: PASS" (37 of 37 images opened).
- **Gate rounds:** 1.
- **Write-up-only fixes after PASS:** `rulings.md` S10's example sentence and S4's quote and cite; "not measured" in place of a defaulted 0 in `measures-summary.txt` and `script/summary.mjs`; `walk.md` says the nine 1198 crops equal their 1440 twins; four before-shot citations marked untracked.
- **Not run:** the columns check (the diff touches only `.whd-*` rules).

### #556: three fixes in the work-hours window

- **Change:** the key gains "No closures allowed" with a striped swatch when a day is striped; with no street class (the backend's `allowed: null`) your hours draw hollow and dashed in both views under the ruled notice; the week note is reworded and sticks to the body's bottom edge; the window is 640 px tall at 600 px wide and under. Five code files, no backend change.
- **Tests:** baseline 13 files, 199 passed; red proof on the base 9 failed, 68 passed (77); final 13 files, 209 passed; tsc clean. Walk: 34 readings plus 48 worst-case readings, no failed checks, axe 0, nothing under 44 px.
- **Round 1:** diff-verifier "VERDICT: PASS" (marker `d9d011008e85`); independent reviewer "REVIEW: FAIL". Two mediums: the 390 fit was measured with the wrong subtitle (the real no-class subtitle is three lines and the note would have been cut), and one wrong row in `walk.md`. Repaired: the sticky note (S12), the real state walked with worst-case wording, the one-day note reworded to "Your date: Wed Dec 9. No work on the other days."
- **Round 2:** diff-verifier "VERDICT: PASS" (marker `2cf01a4befba`); independent reviewer "REVIEW: PASS" (41 of 41 images opened).
- **Gate rounds:** 2.
- **Write-up-only fixes after PASS:** the commit message says 9 new tests, 7 mounted and 2 on the stylesheet source; `rulings.md` S12's cost line gains the 13.13 px reading. Round 2's lows went to #561 as a comment.

### #557: four page fixes, the stale comment, the clip arrows

- **Change:** "CHANGE" reads "Change" (Inter 13.5/600, `--act`, 58.66 x 44) on both collapsed rows, rows keep their height; the aerial's +, − and Reset are 44 px at every width; the hours link has 8 px more above it and its ring clears the sentence; "Default" is 46.45 px wide with the word unmoved; the comment cites P15; all four clip arrows (▾ included) are removed as unreachable on the 6 am to 6 am chart.
- **Churn misses (recorded in `issue-557/checkpoint.md`):** row text 2.5 px lower against 2 predicted; `lib/design/type-exceptions.ts` changed (236 to 235); S11 added after the walk found Reset over "Use the big map instead" at 768.
- **Tests:** baseline 20 files, 288 passed; red proof 7 failed, 90 passed (97); final 20 files, 297 passed, and 5 more files, 28 passed; tsc clean. Walk: axe 0, 0 overlaps in 11 frame readings.
- **Columns check:** RESULT FAIL on the base and on this commit, the same 20 FAIL lines per size at 1024, 1198 and 1440 but for the hours row (100 to 108) and the section height; 390 not run. Filed as #563.
- **Diff-verifier:** "VERDICT: PASS" (marker `38b0de71e370`).
- **Independent reviewer:** "REVIEW: PASS" (40 of 40 images opened).
- **Gate rounds:** 1.
- **Write-up-only fixes after PASS:** `rulings.md` S9's cite (`:76-93`); `walk.md` says Reset stays mono as on the base, that the hours row is 8 px taller, and that the columns check's FAIL lines are checkable from the committed files only. The reviewer's code lows are #564.

## Before the push

ruff: "All checks passed!". mypy: "Success: no issues found in 49 source files". CI on `a55a232b`: Frontend tests and Python tests both green.

## After the ship

Production check at 1440x900, 1198x930 and 390x844, real site, read-only, on a new evidence branch:
- #555: 8 pm to 5 am and 9 am to 3 pm in both views; the five ticks; one bar across midnight; axe 0.
- #556: the week note whole at 390 (Dec 7 to Dec 11, 9 am to 3 pm and 7 am to 5 pm). The no-closures key and the no-class state need a browser edit of one answer, as in the before shots.
- #557: "Change" on both rows; the aerial zoom's size; the hours link's focus ring; the "Default" links' width; no arrows in the night week.

Then close #555, #556, #557, #534 (both its page parts are done; its third part is crop framing only) and #558. Browser check for Ryan: the work-hours window and the four page fixes (visible design).
