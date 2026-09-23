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
1,221 text nodes. The pin is E Colfax (39.74020, −104.95600), the arc's standing test spot.

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
| X11 | **Street-class segmented control** (Local / Collector / Arterial) and the two **suggestion panels** in the road-type and jurisdiction cells (the `⌁` glyph, bold names, two "boundary data is approximate" paragraphs) | S3 | §8.21 moves jurisdiction and road type into WHAT "as two fields with their provenance lines". The suggestion records are ruled (#201 / #227: they live in the cell), but Part 2 has no component for a segmented control or a suggestion panel, so their type is unspecified (table rows 63–67). The `⌁` glyph is outside rule 17's set. | style to rules 6 / 133 / 135; the `⌁` glyph is **Q5** |
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
