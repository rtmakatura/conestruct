# #439 checkpoint — investigate first (CC, 2026-11-03)

No park-list item: no money/legal, no safety distance, no Ryan ruling reversed, no gated kind enabled (the kind still starts unchosen), nothing outside the repo. Proceeding under R145 (rulings.md § R145 self-ruled).

## 1. Today's WHERE band, by state (`conestruct/site/components/bands/WhereBand.tsx` at origin/main 7d6228f)

| State | Shown, top to bottom |
|---|---|
| Pre-pin | header (STEP + WHERE, no provenance), question, helper "Type an address…", address field + "Pick on map" (634-672), manual entry only without a Mapbox token (913-940) |
| Pinned | header + provenance line (621, `band-facts.ts:198-222`), question, helper "The segment below…", address + "Edit on map", the 6-row move ledger (705-714), aerial (721-727), side control (733-741), kind chips + gate line (780-789), work-length field (798-869), Confirm (887-909) |
| Side set | as pinned; ledger side row ✓ with the backend label; aerial redraws to `work` |
| Kind picked | chip pressed; Confirm reads "Confirm <kind>" |
| Confirmed | band closes to its fact line, WHAT opens (`BandStack.tsx:228-240`); side still owed keeps WHERE open |
| Revision | post-Generate the sidebar unmounts; revision is `RevisionPanel` (out of scope, unchanged) |

## 2. Ruling 5 trace: side options per road kind (`src/api/render_api.py:1594-1657`)
- **Two-way road** (confirmed centerline, not one-way): two options, the right edge of each travel direction (1610-1629).
- **One-way road**: the legal direction's right edge (the against-direction is skipped, 1614-1617), plus its left edge when `left_side_built` (`src/api/schemas.py:1316-1337`: shoulder or near_intersection, a one-way STREET verdict, the one-way tag, a confirmed road): one or two.
- **Divided carriageway**: one (the median edge is never offered, 1603-1606).
- **No confirmed road**: four headings, "traffic heads N/E/S/W" (1647-1656).
- One option still renders as the question with one unselected row (ruling 5).

## 3. Tests pinning what changes (Rule 5 churn prediction)
Strings/order/layout that change: the ledger's six rows (`move-*`), "Occupied side", the side chips (`side-option`, now radio inputs), the kind chips (`kind-chip-*`, now radio inputs: `aria-pressed` → `checked`), `kind-gate-note` text, the Confirm label ("Confirm <kind>" → "Confirm and lay out the plan"), the header provenance (now behind Details), the legend labels and place, the address field after a pin (now in the Edit fold).

Predicted to change (edited, each named in the commit):
- `components/__fixtures__/band-helpers.ts` (`answerSide` presses Next; new `pickKind`; `confirmKind` reads `disabled`)
- `components/bands/WhereBand.side-control.test.tsx`, `WhereBand.left-side.test.tsx`, `WhereBand.kind-proposal.test.tsx`, `WhereBand.no-crossing.test.tsx`, `WhereBand.address-enter.test.tsx`, `WhereBand.work-length.test.tsx`, `MoveLedger.form.test.tsx`, `BandAerial.test.tsx`, `untouched-provenance.test.tsx`
- `components/GeneratorShell.kind-confirm.test.tsx`, `GeneratorShell.kind-switch.test.tsx`, `GeneratorShell.class-suggest.test.tsx`, `GeneratorShell.no-location.test.tsx`, `GeneratorShell.value-links.test.tsx`, `GeneratorSidebar.manual-pin-move.test.tsx`, `GeneratorSidebar.prepin-gating.test.tsx`, `BandStack.single-voice.test.tsx`, plus suites that click `kind-chip-*` directly
- `lib/design/type-exceptions.ts` only if the census names WhereBand sites (no new size is added)

Byte-identical (asserted by their suites unchanged): NEEDS YOU's DOM (`GeneratorShell.needs-you*.test.tsx`, `NeedsYou*.test.tsx`), the results, the picker, WHAT, PDF/XLSX/audit (no backend change), `move-ledger.ts`'s derivation (its rows feed the Edit fold unchanged), `ZONE_LABEL` (extent lines and static preview keep "Advance warning"/"Downstream"), every hex (`ink-literals.test.ts`), every font size (the census).

Stated behaviour changes: Confirm needs both answers (W7); Undo un-chooses (W6); the address and length fields move into the Edit fold after a pin (W9); the "See the plan grow" row is gone (its fact is the aerial's own stage).

## 4. P1–P22 for the changed surfaces (FLOW.md step 1, Where; user: a field rep or a TCP drafter on a first plan)
- P1 no jump: the aerial frame keeps its reserved height; the card replaces rows in place.
- P2 one component per job: one question card for NEEDS YOU and CONFIRM (W1); one summary row.
- P3 the next act at the eye: the question sits under the map it changes.
- P5 one open item at a time: the card's current question; Edit opens itself for an unset length.
- P8 disclose, don't lock: the aerial and Details stay readable under the write lock (data-read).
- P9 a button looks like a button: Edit/Details are links, Next/Confirm the band primary, Undo a secondary.
- P11 one producer: options from `side_options`, kinds from `SCENARIO_KINDS`, count from the same table.
- P13 plain words: compass sides, plain kind labels; sheet refs behind Details.
- P18 no jargon by default: OSM way/node only behind Details.
- P19 detail one click away: the provenance line and the sheet refs behind Details.
- P22 every control says its consequence: side line 2, the Confirm label.
- Rule 13: radio marker is fill + inset vs outline (shape), not hue; ✓ glyph on the summary row.
- P4, P6, P7, P10, P12, P14–P17, P20, P21: no change on these surfaces.
