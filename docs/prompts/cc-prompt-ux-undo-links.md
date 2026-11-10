# cc-prompt: UX: every Undo becomes a plain link

Ruled 2026-11-05 by Ryan: **Option A** on the "Tool page: tap feedback and aerial help" design canvas (https://claude.ai/artifact/UnXwW9LvUDmFLDwraGXqKA, artboard `UndoA.dc.html`; `UndoToday.dc.html` is today).

Platform UI arc, light lane: one branch, file the issue yourself (R146), record calls in `rulings.md`, local walk with crops for Ryan's hand check before the ship go.

## Why

Ryan's review, 2026-11-05. Every Undo on the tool page is a bordered box in mono 10 caps. It sits inside rows that already have borders, and it has no space around it, so its edges touch the row's dividing lines. It looks off everywhere it appears: the NEEDS YOU answered rows, the CONFIRM answered rows, and any other place it shows up.

## Rulings (quote verbatim into rulings.md)

1. **Every Undo on the tool page is a plain text link**, styled like the existing row actions (Move, Edit, Details): Inter 13.5/600 in `--act`, hover `--act-bright`. It has no border, no box and no mono caps. The text reads "Undo".
2. **Hit area:** 44 px tall with 8 px side padding. The row it sits in is at least 48 px tall with 16 px right padding, so the link never touches a row line.
3. **Find every instance:** grep for every Undo control on the tool page and any shared component that draws one. Change them all through one shared style or component, with no copies. List each place in rulings.md. Two places are in scope only as places: `QuestionSteps` answered rows and the NEEDS YOU answered rows. An Undo outside the tool page is out of scope, so list it and leave it alone.
4. **Behaviour unchanged:** each Undo does exactly what it does today (P15). Only the look changes. Use a real `<button>` styled as a link where it acts on the page, so keyboard and screen readers still treat it as a button. Keep the focus ring visible.
5. Follow group 1's rules: only the ruled sizes, no new hex, unslop. Use the Rule 5 churn prediction for tests that look for the old mono "UNDO".

## Out of scope

Everything else in the rows, the spacing round's other items, and groups 5 through 8.

## Evidence

Run locally at 1440 and 390. Capture the NEEDS YOU answered rows and the CONFIRM answered rows, before and after, plus every other place you found. Include one keyboard-focus crop, and run axe and the 44 px measure.
