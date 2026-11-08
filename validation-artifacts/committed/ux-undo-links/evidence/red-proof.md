# #457 red proof

The tests were written first and run on the base code (`2cd6d72`, no product change), 2026-11-07:

`npx vitest run components/undo-link.test.tsx components/NeedsYouConditions.test.tsx components/NeedsYouQuestion.test.tsx components/GeneratorShell.where-confirm-card.test.tsx components/GeneratorShell.cross-street-tap.test.tsx components/GeneratorForms.confirm-undo.test.tsx components/NeedsYou.acknowledge.test.tsx`

Result: `Test Files 7 failed (7)`, `Tests 15 failed | 88 passed (103)`.

The 15 that failed, and why:

| Test | Place | Fails on the base because |
|---|---|---|
| `undo-link.test.tsx` (6) | the shared style | no `.workbench .undo-link` rule, the font rule doesn't name it, answered rows have no 48 px floor, the cross row's right padding is 12, `.nyq-undo` / `.wq-undo` still in the sheet |
| `NeedsYou.acknowledge.test.tsx` › staged acknowledgement's Undo | U-d | class is `act` |
| `NeedsYouConditions.test.tsx` › asserted manual key; applied assert | U-c | class is `act tr-step` |
| `NeedsYouQuestion.test.tsx` › Undo on a staged answer | U-b | class is `act tr-step nyq-undo` |
| `GeneratorShell.where-confirm-card.test.tsx` › kind Undo | U-a | class is `act-btn wq-undo` |
| `GeneratorShell.cross-street-tap.test.tsx` › the tap … Undo restores | U-e | class is `wq-link` |
| `GeneratorShell.cross-street-tap.test.tsx` › T24 | U8 (#446) | after Move, `document.activeElement` is the Move/Cancel button, not `band-aerial-big-map` |
| `GeneratorForms.confirm-undo.test.tsx` › confirm renders the note; confirm-then-edit | U-f | no button named "Undo" (it read "Undo: restore detected lane data") |

The third near-intersection query (`queryByRole(... "Undo")` → null on a no-dispute confirm) passes on the base too: it asserts absence.

## Re-run of the final `undo-link.test.tsx` on the base sheet

The two ruling-1 cases were rewritten after U1/U2 moved the shared rule to `.wq-link` (`../checkpoint.md`, § Actual), and U7's selector changed. The final file was run against the base's `app/globals.css` (`git show 2cd6d72:conestruct/site/app/globals.css` into a scratchpad copy, vitest `--root` there): all 6 fail, each on its own missing rule (`a rule for .workbench .wq-link, .workbench .undo-link: expected 0 to be greater than 0`, the same for `.workbench .undo-link`, `.workbench .nyq-row.nyq-answered`, `.workbench .undo-link:focus-visible`; the sixth on `.nyq-undo` still in the sheet).
