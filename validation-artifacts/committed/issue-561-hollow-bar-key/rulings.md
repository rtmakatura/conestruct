# #561 rulings

Issue #561: the work-hours window's hollow "not checked" bar has no key entry, and a scrolling body shows no "more below" sign. Base: `issue-570-prod-check` at `0880fed3` (#570's production-check evidence, which ships with this branch).

## Ryan's rulings

None on either point. #561 was filed from #556's `rulings.md` S7 and S11, which left both open ("Both need a design ruling before code"). Neither is on R145's park list (no money, pricing or legal; no safety distance; no Ryan ruling reversed; no gated scenario; nothing outside the repo), so both are self-ruled below.

The rulings that still bind this work, word for word:

- #556, item 2b (Ryan, 2026-11-24): "When no street class is set, your hours draw as a dashed outline (not checked yet), not the solid "inside" ink."
- #556, item 2c (Ryan, 2026-11-24): "At 390, the week note under the chart must never be cut off." and "The window body scrolls when it still runs long, with the last line fully visible."
- #556, "All items" (Ryan, 2026-11-24): "Inter only, group 1's sizes, tokens only, no new hex, 44 px targets (apart from #505's exception), axe clean. Rows and columns don't change height (#469, #490). List every new string with its source. Unslop."
- #526 ruling 4, as #556 S10 quotes it: "It is one fixed size in both views."

## R145 self-ruled

### The key

- **R145 self-ruled S1. The key gains "Not checked", shown only while a hollow bar is drawn.** The entry uses the tests the two views draw the hollow bar with: times are set, the dates aren't being re-checked, and the weekday kind (weekday view) or a day in the job (whole week) has no record or needs a street class. Both facts are read from the backend's answer (`record`, `allowed: null`); nothing is scored in the frontend (Rule 3). It sits right after "Your hours", the bar it is a form of, and the other entries keep their order. This follows #526 round 2 S10 and #556 S1 ("joins the key only when a day shows it").
  - The words: "Not checked". The issue's example was "Not checked yet"; "yet" is wrong on a no-record day, where the hours never get checked. Ryan's own words for the look are "(not checked yet)". The first build read "Your hours, not checked"; at 390 that pushed the key to a third line and took 23 px from the body (first walk, kept in `validation-artifacts-extra/issue-561/round-1/`, untracked, named only as the reason). "Not checked" fits the key's first line at 390: the key is two lines there, as before, and the body is as tall as in #556's walk (`measures-summary.txt`).
  - The solid "Your hours" entry stays in every state, as "Allowed" and "Outside what's allowed" do when nothing of theirs is drawn. With no street class every bar is hollow and the key still lists the solid one; with "Not checked" beside it, each bar drawn now has a swatch that matches. Removing unused entries would change every shipped key and isn't done here (see "For Ryan").
