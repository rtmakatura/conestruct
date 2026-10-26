# Sandbox form mark inventory (#407, mission provenance-marks #408)

Every glyph and word-mark the `/sandbox` setup form renders (band stack, NEEDS YOU, status strip, working band), with each meaning and where it renders. Line numbers are on base `7678d0b` unless marked "branch". Paths are under `conestruct/site/`. Results, PDF, landing and coming-soon surfaces are out of scope.

Hue sources: `symClass()` (`lib/design/symbols.ts`, CSS `app/globals.css` `.workbench .sym-*`): ✓ `--pass`, ▲ ⚠ `--warn`, ◌ `--none`, × `--fail`, i `--act`, ⌁ `--ink-on-dark`, ● `--act` (new). `symClass` is called at `components/StatusBar.tsx:243` (`Sym`), `components/bands/RevisionPanel.tsx:249`, `components/bands/FieldCell.tsx:153` (the "i details" toggle), `components/DisclosureRow.tsx:91` (results disclosures, outside the form), and on this branch the side chip (`WhereBand.tsx:352`) and dismiss-reason chip (`NeedsYouConditions.tsx:441`); a grep of `conestruct/site` (components, app, lib; tests excluded) finds no other caller. The provenance marker (`.a-mark`, `FieldCell.tsx:122`) draws ✓, ◌ and i in `--ink-faint` (`globals.css:5368`); only `.a-mark.is-guess` (⚠) has a hue (`--warn`, `:5386`).

**Legend:** CONFLICT = the mark carries more than one meaning or more than one hue. FIXED = settled on this branch.

## ● (new) — the option chosen on a control. One meaning, one hue (`--act`).
- Side chip: `components/bands/WhereBand.tsx:352` (branch), `symClass("●")`. FIXED (was ✓, `.a-chip-check`).
- Kind chip: `app/globals.css` `.a-chip[aria-pressed] > .tr-field::after` (branch). FIXED (was ✓).
- Segmented toggle (Hours, Speed reduction, Carriageway, street class …): `app/globals.css` `.a-seg > button[aria-pressed="true"] > .a-seg-label::before` (branch). FIXED (was ✓).
- Dismiss-reason chip (site conditions): `components/NeedsYouConditions.tsx:441` (branch), `symClass("●")`. FIXED (was ✓ in `--act-bright`).

## ✓ — CONFLICT (after this branch: still five meanings, three hues)
Ryan's ruling (2026-10-25): ✓ is a provenance mark only ("measured", "yours").
- Provenance marker, faint ink (`.a-mark`), words from `lib/scenarios/provenance-marker.ts`:
  - "yours" `:64` (your change / your answer / operator-set); OSM `operator-set` → "yours" `:34`; length field `WhereBand.tsx:768`. In scope of the ruling.
  - "measured" `:29`. In scope.
  - "overridden" `:33`, "changed" `:35`. Provenance (operator acted); fits "yours".
  - "default" `:66` (R110 Q8; Hours / Speed reduction / Carriageway via `PlanDetails.tsx:101` `defaultOrYours`; lane width `WhatBand.tsx:432`). CONFLICT: the plan's default, not measured and not the operator's. **R110 Q8 is Ryan's ruling (2026-10-07, `validation-artifacts/committed/setup-what-redesign/rulings.md:17,26`) → QUESTION FOR RYAN, not changed.**
  - "evaluated" `:73`, "detected" `:74`, unknown OSM token `:58`. Provenance-ish ("from the map").
