# #479 rulings: NEEDS YOU's Details floats as the WHERE kind question's does

Issue: https://github.com/rtmakatura/conestruct/issues/479. Mission `ux-token-map-load-edit`, tracking https://github.com/rtmakatura/conestruct/issues/486.

## Ryan's ruling (2026-11-10, verbatim)

> NEEDS YOU's Details uses the same floating tooltip as #469.

## Mission brief (orchestrator)

The brief that carried the ruling added these instructions (the orchestrator's words, not Ryan's):

> (the WHERE kind question's Details, which floats as step 2's popover; see #469's commit a239a0e and its rulings under validation-artifacts/committed/). Reuse #469's component/styles rather than building a parallel one. Quote Ryan's ruling in rulings.md. Keep 44 px targets, axe 0, the ruled sizes only, no new hex, and Escape/focus behaviour matching #469's.

This answers the issue's question ("Should NEEDS YOU's Details float the same way?") with its recommended option, yes. #469's R1-R5 (`validation-artifacts/committed/missions/ux-wait-band-followups/issue-469/rulings.md`) carry over: step 2's popover pattern, the toggle keeps its word and 44 px, the panel opens downward, it closes when the question changes. #469's R3 ("NEEDS YOU's Details keeps its in-flow text") is superseded by this ruling.

## R145 self-rulings

- **R1 (R145 self-ruled). Reuse is the prop, not a copy.** NEEDS YOU sets `QuestionSteps`' `detailsTip`, the prop #469 added, so it gets the same `DetailsTip` (`useDetailsToggle` + the `a-info a-pop` panel inside `.nyq-tip-box`). No new component and no new hook. One new class, `nyq-dur`, is added later for R6.
- **R2 (R145 self-ruled). The content fits the span.** NEEDS YOU's `<Details>` renders text and one `<time>` (phrasing content, `components/NeedsYouQuestion.tsx` `Details`), so it nests inside the panel's `<span>` inside the foot's `<p>` without a block element (the issue's DOM-nesting check).
- **R3 (R145 self-ruled). The `detailsTip` prop stays.** Both callers now set it, so the in-flow path has no caller. Removing the prop would also touch `WhereQuestions.tsx` and the in-flow path's tests for no behaviour change; the prop stays and its doc comment says both bands set it. Removing the dead path can be a later cleanup.
- **R4 (R145 self-ruled). Where the panel opens at 390 is decided by the walk.** In NEEDS YOU the toggle ends the Source line, not starts it (WHERE's foot holds the toggle alone). `.a-pop` anchors at the toggle's left (`left: 0`), up to 360 px wide (`max-width: min(360px, calc(100vw - 32px))`). If the walk measures the panel past the viewport's right edge, the panel is anchored to the foot instead (one scoped rule, existing values only). See `evidence.md` for what the walk measured and which applied.
  - **Outcome:** the first walk (prop only) measured the panel at x 134.8-414.8 on a 390 screen (page 415 wide, a sideways scroll). So the rule applies, at every width, because where the toggle lands depends on how the Source line wraps: `.workbench .needs-you .nyq-foot { position: relative }` and `.workbench .needs-you .nyq-tip-box { position: static }`. The panel's top, left, width and max-width are still `.a-pop`'s own. At 1440 and 1198 it opens under the foot's left edge, not under the toggle. It is also wider: `.a-pop`'s `width: max(100%, 280px)` now reads the foot's width, not the toggle's, so the panel is 360 px at 1440 and 1198 (the 360 cap) and 328 px at 390 (the `100vw - 32px` cap less the card's inset), where anchored at the toggle it was 280 at all three. The WHERE band is not under `.needs-you`, so its panel is unchanged.
- **R5 (R145 self-ruled). The Details content is one span.** `.a-info` is `display: grid`, so NEEDS YOU's text runs and its `<time>` laid out as three rows in the panel (the second walk's 390 crop). `Details` now wraps its parts in one `<span>` (it was a fragment). The text and the `<time>` are unchanged.
- **R6 (R145 self-ruled, R154 fold-in from the reviewer). The scan duration doesn't break.** At 1440 and 1198 the panel wrapped "0.1 s" across two lines. The duration is a text run after the `<time>`, so a CSS rule alone can't reach it: `Details` puts it in a `<span className="nyq-dur">` (still inside the one span, R5), and `.workbench .needs-you .nyq-dur { white-space: nowrap }`. Its text, " · 0.1 s", is unchanged.

Nothing here changes a device count, a wire field, a plan value or backend math (Rule 3). No new hex, no new type size, no new copy.
