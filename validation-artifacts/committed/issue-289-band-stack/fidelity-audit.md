# #289 — fidelity audit against #281 Part 2 (Direction A)

**Asked (2026-09-23, after Ryan confirmed the kind gate on prod):** Ryan's verdict on prod,
"spacing, font and everything is all over the place". No new behaviour: make what exists
match the spec. Investigate first, measure, don't eyeball.

**Measured:** the deployed `/sandbox` at `https://www.conestruct.com/sandbox`, `/healthz` sha
`193faab` (= `origin/main`). The frontend bundle is confirmed current off the page itself:
the setup line's value links are present and CHANGE SOMETHING ELSE is gone (both `193faab`).
Every capture is **settled**: no working band, no VERIFYING strip, and S7's preview `ready`.

**States and widths:** S1 (fresh) · S2 (road confirmed through the picker, kind unchosen) ·
S3 (kind confirmed, WHAT open, checks settled) · S5 (generated, settled) · S7 (the speed value
opened, 35 staged, preview landed), at **1440×1000** and **380×800**. That is 10 captures and
1,181 text nodes. The pin is E Colfax (39.74020, −104.95600), the arc's standing test spot.

**How:** `fidelity-audit/probe.cjs` drives the real page with Playwright and reads
`getComputedStyle` for:
- every visible element with a direct text node: family, size, weight, line-height,
  letter-spacing, colour, transform, decoration, effective opacity;
- every band, fact line, field, chip, button, panel and row: padding, gap, border,
  background, height, grid tracks, and the distance to its previous visible sibling.

`fidelity-audit/analyze.cjs` holds Part 2's type roles and box rules as explicit specs. It
maps each measured element to its rule, diffs every property the rule states, and aggregates
identical deltas into one row. A property the spec doesn't state is not diffed. The raw
measurement is committed as `fidelity-audit/capture.json` (1.4 MB): every row below is
re-derivable from it with `node analyze.cjs && node build.cjs`, without touching prod. The 10
full-page screenshots stay outside the repo (the s7-prod precedent), at
`C:\Users\rtmak\.claude\jobs\cf0a8ecb\tmp\audit\w{1440,380}-S{1,2,3,5,7}.png`.

**Spec values** are Part 2's (#281 comment 1, complete through rule 204 and "END OF PART 2"),
with the arc's recorded rulings applied where they override a number:
- **R7:** `--nav-h` is 52, not 48.
- **R9:** the fact-line floor is 48, not 44.
- **Ruling 180:** 19 px step question below 520.
- **Rule 124:** overridden by ruling 186; NEEDS YOU stays expanded in S7, so it is not a delta.
- **Rule 138:** amber provenance marks a guess, so its hue is not a delta.

## The headline, before the table

1. **The page's base is the old light theme.** `body` computes Inter **16 px / 25.6 px**,
   colour **#1b2838** on ground **#f5f0eb**, the paper palette of the pre-dark site.
   `.workbench` resets only the colour. Rule 20's base is **13 px / 1.5, #c8d1dd**. Every
   element with no declared size therefore renders at 16 px, which is all of group C:
   - the move-ledger and fact-line symbols;
   - the disclosure carets;
   - the S7 panel's values and its status row.
2. **The four label roles carry #226's values, not Part 2's.** `lib/design/type-roles.ts` is
   authoritative and its values come from #226's GO rulings on the old PDF (p. 3), so moving
   them is a ruling, not a slip (checkpoint Q1):
   - **section header:** #ffffff and .20em, against rule 3's #eaf0f7 and .18em;
   - **step index:** .14em and uppercased by CSS, against rule 4's .12em with caps written
     into the string;
   - **field label:** 12 px #c8d1dd, against rule 5's 12.5 px #eaf0f7;
   - **provenance:** 10 px .04em with a dotted underline, against rule 6's 10.5 px and no
     decoration.

   These four classes are on every screen, so this one cause is most of what reads as "font
   all over the place".
3. **The column is 1,100 px, not 880** (rule 24), under a `max-w-[1180px]` shell with
   32/40/80 padding against 26/40/0. At 1440, every band, field and fact line is 25% wider
   than drawn.
4. **Two grounds use the retired navy.** Fact lines, fields and the nav measure **#1b2838**
   (`--navy`, the old palette) against rule 1's `--panel2` **#16232f**.
5. **The verdict strip is the pre-Direction A strip:** Inter 13 px sentence case, a 3 px
   coloured left rule, and a translucent ground. Rules 50–53 call for a mono 11 px .14em
   uppercase word, a 1 px border and a solid per-variant ground.
6. **S7's layout is not built:** rule 121's two-track body (240 px field column │ panel), rule
   92's 4-track rows, rule 94's 200 × 44 APPLY and rule 95.4's 44 px status row are all absent.
   The panel stacks full-width under the field.
7. **At 380, NEEDS YOU is unreadable.** The ⚠ item wraps to one word per line because rule
   167 (citation into the provenance line, actions on their own full-width row) isn't built.
   Rules 168 and 169 aren't built either: the four download cards and the hero's geometry
   cell still render.

## Elements on screen that Direction A does not have

Each item carries the Part 1 §8 line (or Part 2 rule) that removes it. Where no line names it,
the item says so and goes to the checkpoint for a ruling rather than being removed on my
reading.

