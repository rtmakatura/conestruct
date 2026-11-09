# #461 rulings: at 390 the pinned strip must not cover the CONFIRM question

Issue: https://github.com/rtmakatura/conestruct/issues/461 (mission `ux-followups-465-461-459`, tracking #466, item 2).
Branch `issue-461-strip-clears-question`, stacked on `issue-465-held-tap-bar` `401d7611`.

## Governing rulings (quoted, not changed)

- #456 ruling 1 (Ryan, 2026-11-07; `validation-artifacts/committed/ux-map-in-view/rulings.md`): "the aerial sits on the left at full band height and the road row and CONFIRM card sit on the right, so the map never scrolls away while you answer."
- #456 ruling 2: "below that width, while the CONFIRM card is open, the aerial pins under the site's top bar as a short strip (about 150 px at 390), above the card." and "Check how the strip and #446's scroll-into-view work together, and record it (P1: nothing jumps on its own)."
- #456 M4 (150 px strip), M7/M8 (the tap question is unpinned at full height and brings the map in with #446 T24's least scroll, `scrollAerialPartIn`), M19 (Hide map only while the card is open).
- Ruling 184 / #460 ruling 1: Save & Close lands the open band 8 px under the nav.

Nothing here changes the strip's size, its pinning, Hide/Show map, the tap question, #446's tap scroll or ruling 184's landing. No device count, no wire field, no plan value (Rule 3).

## R145 self-rulings

