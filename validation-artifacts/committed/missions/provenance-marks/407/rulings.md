# #407 — the chosen-option mark: its own glyph, never ✓

Mission `provenance-marks` (#408), item 2. Branch `issue-407-selection-mark`, base `7678d0b`.

## Authority

Ryan, 2026-10-25 (https://github.com/rtmakatura/conestruct/issues/407#issuecomment-6403916392):

> **No exception to Rule 18.** None of the options as written; closest to (c).
> - ✓ stays a provenance mark only ("measured", "yours").
> - A selected chip or toggle gets its own mark, for example a filled dot, and never a ✓. This covers the side chip (#290), the kind chip and the segmented toggle together.
> - After this and #397, every mark in the sandbox form means exactly one thing.

This ruling is the authority for adding a glyph to P9's fixed vocabulary (P9 origin note: the ●/○ proposal was rejected because ● was "not in vocabulary"; Ryan's ruling now puts it there, for selection only).

## Plan (5 bullets, before the diff)

1. **Problem.** ✓ marks the chosen option in `--act` on three controls: the side chip (`components/bands/WhereBand.tsx:350`, `.a-chip-check` at `app/globals.css:4862`), the kind chip (`app/globals.css:4875-4883`, trailing `::after`) and the segmented toggle (`app/globals.css:4887-4895`, hung `::before`). Rule 18 fixes ✓ at `--pass`; P9 gives each glyph one meaning and one colour.
2. **Ruling.** Ryan 2026-10-25 (above). Rule 13 (non-hue channel), P1 (pressing moves nothing, kept), P4/P11 (L2's positions kept; the three still look alike), Rule 18 (one glyph, one hue).
3. **Change.** ● (U+25CF) joins the vocabulary as `sym-select`, meaning "the option chosen on this control", hue `--act`. The three sites swap ✓ for ●, positions unchanged. The side chip's span takes `symClass("●")` (so its hue follows from the glyph, Rule 18 made structural) and the one-off `.a-chip-check` rule is deleted. `symbols.ts`, `symbols.test.ts`, DESIGN-SPACING.md's glyph table (and its "● does not land" note) and P9's vocabulary list record the adoption with the comment link.
4. **Rule 5 churn prediction** (below).
5. **Proof.** Red-on-base vitest: symbols test pins ● → `sym-select` → `--act` with the single meaning, and that no selection rule in globals.css draws ✓; mounted side-chip tests read "● West side · …" / "● East side · …"; L2's CSS test reads ● in both pseudo-element rules. Playwright on a local dev server at 1440 and 390: computed colour of the mark vs the pressed ground, `measurements.json`; before/after screenshots of the side chip, a pressed kind chip and a pressed segmented toggle. All under `validation-artifacts/committed/missions/provenance-marks/407/`.

## Rule 5 churn prediction (before the diff)

Changes (stated behaviour change: the glyph on a chosen chip/toggle option is ● instead of ✓; hue stays `--act`; nothing else on screen moves except as noted):
- `conestruct/site/app/globals.css`: `.a-chip-check` rule deleted; new `.workbench .sym-select { color: var(--act); }` beside the other `sym-*` rules; kind-chip `::after` content `"\00a0●"`; segmented `::before` content `"●\00a0"`; comments at the two blocks updated.
- `conestruct/site/components/bands/WhereBand.tsx`: side chip span `className={symClass("●")}`, text `● `; import of `symClass`.
- `conestruct/site/components/bands/FieldCell.tsx`: one comment word (✓ → ●).
- `conestruct/site/lib/design/symbols.ts`: `"●": "sym-select"` + header note citing the ruling.
- Tests: `symbols.test.ts` (vocabulary list, token map, new single-meaning test), `walkthrough-l2-css.test.ts` (✓ → ● in two expectations), `WhereBand.side-control.test.tsx` and `WhereBand.left-side.test.tsx` (text "● …", class `.sym-select`, CSS assertion moved to `.sym-select`).
- Docs: `conestruct/site/DESIGN-SPACING.md` glyph table row + deviation note; `DESIGN-PRINCIPLES.md` P9 vocabulary list.
- Evidence: this folder.
- Possible pixel move: the side chip's label shifts by the width difference between "✓ " and "● " when checked (measured, reported). Kind chip and toggle: the ✓ slot was reserved / out of flow, so labels move 0 px if ● is no wider than the reserved ✓ slot's box on the kind chip (measured).

Byte-identical: every backend file (pytest count unchanged at 3593 passed, 2 skipped), every wire field, every provenance line and marker (✓ / ⚠ / ◌ / i untouched), the ink and type censuses (no new hex, no new font size), pressed border and wash.

### Prediction amendment (before that part of the diff)

The mark inventory found a fourth selection ✓: the site-condition dismiss-reason chip, `components/NeedsYouConditions.tsx:438` (`{chosen ? "✓" : ""}` in `.reason-glyph`, ink `--act` from `.reason-chip.chosen`). Ryan's ruling covers it by its own words ("A selected chip or toggle gets its own mark … never a ✓"), so it is in this issue's scope, not a follow-up. Added churn: that one line (✓ → ●), its comment, and `components/NeedsYouConditions.test.tsx:330` (`"✓"` → `"●"`, plus a no-✓ assertion). Hue and ground unchanged (`--act` on the chip's ground); contrast measured on an injected replica of the chip inside the live `.workbench` (the real chip needs a live site-scan hit to appear).

Second amendment (before that edit): the dismiss-reason glyph also takes `symClass("●")`, so its ● is `--act` like the other three; before, its ✓ inherited the label's `--act-bright` (`.sc-picker .reason-chip.chosen`, `globals.css:2466-2469`). Stated behaviour change: that glyph's hue moves `--act-bright` → `--act` (contrast 6.44 → 5.21:1); the label keeps `--act-bright`.

## Calls

1. **R145 self-ruled — the glyph is ● (U+25CF).** Ryan's ruling names "a filled dot" as the example, and DESIGN-SPACING already knew ● (as a rejected "in progress" reading), so it is the one candidate with history. • (U+2022) was rejected: it reads as a list bullet, and the kind chip's citation line already uses a middle dot as a separator.
2. **R145 self-ruled — the hue is `--act`.** It's the pressed border's and wash's own accent (P11: the mark belongs to the control's pressed state), and the hue the shipped ✓ already had, so the visual change is the glyph alone. DESIGN-SPACING's note that "`--act` stays interactive-only" holds: a pressed chip is an interactive surface. Rule 13's second channel is the glyph's shape. AA was measured, not asserted (`measurements.json`): side chip and kind chip 5.60:1, segmented 5.16:1 at 1440 and 390, and the dismiss-reason chip 5.21:1. All four are ≥ 4.5:1. **The dismiss chip's 5.21 vs the 4.97 recorded at `app/globals.css:2462-2465`** (repair 1): that note's figures (--act 4.97, --act-bright 6.15) are the 0.14 wash over `--canvas` #14202e (recomputed 4.96 / 6.13). The NEEDS YOU block now paints `--da-ground` #101c29 (`.workbench .needs-you { background: var(--da-ground) }`), and the chosen chip's ground is the wash over that: rgb(21.0, 47.7, 67.7), where --act measures 5.21:1 and --act-bright 6.44:1. This was shown on the real ancestry, not only a replica: `repair1-probe.json` injects the chip where NeedsYou mounts (inside `.zone.results`), with NeedsYou's own element chain (`section.needs-you > ul.ny-items > li.ny-item.ny-sub.site-correction-picker > .ny-mid > .sc-picker > fieldset > label.reason-chip.chosen`). The painted ancestors are only the chip's wash, `section.needs-you` rgb(16, 28, 41), `.workbench` and body. The result is the same with and without `.owns-primary`, at 1440 and 390. So the ● stays `--act` (.sym-select). The stale note is corrected in place. The real chip, which needs a live site-scan hit, was not rendered.
3. **R145 self-ruled — positions kept.** L2's placements stay: the side chip's mark leads in flow, the kind chip's trails in a reserved slot, and the segmented one hangs left out of flow. Moving them would be churn outside the ruling. Measured label moves (`measurements.json` `labelShiftPx`): side chip −1.28 px at 1440 and 390 (● is narrower than ✓), kind chip 0, segmented 0, dismiss-reason 0.
4. **R145 self-ruled — the side chip's `.a-chip-check` rule is deleted.** Its span takes `symClass("●")`, so the hue follows from the glyph (Rule 18 made structural, as `symbols.ts` intends). The pseudo-element marks can't take a class, so they name `--act` directly, and `symbols.test.ts` pins every selection rule's glyph and token.
5. **In scope, not a fold: the dismiss-reason chip** (prediction amendment above). Ryan's words cover it: "A selected chip … never a ✓".
6. **QUESTION FOR RYAN — "✓ default".** R110 Q8 is Ryan's ruling (2026-10-07, `validation-artifacts/committed/setup-what-redesign/rulings.md:17,26`: "Hours and Speed reduction get markers ('✓ default' until changed, then '✓ yours')"). It renders as the marker "✓ default" (`lib/scenarios/provenance-marker.ts:66`) on Hours, Speed reduction, Carriageway and lane width. Changing it would reverse a Ryan ruling, so it is unchanged. Recommendation: "◌ default" is wrong (◌ means not set), so mark defaults with no ✓, for example "i default". That keeps ✓ for measured and yours, as the 2026-10-25 ruling says.
7. **QUESTION FOR RYAN — "✓ proposed".** Ryan's #284 ruling (2026-10-14, `validation-artifacts/committed/issue-284-proposed-kind/prediction.md:7-11`) says "marked '✓ proposed'" (`WhereBand.tsx:429,437`). Under the new ruling, ✓ there is neither measured nor yours, and P9's vocabulary already has ⌁ for "proposed". Unchanged. Recommendation: "⌁ proposed".
8. **Filed, not folded:** the other multi-meaning marks from the inventory (✓ as verdict; hue drift on ✓, ◌, i, ×, ⚠; double duty on ▲, ◌, ×) are in files this branch doesn't touch and need rulings. Filed as https://github.com/rtmakatura/conestruct/issues/411.

## Repair cycle 1 (independent reviewer FAIL, three repairs + two notes)

1. The #245 comments, both: `NeedsYouConditions.tsx` (the picker's JSX comment) and `app/globals.css` (the `/* #245 — the dismiss reason picker` block), "a ✓ glyph" → "a ● glyph (#407 …)". The CSS one was missed in repair 1 and fixed in repair 2.
2. Contrast reconciled (Call 2 above); `globals.css` chosen-chip note amended with the ground it was measured on and the current figures.
3. **No screenshots of the dismiss-reason chip.** It renders only after a live site scan reports a condition. Its evidence is the computed-style probe (`repair1-probe.json`, `measurements-reason-chip.json`) and the mounted test. Before/after screenshots exist for the side chip, kind chip and segmented toggle only.
4. Note folded: P9's "Origin here" line now records ●'s adoption for "selected" (`DESIGN-PRINCIPLES.md`).
5. **Unresolved: the segmented ●'s vertical position** (reworded in repair 2). On the toggle, the ● sits lower than on the other three marks: below "Daytime"'s x-height middle, near the baseline (`after-1440-segmented.png`, `after-390-segmented.png`). On the side and kind chips it sits centred. The ● inherited this from the ✓'s placement, which sat the same in `before-*-segmented.png`, so the offset predates this diff. The cause is the toggle mark being an absolute `::before` at `top: 0`, while the chip marks sit in the text flow. The `segInk` probe in `repair1-probe.json` measured against the label's full ink extent, including the "y" descender, so it does not show the marks are alike. Not fixed here: centring belongs on all four marks together. Filed as https://github.com/rtmakatura/conestruct/issues/412.

## Actual churn vs prediction

Predicted files all changed, plus the amendment's two (`NeedsYouConditions.tsx`, `NeedsYouConditions.test.tsx`). Nothing else: 12 tracked files, +107 / −36, plus this folder; after repair 1, the same 12 files, +115 / −39 (three comment/doc lines in `NeedsYouConditions.tsx`, `globals.css`, `DESIGN-PRINCIPLES.md`; no new file). After repair 2, the same 12 files, +117 / −40 (the `globals.css` #245 comment). Follow-ups filed: #411 (other multi-meaning marks), #412 (centre all four selection marks). Pixel moves: side chip label −1.28 px (predicted as "the width difference", measured), all others 0. pytest unchanged (backend untouched). vitest 2557 → 2561 passed (+4 new tests, all in `symbols.test.ts`; the other changed tests are amended in place), 1 skipped.
