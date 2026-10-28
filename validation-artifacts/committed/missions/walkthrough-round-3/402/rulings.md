# #402 rulings: picker and WHERE band states

Mission `walkthrough-round-3` (tracking #431). Branch `issue-402-picker-states`, base
`issue-428-typed-zero-length` at `90ab1fb`. Line cites are on `90ab1fb` unless marked.

Baseline on 90ab1fb (vitest, quiet): 252 files passed, 1 skipped; 2659 tests passed, 1 skipped.

## The four sub-findings, located on 90ab1fb

1. Head after a pick. `WhichRoadCard` renders the amber frame and
   `<span aria-hidden="true">⚠ </span>` / `Which road? · {candidates.length} detected`
   whatever `selectedIdx` holds (conestruct/site/components/LocationPickerModal.tsx:2144-2148).
   The card already collapses to the picked caption with CHANGE after a pick (:2149-2180).
2. Truncated caption. The picked line is
   `<span className="min-w-0 truncate font-mono text-[10px] ...">` around `<CandidateCaption>`
   (LocationPickerModal.tsx:2164-2166); the caption reads
   `Detected from OSM: {brg}° ({lbl.primary} {lbl.direction.toLowerCase()}, {lbl.sub.toLowerCase()}) · way {candidate.way_id}`
   (:2193-2194), so a long road name pushes the direction past the ellipsis.
3. Side sentence. `const SIDE_SENTENCE = "Say which side is occupied to lay out the work";`
   (LocationPickerModal.tsx:2269), drawn on the map while `awaitingSide` (:1684-1690) and in the
   panel for status "side" (:2355-2356). The picker has no side control (#290 moved it to the band).
4. Enter. The band's input (conestruct/site/components/bands/WhereBand.tsx:633-641) has only
   `onChange={(e) => setMeta({ ...scenario.meta, address: e.target.value })}`; no key handler,
   no form. The picker already searches `initial.address` when it opens on a plan with no pin
   (LocationPickerModal.tsx:1176-1214, inside the Mapbox effect, :978-979), and the shell passes
   `address: scenario.meta.address` as `initial` (GeneratorSidebar.tsx:532).

## Calls

### Call 1 (R145 self-ruled): the picked head reads "✓ Road picked · N detected"
Once `selectedIdx !== null` the head reads `✓ Road picked · {n} detected`, the frame drops the
amber border and tint for the neutral `--rule` border, the ✓ is `--pass` and the words
`--ink-on-dark-faint`: the exact form of the single-match card's "✓ Road detected · 1 match"
(LocationPickerModal.tsx:2087-2093). DESIGN-SPACING.md's table gives `✓` "confirmed or passing",
`--pass` (conestruct/site/DESIGN-SPACING.md:142); the head states that the road question is
answered by the operator, which is a confirmation, not a selected-option mark, so #407's
"A selected chip or toggle gets its own mark ... never a ✓" (DESIGN-SPACING.md:147) does not
apply: the selected row in the expanded list keeps its border and gets no glyph. The count stays
("· 4 detected"): it is still true and tells the operator CHANGE has alternatives. While CHANGE has
re-expanded the list, a pick still stands (Save is enabled), so the head stays ✓. Unpicked: unchanged
(amber, "⚠ Which road? · N detected").

### Call 2 (R145 self-ruled): the picked caption wraps
The `truncate` on the picked line goes; the span wraps (`min-w-0 break-words`), so the whole
caption, direction included, shows at every width. The issue's other option (direction first) would
also reorder the single-match card's shared caption; wrapping is the smaller change and meets
"the picked line shows the full direction at 1440 and 390". No `title` is added: nothing is hidden.

### Call 3: PARKED (reversing a Ryan ruling)
The picker's side sentence is Ryan's verbatim ruling, 2026-09-25, on #290
(validation-artifacts/committed/issue-290-pin-work/rulings.md:243-257): "before the side is
confirmed, the picker draws the pin and the sentence "Say which side is occupied to lay out the
work" — no segment, and no direction-free circle", recorded as "the picker draws the pin and
exactly:" that sentence. Changing it to the issue's "Save, then say which side is occupied." changes
a ruled string, so it is parked, not built.
PARK: may the picker's pre-side sentence (map overlay and panel) read "Save, then say which side is
occupied." instead of your #290 sentence "Say which side is occupied to lay out the work", since the
picker has no side control? The band's SIDE_BLOCKER (lib/scenarios/rail.ts:151), where the control
lives, would keep your sentence.

### Call 4 (R145 self-ruled): Enter does what "Pick on map" does
Enter in the band's address field (not while an IME composes, not while `locked`) calls the same
`onOpenPicker()` the button calls. One door onto the pin (the field's own comment, ruling 189:
"the picker is where the search, the candidates and the road pick live", WhereBand.tsx:627-631);
the picker then searches the typed text as it already does on open. Edge, recorded: on a plan that
already has a pin, opening the picker (by button or Enter) restores the saved pin and puts the typed
text in its search box without running it, as the button does on 90ab1fb; the operator presses
SEARCH there. Not changed: re-searching on open would move a saved pin, which is not this issue.

## Plan (5 bullets)
1. Problem: the four states above (LocationPickerModal.tsx:2144-2148, :2164-2166, :2269 with
   :1684-1690 and :2355-2356; WhereBand.tsx:633-641 on 90ab1fb).
2. Rulings: #290 pre-side sentence (Ryan, 2026-09-25) parks sub-finding 3; ruling 189 (the picker is
   the one door) governs Enter; DESIGN-SPACING.md:142/:147 and the single-match card govern the head.
3. Change: picked head "✓ Road picked · N detected" on a neutral frame; the picked caption wraps;
   Enter in the band field opens the picker; the side sentence untouched (parked).
4. Rule 5 prediction below.
5. Proof: mounted picker tests (head, glyph, frame, caption class and full text) and a mounted
   GeneratorShell test (Enter opens the picker with the typed text as its address; the button
   unchanged); red on 90ab1fb via git archive; shots at 1440 and 390 of the picked card, before and
   after, with boxes; the Enter flow driven in the browser with the geocode request read.

## Rule 5 churn prediction (written before the diff)
Stated behaviour change: after a pick in a multi-road detection the head reads
"✓ Road picked · N detected" (was "⚠ Which road? · N detected"), its frame is the neutral rule border
with no amber tint (was amber); the picked caption wraps instead of ending in an ellipsis, so the card
grows by the wrapped lines (to be measured); Enter in the WHERE band's address field opens the picker,
which then searches the typed text on a plan with no pin (was: nothing). Unchanged: the unpicked card,
the single-match and empty cards, the candidate rows, CHANGE, Save gating, the side sentence (parked),
the picker's search, the payloads, the backend.

| File | Predicted |
|---|---|
| components/LocationPickerModal.tsx | ~+15/-6 |
| components/bands/WhereBand.tsx | ~+12/-0 |
| components/LocationPickerModal.road-pick.test.tsx | ~+45 |
| components/bands/WhereBand.address-enter.test.tsx (new) | ~+110 |

## After the diff

### Rule 5: predicted -> actual
| File | Predicted | Actual |
|---|---|---|
| components/LocationPickerModal.tsx | ~+15/-6 | +27/-5 (over: the head is one element whose class and words switch, plus two comments) |
| components/bands/WhereBand.tsx | ~+12/-0 | +9/-0 |
| components/LocationPickerModal.road-pick.test.tsx | ~+45 | +71 (over: two Colfax candidates and an unpicked control test) |
| components/bands/WhereBand.address-enter.test.tsx (new) | ~+110 | +108 |

The first draft rendered the head as two elements, one per state; the type census counted a 31st
`text-[10px]` site in LocationPickerModal.tsx and failed (full-run-fails.txt). The head was rewritten
as one element before the final run; no census row changed.

### Shots and measurements (script/shoot.mjs, shots/, text-before.json, text-after.json)
Local `next dev`, Chromium at DPR 2, 1440x900 and 390x844. Before: a git archive of 90ab1fb on port
3402. After: this worktree on port 3403. `/api/road-bearing` is stubbed with four candidates (East
Colfax Avenue both ways, North Gilpin Street both ways, the issue's "4 DETECTED"); `/api/geocode`
went to Mapbox through the local route. Both dev servers were stopped by PID after the shots, and the
copied `.env.local` files were deleted.

- Enter. Before: typing "1600 E Colfax Ave, Denver" and pressing Enter left the page with no dialog
  (`dialogAfterEnter: false`, before-*-enter.png, the find row 846 x 44 at 1440, 328 x 102 at 390);
  the script then clicked "Pick on map". After: Enter opened the picker (`dialogAfterEnter: true`),
  its search box held the typed text, and one `/api/geocode` request carried
  `{"address":"1600 E Colfax Ave, Denver","jurisdiction_key":null}` (after-*-enter.png), the same
  body the button-opened picker sent on the base.
- The card, unpicked: 407 x 257.5 at 1440 and 340 x 307 at 390, the same before and after, amber.
- The card, picked (East Colfax Avenue eastbound). Head: "⚠ WHICH ROAD? · 4 DETECTED" ->
  "✓ ROAD PICKED · 4 DETECTED"; head words rgb(244, 192, 32) -> rgb(147, 160, 176) (--ink-on-dark-faint),
  glyph rgb(244, 192, 32) -> rgb(79, 215, 135) (--pass); frame border rgb(244, 192, 32) ->
  rgb(44, 62, 83) (--rule), background rgba(244, 192, 32, 0.15) -> transparent. Contrast, computed from
  the token hexes against the dialog's --canvas-tint #16232f (not sampled from pixels): --pass 8.67:1,
  --ink-on-dark-faint 6.00:1, --act-bright (CHANGE) 7.50:1, the line's --ink-on-dark 10.35:1; the same
  pairs the single-match card already uses.
- The picked line: before, one line and clipped (`scrollWidth > clientWidth`) at both widths,
  310.19 x 15 at 1440 and 243.19 x 15 at 390; after, not clipped, "DETECTED FROM OSM: 90° (EAST COLFAX
  AVENUE EASTBOUND, PRIMARY) · WAY 600545936" in full, 310.19 x 30 (2 lines) at 1440 and 243.19 x 45
  (3 lines) at 390.
- Layout shift: the picked card grows 64 -> 69 px at 1440 (+5) and 83 -> 84 px at 390 (+1) (the CHANGE
  button's 44 px tap row held most of the height), so the rail content below it moves down by that much.
- The side sentence is unchanged in both runs ("Say which side is occupied to lay out the work"), parked
  (call 3).
