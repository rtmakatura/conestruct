# Sandbox form mark inventory, re-run after #411 (mission form-marks #413)

This list covers every glyph and word-mark the `/sandbox` setup form renders (band stack, NEEDS YOU, status strip, working band), with its one meaning, or the conflict that is left and who owns it. It is the #407 inventory (`validation-artifacts/committed/missions/provenance-marks/407/mark-inventory.md`), re-run on branch `issue-411-mark-meanings` (base `04b76f5`, #397's commit; repair cycle 3). Its line cites hold on the cycle-4 base `54b8182` too, because `git diff 04b76f5 54b8182 -- conestruct` is empty. Paths are under `conestruct/site/`, with line numbers on that base unless marked "branch". Results, PDF, landing and coming-soon surfaces are out of scope.

Hue source: `symClass()` (`lib/design/symbols.ts`): ✓ `--pass`, ▲ ⚠ `--warn`, ◌ `--none`, × `--fail`, i `--act`, ⌁ `--ink-on-dark`, ● `--act`.

**Legend:** ONE = one meaning and one hue. FIXED = settled on this branch. OPEN = a conflict remains; the owner is named.

## ● is the option chosen on a control. ONE (#407, #412)
Side chip, kind chip, segmented toggle, dismiss-reason chip. Unchanged here, except that on the picked proposed kind chip ● is now the only mark (see "⚠ proposed" below).

