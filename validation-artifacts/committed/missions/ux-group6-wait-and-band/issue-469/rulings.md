# #469 rulings: the WHERE band keeps one height

Issue: https://github.com/rtmakatura/conestruct/issues/469 (mission `ux-group6-wait-and-band`, tracking #471, Part 2).
Branch `issue-469-band-one-height`, on `mission-466-prod-check` `385b6c0` (contains `origin/main`).

## Governing rulings (Ryan, 2026-11-08, `cc-prompt-ux-group6-wait-and-band.md` § Part 2 rulings, verbatim)

1. **At two-column widths, the WHERE band is one height for every CONFIRM state.** That height is the tallest of its questions or the map's minimum, whichever is larger. Trace each question's height and record the tallest.
   - The aerial fills the left column at that height.
   - The CONFIRM card stretches to the same height. Its content stays at the top and its action row (Next question / Confirm) is pinned to the card's bottom.
2. **Moving between questions, undoing, and the found/failed tap states change nothing outside the card.** The band's outline, the aerial and the road row keep their size and place.
3. **The phone strip** (#456) is unchanged.
4. **Add a permanent check:** the band's height is identical (0 px change) across every CONFIRM state at 1440 and 1198.

Also governing: #456 M1 (two columns from a band width of 720 px, a container query), M2 (the aerial's fixed height in two columns, `min(560px, 100vh - nav - 32px)`, fixed "because the picture is drawn for its box"), M3 (held under the nav), M4 (the 150 px strip at 390). `validation-artifacts/committed/ux-map-in-view/rulings.md`.

Nothing here changes a device count, a wire field, a plan value or any backend math (Rule 3). No new hex; no new type size.

## The trace (ruling 1: "Trace each question's height and record the tallest")

Measured on the before-walk (`script/walk469.mjs`, this branch's base, Chromium DPR 1, Colfax at 1550 E). The right column is the road row (86.8) + 16 px gap + the CONFIRM card. 1440x900 and 1198x930 measure the same (the band is 880 px wide at both; each column 411 px).

| question (state) | CONFIRM card (px) | right column (px) |
|---|---|---|
| kind, unanswered / shoulder / flagger | 476 | 578.8 |
| kind, near intersection chosen (a second "Next: which intersection the work is near" row appears) | **521** | **623.8** |
| kind, reopened from its row (side answered) | 480 | 582.8 |
| side | 352 | 454.8 |
| tap (cross street), asked / after Undo | 339.3 | 442.1 |
| tap, none found | 392.8 | 495.6 |
| tap, failed | 426 | 528.8 |
| tap, found | 435.8 | 538.6 |
| side after the tap | 400 | 502.8 |

**Tallest: the kind question with near intersection chosen, 623.8 px of right column (card 521).** The map's minimum is M2's 560 px frame + the one line under it (8 px margin + one 10.5 px / 1.5 `.tr-prov` line = 23.75) = 583.75. The tallest wins.

**Re-traced, build 2 (B5's 48 px rows; `walk/after-pass1.txt`):** the same question's card 528, right column 630.8; the value was 631 (`walk/after-pass2.txt`).

**Re-traced, repair 1 (the reviewer's FAIL: the action row at the card's true bottom; B4 rewritten, B5 withdrawn; `walk/after.txt`):** the action row leaves the question block's flow and the card reserves its room at the bottom (16 px gap + 44 px button + 24 px inset = 84, for the 60 it took in the block). Every card's content is 24 px taller: the near-intersection kind 545 (right column **647.8 px**), kind 500, kind reopened 504, tap found 459.8, tap failed 450, side after the tap 424, tap none 416.8, side 376, tap asked 363.3. The tallest is still the near-intersection kind question; B1's value is **648**.

## R145 self-rulings

- **B1 (R145 self-ruled). The band's height in two columns is `--wq-band-h: 648px`, CHOSEN: the traced tallest (647.8, with B4's action row at the card's bottom) rounded up to the whole pixel.** A layout number, not a safety value (Rule 12). It is a fixed reserve rather than a measured maximum: the questions are never on screen together, so the page cannot measure the tallest one without drawing them all; and a height that follows the open card is the bug. Known limit: a question taller than 648 (a narrower two-column band, between 720 and 880 px wide, where text wraps more; or a kind added to the list) grows the band on that question, as before. It is never clipped (Rule 10: nothing is hidden to keep a height).
- **B2 (R145 self-ruled). "The aerial fills the left column at that height" = the aerial column is `--wq-band-h` tall in two columns, and the frame is that height less one line slot (`--wq-line-slot` = the line's own 8 px margin + one `.tr-prov` line, 10.5 px x 1.5), still capped by M2's window term.** The line under the aerial (the kind-owed sentence or the approach words; at most one shows, `BandAerial.tsx`) sits in that slot, so its arriving or going changes neither the frame nor the column. The frame grows from 560 to 624.25 px (648 - 23.75). The slot holds one line: at the 411 px column both sentences are one line (measured); a sentence that wraps runs one line past the column's foot, inside the band's padding (known limit).
- **B3 (R145 self-ruled). The aerial's height applies in every two-column state, not only while the card is open.** M2's own reason ("a height that followed the card would ask for a new image on every question") holds at the card's close too: a frame that went back to 560 on Confirm would ask Mapbox for a new picture. This extends Ryan's ruling 1 past the CONFIRM states for the aerial only; it reverses no Ryan ruling (M2 was R145 self-ruled, and ruling 1 supersedes its 560 for the CONFIRM states).
- **B4 (R145 self-ruled; rewritten in repair 1 after the reviewer's FAIL). Ruling 1, literally: the action row (Next question / Confirm) is pinned to the CONFIRM card's bottom, in one place on every question.** While the card is open (`.wq-stack[data-aerial][data-card="open"]`) the right column's `min-height` is `--wq-band-h` and the CONFIRM card (`section.wq`) grows to fill it (`flex: 1 0 auto`). The card is `position: relative` and reserves its action row's room at its bottom (`padding-bottom: calc(var(--space-block) + 44px + var(--space-section))`: the question block's own 16 px gap, the 44 px button `.a-pri.wq-next`, and the block's own 24 px inset). `.nyq-foot` is `position: absolute` at `left`/`right: var(--space-block)`, `bottom: var(--space-section)`. So the content (head, question, answers, the answered and "Next:" rows) stays at the top, and the action row sits at the card's bottom: measured `foot->bottom` 25.1 (1 px border + the 24 px inset, offset 0.1 sub-pixel) and its top at 835.5 on all 16 states at both sizes, 0 px move (Details closed; with Details open the row goes back into the question's flow, B4b). The first build put it at the foot of the question block, above the rows, which moved it 48 px between flows; that read was wrong against the ruling's text. A `min-height`, not a `height`: an operator's own Edit fold or Details still opens the band (P1: the operator asked).
  - **B4a, focus order (WCAG 2.4.3 / 1.3.2).** CSS only; the DOM is unchanged, so the reading and focus order stays answers -> Details / Next question (or Confirm) -> the answered / "Next:" rows and their Undo, while the eye sees the rows above the action row. Judged not a 2.4.3 failure: the focus order still preserves meaning and operability. The action that commits the answer comes straight after the answer, and the record of the other questions comes after it, which is the same order the narrow layout shows. A screen reader reads the DOM, which is unchanged. The one cost is that a sighted keyboard user's focus goes down to the button and then back up to the rows. The alternative, moving the foot after the rows in the DOM (`QuestionSteps.tsx`, shared with NEEDS YOU), would change the 390 card too (ruling 3 and the coordinator's "390 stays unchanged"), or would need a 390-only CSS reorder that has the same visual/focus split there. Reordering with `display: contents` plus `order` was rejected because it drops the question block's padding and gap. Flagged for the reviewer and Ryan; reversible in CSS.
- **B4b: ANSWERED by Ryan 2026-11-09 (Part 2 ruling 5): Details on the kind question is a tooltip, step 2's "from the road" pattern, floating over the page; the band's height never changes when it opens.** None of the options below is built; option (d) is removed. Built and measured in `missions/ux-wait-band-followups/issue-469/` (rulings R1-R6). The record of the question as parked follows. Details opened on the kind question. It parks after the third review, with both code repair cycles used: the current build (option d) narrows Ryan's rulings 1 and 4, which is on the park list.
  - **Facts (the current CSS, option d; `walk/details.txt`, 1440 and 1198 measure the same):**
    - On open, the pressed Details toggle and the whole action row move 114.2 px up (top 835.5 to 721.3), and they move back down on close.
    - With Details open the action row is no longer pinned to the card's bottom.
    - The band grows +3 (unanswered kind, 765.5) or +48 (near intersection chosen, 810.5), and returns to 762.5 on close.
    - The text sits 16 px under its toggle.
    - P1's clause "a control that appears on click appears in room that was already allocated" is not met.
  - **Before option d (repair 1's CSS; `walk/details-before-d.txt`):**
    - The toggle and action row stay pinned to the card's bottom, but the band grows (+27 / +72, to 789.5 / 834.5), so they move down with it.
    - The text opens in the question's flow, 141 px above its toggle.
  - **Options for Ryan:**
    - **(a)** The text away from its toggle (repair 1's CSS, drop the two open-Details declarations). The band and the action row still grow and move down on open.
    - **(b)** Include an open Details in B1's trace, so the reserve covers the tallest question with its Details open:
      - The repair-1 walk measured that right column at 720 (road row 86.8 + 16 + card 617.3 = 720.1), so `--wq-band-h` about **721 px**: a band of about 835.5 on every state, about 73 px taller than today's 762.5.
      - The toggle stays pinned at the card's bottom. The text opens in the room that was already reserved.
      - 0 px move on every state, Details open or closed.
      - Where the text sits inside that room (in flow above the rows, or beside its toggle) is part of the build.
    - **(d)** The current CSS: the text under its toggle, the toggle and action row move 114.2 px, the band moves 3 / 48 px.
  - **Recommendation: (b).** It is the literal reading of ruling 1 ("one height for every CONFIRM state", action row "pinned to the card's bottom") and of P1's allocated-room clause. The cost is a band about 73 px taller on every state.
  - All three are CSS-only and reversible. The CSS and tests are left at option (d), as instructed. No code change after the third review.
- **B5 (withdrawn in repair 1).** The 48 px row floor existed only to keep the action row still above the rows. With the row pinned to the card's bottom, the rows' heights no longer move it, so the rule is gone and the rows are as shipped.
- **B6 (R145 self-ruled). The permanent check (ruling 4) is in two layers.** CI's vitest runs in happy-dom, which has no layout engine, and the repo has no browser test runner in CI. (a) `components/bands/WhereBand.one-height.test.tsx`: the mounted shell is walked through the CONFIRM states (kind, kind answered, side, side answered, Undo, the tap question, tap found / failed / none, the cross street's Undo) and in every one the stack carries the attributes the reserved-height rules key on (`data-aerial`, `data-card="open"`) and the aerial frame and the road row are the same nodes (nothing remounted); and the two-column CSS is pinned: the band height reaches the aerial column, the frame and the right column, the card reserves its action row's room and the action row is pinned to the card's bottom (`position: absolute`, `bottom: var(--space-section)`, the block's own inset; repair 1), and no rule keyed on a CONFIRM state (`data-tap`, `data-map`, `data-bar`, `data-held`, `.is-armed`, `.has-bar`) sets a box size in the two-column block. (b) The measured 0 px (the band's height, and since repair 1 the action row's top and its offset from the card's bottom) is `script/walk469.mjs` at 1440x900 and 1198x930, committed with its output; it is re-runnable against any build. A CI browser check would need a new dev dependency and a browser install in `frontend-tests.yml`; that is filed as https://github.com/rtmakatura/conestruct/issues/472 rather than folded in (outside this branch's files, and bigger than the fold test allows).
- **B7 (R145 self-ruled). The 390 strip (ruling 3): nothing in the narrow container query changes.** Every new rule is inside `@container (min-width: 720px)` or sets a custom property only that block reads.
- **B8 (R145 self-ruled). "Every CONFIRM state" walked:** kind (unanswered, answered, reopened), side (asked, answered, undone, answered again), near intersection kind, the tap question (asked, failed, none found, found, Undo, found again), the side after the tap and answered. The tap's resolving moment ("Finding the cross street…") is a sub-second state between two walked ones; it sits in the same card (`wq-cross-row`, ruling 6's "at the row's own height") and is not separately measured.

- Plan and the Rule 5 prediction: `checkpoint.md`.
