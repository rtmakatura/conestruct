# #457: every Undo on the tool page becomes a plain link

Ruled 2026-11-05 by Ryan: **Option A** on the "Tool page: tap feedback and aerial help" design canvas (https://claude.ai/artifact/UnXwW9LvUDmFLDwraGXqKA, artboard `UndoA.dc.html`; `UndoToday.dc.html` is today). Issue: #457. Mission `ux-queue-2-6` (tracking #458), queue item 2. Carries #446's known limit (focus after Move at 390x664).

## Rulings (verbatim, `cc-prompt-ux-undo-links.md`)

1. **Every Undo on the tool page is a plain text link**, styled like the existing row actions (Move, Edit, Details): Inter 13.5/600 in `--act`, hover `--act-bright`. It has no border, no box and no mono caps. The text reads "Undo".
2. **Hit area:** 44 px tall with 8 px side padding. The row it sits in is at least 48 px tall with 16 px right padding, so the link never touches a row line.
3. **Find every instance:** grep for every Undo control on the tool page and any shared component that draws one. Change them all through one shared style or component, with no copies. List each place in rulings.md. Two places are in scope only as places: `QuestionSteps` answered rows and the NEEDS YOU answered rows. An Undo outside the tool page is out of scope, so list it and leave it alone.
4. **Behaviour unchanged:** each Undo does exactly what it does today (P15). Only the look changes. Use a real `<button>` styled as a link where it acts on the page, so keyboard and screen readers still treat it as a button. Keep the focus ring visible.
5. Follow group 1's rules: only the ruled sizes, no new hex, unslop. Use the Rule 5 churn prediction for tests that look for the old mono "UNDO".

## Carried from #446 (handoff.md, #446 entry, "Open for Ryan", word for word)

"after Move at 390x664 keyboard focus stays on Cancel, off screen; moving it to the bar's big-map button is about one line (recommended)." The mission brief asks for it here: focus moves to the bar's "Use the big map instead" button.

## Every Undo control found (ruling 3)

Searched `conestruct/site/components`, `conestruct/site/app` and `conestruct/site/lib` for every rendered "Undo" label and every class that draws one (`grep -rn "Undo"`, then each hit read). Line numbers are on the base `2cd6d72`.

| # | Place | File (base) | What it looked like | Scope |
|---|---|---|---|---|
| U-a | CONFIRM answered rows (kind, side, cross street) | `components/QuestionSteps.tsx:224-233`, class from `components/bands/WhereQuestions.tsx:559` (`act-btn wq-undo`) | bordered box, mono 9.5 caps | in: the place (ruling 3) |
| U-b | NEEDS YOU answered rows (site questions) | `components/QuestionSteps.tsx:224-233`, class from `components/NeedsYouQuestion.tsx:149` (`act tr-step nyq-undo`) | bordered box, mono 9.5 caps | in: the place (ruling 3) |
| U-c | NEEDS YOU condition records: an applied correction, a staged correction, an asserted manual key | `components/NeedsYouConditions.tsx:194, 210, 229` via `actBtn` (`act tr-step`) | bordered box, mono 9.5 caps | in |
| U-d | NEEDS YOU acknowledgement rows, once staged ("Undo" from `lib/needs-you-items.ts:80, 82`) | `components/NeedsYou.tsx:188-199` (`ActionButton`, class `act`) | bordered box, mono 9.5 caps | in |
| U-e | The cross street's ✓ row on the CONFIRM card | `components/bands/WhereQuestions.tsx:487` (`wq-link`) | already a link, underlined, 4 px side padding | in |
| U-f | The near-intersection form's confirmed lane-count note ("Undo: restore detected lane data") | `components/NearIntersectionForm.tsx:531-537` | bordered `--act` box, Inter 12 | in |

QuestionSteps draws U-a and U-b from one button; the class was passed in by each caller.

**Outside the tool page:** no Undo control. The one other "undo" a person reads is the sentence "This can't be undone." in the plan list's delete confirm (`components/PlanRow.tsx:220`), which is text, not an Undo control: listed, left alone. `FlaggerForm.tsx` undoes a detection override by unticking a check row, which has no Undo control: listed, left alone.

## R145 self-ruled (2026-11-07)

- **U1, one shared style.** R145 self-ruled. One class, `.workbench .undo-link`, in `app/globals.css`. It joins the selector list of the row actions' own rule (`.workbench .wq-link`, which draws Move on the cross street's row and Edit and Details on the WHERE summary row: Inter 13.5/600 in `--act`, no border, no box), so the type is shared, not copied, and no font-size declaration joins the census. Its own rule adds only what the rulings add: 8 px side padding, 44 px height, the `--act-bright` hover, the ring (U6), the phone width (U5), disabled (U7). All six places use only that class. QuestionSteps' `undoClass` prop goes: QuestionSteps draws its Undo with the class itself, so neither caller can hand it another look.
- **U2, underlined, like Move, Edit and Details.** R145 self-ruled. On this page Move, Edit and Details are all `.wq-link`, underlined, and `UndoA` draws an `<a>`, which the browser underlines. So the Undo link is underlined too; the hover's `--act-bright` is the second cue. (A first draft of this ruling read Edit and Details from the Setup row's `.a-setuprow-edit` and the disclosure's `.disc-word`, which aren't underlined; the before walk showed the Edit and Details beside Undo on this page are the underlined `.wq-link`, and the build follows the page.)
- **U3, the near-intersection note's label reads "Undo".** R145 self-ruled. Ruling 1 says the text reads "Undo". The words the label carried ("restore detected lane data") are what the note above it says already ("✓ Cross-street lane count confirmed; map data reported …"), so the button's `aria-describedby` points at that note: a screen reader hears "Undo" and then the note. Behaviour is unchanged (ruling 4).
- **U4, the rows.** R145 self-ruled, from ruling 2. The answered rows on QuestionSteps (U-a, U-b) were 44 px tall (their row button's floor); they get `min-height: 48px`, and they already have 16 px side padding. The condition and acknowledgement rows (U-c, U-d) are rule 74's rows, 14 px top and bottom around a 44 px control and 16 px at the sides, so they already meet it. The cross street's ✓ row (U-e) had 12 px right padding; it gets 16 on the right (its other sides stay). The near-intersection note's box (U-f) had 12 px (`px-3`); it gets 16 on the right (`pr-4`).
- **U5, the link keeps its own width on a phone.** R145 self-ruled. At 480 px and under, rule 167 stretches each NEEDS YOU row action across the row (`.ny-acts > * { flex: 1 1 0 }`). A link stretched to the row's width is a box without a border, so the Undo link takes its own width there (`flex: none`) and sits at the start of the actions' row.
- **U6, the focus ring sits inside the hit area.** R145 self-ruled. Ruling 4 keeps the ring visible. Edit's ring (`2px solid var(--act)`, `outline-offset: -2px`) is the one used: an outside ring on a 44 px link in a 48 px row would cross the row's lines, which ruling 2 is there to prevent.
- **U7, disabled.** R145 self-ruled. A disabled Undo takes rule 133's disabled look (opacity 0.45, `not-allowed`), as the boxed control did. Under the write lock the existing one dim rule (`.workbench.ws-locked [data-write]:disabled`, specificity 0,4,0) outranks it, so the lock looks as it did; the rule names no lock class, which #252's enumeration in `WriteLock.test.tsx` forbids.
- **U8, focus after Move.** R145 self-ruled, from the carried #446 limit. Move's handler moves focus to the aerial's "Use the big map instead" button (`band-aerial-big-map`) with `preventScroll`, after the scroll T24 asks for, so the scroll is the one T24 already makes. The button is the keyboard's way to answer the re-armed question (#446 T5, X12). If the button isn't there, focus stays where it was.
- **U9, where the evidence lives.** R145 self-ruled. The issue's acceptance names `validation-artifacts/committed/missions/ux-queue-2-6/`; the mission's brief for this item names `validation-artifacts/committed/ux-undo-links/`, one folder per arc as the earlier UX arcs have it. The brief's folder is used.