## "default" (no glyph) is the value the plan started from. ONE. FIXED
- Ryan, 2026-10-26: "'✓ default' becomes plain 'default', with no mark" (amends R110 Q8). P9 records it as the one ruled exception to "every state has a symbol".
- Every row: `markerOf` maps every "default …" line to `{ glyph: null, word: "default", tone: "plain" }`, which `FieldCell` renders as the word alone (branch, `lib/scenarios/provenance-marker.ts`). The per-row `plainDefault` option is gone (cycle 3). On `04b76f5` only #397's rows passed it; Hours (`PlanDetails.tsx:244` on `04b76f5`), Speed reduction (`:265`) and Carriageway (`:359`) did not and read "✓ default", so this is the change that makes those three rows plain. Rows: Hours, Speed reduction, Carriageway (this branch's: "✓ default" on the base), and length, work type, lanes and road type (#397's: already plain on `04b76f5`, unchanged). The trigger reads `default` in the marker's faint ink, 6.47:1 on `#101c29`, measured at 1440 and 390 on Hours and Speed reduction. Carriageway didn't render on the stub road; it is covered by `WhatBand.step2-layout.test.tsx` only.
- Lane width has no marker. Its source is a line in the Lanes row's details, "Lane width · default · …", which never had a glyph. Unchanged.
- #397 is committed (`04b76f5`), and this branch sits on it. The three-file conflict was resolved with #411's hunks, as self-ruled (rulings.md call 1, R145) and recorded on #397 (https://github.com/rtmakatura/conestruct/issues/397#issuecomment-6411650827). Nothing on this branch renders "✓ default".
- #397's near-intersection Lanes row read "⚠ default" in its cycle 3. #397's cycle 4 (`04b76f5`) resolved it per Ryan's ruling (https://github.com/rtmakatura/conestruct/issues/397#issuecomment-6428707399): the row reads plain "default", and ⚠ sits on its own doubt line, "⚠ not confirmed · the map reads N per side, …", where ⚠ keeps its one meaning, a guess to check. The stale `markerOf` doc #397 added (naming "✓ default" rows) is replaced on this branch. The wording gaps left on that row are #418.
- Stale "✓ default" comments, corrected: `lib/scenarios/types.ts:415`, `lib/scenarios/what-writes.ts:143` (was `:128` before #397), `lib/scenarios/operator-set.test.ts:6`, `components/bands/PlanDetails.test.tsx:256`.

## ⚠ is a guess to check, or something that needs you. Hue is ONE (FIXED); the meaning is OPEN (#419)
- Ryan, 2026-10-26: "⚠ already means 'a guess, check it'" (recorded at https://github.com/rtmakatura/conestruct/issues/411#issuecomment-6410071272). That covers the guesses below. DESIGN-SPACING's ⚠ row (the glyph table) also gives "changed / needs attention / conflicts". No ruling makes that and "a guess to check" one meaning, so it is filed for Ryan: https://github.com/rtmakatura/conestruct/issues/419
- Guesses: "from the road" / "from the pin" (`lib/scenarios/provenance-marker.ts`), and the `.tr-prov.is-amber` prefixes.
- **"⚠ proposed"**, the proposed kind (FIXED, branch `components/bands/WhereBand.tsx`; base `:433,441`): it was "✓ proposed" on the chip and on the note "✓ proposed: … Pick it to use it." Ryan, 2026-10-26, amending #284. ⚠ is in `symClass("⚠")` amber: 10.17:1 on `#101c29` on the unpressed chip and on the note (faint `#93a0b0` 6.47 before). The word after the glyph moves +1.20 px on the chip (`xProposedMark`, 35.16 → 36.36 px), measured at 1440 and 390.
- **Picked proposed chip** (FIXED, cycle 3). Ryan, 2026-10-26 (https://github.com/rtmakatura/conestruct/issues/411#issuecomment-6428707756, amends #284): "Once the operator picks the proposed kind chip, '⚠ proposed' and its note go away, and ● alone says 'chosen'." The pressed chip reads its citation alone ("TA-3/TA-5 · S-630-1") with ● on its label, and the note is gone, at 1440 and 390 (`kindPressedHasMark` 0, `kindPressedHasNote` 0). Before, the pressed chip showed ● and "✓ proposed" (5.53:1) together, and the note stayed. If the operator then picks another kind, the proposal is unanswered again and its mark and note come back (R145 self-ruled).
- Side-control lines "⚠ <backend line>" (`WhereBand.tsx:298,368` on the base): these were faint and are now amber (FIXED), 10.17:1.
- Needs you, notices, jurisdiction warnings, failures, the moot record, the lock: unchanged. DESIGN-SPACING's own meaning is "changed / needs attention / conflicts", broad on purpose.
- WHAT header count: "N guesses marked ⚠" counts only the WHAT rows' markers (`WhatBand.tsx` `warnMarkers`). The kind chip is in WHERE, and `lib/scenarios/rail.ts` and `lib/tier-sources.ts` don't read the proposal. So "⚠ proposed" is not counted, and the header and rail are unchanged (Rule 5).

## ✓ is "measured" or "yours". Hue is FIXED on the marker and OPEN on two plain-text ✓s (#414); the meaning is OPEN (#414)
- Provenance marker: "measured", "yours", "overridden", "changed", plus "evaluated" and "detected" (verdicts, OPEN below). The glyph is now `symClass("✓")` green `#4fd787`, 9.35:1 on `#101c29` (was faint, 6.47). The word keeps the faint ink (FIXED, branch `FieldCell.tsx`). The glyph's own span puts the word 0.031 px further from the trigger's left edge and widens the trigger by 0.031 px ("✓ measured" 68.766 → 68.797 px; "⚠ from the road" 103.547 → 103.578 px), the same at 1440 and 390 (`marker-<row>-wordx`, measured inside the trigger). On screen it differs by width: at 1440 the trigger is left-aligned under the label, so the glyph stays and the word moves 0.031 px right; at 390 it is right-aligned in the row head, so the word stays and the glyph (the trigger's left edge) moves 0.031 px left. The alignment is the one measured on the "default" trigger in cycle 1 (rulings.md, plan bullet 4: left edge x 736 kept at 1440; 296.95 → 311.95 px at 390 with the right edge kept).
- Read as "yours", an answer the operator gave: band facts (`lib/scenarios/band-facts.ts:450,470`), the move ledger's answered rows (spot, start, side, kind), "✓ both set" (`WhatBand.tsx:283`), and the site-condition "confirmed" record (`NeedsYouConditions.tsx:348`). Self-ruled (rulings.md, call 7).
- OPEN (#414, needs Ryan): ✓ as a verdict. VERIFIED (`StatusBar.tsx:444`), revision 7c "computed" (`components/bands/RevisionPanel.tsx:180`), windows "fits your dates" and "clear" (`ScheduleField.tsx:218,266`), site conditions "none along the corridor" (`NeedsYouConditions.tsx:525`, the glyph; the words at `:528`) and "N none found" (`:587`), and the ledger's "laid out" row (`move-ledger.ts`). #281 rule 95.4, rules 74–77 and #248 pin these ✓s, against the 2026-10-26 "✓ means only measured or yours". https://github.com/rtmakatura/conestruct/issues/414
- OPEN (#414): "✓ evaluated" (the jurisdiction line, `WhatBand.tsx:393`) and "✓ detected" (the twin check, `PlanDetails.tsx:80-81`; "no same-name carriageway" is a none-found result) are verdict ✓s from `markerOf` (base `provenance-marker.ts:80-81`). This branch turns their ✓ green (Rule 18) and does not change their meaning. https://github.com/rtmakatura/conestruct/issues/414#issuecomment-6411797801
- OPEN (#416, Rule 10): an OSM clause word missing from `OSM_WORDS` silently becomes ✓ (base `provenance-marker.ts:65`). It is latent: every token emitted today is mapped. https://github.com/rtmakatura/conestruct/issues/416
- OPEN hue (#414, https://github.com/rtmakatura/conestruct/issues/414#issuecomment-6411651963), the reason the heading's hue is not ONE: "✓ both set" (`WhatBand.tsx:283`) and the fold "✓ N none found" (`NeedsYouConditions.tsx:587`) draw ✓ as plain text in the faint line, not in `--pass`. These were left alone because #414 decides whether that ✓ stays at all.
- OPEN (#414): the ledger's extent row reads ✓ "done" when nobody answered it (`workLen > 0` with the default length). It is a state/verdict ✓, like "laid out". #397's R145-12 defers it to this inventory, so it is added to #414 (https://github.com/rtmakatura/conestruct/issues/414#issuecomment-6411651308).

## ◌ is not set, pending or in flight. Hue is ONE; the meaning is OPEN (#415)
- The marker's ◌ now carries `symClass("◌")`. `--none` and the faint ink are both `#93a0b0` in `.workbench`, so its hue doesn't change (6.47:1). Like every glyph marker, its glyph's own span moves the word or the glyph by a sub-pixel amount (0.031 px measured on ✓ and ⚠: the word right at 1440, the glyph left at 390, as in the ✓ section; ◌ not measured separately).
- OPEN (#415): ◌ also marks UNAVAILABLE (`StatusBar.tsx:406,431`) and a failed lookup (`JurisdictionSection.tsx:178`).
- OPEN (#415): the marker words "no tag" and "withdrawn" (`OSM_WORDS`, `lib/scenarios/provenance-marker.ts:38-39` on the base). "no tag" (the map carries no tag for the value) is close to "not set" from the map. "withdrawn" sits on a value the operator has set (the plan no longer uses the map's detection), so ◌ there is not "not set / pending". Listed as a second meaning, added to #415.

## i is "about". ONE (FIXED)
- Hue source: Rule 18, quoted at `lib/design/symbols.ts:5-6` ("i #34a9e8"; `--act` is `#34a9e8`, `app/globals.css:911`). DESIGN-SPACING's glyph table said "neutral" for `i`; it now says `--act` with that cite (folded in, gate repair 2).
- The marker fallback "i about" now takes `symClass("i")` `--act`, like the "i details" toggle: 6.55:1 on `#101c29`, measured at 1440 and 390 (was faint, 6.47). No live row shows "i about", so the probe measured a copy of the Speed row's own trigger, in the same cell, given the marker's markup (`marker-about` shots, `markerAbout` in the measurements; cycle 3). It is also pinned by `components/bands/FieldCell.marks.test.tsx`.

## ▲ is OPEN (#415)
"Changed this plan" (`NeedsYou.tsx:44,137`) vs "detected" (`NeedsYouConditions.tsx:525`, the glyph; the word at `:528`). `rail.ts:193` maps ▲ to "stale", but the screen shows ⚠.

## × is OPEN (#415)
- The dismissed record is grey `--none` (`app/globals.css:2584`, comment at 2572), which matches DESIGN-SPACING's table ("dismissed … `--none`"). `symbols.ts` fixes × at `--fail`, so the two sources disagree and the hue was not changed here.
- × is also red on INVALID INPUT and PLAN DECLINED (`StatusBar.tsx:295,312`), and it is the multiplication sign in `components/bands/HandoffNotes.tsx:100` and `lib/scenarios/validation.ts:129`.

## ⌁ is unused on the form (already true on the base)
Its meaning in the vocabulary is "proposed — a suggestion awaiting Confirm/Dismiss". The base already rendered no ⌁: the ⌁ proposal rows are gone (DESIGN-SPACING), and the proposed kind used ✓. It now reads "⚠ proposed" (Ryan's ruling). DESIGN-SPACING marks the ⌁ row "unused on the form" and adds "a guess to check (from the road, proposed)" to ⚠ (branch).

## Other marks (not in the vocabulary), unchanged
`›` / `‹` disclosure; `→` "becomes"; `◎` classification-map chip; `Δ`; `−` zoom; `—` empty value; `…` progress. Each has one meaning. `→` has two uses with that one meaning: was → now in the revision panel (`components/bands/RevisionPanel.tsx:221`), and a staged field edit's "label → value" (`components/NeedsYouConditions.tsx:260`, a type guard its comment says a condition row never reaches). R145 self-ruled (rulings.md, cycle 4).

## Summary: still more than one meaning after this branch
- ✓: verdicts, including the unanswered extent row and "evaluated" / "detected" (#414); the faint plain-text ✓ on "both set" and "N none found" (hue, #414); the unknown-word fallback (#416).
- ◌: also unavailable or failed, and the "withdrawn" / "no tag" marker words (#415).
- ⚠: a guess to check, and changed / needs attention (#419).
- ▲: changed-the-plan and detected (#415).
- ×: dismissed (grey) and failure (red), and multiplication (#415).

Everything else on the form (● selection, plain "default", i "about", and the non-vocabulary marks above) has one meaning, and each vocabulary mark among them one hue.