| # | element | where | removed by | status |
|---|---|---|---|---|
| X1 | **Sheet-meta row**: `MHT:` · `PROJECT: UNTITLED` · `LOCATION: —` · `SCALE: AS NOTED`, a second chrome bar under the nav. `MHT:` is an **empty cell** pre-generate. At 380 it clips off the right edge (`SCALE` cut). | all states, both widths | **Part 1 §8.32**: "Sheet meta — DROPPED from the screen; the TA/sheet citation it carried moves to the nav's right edge post-generate." | remove |
| X2 | **`02 · GENERATOR` eyebrow and the H1** "Method of Handling Traffic — plan generator" | all | No §8 line names the H1. Part 1 §1.2's order is nav → verdict strip → band stack; rule 25 puts nothing in the column but the bands and stacks; §8.28 drops the zone headings ("02 · RESULTS" survives only as S4's placeholder label). | **ruling — Q2** |
| X3 | **Orange corner brackets** on the frame (`.workbench-frame`) | all | Rule 20: the frame is a 1 px #2c3e53 border. No §8 line keeps the brackets. | **ruling — Q2** |
| X4 | **Nav extras**: the `v0.4` tag, the orange `DEMO /` tag, the `MUTCD PLAN GENERATOR` item, an **empty `·` cell** pre-generate, and `TA-3 · S-630-1` as its own middle cell with an orange `TA-3` | all @1440 | Rule 23: the TA/sheet citation is the right slot's static string "TA-3 · S-630-1 · MUTCD 2023 · CDOT" (§8.1). Rule 22: nav items #93a0b0, the active one #34a9e8, so no orange. The empty `·` cell is the citation's slot rendering with nothing in it (rule 14: a value not known renders as a word, never an empty box). | empty cell and citation placement: remove/move by rule 23. `v0.4` / `DEMO`: **ruling — Q2** |
| X5 | **"map · road detect · work zone in one step"** caption under the FIND row | S1, S2 | Rule 64's body order is question → provenance → producers → primary, with no caption slot. Rule 114's S1 is field + FIND only. §8.19 retires the picker CTA as a distinct control; the button stays by ruling 189, but its caption describes the modal. | remove |
| X6 | **Corridor-extent block** in WHERE: the `CORRIDOR EXTENT` header, the zone rows (or their wait/unavailable note) and a dotted top rule, a form-like block after the extent field | S2 (S1 when a length exists) | §8.19 and rule 104 put the zone lengths on the **aerial** (S2), and rule 116 on S3's 104 px corridor strip under the WHERE fact line. Phase 2 has no aerial (the recorded deviation in `WhereBand.tsx`'s header), so these rows are the lengths' only pre-generate home. | **ruling — Q3** |
| X7 | **The strip's disclosure**: a `▸` caret and an expanding check list ("1 compliance check failed — see the audit trail below", `MANUAL HANDLING`, `CDOT S-630-1`) | S5, S7 | Rules 50–55: symbol, word, pill, and in S7 the trailing clause. Nothing opens. §8.2 keeps the strip's four states and precedence but does not name this expansion. | **ruling — Q4** |
| X8 | **"MHT PACKAGE" heading** over the download row, plus a separate **"4 files"** count under the zip button | S5, S7 | Rules 84–86: the row is the four cards. Ruling 193 passes "the file count is stated exactly once on the page" to the download row, so the heading and the extra count are the old results-head's. | remove the heading. The count stays once (ruling 193); which instance survives goes to Q4 |
| X9 | **Uppercase result tags** after NEEDS YOU item names: `APPLIED`, `FAIL` | S5, S7 | Rule 75: the provenance line "always names the tier in words — 'changed this plan', 'needs attention'", and it already does. The tag says it a second time in a third vocabulary. | remove |
| X10 | **S7 panel column-header row** ("Speed limit · was · now"), the panel title **"IF YOU APPLY THIS"**, and the band head reading **"REVISING · REVISING · SPEED LIMIT"** | S7 | Rules 92–93 specify rows only, with no header row. Rule 91's title is "WHAT THIS CHANGES". Rule 4 makes "REVISING" the step index and rule 62 the section header, so the word appears once as the index and the head is the field. | remove the row, fix both strings |
| X11 | **Street-class segmented control** (Local / Collector / Arterial) and the two **suggestion panels** in the road-type and jurisdiction cells (the `⌁` glyph, bold names, two "boundary data is approximate" paragraphs) | S3 | §8.21: "moved into the WHAT band as two fields (jurisdiction, road type) with their provenance lines". The suggestion records are ruled (#201 / #227: they live in the cell), but Part 2 has no component for a segmented control or a suggestion panel, so their type is unspecified (table rows 63–67). The `⌁` glyph is outside rule 17's set. | style to rules 6 / 133 / 135; the `⌁` glyph is **Q5** |
| X12 | **Draft notice as a callout**: an amber 2 px left rule, an amber uppercase heading, then a 13 px sans paragraph | all | Rule 29: provenance role, two sentences, verbatim "Draft — not a sealed plan. Output is engineering reference; requires review and seal by a licensed PE prior to field use." The built words differ too ("…Requires review and seal by a licensed Professional Engineer prior to field use."). | restyle; the wording is **Q6** (the words are #198-adjacent: they appear in the PDF) |
| X13 | **"SITE CONDITIONS — SCANNED" sub-header** inside NEEDS YOU | S5, S7 | §8.5 moves the corrections block "whole … inside NEEDS YOU as its item rows"; rule 79 lists the rows with no sub-header. | **ruling — Q4** (kept-whole may include it) |
| X14 | At **380**: the four **download cards** and the **hero's geometry cell** render | S5, S7 @380 | Rule 168: one primary "↓ ALL FILES (.ZIP)" plus a "✓ 4 files ready" disclosure; the cards do not render. Rule 169: the geometry cell is not rendered at 380. | **Q7** — this pass or Phase 4 (#281's own "380 px arc") |

Two things that look extra but are ruled, so they stay:
- the "4 more kinds are not enabled" line (R2, 2026-09-22);
- the "THE REST OF THIS PLAN" group (hand-check correction 1, 2026-09-23).

The footer is §8.14 "kept, unchanged", so its text is not diffed.

## The table — every measured delta, grouped by cause

Each row is one delta that one fix removes: the elements that share it are listed together.
"states" names where it was measured ("all" = S1 S2 S3 S5 S7). The cause groups:
- **A · wrong token:** the element carries its Direction A class and the class has the wrong
  value. Fix the token and every element follows.
- **B · inherited old-page style:** the element is styled by a pre-redesign component class or
  a Tailwind utility (`status-bar`, `dl-card`, `generate-btn`, `mb-6.pl-4.border-l-2`…).
- **C · missing rule:** nothing sets the property, so the body's 16 px, or a browser default,
  shows through.
- **D · extra element:** the table above (X1–X14), plus the unmapped text nodes at the end.

## The captures

| state | width | settled | text nodes | boxes | page height | horizontal overflow |
|---|---|---|---|---|---|---|
| S1 | 380 | true | 33 | 26 | 1339 px | none |
| S2 | 380 | true | 66 | 56 | 2239 px | none |
| S3 | 380 | true | 88 | 81 | 3466 px | none |
| S5 | 380 | true | 176 | 76 | 3988 px | none |
| S7 | 380 | true | 211 | 102 | 4833 px | none |
| S1 | 1440 | true | 38 | 26 | 1067 px | none |
| S2 | 1440 | true | 71 | 59 | 1728 px | none |
| S3 | 1440 | true | 95 | 82 | 2027 px | none |
| S5 | 1440 | true | 184 | 77 | 2299 px | none |
| S7 | 1440 | true | 219 | 103 | 3159 px | none |

Run at 2026-09-23T20:18:12.839Z. 1181 text nodes in total. Body base in every capture: `__Inter_8b3a0b 16px/25.6px rgb(27, 40, 56) bg rgb(245, 240, 235)`.

### A · wrong token (a Direction A class with the wrong value) — 62 rows

| # | element | Part 2 rule | property | spec | measured | delta | states |
|---|---|---|---|---|---|---|---|
| 1 | section header — span.tr-section<br>section header — h3.ny-title.tr-section | 3 | line-height | 12px (1.2) | 16px | +4px | all · both widths |
| 2 | section header — span.tr-section<br>section header — h3.ny-title.tr-section | 3 | letter-spacing | 0.18em | 0.2em | +0.02em | all · both widths |
| 3 | section header — span.tr-section<br>section header — h3.ny-title.tr-section | 3 | colour | #eaf0f7 | #ffffff | ≠ | all · both widths |
| 4 | step index — span.tr-step | 4 | line-height | 12px (1.2) | 16px | +4px | S1 S2 S3 S7 · both widths |
| 5 | step index — span.tr-step | 4 | letter-spacing | 0.12em | 0.14em | +0.02em | S1 S2 S3 S7 · both widths |
| 6 | step index — span.tr-step | 4 | transform | none | uppercase | ≠ | S1 S2 S3 S7 · both widths |
| 7 | field label — span.tr-field<br>field label — label.tr-field | 5 | size | 12.5px | 12px | -0.5px | all · both widths |
| 8 | field label — span.tr-field<br>field label — label.tr-field | 5 | line-height | 17.5px (1.4) | 19.2px | +1.7px | all · both widths |
| 9 | field label — span.tr-field<br>field label — label.tr-field | 5 | colour | #eaf0f7 | #c8d1dd | ≠ | all · both widths |
| 10 | provenance — span.tr-prov.a-prov<br>provenance — p.tr-prov.a-question-prov<br>provenance — div.tr-prov.mt-2<br>provenance — span.tr-prov.a-fact-prov<br>provenance — div.tr-prov.a-gencap<br>provenance — span.tr-prov<br>provenance — div.a-sub.tr-prov<br>provenance — p.ny-sub.tr-prov<br>provenance — p.ny-prov.tr-prov<br>provenance — span.sc-result.sc-detected<br>provenance — span.sc-evidence<br>provenance — span.sc-result.sc-absent<br>provenance — span.sc-result.sc-unset<br>provenance — span.sc-apply-text.tr-prov<br>provenance — span.sc-foot-text.tr-prov<br>provenance — time.sc-time<br>provenance — div.sub.tr-prov<br>provenance — span.dl-all-count.tr-prov<br>provenance — span.disc-prov.tr-prov | 6 | size | 10.5px | 10px | -0.5px | all · both widths |
| 11 | provenance — span.tr-prov.a-prov<br>provenance — p.tr-prov.a-question-prov<br>provenance — div.tr-prov.mt-2<br>provenance — span.tr-prov.a-fact-prov<br>provenance — div.tr-prov.a-gencap<br>provenance — span.tr-prov<br>provenance — div.a-sub.tr-prov<br>provenance — p.ny-sub.tr-prov<br>provenance — p.ny-prov.tr-prov<br>provenance — time.sc-time<br>provenance — div.sub.tr-prov<br>provenance — span.disc-prov.tr-prov | 6 | decoration | none | underline | ≠ | all · both widths |
| 12 | provenance — span.sc-result.sc-detected | 6 | colour | #93a0b0 | #ff8a2e | ≠ | S5 S7 · both widths |
| 13 | provenance — span.fmt | 6 | size | 10.5px | 9.5px | -1px | S5 S7 · both widths |
| 14 | provenance — span.fmt | 6 | line-height | 15.75px (1.5) | 15.2px | -0.55px | S5 S7 · both widths |
| 15 | provenance — span.fmt | 6 | transform | none | uppercase | ≠ | S5 S7 · both widths |
| 16 | provenance (amber guess) — span.tr-prov.is-amber<br>glyph inside provenance — span | 6 / 138 | size | 10.5px | 10px | -0.5px | S3 · both widths |
| 17 | provenance (amber guess) — span.tr-prov.is-amber | 6 / 138 | decoration | none | underline | ≠ | S3 · both widths |
| 18 | item body — span.ny-body.tr-field<br>item body — span.ny-body.tr-field.sc-name | 9 | size | 13.5px | 12px | -1.5px | S5 S7 · both widths |
| 19 | item body — span.ny-body.tr-field<br>item body — span.ny-body.tr-field.sc-name | 9 | line-height | 20.25px (1.5) | 19.2px | -1.05px | S5 S7 · both widths |
| 20 | item body — span.ny-body.tr-field<br>item body — span.ny-body.tr-field.sc-name | 9 | colour | #eaf0f7 | #c8d1dd | ≠ | S5 S7 · both widths |
| 21 | citation — span.ny-cite.tr-step | 11 | size | 9.5px | 10px | +0.5px | S5 S7 · both widths |
| 22 | citation — span.ny-cite.tr-step | 11 | letter-spacing | 0.06em | 0.14em | +0.08em | S5 S7 · both widths |
| 23 | span.a-sym "○" | 17–18 | glyph | ◌ | ○ | ≠ | S1 S2 · both widths |
| 24 | span.ck.fail "✕" | 17–18 | glyph | × | ✕ | ≠ | S5 S7 · both widths |
| 25 | span.ck "ℹ" | 17–18 | glyph | i | ℹ | ≠ | S5 S7 · both widths |
| 26 | span.ny-glyph.tr-field "▲"<br>span.ny-glyph.tr-field "⚠"<br>span.ny-glyph.tr-field.sc-detected "▲"<br>span.ny-glyph.tr-field.sc-absent "✓"<br>span.ny-glyph.tr-field.sc-unset "◌" | 17–18 | family | mono | sans | ≠ | S5 S7 · both widths |
| 27 | span.ny-glyph.tr-field "▲"<br>span.ny-glyph.tr-field "⚠"<br>span.ny-glyph.tr-field.sc-detected "▲"<br>span.ny-glyph.tr-field.sc-absent "✓"<br>span.ny-glyph.tr-field.sc-unset "◌" | 17–18 | size | 12.5px | 12px | -0.5px | S5 S7 · both widths |
| 28 | span.ny-glyph.tr-field.sc-detected "▲" | 17–18 | colour | #f4c020 | #ff8a2e | ≠ | S5 S7 · both widths |
| 29 | fact line — div.a-fact.is-pending<br>fact line — div.a-fact | 56 | background | #16232f | #1b2838 | ≠ | all · both widths |
| 30 | open band (revising) — section.a-open.is-revising | 61 | border-top | 1px solid #34a9e8 | 1px solid #2c3e53 | 0px | S7 · both widths |
| 31 | NEEDS YOU count — span.ny-count.tr-step | 73 | size | 11px | 10px | -1px | S5 S7 · both widths |
| 32 | NEEDS YOU item — li.ny-item.is-changed<br>NEEDS YOU item — li.ny-item.ny-cond.site-correction-row | 74 | grid | 18px / 1fr (rule 166/167) | 20px 152.797px 96.2031px | +2px | S5 S7 @380 |
| 33 | NEEDS YOU item — li.ny-item.is-attention | 74 | grid | 18px / 1fr (rule 166/167) | 20px 0px 249px | +2px | S5 S7 @380 |
| 34 | NEEDS YOU item — li.ny-item.ny-cond.site-condition-manual | 74 | grid | 18px / 1fr (rule 166/167) | 20px 180.594px 68.4062px | +2px | S5 S7 @380 |
| 35 | Apply row — li.ny-item.ny-apply.sc-apply | 78 | padding | 13px 16px 13px 16px | 14px 16px 14px 16px | +1px | S5 S7 · both widths |
| 36 | hero case-id line — div.caseid.tr-prov | 82 | size | 10.5px | 10px | -0.5px | S5 S7 · both widths |
| 37 | disclosure count — span.disc-count.tr-step | 88 | size | 11px | 10px | -1px | S5 S7 · both widths |
| 38 | disclosure count — span.disc-count.tr-step | 88 | colour | #c8d1dd | #93a0b0 | ≠ | S5 S7 · both widths |
| 39 | before/after panel — div.a-panel | 90 | background | #0f1c29 | #000000@0 | ≠ | S7 · both widths |
| 40 | before/after panel — div.a-panel | 90 | border-top | 1px solid #34a9e8 | 1px solid #2c3e53 | 0px | S7 · both widths |
| 41 | panel row — div.a-panel-row<br>panel row — div.a-panel-row.is-deferred | 92 / 95.15 | padding | 10px 16px 10px 16px | 7px 0px 7px 0px | -3px | S7 · both widths |
| 42 | panel row — div.a-panel-row<br>panel row — div.a-panel-row.is-deferred | 92 / 95.15 | grid | 1fr 58px 16px 96px | 110.219px 68.8906px 68.8906px | +109.22px | S7 @380 |
| 43 | panel row — div.a-panel-row<br>panel row — div.a-panel-row.is-deferred | 92 / 95.15 | grid | 1fr 92px 22px 92px | 451.547px 282.219px 282.234px | +450.55px | S7 @1440 |
| 44 | APPLY — button.a-pri | 94 / 95.15 | height | 44px | 56px | +12px | S7 @1440 |
| 45 | APPLY — button.a-pri | 94 / 95.15 | width | 200px | 1036px | +836px | S7 @1440 |
| 46 | stale ribbon — div.stale-ribbon | 100 | size | 13.5px | 12.5px | -1px | S7 · both widths |
| 47 | stale ribbon — div.stale-ribbon | 100 | line-height | 19.58px (1.45) | 20px | +0.42px | S7 · both widths |
| 48 | WHERE confirm primary — button.a-pri | 115 | gap above | 14px | 0px | -14px | S2 @1440 |
| 49 | primary — button.a-pri | 130 | size | 15.5px | 13.5px | -2px | S1 S2 · both widths |
| 50 | primary — button.a-pri | 130 | colour | #0c1622 | #06222f | ≠ | S1 S2 S7 · both widths |
| 51 | ledger action — button.confirm<br>ledger action — button.ghost<br>ledger action — button.act.tr-step | 133 | size | 9.5px | 10px | +0.5px | S3 S5 S7 · both widths |
| 52 | ledger action — button.confirm<br>ledger action — button.ghost | 133 | letter-spacing | 0.14em | 0.06em | -0.08em | S3 · both widths |
| 53 | ledger action — button.confirm | 133 | colour | #c8d1dd | #34a9e8 | ≠ | S3 · both widths |
| 54 | ledger action — button.ghost | 133 | colour | #c8d1dd | #93a0b0 | ≠ | S3 · both widths |
| 55 | ledger action (disabled) — button.act.tr-step.is-on | 133 disabled | size | 9.5px | 10px | +0.5px | S5 · both widths |
| 56 | ledger action (disabled) — button.act.tr-step.is-on | 133 disabled | colour | #c8d1dd (at opacity .45) | #93a0b0@0.35 | ≠ | S5 · both widths |
| 57 | ledger action (recommended, on) — button.act.tr-step.is-on | 133 on | size | 9.5px | 10px | +0.5px | S7 · both widths |
| 58 | ledger action (recommended, on) — button.act.tr-step.is-on | 133 on | colour | #34a9e8 | #56bcf2 | ≠ | S7 · both widths |
| 59 | toggle chip (flat) — button.a-chip.a-chip-flat | 135 / 5 | family | sans | mono | ≠ | S3 · both widths |
| 60 | toggle chip (flat) — button.a-chip.a-chip-flat | 135 / 5 | weight | 500 | 400 | ≠ | S3 · both widths |
| 61 | toggle chip (flat) — button.a-chip.a-chip-flat | 135 / 5 | colour | #eaf0f7 | #c8d1dd | ≠ | S3 · both widths |
| 62 | field — input.a-fld<br>field — input#band-worklen.a-fld<br>field — select#what-speed.a-fld<br>field — select#what-lanes.a-fld<br>field — select#what-lane-width.a-fld<br>field — select#what-road-type.a-fld<br>field — select#what-jurisdiction.a-fld.is-unset<br>field — input#what-date.a-fld.is-unset<br>field — input#what-project.a-fld.is-unset<br>field — input#what-location-description.a-fld.is-unset<br>field — select#pd-work-type.a-fld<br>field — select#revise-speed.a-fld | 136 | background | #16232f | #1b2838 | ≠ | S1 S2 S3 S7 · both widths |

### B · inherited old-page style — 92 rows

| # | element | Part 2 rule | property | spec | measured | delta | states |
|---|---|---|---|---|---|---|---|
| 63 | suggestion line — span<br>suggestion line — b.sugg-name | 6 | size | 10.5px | 11.5px | +1px | S3 · both widths |
| 64 | suggestion line — span<br>suggestion line — b.sugg-name<br>suggestion line — span.font-mono | 6 | colour | #93a0b0 | #c8d1dd | ≠ | S3 · both widths |
| 65 | suggestion line — b.sugg-name | 6 | weight | 400 | 700 | ≠ | S3 · both widths |
| 66 | suggestion line — span.font-mono | 6 | size | 10.5px | 10px | -0.5px | S3 · both widths |
| 67 | suggestion line — div.honesty | 6 | size | 10.5px | 9.5px | -1px | S3 · both widths |
| 68 | schedule-window line — span | 6 | family | mono | sans | ≠ | S3 · both widths |
| 69 | schedule-window line — span | 6 | size | 10.5px | 11px | +0.5px | S3 · both widths |
| 70 | generated numeral (card) — b | 10 | family | mono | sans | ≠ | S5 S7 · both widths |
| 71 | generated numeral (card) — b | 10 | weight | 500 | 600 | ≠ | S5 S7 · both widths |
| 72 | span.ck.fail "✕"<br>span.ck "ℹ"<br>span.disc-glyph.tr-field "i"<br>span.disc-glyph.tr-field "✓"<br>span.disc-glyph.tr-field "◌" | 17–18 | family | mono | sans | ≠ | S5 S7 · both widths |
| 73 | span.ck.fail "✕"<br>span.ck "ℹ" | 17–18 | size | 12.5px | 11px | -1.5px | S5 S7 · both widths |
| 74 | span.ck "ℹ" | 17–18 | colour | #34a9e8 | #4fd787 | ≠ | S5 S7 · both widths |
| 75 | span.disc-glyph.tr-field "i"<br>span.disc-glyph.tr-field "✓"<br>span.disc-glyph.tr-field "◌" | 17–18 | size | 12.5px | 12px | -0.5px | S5 S7 · both widths |
| 76 | span.disc-glyph.tr-field "i" | 17–18 | colour | #34a9e8 | #c8d1dd | ≠ | S5 S7 · both widths |
| 77 | span.disc-glyph.tr-field "✓" | 17–18 | colour | #4fd787 | #c8d1dd | ≠ | S5 S7 · both widths |
| 78 | span.disc-glyph.tr-field "◌" | 17–18 | colour | #93a0b0 | #c8d1dd | ≠ | S5 S7 · both widths |
| 79 | nav height — nav.sticky.top-0.z-.flex | 21 / R7 | background | #16232f | #1b2838 | ≠ | all · both widths |
| 80 | wordmark — span<br>wordmark period — span | 22 | size | 14.5px | 16px | +1.5px | all · both widths |
| 81 | wordmark — span<br>wordmark period — span | 22 | weight | 600 | 700 | ≠ | all · both widths |
| 82 | wordmark — span | 22 | colour | #eaf0f7 | #ffffff | ≠ | all · both widths |
| 83 | nav text — span.font-mono.uppercase | 22 / 23 | letter-spacing | 0.16em | 0.08em | -0.08em | all · both widths |
| 84 | nav text — span<br>nav text — span.hidden.md:flex.items-center.px-5 | 22 / 23 | letter-spacing | 0.16em | 0.1em | -0.06em | all @1440 |
| 85 | nav text — span | 22 / 23 | colour | #93a0b0 | #ff8a2e | ≠ | all @1440 |
| 86 | column width — main | 24 | column width | 880px | 1100px | +220px | all @1440 |
| 87 | page padding — main | 24 / 160 | padding | 16px 14px 16px 14px | 24px 24px 80px 24px | +8px | all @380 |
| 88 | page padding — main | 24 / 160 | padding | 26px 40px 0px 40px | 32px 40px 80px 40px | +6px | all @1440 |
| 89 | verdict strip → setup fact line | 27 | gap | 14px | 24px | +10px | S5 · both widths |
| 90 | NEEDS YOU → hero — div | 27 | gap above | 14px | 0px (after section#site-corrections.needs-you.jump-anchor.outline-none.owns-primary) | -14px | S5 · both widths |
| 91 | NEEDS YOU → hero — div.results-stale | 27 | gap above | 14px | 16px (after div.stale-ribbon) | +2px | S7 · both widths |
| 92 | draft notice — div.font-mono.uppercase | 29 | size | 10.5px | 10px | -0.5px | all · both widths |
| 93 | draft notice — div.font-mono.uppercase | 29 | colour | #93a0b0 | #f4c020 | ≠ | all · both widths |
| 94 | draft notice — div.font-mono.uppercase | 29 | transform | none | uppercase | ≠ | all · both widths |
| 95 | draft notice — div | 29 | family | mono | sans | ≠ | all · both widths |
| 96 | draft notice — div | 29 | size | 10.5px | 13px | +2.5px | all · both widths |
| 97 | draft notice — div | 29 | line-height | 15.75px (1.5) | 17.875px | +2.13px | all · both widths |
| 98 | verdict strip — flag — summary.status-bar.caution | 50 / 53 flag | padding | 13px 16px 13px 16px | 12px 16px 12px 16px | -1px | S5 S7 · both widths |
| 99 | verdict strip — flag — summary.status-bar.caution | 50 / 53 flag | column-gap | 12px | 16px | +4px | S5 S7 · both widths |
| 100 | verdict strip — flag — summary.status-bar.caution | 50 / 53 flag | background | #221e10 | #000000@0.25 | ≠ | S5 S7 · both widths |
| 101 | verdict strip — flag — summary.status-bar.caution | 50 / 53 flag | border-top | 1px solid #6b5a18 | 1px solid #2c3e53 | 0px | S5 S7 · both widths |
| 102 | verdict strip — flag — summary.status-bar.caution | 50 / 53 flag | border-left | 1px solid #6b5a18 | 3px solid #f4c020 | +2px | S5 S7 · both widths |
| 103 | verdict strip — none — div.status-bar.idle.unavail | 50 / 53 none | padding | 13px 16px 13px 16px | 12px 16px 12px 16px | -1px | S1 S2 · both widths |
| 104 | verdict strip — none — div.status-bar.idle.unavail | 50 / 53 none | column-gap | 12px | 16px | +4px | S1 S2 · both widths |
| 105 | verdict strip — none — div.status-bar.idle.unavail | 50 / 53 none | background | #101c29 | #93a0b0@0.14 | ≠ | S1 S2 · both widths |
| 106 | verdict strip — none — div.status-bar.idle.unavail | 50 / 53 none | border-top | 1px solid #223345 | 1px solid #2c3e53 | 0px | S1 S2 · both widths |
| 107 | verdict strip — none — div.status-bar.idle.unavail | 50 / 53 none | border-left | 1px solid #223345 | 3px solid #93a0b0 | +2px | S1 S2 · both widths |
| 108 | verdict strip — ready — div.status-bar.pass | 50 / 53 ready | padding | 13px 16px 13px 16px | 12px 16px 12px 16px | -1px | S3 · both widths |
| 109 | verdict strip — ready — div.status-bar.pass | 50 / 53 ready | column-gap | 12px | 16px | +4px | S3 · both widths |
| 110 | verdict strip — ready — div.status-bar.pass | 50 / 53 ready | background | #112620 | #000000@0.25 | ≠ | S3 · both widths |
| 111 | verdict strip — ready — div.status-bar.pass | 50 / 53 ready | border-top | 1px solid #2d6b4d | 1px solid #2c3e53 | 0px | S3 · both widths |
| 112 | verdict strip — ready — div.status-bar.pass | 50 / 53 ready | border-left | 1px solid #2d6b4d | 3px solid #4fd787 | +2px | S3 · both widths |
| 113 | verdict word — span | 51 | family | mono | sans | ≠ | S3 S5 S7 · both widths |
| 114 | verdict word — span | 51 | size | 11px | 13px | +2px | S3 S5 S7 · both widths |
| 115 | verdict word — span | 51 | weight | 500 | 400 | ≠ | S3 S5 S7 · both widths |
| 116 | verdict word — span | 51 | letter-spacing | 0.14em | 0em | -0.14em | S3 S5 S7 · both widths |
| 117 | verdict word — span | 51 | colour | #eaf0f7 | #c8d1dd | ≠ | S3 S5 S7 · both widths |
| 118 | verdict word — span | 51 | transform | uppercase | none | ≠ | S3 S5 S7 · both widths |
| 119 | verdict word (none variant) — span | 51 / 53 | family | mono | sans | ≠ | S1 S2 · both widths |
| 120 | verdict word (none variant) — span | 51 / 53 | size | 11px | 13px | +2px | S1 S2 · both widths |
| 121 | verdict word (none variant) — span | 51 / 53 | weight | 500 | 400 | ≠ | S1 S2 · both widths |
| 122 | verdict word (none variant) — span | 51 / 53 | letter-spacing | 0.14em | 0em | -0.14em | S1 S2 · both widths |
| 123 | verdict word (none variant) — span | 51 / 53 | colour | #93a0b0 | #aebbcc | ≠ | S1 S2 · both widths |
| 124 | verdict word (none variant) — span | 51 / 53 | transform | uppercase | none | ≠ | S1 S2 · both widths |
| 125 | verdict pill — span.pill.pass<br>verdict pill — span.pill.caution | 52 | size | 9.5px | 11px | +1.5px | S3 S5 S7 · both widths |
| 126 | verdict pill — span.pill.pass<br>verdict pill — span.pill.caution | 52 | weight | 500 | 600 | ≠ | S3 S5 S7 · both widths |
| 127 | verdict pill — span.pill.pass<br>verdict pill — span.pill.caution | 52 | letter-spacing | 0.14em | 0.06em | -0.08em | S3 S5 S7 · both widths |
| 128 | verdict pill — span.pill.pass<br>verdict pill — span.pill.caution | 52 | padding | 6px 10px 6px 10px | 4px 8px 4px 8px | -2px | S3 S5 S7 · both widths |
| 129 | verdict pill — span.pill.pass<br>verdict pill — span.pill.caution | 52 | border-top | 1px | 0px | -1px | S3 S5 S7 · both widths |
| 130 | hero cell label (quiet header) — span.k | 81 / 3q | line-height | 12px (1.2) | 16px | +4px | S5 S7 · both widths |
| 131 | download row — div.dls | 84 | renders at 380 | no (rule 168) | yes | ≠ | S5 S7 @380 |
| 132 | download card title — h3 | 85 / 5 | size | 12.5px | 14px | +1.5px | S5 S7 · both widths |
| 133 | download card title — h3 | 85 / 5 | weight | 500 | 600 | ≠ | S5 S7 · both widths |
| 134 | download card title — h3 | 85 / 5 | line-height | 17.5px (1.4) | 22.4px | +4.9px | S5 S7 · both widths |
| 135 | download card title — h3 | 85 / 5 | colour | #eaf0f7 | #ffffff | ≠ | S5 S7 · both widths |
| 136 | card caption — span.font-mono.uppercase | 85 / 6 | size | 10.5px | 10px | -0.5px | S5 S7 · both widths |
| 137 | card caption — span.font-mono.uppercase | 85 / 6 | line-height | 15.75px (1.5) | 14.5px | -1.25px | S5 S7 · both widths |
| 138 | card caption — span.font-mono.uppercase | 85 / 6 | transform | none | uppercase | ≠ | S5 S7 · both widths |
| 139 | card caption — span.qty | 85 / 6 | family | mono | sans | ≠ | S5 S7 · both widths |
| 140 | card caption — span.qty | 85 / 6 | size | 10.5px | 11.5px | +1px | S5 S7 · both widths |
| 141 | card caption — span.qty | 85 / 6 | line-height | 15.75px (1.5) | 16.675px | +0.93px | S5 S7 · both widths |
| 142 | Generate reason line — div.mt-2.font-mono.uppercase | 116 / 130 | size | 10.5px | 10px | -0.5px | S1 S2 · both widths |
| 143 | Generate reason line — div.mt-2.font-mono.uppercase | 116 / 130 | colour | #93a0b0 | #ff7a7a | ≠ | S1 S2 · both widths |
| 144 | Generate reason line — div.mt-2.font-mono.uppercase | 116 / 130 | transform | none | uppercase | ≠ | S1 S2 · both widths |
| 145 | primary XL (Generate) — button.generate-btn | 131 | size | 17.5px | 15.5px | -2px | S1 S2 S3 @380 |
| 146 | primary XL (Generate) — button.generate-btn | 131 | colour | #0c1622 | #93a0b0 | ≠ | S1 S2 · both widths |
| 147 | primary XL (Generate) — button.generate-btn | 131 | transform | none | uppercase | ≠ | S1 S2 S3 · both widths |
| 148 | Generate primary — button.generate-btn | 131 | height | 66px | 48px | -18px | S1 S2 S3 @380 |
| 149 | primary XL (Generate) — button.generate-btn | 131 | colour | #0c1622 | #06222f | ≠ | S3 · both widths |
| 150 | ghost (download buttons, zip) — button.dl-btn | 132 | size | 13px | 12.5px | -0.5px | S5 S7 · both widths |
| 151 | ghost (download buttons, zip) — button.dl-btn | 132 | weight | 500 | 600 | ≠ | S5 S7 · both widths |
| 152 | ghost (download buttons, zip) — button.dl-btn | 132 | colour | #eaf0f7 | #56bcf2 | ≠ | S5 S7 · both widths |
| 153 | card button (ghost) — button.dl-btn | 132 | height | 44px | 40px | -4px | S5 S7 @1440 |
| 154 | hero geometry cell at 380 — div.hero-meta | 169 | renders at 380 | no (rule 168) | yes | ≠ | S5 S7 @380 |

### C · missing rule (nothing declared; the body's 16 px or a browser default shows through) — 11 rows

| # | element | Part 2 rule | property | spec | measured | delta | states |
|---|---|---|---|---|---|---|---|
| 155 | span.a-sym "✓"<br>span.a-sym "⚠"<br>span.a-sym "○"<br>span.sw-glyph "◌" | 17–18 | family | mono | sans | ≠ | S2 S3 · both widths |
| 156 | span.a-sym "✓"<br>span.a-sym "⚠"<br>span.a-sym "○"<br>span.sw-glyph "◌" | 17–18 | size | 12.5px | 16px | +3.5px | S2 S3 · both widths |
| 157 | disclosure caret — span.disc-caret | 88 | family | mono | sans | ≠ | S5 S7 · both widths |
| 158 | disclosure caret — span.disc-caret | 88 | size | 12px | 16px | +4px | S5 S7 · both widths |
| 159 | panel was / now — span.a-val | 93 | family | mono | sans | ≠ | S7 · both widths |
| 160 | panel was / now — span.a-val | 93 | size | 12.5px | 16px | +3.5px | S7 · both widths |
| 161 | panel status row — div.a-panel-status | 95.4 | size | 10.5px | 16px | +5.5px | S7 · both widths |
| 162 | panel status row — div.a-panel-status | 95.4 | padding | 11px 16px 11px 16px | 0px 0px 0px 0px | -11px | S7 · both widths |
| 163 | panel status row — div.a-panel-status | 95.4 | min-height | 44px | 22px (h 25.59) | -22px | S7 @1440 |
| 164 | S7 body grid — div.a-body | 121 | column-gap | 26px | normal | ≠ | S7 · both widths |
| 165 | S7 body grid — div.a-body | 121 | grid | 240px 1fr | none | ≠ | S7 · both widths |

### Unmapped text nodes — no Part 2 rule names them (25)

| element | text | measured | where |
|---|---|---|---|
| button | Local | sans 12px/19.2px 400 #93a0b0 none | S3 · both widths |
| button | Collector | sans 12px/19.2px 400 #93a0b0 none | S3 · both widths |
| button | Arterial | sans 12px/19.2px 400 #93a0b0 none | S3 · both widths |
| div.font-mono.uppercase | 02 · GENERATOR | mono 11px/17.6px 400 #34a9e8 uppercase | all · both widths |
| div.font-mono.uppercase | MHT PACKAGE | mono 10px/16px 400 #93a0b0 uppercase | S5 S7 · both widths |
| h1.font-bold | Method of Handling Traffic — plan generator | sans 28px/30.8px 700 #ffffff none | all · both widths |
| span | MHT : | mono 10px/16px 400 #93a0b0 uppercase | all · both widths |
| span | PROJECT : | mono 10px/16px 400 #93a0b0 uppercase | all · both widths |
| span | UNTITLED | mono 10px/16px 400 #c8d1dd uppercase | all · both widths |
| span | LOCATION : | mono 10px/16px 400 #93a0b0 uppercase | all · both widths |
| span | — | mono 10px/16px 400 #c8d1dd uppercase | all · both widths |
| span | SCALE : | mono 10px/16px 400 #93a0b0 uppercase | all · both widths |
| span | AS NOTED | mono 10px/16px 400 #c8d1dd uppercase | all · both widths |
| span | S-630-1 | mono 10px/16px 400 #c8d1dd uppercase | S3 S5 S7 · both widths |
| span.check-list-lbl (rule 50–55: not in the component) | — see the audit trail below for details | sans 14px/22.4px 400 #ffffff none | S5 S7 · both widths |
| span.check-list-lbl (rule 50–55: not in the component) | — known capability gap; see the audit trail below | sans 14px/22.4px 400 #ffffff none | S5 S7 · both widths |
| span.check-list-src (rule 50–55: not in the component) | CDOT S-630-1 | mono 10px/16px 400 #93a0b0 uppercase | S5 S7 · both widths |
| span.check-list-src (rule 50–55: not in the component) | MANUAL HANDLING | mono 10px/16px 400 #93a0b0 uppercase | S5 S7 · both widths |
| span.disclosure-caret (rule 50–55: not in the component) | ▸ | sans 13px/20.8px 400 #c8d1dd none | S5 S7 · both widths |
| span.font-mono | ↓ | mono 10px/16px 400 #c8d1dd uppercase | S5 S7 · both widths |
| span.ny-result.tr-step | APPLIED | mono 10px/16px 400 #93a0b0 uppercase | S5 S7 · both widths |
| span.ny-result.tr-step | FAIL | mono 10px/16px 400 #93a0b0 uppercase | S5 S7 · both widths |
| span.sugg-glyph | ⌁ | mono 11.5px/18.4px 400 #c8d1dd none | S3 · both widths |
| strong (rule 50–55: not in the component) | 1 compliance check failed | sans 14px/22.4px 700 #ffffff none | S5 S7 · both widths |
| strong (rule 50–55: not in the component) | 1 V1 limitation | sans 14px/22.4px 700 #ffffff none | S5 S7 · both widths |

## Fix plan — grouped by cause, one commit per group

Nothing below is built. Each group is one commit on one branch, in this order. The earlier
groups move the most pixels per line changed, and every later group is measured against the
earlier ones. After the last commit: a before/after screenshot pair per state (S1, S2, S3, S5,
S7) at both widths, plus a re-run of this rig with its delta count, both committed beside this
file.

| commit | cause | what it changes | rows it closes | rule 5: what moves on screen |
|---|---|---|---|---|
| **F1 · the base** | C | `.workbench` gets rule 20's base (13 px / 1.5, #c8d1dd, Inter), so nothing inherits the body's 16 px paper theme. A `.sym` treatment (mono 12.5 / 1, `font-variant-emoji: text`) goes on every symbol class (`a-sym`, `ny-glyph`, `disc-glyph`, `status-glyph`, `sw-glyph`, `ck`), and rule 17's glyph set is used: ○→◌, ✕→×, ℹ→i. Rule 18's fixed hues: ▲ never orange, disclosure glyphs coloured by glyph. | all of group C, plus the glyph rows in A and B | every unstyled text shrinks 16 → 13 px; symbols shrink to 12.5 px; three glyphs change character |
| **F2 · the type roles** | A | `type-roles.ts` and its four CSS blocks move to rules 3–6 (sizes, line-heights, tracking, colours; no CSS uppercase on the step index; no underline on provenance). The provenance family (`sc-*`, `fmt`, `honesty`, `sugg-*`, card captions) follows the role, not its own sizes. `ny-body` moves to rule 9 (13.5 / 1.5 / #eaf0f7), `ny-cite` to rule 11, counts to rules 73 / 88. **Needs Q1.** | rows 1–22 and the provenance rows in B | every label, index and provenance line on every screen; the dotted underline disappears from every provenance line |
| **F3 · palette and column** | B | fact line, field and nav ground `#1b2838` → `--panel2 #16232f`. The column goes to 880 px with 26/40/0 padding (rule 24), and to 16/14 at 380 (rule 160). Rule 27's results gaps. | palette rows; rows for rules 24 and 27 | the whole column narrows by 220 px at 1440; every surface's ground darkens one step |
| **F4 · chrome removals** | D | X1 sheet-meta row, X5 caption, X8 heading, X9 result tags, X10 panel strings / header row, X4 empty nav cell and citation placement. Q2 items (H1, eyebrow, brackets, `v0.4` / `DEMO`) only if ruled. | X1, X4 (part), X5, X8, X9, X10 | the page starts 70–110 px higher; the nav loses its empty cell |
| **F5 · the verdict strip** | B | rules 50–53: mono 11 px .14em uppercase word, 1 px per-variant border and solid ground (none / ready / flag / bad), padding 13 16, gap 12; pill mono 9.5 / 500 / .14em, padding 6 10, 1 px border. X7's disclosure only as ruled (Q4). | strip rows (rules 50–53) | the strip's typography and colours change in every state; its reserved height is kept (rule 35 / #250) |
| **F6 · controls** | A + B | primary text `#0c1622` and 15.5 px (rule 130); Generate XL not uppercased and grey only when disabled (rule 131); `.act` at 9.5 px with on / disabled treatments (rule 133); ghost download buttons at 44 px Inter 500 13 px (rule 132); flat toggle chips in the field-label role (rule 135); WHERE confirm's 14 px margin (rule 115); the Generate reason line in provenance role, not red uppercase (rule 116 / #260's speaker stays, only its style changes); draft notice (rule 29, X12). | primary / Generate / action / card / chip rows | every button's text colour; the Generate button reads "Generate plan", not "GENERATE PLAN" |
| **F7 · S7's layout** | C | rule 121's body grid (240 px │ panel, gap 26); panel shell #0f1c29 with a #34a9e8 border (rule 90); rows at 1fr / 92 / 22 / 92, gap 10, padding 10 16 (rule 92); was / now in mono 12.5 (rule 93); status row padding 11 16, min-height 44 (rule 95.4); the footer with DISCARD as a ghost and APPLY at 200 × 44 (rule 94); the revising band's #34a9e8 border (rule 61). 380 per rule 95.15. | S7 rows | S7 goes from one stacked column to field │ panel; the panel's figures shrink 16 → 12.5 px mono |
| **F8 · 380 arc items** | B | rule 167 (NEEDS YOU items 18 / 1fr, citation into provenance, actions on their own row), rule 168 (the zip primary replaces the cards), rule 169 (no geometry cell), rule 166 fact-line row gap. **Only if Q7 puts them in this pass.** | rows for rules 74 / 166–169 @380 | at 380 NEEDS YOU stops wrapping one word per line; the four cards collapse to one button |

Every commit runs the type census (`lib/design/type-census.test.ts`) and the hit-target
contract (`GeneratorShell.hit-targets.test.tsx`), which will move with F1, F2 and F6 and are
updated in the same commits. The prod leg re-runs this rig after the ship.

## Checkpoint — what I need ruled before building

- **Q1 · the four label roles.** `type-roles.ts` carries #226's GO-ruled values (section
  #ffffff and .20em, step .14em and uppercased, field 12 px #c8d1dd, provenance 10 px with a
  dotted underline). Part 2 rules 3–6 state different values. **Recommend: Part 2 supersedes
  #226 for all four**, recorded as such, because Direction A is the design authority and these
  four classes are most of the "font all over the place". Alternative: keep #226's underline
  only, if it was ruled as a channel. Part 2 is silent on decoration, and I read silence plus
  rule 6's "never bold, never uppercase" as no underline.
- **Q2 · the page head and the frame.** The `02 · GENERATOR` eyebrow, the H1, the orange corner
  brackets and the nav's `v0.4` / `DEMO` tags have no §8 line. **Recommend: remove the eyebrow,
  H1 and brackets** (§1.2's order and rule 25 leave no slot for them), and **keep `DEMO`
  as a nav item in rule 22's colours** until launch prep decides it. `v0.4` goes.
- **Q3 · the corridor-extent block (X6).** It is the zone lengths' only pre-generate home until
  the aerial exists. **Recommend: keep the rows, drop the block chrome** (header and top rule),
  printing them as provenance lines under the extent field, the field they describe.
  Alternative: move them to S3's rule-116 corridor strip slot under the WHERE fact line.
- **Q4 · the strip's check list (X7), the "SITE CONDITIONS — SCANNED" sub-header (X13) and
  which file count survives (X8).** **Recommend:** remove the strip disclosure (its content is
  NEEDS YOU's ▲ / ⚠ rows plus the reference disclosure, both on screen); keep the sub-header
  (§8.5 "kept whole"); keep the count on the download row, not under the zip button.
- **Q5 · the `⌁` glyph** in the suggestion rows. It is outside rule 17's set. **Recommend: `i`**
  (#34a9e8, rule 18's information symbol).
- **Q6 · the draft notice's wording.** Rule 29's two sentences are verbatim and differ from
  the built text ("licensed PE" vs "licensed Professional Engineer", one sentence split
  differently). **Recommend: rule 29's words**, after checking the PDF deliverable's
  own draft line is a different string (#198 byte-identity only binds surfaces that share
  a producer).
- **Q7 · the 380 items (F8).** Rules 166–169 are #281 Phase 4's arc. The NEEDS YOU wrap at 380
  is a readability defect, not a refinement. **Recommend: F8 in this pass for rule 167 only**
  (the wrap), and rules 168 / 169 in Phase 4 as planned.

**Build order after the ruling:** F1 → F2 → F3 → F4 → F5 → F6 → F7 (→ F8), one commit each,
diff-verifier after each, then the before/after pairs.
