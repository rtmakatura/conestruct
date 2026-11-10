# cc-prompt: UX group 4 — mark the cross street on the Where band's own map

Ruled 2026-11-04 by Ryan: Option A on the "Tool page: cross street" design canvas.
Design reference: https://claude.ai/artifact/Tkom7m1hbYnm5fwRnmP67d (artboard `OptionA.dc.html`; `Main.dc.html` is today's three screens).
Builds on #439 (the CONFIRM card, `QuestionSteps.tsx`). Ryan found the double-ask on prod 2026-11-04: side answered, then near-intersection kind chosen, then the side question came back with "Mark the cross street on the map to lay out the sides." and a MARK ON MAP button. Continues #301's migration of the picker onto the band (ruling 189: the cross-street pin is one of its pieces); comment on #301 when this lands.

Platform UI arc, mission rules: investigate first, commit `rulings.md` (the "Rulings" section verbatim, dated) and `checkpoint.md`; stop only for the park list; record every other call. File the issue yourself (R146). Local walk with Overpass stubbed and crops for Ryan's hand check before the ship go.

## Why

Ryan's review (screenshots 8–11): after choosing "Lane closure near intersection", the band's aerial shows "Mark the cross street on the map to lay out the sides." on a map that can't be clicked; the real action is a small MARK ON MAP button that opens the picker, whose cross-street control reads "Click the intersection on the map…" without standing out; after the click the panel shows a paragraph ("…You'll confirm the details in the form.") that never says the job is done.

## Rulings (quote verbatim into rulings.md)

1. **The cross street is a CONFIRM question**, asked only when the kind is "Lane closure near an intersection": "Which intersection is the work near?" with the line "Tap where the two streets cross on the map above. The plan lays out signs on the cross street too." (trace the second sentence to what the layout does with the cross street; reword or drop if it doesn't hold, and record which).
2. **Question order (Ryan, 2026-11-04): the kind comes first, for every kind.** Order: (1) "What kind of work is it?", (2) only for "Lane closure near an intersection": "Which intersection is the work near?", (3) "Which side of the road is the work on?". Reason: today, picking the near-intersection kind after the side re-opens the side question with a "Mark the cross street…" blocker, so the user is asked the side twice. With the kind and the cross street first, the side's options are final when it's asked and nothing is asked twice. This reverses #439's side-then-kind order (W7 still holds: Confirm needs every answer). If the kind is changed after the side is answered and the side's options change, the side answer is cleared and re-asked with one line saying why ("The sides changed with the new kind of work."); if they don't change, it stays. Trace and record which kinds change the side options.
3. **While that question is open, the band's aerial takes the tap:** a 2 px `--act` outline on the aerial, a full-width `--act` bar across its top reading "Tap the intersection nearest the work" (Inter 13.5/600 on `--on-act`, a crosshair icon), and a crosshair cursor. Only this question turns the aerial into a target; at every other moment it stays as #439 left it. The tap sends what the picker's cross-street click sends today (one producer: reuse its handler and wire field; no second path).
4. **"Use the big map instead"** (44 px, on the aerial's bottom-right) opens the picker straight to its cross-street control, for small screens or hard spots. A click there answers the same question.
5. **After the tap:** a highlight box on the crossing and a label with the cross street's name on the aerial; in the card, a `--vd-ready-ground` row: `✓`, "Near <street name>" (Inter 15/600) and a line "<two-way|one-way> street · <distance> <direction> of where the work starts" (Inter 12.5 `--ink-mute`), with "Move" (re-arms the tap) and "Undo" (clears it, P15). Every value traces to a wire field; a value the wire doesn't carry is left out, never computed on the frontend (Rule 3).
6. **While the lookup runs** (today "Looking up the cross street…"): the row says "Finding the street name…" in place, reserving its height (P1). A failed lookup says so in plain words with "Try again" and "Use the big map instead".
7. **Removed:** the text overlay on the band aerial ("Mark the cross street on the map to lay out the sides."), the "Occupied side ⚠ … MARK ON MAP" block, and the picker panel's paragraph "…You'll confirm the details in the form." The picker's cross-street control keeps working for ruling 4.
8. Group 1's spacing and text rules; no new size or hex; 44 px targets; unslop copy, every new string listed with its source.

## Out of scope

The rest of the picker (#301 pieces beyond the cross-street pin), the WHAT band, the wait state.

## Investigate first

1. Today's cross-street path end to end: the picker control, its handler, the lookup, the wire field, and every reader (the layout, the scan, the audit, the PDF).
2. Ruling 2's trace.
3. What it takes for the band aerial to accept one tap (map library, current read-only mode, what #301 piece 1 built) and how that behaves at 390.
4. Rule 5 churn prediction; P1–P22 for the changed surfaces.

## Evidence

Local, Overpass stubbed, 1440 and 390: pick the near-intersection kind, see the tap bar, tap the crossing, see the lookup and the ✓ row, Move, Undo, "Use the big map instead" round trip, a failed lookup, Confirm. One plan generated from it with the cross-street signs on page 1 of the PDF. axe, 44 px targets. Crops committed for Ryan's hand check.
