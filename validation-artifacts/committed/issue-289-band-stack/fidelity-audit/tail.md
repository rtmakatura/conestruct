
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
