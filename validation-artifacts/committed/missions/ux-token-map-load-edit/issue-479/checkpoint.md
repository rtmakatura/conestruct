# #479: the plan and the Rule 5 churn prediction

Mission `ux-token-map-load-edit` (tracking #486). Branch `issue-479-needs-you-details-float`, worktree `.claude/worktrees/issue-479`, from local `issue-482-wait-copy-gap` `7324da2`. Rulings: `rulings.md`. Evidence: `evidence.md`.

Written before the diff.

## Baseline

vitest (worktree, `7324da2`): 277 files passed / 1 skipped; 3000 tests passed / 1 skipped. pytest not run locally: the change is frontend only (the lane check decides; if OUT OF LANE, pytest, mypy and ruff run before the report).

## Plan (5 bullets)

1. **Problem:** NEEDS YOU's Details opens as an in-flow `<p class="nyq-details">` after the card's foot (`conestruct/site/components/QuestionSteps.tsx:360-364`), so the card grows and everything under it moves (P1). NEEDS YOU never sets `detailsTip` (`conestruct/site/components/NeedsYouQuestion.tsx:141`).
2. **Rulings:** Ryan, 2026-11-10: "NEEDS YOU's Details uses the same floating tooltip as #469 ... Reuse #469's component/styles rather than building a parallel one." Full text and R1-R4 in `rulings.md`.
3. **Change:** NEEDS YOU passes `detailsTip` to its `QuestionSteps`; QuestionSteps' doc comments say both bands set it. Conditionally (R4), one scoped CSS rule anchors the panel to the foot if the walk finds it past the viewport edge.
4. **Rule 5 churn prediction:** below.
5. **Proof:** a new mounted test in `NeedsYouQuestion.test.tsx` (the panel is the `a-info a-pop` span in `.nyq-tip-box` in the foot, no `p.nyq-details` after the foot, Esc closes with focus on the toggle, a click outside closes), red-proved on the base; the affected vitest files; a local walk (Overpass stubbed, `/api/road-bearing` stubbed) at 1440x900, 1198x930 and 390x844 measuring NEEDS YOU and every results box below it with Details closed and open, CLS while it opens, the panel's box (in view, on top), axe 0 and the 44 px list; the permanent check `scripts/verify-generate-cls.mjs`. Crops and raw output in this folder.

## Rule 5 churn prediction (written before the diff)

- `conestruct/site/components/NeedsYouQuestion.tsx`: `detailsTip` on its `<QuestionSteps>`, 1 line plus a 2-3 line comment.
- `conestruct/site/components/QuestionSteps.tsx`: comment text only (the `detailsTip` doc comment and `DetailsTip`'s doc, "NEEDS YOU keeps the line" goes). No code change.
- `conestruct/site/app/globals.css`: the `.nyq-tip-box` comment names NEEDS YOU too. Conditionally (R4, only if the walk measures the panel past the viewport): one scoped rule under `.needs-you`, about 8 lines, existing values only.
- NEEDS YOU's rendered DOM changes: the foot's `button.nyq-details-btn` moves into `<span class="nyq-tip-box">` with the panel `<span id=nyq-<flag>-details class="a-info a-pop tr-note nyq-details" role="group" aria-label="Details" hidden>` after it; the `p.nyq-details` after `.nyq-foot` is gone. The toggle's word, class, `aria-expanded`, `aria-controls` id and 44 px are the same, and so is the Details text.
- Behaviour change (deliberate): the panel floats over the page; it closes on a click outside, on Esc (focus back on the toggle) and when the question changes. Before, it stayed open until the toggle was pressed again or the question changed.
- Tests: `NeedsYouMap.test.tsx`'s child-order list drops `"nyq-details"` (the card's children end at `nyq-foot`). `NeedsYouQuestion.test.tsx` gets the new test; its existing Details test still passes unchanged (it finds `.nyq-details` by class). No other test changes expected.
- **Amendment (before the CSS diff, after the first walk on the prop-only change):** the walk measured the panel past the viewport at 390x844 (x 134.8-414.8, page scrollWidth 415 vs 390; in view at 1440 and 1198). So R4's conditional rule applies: `globals.css` gets two scoped rules under `.workbench .needs-you` (`.nyq-foot { position: relative }`, `.nyq-tip-box { position: static }`), about 8 lines with the comment, at every width, so the panel anchors to the foot's left and under it. No new value: `.a-pop`'s own top, left, width and max-width apply. The WHERE band is untouched (it isn't under `.needs-you`). At 1440 and 1198 the panel moves from under the toggle to under the foot's left edge (deliberate, R4).
- **Amendment 2 (before the diff, after the second walk's 390 crop):** `.a-info` is `display: grid`, so NEEDS YOU's Details text runs and its `<time>` laid out as three grid rows ("... corridor scan ·" / "10 nov · 09:34 utc" / "· 0.1 s"). `NeedsYouQuestion.tsx`'s `Details` returns its parts inside one `<span>` instead of a fragment (1 line changed, 1 comment line), so the panel holds one text item and reads as one wrapped line. Text and `<time>` unchanged; `NeedsYouQuestion.test.tsx`'s existing Details `textContent` assertion still holds.
- **Amendment 3 (before the diff, the reviewer's fold-in, R154 fold test: same files, no ruling, tiny):** "0.1 s" wrapped across two lines in the panel at 1440 and 1198. `NeedsYouQuestion.tsx`'s `Details` puts the duration run in `<span className="nyq-dur">` (2-3 lines); `globals.css` adds `.workbench .needs-you .nyq-dur { white-space: nowrap; }` (about 4 lines with the comment). Text unchanged. The 1440 and 1198 open crops are re-taken (the whole walk re-runs; all six crops and the JSON are replaced).
- Byte-identical: the WHERE band (it already sets the prop), every wire field, the backend, the Details text, the 44 px list, the results layout with Details closed.