- Settled / passed (green `--pass` or faint): band facts `lib/scenarios/band-facts.ts:450,470` → `BandPrimitives.tsx:51`; move ledger `lib/scenarios/move-ledger.ts:69-73` → `WhereBand.tsx:214` (inline `--pass`); status strip `StatusBar.tsx:444` "VERIFIED"; revision `RevisionPanel.tsx:180` "computed"; windows `ScheduleField.tsx:218,266`; file details `WhatBand.tsx:274` "✓ both set" (faint). CONFLICT with "provenance only".
- Site conditions: `NeedsYouConditions.tsx:520` "none along the corridor", `:546` "asserted by you", `:582` fold "✓ N none found" (faint), `:348` correction "confirmed". CONFLICT (verdict vs provenance).
- "Proposed" kind: `WhereBand.tsx:429` " · ✓ proposed", `:437` "✓ proposed: …" (faint). CONFLICT (⌁ is the vocabulary's "proposed"). **"marked ✓ proposed" is Ryan's #284 ruling (2026-10-14, `validation-artifacts/committed/issue-284-proposed-kind/prediction.md:7-11`) → QUESTION FOR RYAN, not changed.**
- Move-ledger word "· typed" `move-ledger.ts:182` beside ✓ on the extent: #397's scope (parked worktree).

## ⚠ — CONFLICT (guess, needs you, warning, failure, lock)
- Guess "from the road" / "from the pin": `provenance-marker.ts:32,61,63`; `.tr-prov.is-amber` prefixes `WhatBand.tsx:150,167,179`, `PlanDetails.tsx:140,153`; header `WhatBand.tsx:219`.
- Needs you: `PlanDetails.tsx:78`; move ledger attention rows `WhereBand.tsx:214`; `NeedsYou.tsx:44,137`.
- Notices: `WhereBand.tsx:640,653` (amber); `WhereBand.tsx:295,364` render ⚠ in faint ink, not amber (hue CONFLICT).
- Jurisdiction warnings `JurisdictionSection.tsx:157`; failures `RevisionPanel.tsx:180`, `StatusBar.tsx:468,487`, `ScheduleField.tsx:276,287`, moot record `NeedsYouConditions.tsx:348`; lock `WorkingBand.tsx:26`.
- DESIGN-SPACING's own meaning is "changed / needs attention / conflicts" — broad by design; the faint-ink renders break Rule 18.

## ◌ — not set / pending / in flight / unavailable
- Marker words (faint): `provenance-marker.ts:68` "not set", `:70` "evaluating", `:72` "checking", `:36` "no tag", `:37` "withdrawn"; `WhereBand.tsx:769`.
- Pending: `band-facts.ts:450,470,486`; move ledger; `RevisionPanel.tsx:180`; `WorkingBand.tsx:35`; `StatusBar.tsx:275,286,351,369,381` (AWAITING …, VERIFYING, PAUSED).
- No data: `JurisdictionSection.tsx:170,178,187`; `ScheduleField.tsx:203-211,310-340`; staged `NeedsYouConditions.tsx:380`, "not asserted" `:546`, fold `:583`.
- CONFLICT (mild): also "unavailable" / "failed lookup" `StatusBar.tsx:406,431`, `JurisdictionSection.tsx:178`. DESIGN-SPACING: "unevaluated / not set / pending — never a verdict"; a failure is closer to a verdict.

## ▲ — CONFLICT (changed-the-plan vs detected)
- `NeedsYou.tsx:44,137` "changed this plan"; `NeedsYouConditions.tsx:520` "detected" (`sc-detected`). `lib/scenarios/rail.ts:193` maps ▲ to "detection stale" but the screen uses ⚠ (`WhereBand.tsx:640`).

## × — CONFLICT (dismissed vs failure vs multiplication)
- Dismissed record `NeedsYouConditions.tsx:348`, grey `--none` (`globals.css:2579`), against `symbols.ts`'s fixed `--fail`.
- Failure `StatusBar.tsx:295` INVALID INPUT, `:312` PLAN DECLINED (`--fail`).
- Multiplication: `HandoffNotes.tsx:100`, `lib/scenarios/validation.ts:129` ("N lanes × W ft …").

## i — CONFLICT (hue)
- "i details" toggle `FieldCell.tsx:153-156` (`sym-info`, `--act`); marker fallback "i about" `provenance-marker.ts:75` (faint).

## ⌁ — not rendered on the form (`symbols.ts` only). Its meaning "proposed" is carried by ✓ (above).

## Other marks (not in the vocabulary)
- `›` / `‹` disclosure `WhatBand.tsx:285`; `→` was→now `RevisionPanel.tsx:221`, staged intent `NeedsYouConditions.tsx:259`; `◎` classification-map chip `JurisdictionSection.tsx:231,237`; `Δ` `PlanDetails.tsx:284-285`; `−` zoom `BandAerial.tsx:196`; `—` empty value `WhatBand.tsx:352`, `RevisionPanel.tsx:59,79,115`, `tier-sources.ts:156`; `…` progress `WhereBand.tsx:321`, `BandAerial.tsx:56`, `RevisionPanel.tsx:173`.

## Word-marks
- Marker words above ("yours", "default", "measured", "detected", "evaluated", "overridden", "changed", "from the road", "from the pin", "not set", "checking", "evaluating", "no tag", "withdrawn", "about") each pair with one glyph in `provenance-marker.ts`; "withdrawn" also reads "⚠ … operator-set" on Wadsworth (#397 Surface C).
- Move ledger (`.tr-prov`, `WhereBand.tsx:233`): "pending", "needs you", "confirmed", "laid out", "· typed" (#397 W1).
- "guessed, not confirmed · … · from the road" `WhatBand.tsx:418`, `PlanDetails.tsx:89`, `lib/scenarios/guesses.ts:266`; "· from the pin" `WhatBand.tsx:395`.

## Summary: marks with more than one meaning after this branch
- ✓: default (Ryan R110 Q8, QUESTION), proposed (Ryan #284, QUESTION), settled/passed verdicts (status, band facts, ledger, windows, site conditions), plus provenance. Hue green or faint.
- ⚠: guess / needs you / warning / failure / lock; faint at `WhereBand.tsx:295,364`.
- ◌: also unavailable / failed lookup.
- ▲: changed-the-plan and detected.
- ×: dismissed (grey) and failure (red); also multiplication.
- i: blue and faint.
- Marker ✓ / ◌ / i drawn faint, not their Rule 18 hues.
- ●: one meaning (selected), one hue. Settled by this branch.

Filed as a follow-up: see `rulings.md` § Calls.

Source: an inventory sweep of the files above on `7678d0b`, spot-checked by hand at `band-facts.ts:450`, `NeedsYouConditions.tsx:438,520,546`, `WhatBand.tsx:274,285`, `move-ledger.ts:69-73,182`, `provenance-marker.ts:29-75`, `PlanDetails.tsx:98-103,231-348`, `WhereBand.tsx:349-353,429,437`.
