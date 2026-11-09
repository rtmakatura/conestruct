# #469 evidence (resumed): Details on the kind question floats; the band keeps one height

Rulings: `rulings.md` (Ryan's B4b answer; R1-R6). Plan and churn: `checkpoint.md`. Parked build's record (B1-B8, walks, crops): `../../ux-group6-wait-and-band/issue-469/`.

## How it was measured

- `script/walk469.mjs`, copied from the parked walk. The `details` mode adds 390, the floating panel's box, an on-top check and an Esc close. Each panel step also takes a full-page crop, because the band crop cuts the floating panel off.
- It runs with the parked `script/launch.cjs` and `script/serve_stub.py`, unchanged. That is local `next dev` on this worktree, Chromium at DPR 1, with Overpass stubbed (every ask a replay of `ux-group3-where`'s recorded answers; the stub's `overpass-asks.log` listed only `replay` and was deleted afterwards) and `/api/road-bearing` stubbed. The gate header rides only the site's own origin.
- On-top check: the topmost element at the panel's centre and 4 px inside each corner is the panel or inside it, with the panel scrolled on screen first. It is `onTop` in the output.
- Raw output: `walk/details.txt` (Details walk, axe and 44 px on every step), `walk/after.txt` (the parked 16-state default walk, re-run), and the per-step JSON in `walk/`.

## The band with Details closed and open (px)

| state | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| kind question, Details closed | 762.5 | 762.5 | 875.8 |
| kind question, Details open | 762.5 | 762.5 | 875.8 |
| kind question, closed again | 762.5 | 762.5 | 875.8 |
| near intersection chosen, Details closed | 762.5 | 762.5 | 920.8 |
| near intersection chosen, Details open | 762.5 | 762.5 | 920.8 |
| near intersection chosen, closed again | 762.5 | 762.5 | 920.8 |
| opened again, then Esc | 762.5 / 762.5 | 762.5 / 762.5 | 920.8 / 920.8 |
| **open minus closed** | **0** | **0** | **0** |

- At every size and state, opening Details changes none of these: the band, the stack, the road row, the card (545.3 in two columns), the action row's top (835.5 in two columns, 916.8 at 390) and the rows' top. The frame doesn't change either at 1440 and 1198 (624.3 at 256.5). Before (the parked option (d)), the band grew +3 / +48 and the action row moved 114.2 px.
- **One exception, at 390: the frame's top.** It moves from 265.8 to 270 at the step where Details closes again after near intersection was chosen (`ni-kind-details-closed`), and it stays at 270 for the rest of the walk. Its height (150), the road row, the action row and the band don't move. The likely cause is the sticky strip shifting after the walk's own `scrollIntoView` of the open panel (`script/walk469.mjs:115`), not the panel. The first open step at 390 (`kind-details-open`) reads 265.8, the same as closed.
- At 390 the band's height still differs between the two kind states (875.8 / 920.8). That is #456's strip following the card's content (ruling 3, unchanged, and it matches the parked walk), not Details.
- The panel: `position: absolute`, 280 px wide, its top 883.5 in two columns (the toggle's bottom 879.5 + `.a-pop`'s 4 px margin) and 964.8 at 390, 97 px tall. `onTop` and in the viewport at every size, so nothing clips or covers it. In two columns it floats over the band's foot and the WHAT band's header row below. At 390 it floats over the rows under the action row (crops).
- Esc closes it and focus goes back to the toggle (`Esc focus on toggle true` at all three sizes). A click outside closes it too (mounted test).

## The default walk (Details closed, all 16 CONFIRM states)

`walk/after.txt` has identical content to the parked `ux-group6-wait-and-band/issue-469/walk/after.txt`; only the line endings differ (LF vs CRLF). A `diff` of the full output at all three sizes, with carriage returns stripped, is empty. At 1440 and 1198 the band is 762.5 on every state (spread 0), and 390 matches the base.

## axe and 44 px

- axe: 0 violations on every step at every size, Details open or closed.
- The toggle ("Details", `button.nyq-details-btn`) is 49.5 x 44 at every size. Under 44 px at desktop: only the aerial zoom's `+` and `−` (32 x 32, rule 133), as before. None at 390.

## Rulings 6-8 (R6), re-measured

- **One map frame:** 624.3 px at the same top (256.5) on all 16 states and with Details open, at 1440 and 1198. The same node throughout (mounted test).
- **The mono line:** `p.a-aerial-line.tr-prov` sits in the reserved slot (`--wq-line-slot`). The frame and column are the same box with and without it (parked walk: side unanswered vs answered).
- **The checks:** `WhereBand.one-height.test.tsx`, 7 tests (the parked 6, plus the floating Details), and this walk. A CI layout check is #472.

## Tests

- Red proof (`red-vitest.txt`), run against the parked build (option (d)) with the changed test: 2 failed | 5 passed. The mounted test fails because the text is the in-flow `p.nyq-details`, not an `a-pop` panel. The CSS pin fails because option (d)'s open-Details rule is present.
- After: `WhereBand.one-height.test.tsx` 7 passed. Affected suites (`WhereBand*`, `BandAerial*`, `WhereQuestions*`, `QuestionSteps*`, `NeedsYou*`, the GeneratorShell WHERE-card, hit-targets, cross-street, kind and near-intersection suites, `undo-link`, `InfoToggle`, the road-pick picker): 25 files, 256 passed.
- Full vitest: 2989 passed | 1 skipped. The baseline on the rebased parked work was 2988 passed | 1 skipped; the +1 is the new test.
- `tsc --noEmit`: clean. pytest not run, because no Python changed.
- `scripts/cosmetic_lane_check.py`: `IN LANE: all 83 paths are frontend look-only`.

## Crops (`crops/`)

`1440x900-kind-details-open-page.png`, `1440x900-ni-kind-details-open-page.png`, `1198x930-ni-kind-details-open-page.png`, `390x844-kind-details-open-page.png` and `390x844-ni-kind-details-open-page.png`. Each is a full-page crop from the band's top to the panel's bottom. In the 390 crops the app's sticky nav is drawn over the band's step header, an artefact of full-page capture.