- **R145 self-ruled S2. The swatch.** The bar's own look at the bar's own thickness: no fill, a 1 px dashed `--ink-faint` rule, 14 x 6 px (`.whd-yours` is 6 px thick; the key's swatches are 14 px wide). It differs from the solid "Your hours" swatch by shape, not hue (Rule 13). Measured: the rule is `rgb(147, 160, 176)` on `rgb(16, 28, 41)`, 6.47:1. No new hex.
- **R145 self-ruled S3. A five-entry key takes an 8 px gap (CHOSEN, Rule 12).** Measured at 1440 in the whole week with a class set (`key-widths-1440.txt`, from `script/key-widths.mjs`): the key has 526 px, and the five entries a real week can show (Allowed, Your hours, Not checked, Outside what's allowed, No record) are 482.04 px wide. With four 16 px gaps they need 546.04 and wrap to two lines, and so they do at 12 px (530.04). The second line takes 22 px from the body (364 to 342 in that file; the line itself is 22.75 px, the foot's 76.63 against 53.88 in `measures-summary.txt`). In the second walk, before this rule, that made the whole week scroll at 1440 with no street class, where it had fit (body 368 against a 369 px view; `validation-artifacts-extra/issue-561/round-2/`, untracked, named only as the reason). At 8 px they need 514.04 and stay on one line, with 11.96 px to spare. 10 px also fits but leaves 3.96 px, too little to trust across browsers. The rule is `.whd-legend:has(li:nth-child(5))`, so a key of three or four entries keeps its 16 px and every state without the new entry is unchanged. The one other five-entry key, "No record" with "No closures allowed" and no hollow bar, has no jurisdiction on file (#556 `walk.md`: "no jurisdiction on file has one").

### More below

- **R145 self-ruled S4. A body with more under its bottom edge shows a fade there.** #534 asked for "a visible 'more below' cue when it scrolls (a fade or a bottom rule)". The window reads its own body (`scrollHeight - scrollTop - clientHeight`) after each render, on scroll and when the body's box changes, and sets `data-more` on it while more than 1 px is below (CHOSEN: a scroll position can stop a fraction of a pixel short of the end). While flagged, the content fades into the window's ground: above the week note in the whole week, at the body's bottom edge in the weekday view. At the end, or when the view fits, there is no flag and no fade. The fade is decoration: no words, `pointer-events: none`, nothing for a screen reader. The body is already a focusable, named region that scrolls by keyboard.
  - A fade, not a rule: the foot already has a rule right under the body, and a second line above the note would read as a border of the note.
- **R145 self-ruled S5. The fade's size (CHOSEN, Rule 12).** 16 px, the chart's own side margin (`.whd-ruler`), from transparent to `--da-ground`. No new hex. Neither fade is in the body's flow (the note's `::before`, and the foot's `::before` drawn 13 px up: the window's 12 px row gap and the foot's 1 px rule), so the body's scroll height is the same with and without it. The first build put the weekday view's fade in the body's grid, and it added 8 px of scroll (second walk, untracked: 234 against 226). In the committed walk the scroll height is 226 with the fade and at the end (`measures-set-390x480.json`).
- **R145 self-ruled S6. The two test gaps in #561's comment.**
  - "No test mounts a week with both 'No record' and 'No closures allowed'": added. The order was already right (#556 S1).
  - "The sticky note rule is pinned by source pattern only": unchanged. jsdom lays nothing out, so layout is still measured by the walk. This walk re-measures the note in every reading and adds the fade and the flag; `walk.md` says what it guards.

## Rule 5: what changes and what stays

Predicted before the diff, amended twice before the final diff (the shorter label, S1; the five-entry gap and the foot-drawn fade, S3 and S5).

- Changes: `WorkHoursDialog.tsx` (the entry, the flag), `lib/scenarios/why-lines.ts` (one constant), `app/globals.css` (the swatch, the five-entry gap, the fade, `position: relative` on the foot), `WorkHoursDialog.test.tsx` (8 tests).
- Stays byte-identical: the backend, the wire, every other component, and every state of the window with no hollow bar and nothing below the body's edge.
- Heights: the body is as tall as in #556's walk in every state the two walks share (`measures-summary.txt`, the "#556 body" lines: 12 of 12 equal). The entry costs no room.
- The branch also carries `0880fed3` (#570's production check), which ships with it.

## For Ryan (none blocks)

1. The key keeps its three fixed entries even when nothing of theirs is drawn (with no street class: "Allowed", the solid "Your hours" and "Outside what's allowed"). Showing each entry only when it is drawn would be more exact and would change every shipped key. Not done; say if you want it.
2. The five-entry key's 8 px gap (S3) is tighter than the 16 px of the shorter keys.
3. At 390x600 with no street class the note still covers 80.13 px of the chart at rest, as in #556. The fade now marks it; the amount is unchanged.

## Out of scope, left alone

- The window's size, the note's wording and the sticky note rule (#556 S10, S8, S12).
- The backend: no file under `src/`, `data/` or `tests/` changes.
