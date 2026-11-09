# #469 checkpoint: the plan and the Rule 5 churn prediction

> **Resumed 2026-11-09 in mission `ux-wait-band-followups` (#478).** Ryan answered B4b: Details on the kind question is a tooltip (Part 2 ruling 5). Option (d) below is superseded and removed. The resume's plan, prediction and evidence are in `validation-artifacts/committed/missions/ux-wait-band-followups/issue-469/`. Everything else here stands as the record of the parked build.
> (Was: PARKED for Ryan after the third review, with both code repair cycles used. B4b was open: with Details open, the toggle and action row moved 114.2 px and the band 3 / 48 px. Options (a) / (b) / (d) are in `rulings.md` B4b.)

Written before the diff (the source and test changes came after this file's first write). Rulings: `rulings.md`.

## Plan (5 bullets)

1. **Problem:** at a band width of 720 px and up the stack is a row with `align-items: flex-start` (`conestruct/site/app/globals.css`, #456 block, `@container (min-width: 720px)`, `.wq-stack[data-aerial]`), so the band's height is whichever column is taller: the aerial (560 frame, plus a line once sided) or the right column (road row + the open card, 352 to 521 px). Measured spread 63.8 px (674.5 to 738.3) across the walked states at 1440 and 1198.
2. **Rulings:** Ryan's Part 2 rulings 1-4 (above), #456 M1-M4; B1-B8 here.
3. **Change:** CSS only, in the #456 block: two custom properties on `.wq-wrap`; in the two-column container query the aerial column at `--wq-band-h`, the frame at `--wq-band-h - --wq-line-slot` (window cap kept), and with the card open the right column's `min-height`, the card's stretch, the action row's `margin-top: auto`, the rows' 48 px. A new test file. No TSX change.
4. **Rule 5 churn prediction:** below.
5. **Proof:** the new vitest (mounted states + CSS pins), red-proved against the base CSS; affected vitest; tsc; the walk before/after at 1440x900, 1198x930 and 390x844 with each state's band height, axe and the 44 px measure; crops committed under `crops/`.

## Rule 5 churn prediction (written before the diff)

Changes:
- `conestruct/site/app/globals.css`: in the #456 block only. `.wq-wrap` gains `--wq-band-h: 624px` and `--wq-line-slot`. In `@container (min-width: 720px)`: `.wq-stack[data-aerial] > .a-aerial` gains `height: var(--wq-band-h)`; the frame's `height: min(560px, ...)` becomes `min(calc(var(--wq-band-h) - var(--wq-line-slot)), ...)`; new rules for `.wq-stack[data-aerial][data-card="open"]` on `> .wq-side` (min-height), `.wq` (flex column, grow), `.nyq-card` (grow), `.nyq-foot` (margin-top: auto), `.nyq-row` (min-height 48px). About 30 lines with comments. No line outside the #456 block changes; the narrow container query is byte-identical.
- `conestruct/site/components/bands/WhereBand.one-height.test.tsx`: new.
- Evidence under `validation-artifacts/committed/missions/ux-group6-wait-and-band/issue-469/`: new.

Measured behaviour, predicted:
- 1440x900 and 1198x930: the band's height is one number on every walked CONFIRM state (0 px spread), the stack 624 px, the aerial frame 600.25 px (from 560) at the same top, the road row the same box on every state. The band is 0 to 49.8 px taller than before on a given state (the old 674.5-738.3 becomes 738.5 ± 0.2, the old tallest + 0.2 rounding).
- The action row's distance from the card's bottom is one number per flow (74 for kind / side, 122 for kind / tap / side).
- 390x844: every state's band height, stack height, frame and road row byte-identical to the before-walk.
- axe: 0 violations, as before. 44 px measure: the same 2 small targets at desktop as before (the zoom's 32 px pair, rule 133), 0 at 390.

Unchanged (byte-identical): every TSX file; `QuestionSteps.tsx` (shared with NEEDS YOU); NEEDS YOU's card; the narrow container query; the picker; every other band; the backend.

Test churn: +1 file. No existing test changes. Existing CSS-pin tests on the #456 block (`WhereBand.strip-question.test.tsx` N1 pins, `BandAerial.test.tsx`) are expected to pass unchanged; if any pins the 560 text, that is a predicted change and is listed here before it is edited.

## Repair 1 (the reviewer's FAIL): what changed, and its prediction

The reviewer found that the first build put the action row at the foot of the question block, above the rows. It sat 74.1 / 122.1 px above the card's bottom and moved 48 px between flows, where ruling 1 says "pinned to the card's bottom". The repair:
- `globals.css`: in the open-card rules, `.wq` drops its flex-column and gains `position: relative` and a reserved `padding-bottom`; `.nyq-foot` changes from `margin-top: auto` to `position: absolute` at the card's bottom inset; the `.nyq-card` grow rule and B5's `.nyq-row` 48 px rule are removed; `--wq-band-h` goes from 631px to 648px.
- Predicted at the time of the edit (arithmetic, in the session before the re-walk; not written to this file before the CSS edit, which is a Rule 5 timing slip stated here): every card's content +24 (it loses the 60 px gap-plus-button from the question block and gains 84 px of reserved room), so the tallest right column goes from 623.8 to 647.8 and the band value to 648. The frame goes to 624.25. The action row sits 25 px above the card's outer bottom (1 px border + 24 px inset) on every state. 390 is unchanged.
- Test: the B5 pin and the `.nyq-card` / `margin-top: auto` pins are replaced by pins on the card's reserved padding and on the foot's `position` / `left` / `right` / `bottom`, plus a guard that the two-column block reorders nothing (`order`) and resizes no row or question block.

## Churn, predicted vs actual (final, after repair 1)

- `globals.css`: predicted about 30 lines in the #456 block only. Actual: all in the #456 block, the narrow container query byte-identical (`git diff --stat` in the report). TSX: none changed, as predicted.
- **Deviation 1 (build 2): `--wq-band-h` 631 instead of the predicted 624.** B5's rows made the near-intersection kind card 528; the first after-walk (`walk/after-pass1.txt`) showed a 6.8 px spread. Superseded by repair 1.
- **Deviation 2 (repair 1): `--wq-band-h` is 648**, the re-traced tallest (647.8) once the action row sits at the card's bottom; B5 withdrawn.
- Final walk (`walk/after.txt`), 1440x900 and 1198x930, all 16 CONFIRM states: band 762.5 (spread 0; before 674.5 to 738.3, spread 63.8); stack 648; frame 624.3 at the same top (256.5); road row the same box (256.5 / 86.8).
- Action row, the same 16 states at both sizes: top at 835.5 every time (0 px move); `foot->bottom` 25.1 (the card's 1 px border + its 24 px inset); offset past that inset 0.1 (sub-pixel). As predicted.
- 390x844: every measured value of every state is identical to the before-walk: band, stack, frame, road row, card, `foot->bottom`, axe and the target list. The only difference in the text is the two fields the walk added in repair 1 (`foot top`, `offset`).
- axe: 0 violations on every state at every size, before and after. 44 px measure: the same 2 small targets at desktop before and after (the zoom's 32 px `+` / `−`), 0 at 390.
- Test churn: +1 file (`WhereBand.one-height.test.tsx`, 6 tests). No existing test changed, and none pinned `560px`.

## Churn found by review (repair 2, stated not hidden)

- The re-review found a side effect of repair 1 that I hadn't predicted. Repair 1 made `.nyq-foot` absolute, so the Details text (`.nyq-details`, after the foot in the DOM) now opens in the question block's flow: under the answers' note and above the rows, 141 px above its toggle. Before, it opened directly under the toggle. The DOM and focus order are unchanged (toggle, then text).
- Measured (`walk/details.txt`, 1440x900 and 1198x930): opening Details grows the band from 762.5 to 789.5 (unanswered kind) or 834.5 (near intersection chosen), and the action row moves down with the card's bottom by 27 / 72 px. Closing it restores both. No code changed at that point; the call was then made as option d (rulings B4b; below).
- `script/walk469.mjs` gained a `details` mode (a 5th argument) and three read fields (`details`, `detailsBtn`, `rows`). The default walk is unchanged.

## Repair 2 (option d, B4b): the prediction, written before the diff

- `globals.css`, inside the #456 block's two-column query only: one new rule `.workbench .wq-stack[data-aerial][data-card="open"] .wq:has(.nyq-details:not([hidden]))` with `padding-bottom: 0`, and one `... .wq:has(.nyq-details:not([hidden])) .nyq-foot` with `position: static`. About 10 lines with the comment. Nothing else changes; the narrow query stays byte-identical.
- `WhereBand.one-height.test.tsx`: the CSS pin test gains the two declarations. Red proof: the new assertion fails on the repair-1 CSS.
- Default walk (16 states, 1440 / 1198 / 390): every value identical to repair 1's `walk/after.txt` (band 762.5, action row top 835.5, `foot->bottom` 25.1; 390 identical to the base). Details stays closed in that walk.
- Details walk (1440 / 1198), Details open: the action row goes back to the question block's flow, so its top moves up from 835.5. The text opens directly under it, with the text's top equal to the action row's bottom plus the block's 16 px gap, as on the base. The rows sit under the text.
  - Unanswered kind: content = 500 - 84 (the reserve) + 60 (gap + button in flow) + 16 + 56.3 (text) ≈ 548, just over the 545.3 card. So the band is about 765 (+3) and grows downward only.
  - Near intersection chosen: about 593, so the band is about 810 (+48).
  - Closing Details restores 762.5 / 835.5.
- axe 0 and the 44 px list are unchanged.

## Repair 2, predicted vs actual

- `globals.css`: two new rules in the two-column query, as predicted; the narrow query is byte-identical.
- Default walk, re-run: `walk/after.txt` is byte-identical to repair 1's (a `diff` of the full output, all three sizes, shows no difference). As predicted.
- Details walk (`walk/details.txt`), as predicted:
  - The action row's top goes to 721.3 and the toggle's bottom to 765.3. The text's top is at 781.3, the block's 16 px gap, directly under the toggle. The rows sit at 861.5.
  - The band is 765.5 (+3) unanswered and 810.5 (+48) with near intersection chosen; it grows downward only.
  - Closing Details restores 762.5 / 835.5.
- axe 0 and the 44 px list are unchanged. Test: +2 declarations pinned and the DOM order of foot and text, red-proved against the repair-1 CSS (1 failed | 5 passed).