- **N1 (R145 self-ruled). The question's text block (`.nyq-text`: the question and its sentence) gets a `scroll-margin-top` of nav + the pinned cover + 8 px while the strip is pinned**: `calc(var(--nav-h) + 150px + 8px)` with the strip, `calc(var(--nav-h) + 44px + 8px)` with the Show map row (map hidden). 150 px is M4's strip; 44 px is the Show map row (one 44 px button, no padding); 8 px is the same gap ruling 184's landing and #231's scroll targets use under the nav (CHOSEN by reuse, a layout number, not a safety value). The issue's proposal names the heading; the text block is used so the sentence's first line comes with it (the acceptance asks for both).
- **N2 (R145 self-ruled). When the question on the card changes (Next, a row's click, an Undo that reopens a question) or the map is shown again, and the strip or the Show map row is pinned, the text block is brought in with #446 T24's least scroll** (`scrollAerialPartIn`, which reads the element's own `scroll-margin-top`; 0 when it is already wholly in view). The issue's recommendation, verbatim: "Recommended: the scroll margin plus a least scroll on question change (#446 T24's helper)." It is input-driven (P1: nothing moves on its own). It does not run:
  - on the card's first question after Save & Close (ruling 184's landing owns that scroll, and with the band 8 px under the nav the strip is in its own place above the card, so nothing is covered);
  - on the tap question (M8 already brings the map in; #446's scroll runs as shipped);
  - in two columns (nothing pins over the card there).
- **N3 (R145 self-ruled). Scrolling by hand is left alone.** A sticky strip covers whatever the operator scrolls under it; that is the strip's ruled behaviour (ruling 2), not a fault. The acceptance's "on every CONFIRM question" is read as: each time a question opens or the map comes back.
- **N3a (R145 self-ruled, repair 1). The acceptance is narrowed: an answer on the same question does not scroll.** Reason: scrolling on an answer would move the chip just tapped. This leaves one walked miss, state 12 at 390x664: the near-intersection answer is below the window, the operator scrolls down to it, and after the tap the heading is under the strip (heading top 136.5, strip bottom 202, before and after alike). It is not fixed here. Filed: https://github.com/rtmakatura/conestruct/issues/468.
- **N4 (R145 self-ruled). Desktop: measured first, as the issue asks ("Check with #460 fixed first"); no desktop change.** The before-walk on `401d7611` (#460's landing in) has the aerial wholly in view (frame 157.5..717.5) on all eleven measured states at 1440x900, 1198x930 and 1024x768, with the page never scrolled off the landing (y 99) and the question clear. The sticky that has no room never needs to hold, so the issue's second case is closed by #460, as it foresaw. Reserving the aerial's height would change a layout that measures right. evidence.md, "Before".
- **N2a (R145 self-ruled). "The card's first question" is read as any move from no question to one** (`currentQ` null to an id): the card mounting after Save & Close (ruling 184's landing puts the strip in its own place above the card, so nothing is covered), or the card reopening from a row after it was closed (not walked; a known limit in evidence.md).

## Plan (5 bullets)

1. Problem: at 390 the strip is `position: sticky; top: var(--nav-h); height: 150px` (`conestruct/site/app/globals.css`, #456 block, `.wq-stack[data-card="open"]:not([data-tap]) .a-aerial-frame`), and nothing keeps the card's question below it when the page sits lower than the strip's own place; the only scroll on a question change is M8's tap-question one (`components/bands/WhereBand.tsx`, the `crossOpen` effect).
2. Rulings: #456 rulings 1-2, M4, M7, M8, M19; ruling 184 (above). No new Ryan ruling needed.
3. Change: N1's CSS (two declarations in the narrow container query) and N2's effect in `WhereBand.tsx` beside M8's, calling the existing `scrollAerialPartIn`.
4. Churn: see the prediction below.
5. Proof: a mounted vitest (`WhereBand` with the card open, a question change, the helper's scroll asked for the text block only when the strip is pinned, and not on the first question or the tap question), red-proved against the old source; a CSS pin on the two scroll margins; the local walk at 390x844, 390x664 and the three desktop sizes, before and after, measuring the heading and first line against the strip's bottom edge (`evidence.md`). Correction (repair 1): the first build of the test did not cover the tap question. Repair 1 adds that case, red-proved in `red-vitest-tap.txt`.

## Rule 5 churn prediction (before the diff)

Timing (repair 1, answering the reviewer's timestamp finding): the prediction below was written in this file's first Write, before any source or test change. In the session the order was: walk script and launcher copied (`script/walk461.mjs` 17:55:42), dev servers started (17:55:54), **this file written with the plan and the prediction**, the before-walk started (its output file 17:56:46), then the test file (18:01:13), the WhereBand diff (18:01:42), the red proof (18:02:16), the comment in `cross-street-reveal.ts` (18:02:37) and the CSS (18:06:58). The file's creation time on disk (18:03:18) is not its first write: the Edit tool rewrites the file, so later edits reset it. `WhereBand.tsx` and `cross-street-reveal.ts` existed long before this branch and show the same reset (creation times 18:01:42 and 18:02:37). Two edits to this section came after the diff: the type-census bullet, changed from "to be checked" to the checked result (no change to the diff), and the "Churn, predicted vs actual" section at the end. Neither changed a prediction.

Changes:
- `conestruct/site/app/globals.css`: two new rules (`.nyq-text` scroll-margin-top) inside the existing `@container (max-width: 719.98px)` block; about 12 lines with the comment. No existing declaration changes.
- `conestruct/site/components/bands/WhereBand.tsx`: one new effect (about 20 lines) after M8's effect. No existing line changes except possibly an import (none expected: `scrollAerialPartIn` and `useRef` are already imported).
- `conestruct/site/lib/cross-street-reveal.ts`: the doc comment of `scrollAerialPartIn` widened to say it also brings the question in (1-2 lines, comment only). Body unchanged.
- New test file `conestruct/site/components/bands/WhereBand.strip-question.test.tsx`; the CSS pin goes in it too.
- The type census: checked before the diff, it counts `font-size` declarations only (`cssFontSizes`, `lib/design/type-census.test.ts`), so `CENSUS_PINS` stays.
- Evidence under `validation-artifacts/committed/missions/ux-followups-465-461-459/issue-461/`.

Byte-identical: every string; the strip's height, pinning and Hide/Show map; the tap question's CSS and M8's effect; #446's `scrollCrossRowIn` and the ✓ row's scroll; ruling 184's landing (`BandStack.tsx`, `lib/landing.ts`); the two-column layout (unless the desktop walk shows the aerial not whole on a question, in which case this prediction is amended before any desktop diff); the backend.

Behaviour change, stated (Rule 5): at band widths under 720 px, a question change or Show map now scrolls the page by the least amount that puts the question and its sentence below the strip, when they were under it or below the window.

## Churn, predicted vs actual

- `globals.css`: predicted about 12 lines inside the narrow container query; actual +9 there, no existing declaration changed.
- `WhereBand.tsx`: predicted one effect, about 20 lines, no import change; actual +20, no import change.
- `lib/cross-street-reveal.ts`: predicted 1-2 comment lines; actual +3 / -1, comment only.
- New `WhereBand.strip-question.test.tsx` (4 tests; 5 after repair 1 added the tap-question case, test only); `CENSUS_PINS` unchanged; no desktop diff (N4); the evidence folder.
- Nothing else changed.
