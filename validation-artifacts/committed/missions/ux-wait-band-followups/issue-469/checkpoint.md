# #469 (resumed): the plan and the Rule 5 churn prediction

Mission `ux-wait-band-followups` (tracking #478), item 1. Resumes the parked build of mission `ux-group6-wait-and-band` (#471). That build's record stays where the committed #471 report links it: `validation-artifacts/committed/missions/ux-group6-wait-and-band/issue-469/` (rulings B1-B8, the walks, the crops). This folder holds the resume: Ryan's answer to B4b and what it changed. Rulings: `rulings.md`. Evidence: `evidence.md`.

Branch `issue-469-band-one-height`, rebased from `385b6c0` onto `origin/mission-471-prod-check` `2d609b6` (the pending #470 production-check evidence branch, on main `750660c`), so that evidence commit ships with this fix. The rebase was clean: a temporary WIP commit (hooks ran and passed), `git rebase`, then `git reset --mixed HEAD~1`, so the parked work is uncommitted again on the new base.

Written before the diff.

## Plan (5 bullets)

1. **Problem:** with Details open on the kind question, the WHERE band's box grows and the action row moves. The Details text is an in-flow `<p class="nyq-details">` after the action row (`conestruct/site/components/QuestionSteps.tsx:344-348`). The parked option (d) put the action row back into the flow while it was open (`conestruct/site/app/globals.css`, the two `.wq:has(.nyq-details:not([hidden]))` rules in the #456 two-column block). Measured: the band +3 / +48 px, and the toggle and action row 114.2 px up (`ux-group6-wait-and-band/issue-469/walk/details.txt`).
2. **Rulings:** Ryan's B4b answer, 2026-11-09 (Part 2 ruling 5): "Details on the kind question is a tooltip per Part 2 ruling 5: reuse step 2's 'from the road' tooltip component/pattern; it floats over the page; the band height never changes when it opens." Also: confirm rulings 6-8 (one map frame, the mono line, the checks) are built. Rulings 1-4 and B1-B8 stand. R1-R6 below in `rulings.md`.
3. **Change:**
   - `QuestionSteps.tsx`: a `detailsTip` prop. When it is set, the Details toggle and its text become one box that uses step 2's popover pattern: `useDetailsToggle` (from `InfoToggle.tsx`, already shared by InfoToggle and the picked-road row) and the `a-info a-pop` panel. The panel floats, opens on click, and closes on a click outside or Esc (focus back on the toggle). Unset, NEEDS YOU's Details is unchanged.
   - `WhereQuestions.tsx`: passes `detailsTip`.
   - `globals.css`: drop option (d)'s two rules; one small rule anchors the box (`position: relative`).
   - `WhereBand.one-height.test.tsx`: the B4b pins become the tooltip's pins, plus a mounted test.
4. **Rule 5 churn prediction:** below.
5. **Proof:** the changed vitest, red-proved against the parked build; affected vitest; tsc; a local walk (Overpass stubbed) at 1440x900, 1198x930 and 390x844 that measures the band with Details closed and open (open = closed, 0 px), axe, and the 44 px measure on the toggle. Crops and the walk go in this folder.

## Rule 5 churn prediction (written before the diff)

Files:
- `conestruct/site/components/QuestionSteps.tsx`:
  - The new `detailsTip?: boolean` prop goes on `QuestionStepsProps`, is passed through to `Card`, and adds a small `DetailsTip` component (about 35 lines).
  - With the prop unset, the rendered DOM is byte-identical: the toggle, the `p.nyq-details` after the foot, and `detailsOpen` held in QuestionSteps.
  - With it set: the foot gets `<span class="nyq-tip-box">` holding the same `button.nyq-details-btn` ("Details", `aria-expanded`, `aria-controls`) and a `<span id=... class="a-info a-pop tr-note nyq-details" role="group" aria-label="Details" hidden>`. The panel is a span, because the foot is a `<p>`. No `p.nyq-details` follows the foot. The panel is keyed by question, so moving to another question closes it.
- `conestruct/site/components/bands/WhereQuestions.tsx`: `detailsTip` on its `<QuestionSteps>`, 1 line plus a comment.
- `conestruct/site/app/globals.css`:
  - Option (d)'s two rules and their comment go (about 9 lines).
  - New: `.workbench .nyq-tip-box { position: relative; display: inline-block; }`, outside the container queries, so it holds at every width.
  - The panel reuses `.a-info.a-pop` as it is: absolute, `top: 100%`, `left: 0`, `width: max(100%, 280px)`, `max-width: min(360px, 100vw - 32px)`, z-index 5. No new hex, no new size.
  - The B1-B4 rules are otherwise unchanged. `--wq-band-h` stays 648, and the narrow container query is byte-identical.
- `conestruct/site/components/bands/WhereBand.one-height.test.tsx`: the B4b option (d) assertions are replaced by pins that the open-Details rule is gone, and that the WHERE adapter passes `detailsTip`. New mounted test: opening Details on the kind question shows a floating `a-pop` panel inside the foot, closes on Esc with focus back on the toggle, and closes on a click outside.
- No change to `NeedsYouQuestion.tsx`, `InfoToggle.tsx`, `FieldCell.tsx`, any backend file, the wire or any device count.

Measured, predicted:
- 1440x900 and 1198x930: with Details closed, every one of the 16 CONFIRM states matches the parked `walk/after.txt` (band 762.5, action row top 835.5, `foot->bottom` 25.1). With Details open on the kind question, unanswered and near intersection chosen: band 762.5 (0 px change), the action row top 835.5 (0 px move), and the panel floats under the toggle (its top = the toggle's bottom + 4).
- 390x844: Details closed matches the base. Opened, the card's and band's heights are unchanged too (0 px), since the panel floats. The kind question was the one Details that grew the 390 card.
- axe 0. The toggle stays 44 px tall (`.nyq-details-btn` `min-height: 44px`). The 44 px list is unchanged: at desktop, the zoom's 32 px pair only.

Test churn: `WhereBand.one-height.test.tsx` changes (B4b pins replaced, +1 mounted test). Existing tests on `.nyq-details` (`GeneratorShell.where-confirm-card.test.tsx:132`, the class and `hidden`; `GeneratorShell.hit-targets.test.tsx`, the button by name and class) are expected to pass unchanged, since the class, `hidden`, the text and the button stay. NEEDS YOU's tests are expected to pass unchanged.

## Churn, predicted vs actual

- `QuestionSteps.tsx`: as predicted. The `detailsTip` prop, passed to `Card`, and a `DetailsTip` component on `useDetailsToggle`. With the prop unset the output is unchanged: NEEDS YOU's suites pass unchanged.
- `WhereQuestions.tsx`: as predicted, `detailsTip` plus a two-line comment.
- `globals.css`: as predicted, option (d)'s two rules are gone and `.nyq-tip-box` is added. **One unpredicted line:** the B4 comment's "A minimum, so the operator's own Edit fold or Details still opens the band" became "...Edit fold still opens the band. The kind question's Details floats (.nyq-tip-box)." It is a comment only, so it changes no declaration. `--wq-band-h` is 648, and the narrow query is byte-identical.
- Test: as predicted (B4b pins replaced, +1 mounted test). The first red run failed on the wrong element: `byText("Details")` found the road row's own Details. The test now takes the card's toggle, and the red was re-run (`red-vitest.txt`). No existing test changed.
- Measured: as predicted, with one difference. At 390 the prediction said the panel floats; it does, over the rows under the action row. Band open = closed at every size (0 px). At 390 the frame's top moves 265.8 to 270 from the second close on and stays there, with nothing else moving; this is likely the sticky strip after the walk's `scrollIntoView` (`evidence.md`). The default walk has identical content to the parked one; only the line endings differ. axe 0. The toggle is 49.5 x 44. The 44 px list is unchanged.
- The parked folder's `checkpoint.md`, `rulings.md` and `evidence.md` each gained a short "resumed / superseded" note pointing here, which the prediction didn't list.
